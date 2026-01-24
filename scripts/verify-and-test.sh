#!/bin/bash

# =============================================================================
# Multi-Currency Accounting - Docker 验证与测试脚本
# =============================================================================
# 用法: ./scripts/verify-and-test.sh
# 功能:
#   1. 构建并启动 Docker 测试环境
#   2. 运行 E2E 测试
#   3. 验证结果并清理
# =============================================================================

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }

# 项目根目录
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# Docker Compose 文件
DOCKER_COMPOSE_FILE="docker-compose.test.yml"

# 测试超时时间（秒）
TEST_TIMEOUT=300

# =============================================================================
# 步骤 1: 检查前置条件
# =============================================================================
check_prerequisites() {
    log_info "检查前置条件..."

    # 检查 Docker 是否安装
    if ! command -v docker &> /dev/null; then
        log_error "Docker 未安装，请先安装 Docker"
        exit 1
    fi

    # 检查 Docker 是否运行
    if ! docker info &> /dev/null; then
        log_error "Docker 服务未运行，请启动 Docker"
        exit 1
    fi

    # 检查 Docker Compose 文件是否存在
    if [ ! -f "$DOCKER_COMPOSE_FILE" ]; then
        log_error "找不到 $DOCKER_COMPOSE_FILE 文件"
        exit 1
    fi

    log_success "前置条件检查通过"
}

# =============================================================================
# 步骤 2: 停止现有容器
# =============================================================================
stop_existing_containers() {
    log_info "停止现有测试容器..."

    # 停止并删除容器（保留镜像以加快构建）
    docker compose -f "$DOCKER_COMPOSE_FILE" down --remove-orphans 2>/dev/null || true

    log_success "现有容器已清理"
}

# =============================================================================
# 步骤 3: 构建并启动 Docker 环境
# =============================================================================
start_docker_environment() {
    log_info "构建并启动 Docker 测试环境..."

    # 构建镜像（使用缓存加速）
    log_info "构建 Docker 镜像..."
    docker compose -f "$DOCKER_COMPOSE_FILE" build --parallel

    # 启动服务
    log_info "启动服务..."
    docker compose -f "$DOCKER_COMPOSE_FILE" up -d

    # 等待服务健康检查
    log_info "等待服务启动..."
    local max_attempts=30
    local attempt=0

    while [ $attempt -lt $max_attempts ]; do
        # 检查 PostgreSQL 是否就绪
        if docker exec mca_postgres_test pg_isready -U test -d test_db &>/dev/null; then
            # 检查后端是否响应
            if curl -s http://localhost:8067/api/health &>/dev/null || \
               curl -s http://localhost:8067/api/docs &>/dev/null; then
                break
            fi
        fi

        attempt=$((attempt + 1))
        log_info "等待服务就绪... ($attempt/$max_attempts)"
        sleep 2
    done

    if [ $attempt -eq $max_attempts ]; then
        log_error "服务启动超时"
        show_logs
        exit 1
    fi

    log_success "Docker 环境启动成功"
}

# =============================================================================
# 步骤 4: 运行 E2E 测试
# =============================================================================
run_e2e_tests() {
    log_info "运行 E2E 测试..."

    # 记录开始时间
    local start_time=$(date +%s)

    # 运行测试（设置超时）
    if timeout $TEST_TIMEOUT npm run test:e2e; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        log_success "E2E 测试通过！耗时: ${duration}秒"
        return 0
    else
        local exit_code=$?
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))

        log_error "E2E 测试失败！耗时: ${duration}秒，退出码: $exit_code"
        show_logs
        return 1
    fi
}

# =============================================================================
# 步骤 5: 显示日志（失败时调用）
# =============================================================================
show_logs() {
    log_warning "显示 Docker 日志..."
    echo ""
    echo "=========================================="
    echo "Backend 日志:"
    echo "=========================================="
    docker compose -f "$DOCKER_COMPOSE_FILE" logs backend_test | tail -50

    echo ""
    echo "=========================================="
    echo "Frontend 日志:"
    echo "=========================================="
    docker compose -f "$DOCKER_COMPOSE_FILE" logs frontend_test | tail -50

    echo ""
    echo "=========================================="
    echo "PostgreSQL 日志:"
    echo "=========================================="
    docker compose -f "$DOCKER_COMPOSE_FILE" logs postgres_test | tail -20
}

# =============================================================================
# 步骤 6: 清理
# =============================================================================
cleanup() {
    log_info "清理 Docker 环境..."

    # 停止容器
    docker compose -f "$DOCKER_COMPOSE_FILE" down --remove-orphans

    log_success "清理完成"
}

# =============================================================================
# 主函数
# =============================================================================
main() {
    echo ""
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║         Docker 验证与测试脚本                              ║"
    echo "║  Multi-Currency Accounting                                ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo ""

    # 捕获错误信号
    trap 'log_error "脚本被中断"; cleanup; exit 1' INT TERM

    # 执行步骤
    check_prerequisites
    stop_existing_containers
    start_docker_environment

    if run_e2e_tests; then
        log_success "🎉 验证完成！所有测试通过"
        cleanup
        exit 0
    else
        log_error "💥 验证失败！请检查日志并修复问题"
        cleanup
        exit 1
    fi
}

# 运行主函数
main "$@"
