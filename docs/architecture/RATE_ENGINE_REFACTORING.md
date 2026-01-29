# Rate Engine 架构重构设计

**版本:** v1.1
**日期:** 2026-01-27
**状态:** 设计稿，待评审

---

## 更新日志

| 版本 | 日期 | 更新内容 |
|------|------|---------|
| v1.0 | 2026-01-27 | 初始设计稿 |
| v1.1 | 2026-01-27 | Redis 可选（单实例内存/多实例 Redis）；单图设计；历史汇率持久化；监控指标需求 |

---

## 1. 问题分析

### 1.1 当前问题

| 问题 | 影响 | 位置 |
|------|------|------|
| 单文件过大 | 1300+ 行，难以维护 | `rate-graph-engine.ts` |
| 职责混合 | 图算法 + 缓存 + API 调用 + 存储混在一起 | 同上 |
| 缓存复杂 | 3 层缓存（graph, path, provider），难以理解 | 同上 |
| 插件接口过重 | 需要实现 5+ 方法，增加开发成本 | `REQUIREMENTS_PLUGIN_SYSTEM.md` |
| 缓存策略不明确 | 没有明确的 TTL 策略 | 当前实现 |

### 1.2 核心痛点

```
rate-graph-engine.ts (1366 行)
├── 图数据结构 + Dijkstra 算法 (~200 行)
├── PriorityQueue 实现 (~80 行)
├── 缓存管理 (3 层缓存) (~150 行)
├── REST API 调用 (~100 行)
├── JS 插件加载器 (~80 行)
├── 批量查询 (~100 行)
├── 历史记录 + 趋势分析 (~150 行)
├── 定时任务 (~80 行)
├── 手动汇率 (~50 行)
└── 其他工具方法 (~350 行)
```

---

## 2. 设计目标

### 2.1 功能目标

- ✅ 保留图算法（Dijkstra 路径查找）
- ✅ 支持多 Provider fallback
- ✅ 简化的插件接口（5+ 方法 → 1-2 方法）
- ✅ 明确的 2 小时缓存策略
- ✅ Redis 可选（单实例内存/多实例 Redis）
- ✅ 单图设计（不按 Provider 拆分）
- ✅ 历史汇率持久化（用于资产增长趋势跟踪）
- ✅ 监控指标（缓存命中率、Provider 成功率）
- ✅ 支持 REST API Provider
- ✅ 支持 JS 插件 Provider
- ✅ 手动汇率支持

### 2.2 非功能目标

- **可维护性:** 每个文件 < 300 行
- **可测试性:** 单元测试覆盖 > 80%
- **可扩展性:** 新增 Provider 类型只需实现接口
- **可观测性:** 缓存命中率、API 调用统计、Provider 成功率

### 2.3 图算法的核心价值

图算法设计的根本目的是**连接不同 Provider**：

```
典型 Provider 组合:
┌─────────────────────────────────────────────────────────────────────┐
│ Provider A: 法币汇率 (USD, EUR, HKD, JPY, CNY...)                    │
│ Provider B: 加密货币 (BTC, ETH, USDT...)                             │
│ Provider C: 大宗商品 (GOLD, SILVER...)                               │
│                                                                     │
│ 图算法自动发现换算路径:                                               │
│                                                                     │
│   BTC ──Provider B──► USD ──Provider A──► EUR                      │
│   (BTC→USD)         (USD→EUR)                                       │
│                                                                     │
│   结果: BTC → EUR = BTC/USD rate × USD/EUR rate                     │
│   无需手动配置任何汇率链，自动发现最优路径！                          │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. 架构设计

### 3.1 整体架构

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          Rate Engine 架构                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      Rate Service (API 层)                      │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │   │
│  │  │ getRate()   │  │  convert()  │  │  getRateHistory()      │ │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                    │
│                                    ▼                                    │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    Rate Fetch Service (获取层)                   │   │
│  │  ┌───────────────────────────────────────────────────────────┐  │   │
│  │  │  1. 检查缓存 (Memory 或 Redis)                             │  │   │
│  │  │  2. 缓存未命中 → 调用 Providers (按优先级)                  │  │   │
│  │  │  3. 存储到数据库 (exchange_rates)                          │  │   │
│  │  │  4. 更新缓存 (2h TTL)                                      │  │   │
│  │  │  5. 构建图 + 路径查找 (Dijkstra)                           │  │   │
│  │  │  6. 写入历史记录 (rate_history)                            │  │   │
│  │  │  7. 更新监控指标                                           │  │   │
│  │  └───────────────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                    │
│                                    ▼                                    │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    Rate Cache Service (缓存层)                   │   │
│  │  ┌───────────────────────────────────────────────────────────┐  │   │
│  │  │  存储实现:                                                   │  │   │
│  │  │  - 单实例: In-Memory (Map)                                  │  │   │
│  │  │  - 多实例: Redis (可配置)                                   │  │   │
│  │  │                                                             │  │   │
│  │  │  缓存键: rate:${from}:${to}:${date}                        │  │   │
│  │  │  TTL: 2 小时 (120 分钟)                                     │  │   │
│  │  │  策略: Lazy Expiration (过期后下次查询时刷新)               │  │   │
│  │  └───────────────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                    │
│                                    ▼                                    │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                  Rate Provider Interface (Provider 层)           │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │   │
│  │  │  REST API   │  │  JS Plugin  │  │  Manual (内置)          │ │   │
│  │  │  Provider   │  │  Provider   │  │  Provider              │ │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────────────┘ │   │
│  │                                                                │   │
│  │  特点:                                                          │   │
│  │  - 不同 Provider 提供不同领域的汇率                              │   │
│  │  - 图算法自动连接不同 Provider 的汇率                            │   │
│  │  - 支持 fallback: Provider A 失败 → Provider B                  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                    │
│                                    ▼                                    │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    Rate Storage (存储层)                         │   │
│  │  ┌───────────────────────────────────────────────────────────┐  │   │
│  │  │  表结构:                                                    │  │   │
│  │  │  - exchange_rates: 缓存数据 (可过期删除)                    │  │   │
│  │  │  - rate_history: 历史记录 (永久保留，用于资产趋势)          │  │   │
│  │  │  - providers: Provider 配置                                │  │   │
│  │  │  - rate_stats: 监控统计 (TTL 24h)                          │  │   │
│  │  └───────────────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────┘   |
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.2 数据流

```
用户请求: getRate("BTC", "EUR", "2026-01-27")
    │
    ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 1. RateService                                                       │
│    - 解析请求参数                                                     │
│    - 验证货币代码                                                     │
└───────────────────────────────┬─────────────────────────────────────┘
                                │ 调用
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 2. RateFetchService                                                  │
│    - 检查缓存 (Memory/Redis)                                         │
│    - 缓存命中? → 返回缓存结果                                        │
│    - 缓存未命中 → 继续                                               │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 3. Provider Fallback                                                 │
│    - 按优先级尝试 Providers: REST → JS Plugin → Manual              │
│    - 记录 Provider 成功率 (用于监控)                                 │
│    - 任意 Provider 成功 → 继续                                       │
│    - 全部失败 → 返回错误                                             │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 4. RateStorage                                                       │
│    - 保存汇率到 exchange_rates (带 TTL)                              │
│    - 写入历史记录到 rate_history (永久)                               │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 5. RateCache                                                         │
│    - 更新缓存 (2h TTL)                                               │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 6. RateGraphEngine                                                   │
│    - 构建图: 节点=货币, 边=汇率                                      │
│    - 单图设计: 所有 Providers 的汇率合并到同一张图                    │
│    - Dijkstra 查找最优路径                                           │
│    - BTC→EUR 没有直接汇率? → 找路径: BTC→USD→EUR                    │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 7. 监控指标更新                                                       │
│    - 缓存命中率                                                      │
│    - Provider 调用次数                                               │
│    - Provider 失败次数                                               │
│    - 查询延迟                                                        │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 8. 返回结果                                                           │
│    - { rate, path, hops, providerId, isInferred, ... }              │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 4. 模块设计

### 4.1 文件结构

```
backend/src/rates/
├── interfaces/
│   └── rate-provider.interface.ts    # Provider 接口定义
│
├── providers/
│   ├── rate-rest.provider.ts         # REST API Provider 实现
│   ├── rate-js.plugin.ts             # JS 插件 Provider 实现
│   └── rate-manual.provider.ts       # 手动汇率 Provider
│
├── services/
│   ├── rate-cache.service.ts         # 缓存服务 (Memory/Redis 可选)
│   ├── rate-storage.service.ts       # 数据库存储服务
│   ├── rate-fetch.service.ts         # 统一获取服务
│   ├── rate-graph.engine.ts          # 图算法引擎
│   ├── rate-monitor.service.ts       # 监控指标服务
│   └── rate.service.ts               # 对外 API 服务
│
├── dto/
│   ├── rate.dto.ts                   # DTO 定义
│   └── provider.dto.ts               # Provider DTO
│
├── entities/
│   ├── exchange-rate.entity.ts       # 汇率实体
│   ├── provider.entity.ts            # Provider 实体
│   ├── rate-history.entity.ts        # 历史记录实体 (新增)
│   └── rate-stats.entity.ts          # 监控统计实体 (新增)
│
└── rates.module.ts                   # NestJS 模块
```

### 4.2 模块职责

| 文件 | 职责 | 依赖 | 行数估算 |
|------|------|------|---------|
| `rate-provider.interface.ts` | 定义 Provider 接口 | 无 | ~50 |
| `rate-rest.provider.ts` | REST API Provider | 接口 | ~80 |
| `rate-js.plugin.ts` | JS 插件加载 | 接口 | ~80 |
| `rate-manual.provider.ts` | 手动汇率 | 接口 | ~50 |
| `rate-cache.service.ts` | 缓存服务 (Memory/Redis) | 配置 | ~120 |
| `rate-storage.service.ts` | 数据库读写 | TypeORM | ~120 |
| `rate-fetch.service.ts` | 获取逻辑 | Cache, Storage, Providers | ~150 |
| `rate-graph.engine.ts` | Dijkstra + 路径 | Fetch Service | ~300 |
| `rate-monitor.service.ts` | 监控指标 | 统计 | ~100 |
| `rate.service.ts` | 对外 API | Fetch Service | ~100 |
| **总计** | | | **~1150 行** |

### 4.3 新增模块详细设计

#### 4.3.1 Rate History Entity (历史记录)

```typescript
// entities/rate-history.entity.ts

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('rate_history')
@Index(['fromCurrency', 'toCurrency', 'date'])
export class RateHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 3 })
  fromCurrency: string;

  @Column({ length: 3 })
  toCurrency: string;

  @Column({ type: 'decimal', precision: 20, scale: 10 })
  rate: number;

  @Column({ type: 'date' })
  date: Date;

  @Column({ length: 36 })
  providerId: string;

  @Column({ type: 'boolean', default: false })
  isInferred: boolean;  // 是否通过图推断

  @Column({ type: 'int', nullable: true })
  hops: number;  // 跳数 (推断时有效)

  @Column({ type: 'simple-array', nullable: true })
  path: string[];  // 路径 (推断时有效)

  @CreateDateColumn()
  createdAt: Date;
}
```

#### 4.3.2 Rate Stats Entity (监控统计)

```typescript
// entities/rate-stats.entity.ts

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('rate_stats')
@Index(['date', 'hour'], { unique: true })
export class RateStats {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'date' })
  date: Date;

  @Column({ type: 'int' })
  hour: number;  // 0-23

  @Column({ type: 'int', default: 0 })
  totalQueries: number;  // 总查询数

  @Column({ type: 'int', default: 0 })
  cacheHits: number;  // 缓存命中

  @Column({ type: 'int', default: 0 })
  cacheMisses: number;  // 缓存未命中

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  cacheHitRate: number;  // 缓存命中率 (%)

  @Column({ type: 'int', default: 0 })
  providerCalls: number;  // Provider 调用次数

  @Column({ type: 'int', default: 0 })
  providerFailures: number;  // Provider 失败次数

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  avgLatencyMs: number;  // 平均延迟 (ms)

  @Column({ type: 'int', default: 0 })
  inferredRates: number;  // 通过图推断的次数

  @CreateDateColumn()
  createdAt: Date;
}
```

#### 4.3.3 Rate Monitor Service (监控服务)

```typescript
// services/rate-monitor.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RateStats } from '../entities/rate-stats.entity';

interface StatsSnapshot {
  totalQueries: number;
  cacheHits: number;
  cacheMisses: number;
  providerCalls: number;
  providerFailures: number;
  inferredRates: number;
  latencySum: number;
}

@Injectable()
export class RateMonitorService {
  private readonly logger = new Logger(RateMonitorService.name);
  
  // 内存中的实时统计 (按小时聚合)
  private currentHour: StatsSnapshot = {
    totalQueries: 0,
    cacheHits: 0,
    cacheMisses: 0,
    providerCalls: 0,
    providerFailures: 0,
    inferredRates: 0,
    latencySum: 0,
  };

  constructor(
    @InjectRepository(RateStats)
    private statsRepository: Repository<RateStats>,
  ) {
    // 每小时持久化一次统计
    setInterval(() => this.flushStats(), 60 * 60 * 1000);
  }

  /**
   * 记录查询
   */
  recordQuery(options: {
    cacheHit: boolean;
    latencyMs: number;
    providerCalled: boolean;
    providerFailed: boolean;
    inferred: boolean;
  }): void {
    const { cacheHit, latencyMs, providerCalled, providerFailed, inferred } = options;

    this.currentHour.totalQueries++;
    this.currentHour.latencySum += latencyMs;

    if (cacheHit) {
      this.currentHour.cacheHits++;
    } else {
      this.currentHour.cacheMisses++;
    }

    if (providerCalled) {
      this.currentHour.providerCalls++;
    }

    if (providerFailed) {
      this.currentHour.providerFailures++;
    }

    if (inferred) {
      this.currentHour.inferredRates++;
    }
  }

  /**
   * 获取当前统计
   */
  getCurrentStats(): {
    cacheHitRate: number;
    providerSuccessRate: number;
    avgLatency: number;
  } {
    const { totalQueries, cacheHits, providerCalls, providerFailures, latencySum } = this.currentHour;

    const cacheHitRate = totalQueries > 0 
      ? (cacheHits / totalQueries * 100) 
      : 0;

    const providerSuccessRate = providerCalls > 0 
      ? ((providerCalls - providerFailures) / providerCalls * 100) 
      : 100;

    const avgLatency = totalQueries > 0 
      ? (latencySum / totalQueries) 
      : 0;

    return {
      cacheHitRate: Math.round(cacheHitRate * 100) / 100,
      providerSuccessRate: Math.round(providerSuccessRate * 100) / 100,
      avgLatency: Math.round(avgLatency * 100) / 100,
    };
  }

  /**
   * 获取历史统计
   */
  async getStatsHistory(
    fromDate: Date,
    toDate: Date
  ): Promise<RateStats[]> {
    return this.statsRepository.find({
      where: {
        date: fromDate,  // 注意: 这是简化写法，实际需要 BETWEEN 查询
      },
      order: { createdAt: 'DESC' },
      take: 24 * 7,  // 最多 7 天的数据
    });
  }

  /**
   * 持久化统计到数据库
   */
  private async flushStats(): Promise<void> {
    const now = new Date();
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const hour = now.getHours();

    const { cacheHits, cacheMisses, providerCalls, providerFailures, inferredRates, latencySum } = this.currentHour;
    const totalQueries = cacheHits + cacheMisses;

    const cacheHitRate = totalQueries > 0 
      ? (cacheHits / totalQueries * 100) 
      : 0;

    const stats = this.statsRepository.create({
      date,
      hour,
      totalQueries,
      cacheHits,
      cacheMisses,
      cacheHitRate,
      providerCalls,
      providerFailures,
      avgLatencyMs: totalQueries > 0 ? (latencySum / totalQueries) : 0,
      inferredRates,
    });

    await this.statsRepository.save(stats);

    // 重置当前小时统计
    this.currentHour = {
      totalQueries: 0,
      cacheHits: 0,
      cacheMisses: 0,
      providerCalls: 0,
      providerFailures: 0,
      inferredRates: 0,
      latencySum: 0,
    };

    this.logger.log(`Rate stats flushed to database`);
  }
}
```

---

## 5. 缓存策略

### 5.1 存储选择

| 场景 | 推荐方案 | 配置方式 |
|------|---------|---------|
| 单实例部署 | In-Memory (Map) | 默认，无需额外配置 |
| 多实例部署 | Redis | 设置 `REDIS_URL` 环境变量 |
| 开发环境 | In-Memory | 默认 |
| 生产环境 | Redis | 推荐 |

```typescript
// rate-cache.service.ts 配置示例

interface CacheConfig {
  type: 'memory' | 'redis';
  ttlMs: number;  // 默认 2 小时
}

const config: CacheConfig = {
  type: process.env.REDIS_URL ? 'redis' : 'memory',
  ttlMs: 2 * 60 * 60 * 1000,  // 2 小时
};
```

### 5.2 缓存键设计

```
汇率缓存: rate:${from}:${to}:${date}
         示例: rate:USD:EUR:2026-01-27
         
Provider 缓存: provider:${providerId}
              示例: provider:ecb-provider
```

### 5.3 TTL 策略

| 缓存类型 | TTL | 刷新策略 | 持久化 |
|---------|-----|---------|--------|
| 汇率缓存 | 2 小时 | Lazy Expiration | exchange_rates 表 |
| Provider 缓存 | 10 分钟 | Lazy Expiration | 数据库 |
| 图缓存 | 5 分钟 | Lazy Expiration | 内存 |
| 历史记录 | 永久 | - | rate_history 表 |
| 监控统计 | 24 小时 | 定时持久化 | rate_stats 表 |

### 5.4 缓存流程

```
请求 getRate("USD", "EUR", "2026-01-27")
              │
              ▼
     检查缓存是否存在?
              │
       ┌──────┴──────┐
       │             │
      是            否
       │             │
       ▼             ▼
  返回缓存      调用 Provider
  结果         获取汇率
       │             │
       │             ▼
       │       存储到 exchange_rates
       │             │
       │             ▼
       │       更新缓存 (2h)
       │             │
       └──────┬──────┘
              ▼
       构建图 + 路径查找
              │
              ▼
       写入 rate_history
              │
              ▼
       更新监控指标
              │
              ▼
       返回结果
```

---

## 6. 监控指标

### 6.1 指标列表

| 指标 | 类型 | 描述 | 告警阈值 |
|------|------|------|---------|
| cacheHitRate | 百分比 | 缓存命中率 | < 70% |
| providerSuccessRate | 百分比 | Provider 成功率 | < 90% |
| avgLatency | ms | 平均查询延迟 | > 1000ms |
| totalQueries | 计数 | 总查询数 | - |
| providerFailures | 计数 | Provider 失败次数 | - |
| inferredRates | 计数 | 图推断次数 | - |

### 6.2 API 端点

```typescript
// rate.controller.ts

@Controller('rates')
export class RateController {
  constructor(
    private fetchService: RateFetchService,
    private monitorService: RateMonitorService,
  ) {}

  /**
   * GET /rates/stats/current
   * 获取当前小时的监控统计
   */
  @Get('stats/current')
  getCurrentStats() {
    return this.monitorService.getCurrentStats();
  }

  /**
   * GET /rates/stats/history?from=2026-01-20&to=2026-01-27
   * 获取历史监控统计
   */
  @Get('stats/history')
  async getStatsHistory(
    @Query('from') fromDate: string,
    @Query('to') toDate: string,
  ) {
    return this.monitorService.getStatsHistory(
      new Date(fromDate),
      new Date(toDate)
    );
  }
}
```

### 6.3 Grafana 面板建议

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Rate Engine 监控面板                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐     │
│  │  缓存命中率      │  │  Provider 成功率 │  │  平均延迟       │     │
│  │     85.3%       │  │     98.2%       │  │    45.6 ms     │     │
│  │   [█████████-]  │  │  [██████████]   │  │   [███████-]   │     │
│  │     ✓ 正常      │  │     ✓ 正常      │  │     ✓ 正常      │     │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘     │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  查询量趋势 (24h)                                            │   │
│  │                                                              │   │
│  │  1,000 │                    ╱╲                               │   │
│  │    500 │              ╱╲    ╱  ╲                             │   │
│  │      0 │──────╱╲────╱──╲──╱────╲──────────────────────────  │   │
│  │        │ 00:00  06:00  12:00  18:00  24:00                   │   │
│  │        └────────────────────────────────────────────────────│   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Provider 调用分布                                           │   │
│  │                                                              │   │
│  │  REST API   ████████████████████░░░░░░░░  12,345 (75%)     │   │
│  │  JS Plugin  ██████░░░░░░░░░░░░░░░░░░░░░░░  3,456 (21%)     │   │
│  │  Manual     █░░░░░░░░░░░░░░░░░░░░░░░░░░░░░    567 (3%)      │   │
│  │        └────────────────────────────────────────────────────│   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 7. 接口设计

### 7.1 Rate Provider 接口

```typescript
// interfaces/rate-provider.interface.ts

/**
 * 简化后的 Rate Provider 接口
 * 
 * 设计原则:
 * - 最少方法: 只需要实现 fetchRates 和 fetchHistorical
 * - 可选方法: testConnection 和 getHealthStatus 不强制
 * - 批量优先: 设计为批量获取，减少 API 调用
 */
export interface RateProvider {
  /** Provider 唯一标识 */
  readonly id: string;
  
  /** Provider 显示名称 */
  readonly name: string;
  
  /** 支持的货币列表 */
  readonly supportedCurrencies: string[];
  
  /** 是否支持历史汇率查询 */
  readonly supportsHistorical: boolean;
  
  /** Provider 优先级 (数字越小优先级越高) */
  readonly priority: number;

  /**
   * 获取汇率 (批量)
   * 
   * @param baseCurrency 基础货币 (如 "USD")
   * @param targetCurrencies 目标货币列表 (如 ["EUR", "GBP", "JPY"])
   * @param date 日期 (可选，默认最新)
   * @returns Map<货币对, 汇率> (如 "EUR" -> 0.92)
   * 
   * @example
   * // 获取 USD 对 EUR, GBP 的汇率
   * const rates = await provider.fetchRates("USD", ["EUR", "GBP"]);
   * // 结果: Map { "EUR" => 0.92, "GBP" => 0.79 }
   */
  fetchRates(
    baseCurrency: string,
    targetCurrencies: string[],
    options?: { date?: Date }
  ): Promise<Map<string, number>>;

  /**
   * 获取历史汇率 (可选方法)
   * 
   * @param fromCurrency 源货币
   * @param toCurrency 目标货币
   * @param date 日期
   * @returns 汇率
   */
  fetchHistoricalRate?(
    fromCurrency: string,
    toCurrency: string,
    date: Date
  ): Promise<number>;

  /**
   * 测试连接 (可选方法)
   */
  testConnection?(): Promise<{ success: boolean; message?: string }>;
}
```

### 7.2 完整 API 服务接口

```typescript
// services/rate.service.ts

export interface FetchOptions {
  from: string;
  to: string;
  date?: Date;
  providerId?: string;  // 指定 provider，不指定则按优先级尝试
  useCache?: boolean;   // 是否使用缓存 (默认 true)
}

export interface FetchResult {
  from: string;
  to: string;
  rate: number;
  providerId: string;
  timestamp: Date;
  isInferred: boolean;  // 是否通过图推断
  path?: string[];      // 路径 (如果是推断的)
  hops?: number;        // 跳数
}

export interface RateHistoryItem {
  from: string;
  to: string;
  rate: number;
  date: Date;
  providerId: string;
  isInferred: boolean;
  path?: string[];
  hops?: number;
}

@Injectable()
export class RatesService {
  constructor(
    private fetchService: RateFetchService,
    private monitorService: RateMonitorService,
  ) {}

  /**
   * GET /rates/:from/:to
   * 获取最新汇率
   */
  async getLatestRate(from: string, to: string): Promise<FetchResult> {
    return this.fetchService.getRate({ from, to });
  }

  /**
   * GET /rates/:from/:to/:date
   * 获取指定日期的汇率
   */
  async getRateAtDate(
    from: string, 
    to: string, 
    date: Date
  ): Promise<FetchResult> {
    return this.fetchService.getRate({ from, to, date });
  }

  /**
   * POST /rates/convert
   * 货币转换
   */
  async convert(
    amount: number,
    from: string,
    to: string,
    date?: Date
  ): Promise<{
    amount: number;
    converted_amount: number;
    rate: number;
    from: string;
    to: string;
    date: Date;
    path?: string[];
    hops?: number;
  }> {
    const result = await this.fetchService.getRate({ from, to, date });

    return {
      amount,
      converted_amount: amount * result.rate,
      rate: result.rate,
      from,
      to,
      date: result.timestamp,
      path: result.path,
      hops: result.hops,
    };
  }

  /**
   * GET /rates/:from/:to/history?fromDate=2026-01-01&toDate=2026-01-31
   * 获取汇率历史 (用于资产增长趋势)
   */
  async getRateHistory(
    from: string,
    to: string,
    options: {
      fromDate?: Date;
      toDate?: Date;
      limit?: number;
    }
  ): Promise<{ rates: RateHistoryItem[]; total: number }> {
    // 从 rate_history 表查询
  }

  /**
   * GET /rates/stats/current
   * 获取当前监控统计
   */
  getCurrentStats() {
    return this.monitorService.getCurrentStats();
  }

  /**
   * GET /rates/stats/history?from=2026-01-20&to=2026-01-27
   * 获取历史监控统计
   */
  async getStatsHistory(
    fromDate: Date,
    toDate: Date
  ): Promise<RateStats[]> {
    return this.monitorService.getStatsHistory(fromDate, toDate);
  }
}
```

---

## 8. 迁移计划

### 8.1 阶段一：创建 V2 模块

1. 创建 `backend/src/rates/v2/` 目录
2. 实现简化后的 Provider 接口
3. 实现 Rate Cache Service (Memory/Redis 可选)
4. 实现 Rate Storage Service
5. 实现 Rate Fetch Service
6. 实现 Rate Graph Engine (单图设计)
7. 实现 Rate Monitor Service
8. 实现 Rate Service

### 8.2 阶段二：数据库迁移

```sql
-- 创建 rate_history 表
CREATE TABLE rate_history (
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

CREATE INDEX idx_rate_history_currencies_date 
ON rate_history(from_currency, to_currency, date);

-- 创建 rate_stats 表
CREATE TABLE rate_stats (
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

CREATE UNIQUE INDEX idx_rate_stats_date_hour 
ON rate_stats(date, hour);
```

### 8.3 阶段三：切换流量

1. 新旧代码并行运行
2. 设置 Feature Flag 控制流量分配
3. 切换 10% 流量到新模块
4. 验证功能和性能
5. 逐步切换到 100%

### 8.4 阶段四：清理旧代码

1. 删除旧 `rate-graph-engine.ts`
2. 更新 `rates.module.ts`
3. 更新测试
4. 更新文档

---

## 9. 测试策略

### 9.1 单元测试

| 模块 | 测试内容 | 覆盖率目标 |
|------|---------|-----------|
| RateCacheService | 缓存命中/未命中、TTL、Memory/Redis 切换 | > 90% |
| RateGraphEngine | Dijkstra 路径查找、图构建、单图合并 | > 90% |
| RateFetchService | Provider fallback、缓存穿透 | > 85% |
| RateRestProvider | REST API 调用、错误处理 | > 90% |
| RateJsPlugin | 插件加载、方法调用 | > 85% |
| RateMonitorService | 统计记录、聚合计算 | > 90% |

### 9.2 E2E 测试

```typescript
// e2e/rates.spec.ts

describe('Rate Engine E2E', () => {
  it('should return cached rate within 2 hours', async () => {
    // 第一次请求
    const result1 = await request.get('/api/v1/rates/USD/EUR');
    expect(result1.body.rate).toBeDefined();

    // 第二次请求 (应该命中缓存)
    const result2 = await request.get('/api/v1/rates/USD/EUR');
    expect(result2.body.rate).toBe(result1.body.rate);
  });

  it('should fallback to next provider when one fails', async () => {
    // 模拟一个 Provider 失败
    // 验证能正常 fallback 到下一个
  });

  it('should use graph path for indirect conversion', async () => {
    // 请求 BTC -> HKD (没有直接汇率)
    // 验证能通过图算法找到路径 (BTC -> USD -> HKD)
  });

  it('should record history for asset tracking', async () => {
    // 发起汇率查询
    await request.get('/api/v1/rates/BTC/USD');
    
    // 验证历史记录已写入
    const history = await request.get('/api/v1/rates/BTC/USD/history');
    expect(history.body.rates.length).toBeGreaterThan(0);
  });

  it('should track monitor metrics', async () => {
    // 发起多个请求
    await Promise.all([
      request.get('/api/v1/rates/USD/EUR'),
      request.get('/api/v1/rates/USD/GBP'),
      request.get('/api/v1/rates/USD/JPY'),
    ]);

    // 验证监控统计更新
    const stats = await request.get('/api/v1/rates/stats/current');
    expect(stats.body.totalQueries).toBe(3);
  });
});
```

---

## 10. 风险与对策

| 风险 | 影响 | 概率 | 对策 |
|------|------|------|------|
| 缓存穿透 | 大量请求同时到达，打垮 Provider | 中 | 分布式锁 / 请求合并 |
| 缓存雪崩 | 大量缓存同时过期 | 低 | 随机 TTL (2h ± 10min) |
| Provider 全部失败 | 服务不可用 | 低 | 手动汇率 fallback + 告警 |
| 图算法性能 | 路径查找慢 | 低 | 限制 maxHops=5, 缓存图结构 |
| Redis 连接失败 | 缓存不可用 | 中 | fallback 到 Memory |
| 历史数据膨胀 | 数据库增长过快 | 中 | 定期归档 (保留 1 年) |

---

## 11. 待讨论事项

### 11.1 已确认

- ✅ Redis 可选（单实例内存/多实例 Redis）
- ✅ 单图设计（不按 Provider 拆分）
- ✅ 历史汇率持久化（用于资产增长趋势跟踪）
- ✅ 监控指标（缓存命中率、Provider 成功率）

### 11.2 待讨论

- [ ] Provider 优先级策略 (固定顺序 vs 动态调整)
- [ ] 历史数据归档策略 (保留多久?)
- [ ] 图的最大跳数限制 (默认 5?)
- [ ] 是否需要支持图的手动边 (固定汇率)?

---

## 12. 参考资料

- 当前实现: `backend/src/rates/rate-graph-engine.ts`
- Provider 插件示例: `backend/plugins/js/providers/*.js`
- 需求文档: `docs/requirements/REQUIREMENTS_MULTI_CURRENCY.md`
- 插件系统需求: `docs/requirements/REQUIREMENTS_PLUGIN_SYSTEM.md`
