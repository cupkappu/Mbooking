-- =====================================================
-- Rate Engine Refactoring - Database Migration
-- Version: 1.0
-- Date: 2026-01-27
-- =====================================================

-- 创建 rate_history 表 (历史记录，用于资产增长趋势)
-- =====================================================
CREATE TABLE IF NOT EXISTS rate_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_currency VARCHAR(3) NOT NULL,
    to_currency VARCHAR(3) NOT NULL,
    rate DECIMAL(20, 10) NOT NULL,
    date DATE NOT NULL,
    provider_id VARCHAR(36) NOT NULL,
    is_inferred BOOLEAN DEFAULT FALSE,
    hops INTEGER,
    path TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_rate_history_currencies_date 
ON rate_history(from_currency, to_currency, date);

CREATE INDEX IF NOT EXISTS idx_rate_history_date 
ON rate_history(date);

CREATE INDEX IF NOT EXISTS idx_rate_history_provider 
ON rate_history(provider_id);


-- 创建 rate_stats 表 (监控统计)
-- =====================================================
CREATE TABLE IF NOT EXISTS rate_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    hour INTEGER NOT NULL,
    total_queries INTEGER DEFAULT 0,
    cache_hits INTEGER DEFAULT 0,
    cache_misses INTEGER DEFAULT 0,
    cache_hit_rate DECIMAL(5, 2) DEFAULT 0,
    provider_calls INTEGER DEFAULT 0,
    provider_failures INTEGER DEFAULT 0,
    avg_latency_ms DECIMAL(10, 2) DEFAULT 0,
    inferred_rates INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 创建唯一索引
CREATE UNIQUE INDEX IF NOT EXISTS idx_rate_stats_date_hour 
ON rate_stats(date, hour);

-- 创建日期索引
CREATE INDEX IF NOT EXISTS idx_rate_stats_date 
ON rate_stats(date);


-- 迁移说明
-- =====================================================
-- 
-- 这个迁移添加了两个新表:
-- 1. rate_history: 永久保存所有汇率查询历史，用于:
--    - 资产增长趋势跟踪
--    - 历史汇率查询
--    - 审计追踪
--
-- 2. rate_stats: 保存每小时监控统计，用于:
--    - 缓存命中率监控
--    - Provider 成功率监控
--    - 性能分析
--    - 保留 30 天后自动清理
--
-- 回滚脚本 (down.sql):
-- =====================================================
-- DROP TABLE IF EXISTS rate_stats;
-- DROP TABLE IF EXISTS rate_history;
-- =====================================================
