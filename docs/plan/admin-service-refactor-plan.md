# Admin Service 重构计划

**文档版本**: 1.0  
**创建日期**: 2026-01-22  
**状态**: 待评审  
**负责人**: Sisyphus

---

## 目录

1. [执行摘要](#1-执行摘要)
2. [现状分析](#2-现状分析)
3. [重构目标](#3-重构目标)
4. [架构设计](#4-架构设计)
5. [事件驱动机制](#5-事件驱动机制)
6. [子服务详细设计](#6-子服务详细设计)
7. [迁移计划](#7-迁移计划)
8. [风险评估](#8-风险评估)
9. [测试策略](#9-测试策略)
10. [验收标准](#10-验收标准)
11. [附录](#11-附录)

---

## 1. 执行摘要

### 问题陈述

当前 `admin.service.ts` 文件包含 **1070 行代码**，混合了 8 个不同领域的业务逻辑，导致：

- **可维护性差**：IDE 卡顿，代码审查困难
- **团队协作冲突**：多人同时修改频繁冲突
- **测试困难**：无法独立测试单个功能
- **架构不清晰**：违反单一职责原则

### 解决方案

采用 **领域驱动 + 事件驱动** 架构，将上帝服务拆分为 8 个单一职责的子服务：

- `user-management.service.ts` - 用户管理
- `provider-management.service.ts` - 提供商管理
- `currency-management.service.ts` - 货币管理
- `scheduler-management.service.ts` - 调度器管理
- `plugin-management.service.ts` - 插件管理
- `audit-log.service.ts` - 审计日志
- `system-config.service.ts` - 系统配置
- `health-monitoring.service.ts` - 健康监控

### 预期收益

| 指标 | 当前状态 | 预期状态 |
|------|---------|---------|
| 单文件行数 | 1070 | 150-250 |
| 服务依赖数 | 10+ Repository | 1-2 Repository/服务 |
| 测试覆盖率 | < 20% | > 70% |
| 团队协作冲突 | 高 | 低 |

---

## 2. 现状分析

### 2.1 当前代码结构

```typescript
// admin.service.ts 文件统计
├── 文件总行数: 1070 行
├── Import 语句: 27 行
├── DTO/接口定义: 50 行
├── 服务类主体: 993 行
│
├── 用户管理: ~200 行
│   ├── listUsers() / getUser()
│   ├── createUser() / updateUser() / disableUser()
│   ├── resetPassword() / bulkUserAction()
│
├── 提供商管理: ~200 行
│   ├── listProviders() / getProvider()
│   ├── createProvider() / updateProvider() / deleteProvider()
│   ├── toggleProvider() / testProvider()
│
├── 货币管理: ~100 行
│   ├── createCurrency() / updateCurrency() / deleteCurrency()
│   ├── seedCurrencies() / getAllCurrencies()
│
├── 调度器控制: ~150 行
│   ├── getSchedulerConfig() / updateSchedulerConfig()
│   ├── triggerManualFetch() / getSchedulerHistory()
│
├── 插件管理: ~120 行
│   ├── listPlugins() / uploadPlugin() / reloadPlugin()
│
├── 审计日志: ~60 行
│   ├── getAuditLogs() / exportAuditLogsToCsv()
│
├── 系统配置: ~40 行
│   ├── getSystemConfig() / updateSystemConfig()
│
└── 健康监控: ~70 行
    └── getHealthStatus()
```

### 2.2 依赖分析

```typescript
// 当前依赖注入 (10+ Repository + 4 Service)
@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(AuditLog) private auditLogRepository,
    @InjectRepository(User) private userRepository,
    @InjectRepository(Account) private accountRepository,
    @InjectRepository(JournalEntry) private journalEntryRepository,
    @InjectRepository(JournalLine) private journalLineRepository,
    @InjectRepository(Currency) private currencyRepository,
    @InjectRepository(ExchangeRate) private exchangeRateRepository,
    @InjectRepository(Budget) private budgetRepository,
    @InjectRepository(Provider) private providerRepository,
    private currenciesService: CurrenciesService,
    public currencyProviderService: CurrencyProviderService,
    private providersService: ProvidersService,
    private rateGraphEngine: RateGraphEngine,
  ) {}
}
```

### 2.3 问题识别

| 问题类型 | 具体表现 | 影响 |
|---------|---------|------|
| 单一职责违反 | 8 个不同领域混在一起 | 代码理解困难 |
| 依赖过多 | 10+ Repository 注入 | 初始化慢，难以 mock |
| 重复代码 | 每个方法都有 `this.log()` 调用 | 维护成本高 |
| 审计耦合 | 审计日志与业务逻辑同步执行 | 影响性能 |
| 测试困难 | 无法独立测试单个功能 | 覆盖率低 |

---

## 3. 重构目标

### 3.1 业务目标

1. **代码可维护性提升**
   - 单文件控制在 250 行以内
   - 单一职责，每个服务只做一件事

2. **团队协作优化**
   - 减少合并冲突
   - 可并行开发不同子服务

3. **测试覆盖率提升**
   - 每个子服务独立可测试
   - 目标覆盖率 > 70%

4. **性能优化**
   - 审计日志异步写入，不阻塞业务
   - 减少不必要的依赖注入

### 3.2 技术目标

- [ ] 拆分 8 个子服务
- [ ] 实现事件驱动的审计机制
- [ ] 引入装饰器简化审计日志代码
- [ ] 保持 API 向后兼容
- [ ] 迁移过程零停机

---

## 4. 架构设计

### 4.1 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                    AdminController                           │
│            (保持轻量，只做路由分发)                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    AdminModule                               │
│            (Orchestrator，只做依赖注入编排)                    │
└─────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
    ┌───────────┐      ┌─────────────┐      ┌───────────┐
    │  User     │      │  Provider   │      │  Currency │
    │  Domain   │      │  Domain     │      │  Domain   │
    │  Service  │      │  Service    │      │  Service  │
    └───────────┘      └─────────────┘      └───────────┘
          │                   │                   │
          └───────────────────┼───────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              AuditEventPublisher (事件总线)                   │
│        (异步发布审计事件，解耦业务与审计逻辑)                   │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 目录结构

```
backend/src/admin/
├── admin.module.ts                    # 根模块，编排依赖
├── admin.controller.ts                # 控制器（保持轻量）
│
├── services/                          # 业务服务层
│   ├── user-management.service.ts     # 用户管理 (~207 行)
│   ├── provider-management.service.ts # 提供商管理 (~220 行)
│   ├── currency-management.service.ts # 货币管理 (~120 行)
│   ├── scheduler-management.service.ts# 调度器管理 (~180 行)
│   ├── plugin-management.service.ts   # 插件管理 (~130 行)
│   ├── audit-log.service.ts           # 审计日志 (~80 行)
│   ├── system-config.service.ts       # 系统配置 (~50 行)
│   └── health-monitoring.service.ts   # 健康监控 (~70 行)
│
├── events/                            # 事件系统
│   ├── admin-events.types.ts          # 事件类型定义
│   └── audit-event-publisher.service.ts # 事件发布器
│
├── decorators/                        # 自定义装饰器
│   └── audit-log.decorator.ts         # 审计日志装饰器
│
├── interfaces/                        # 接口定义
│   └── admin-repository.interface.ts  # 仓储接口
│
├── dto/                               # DTO（可选集中管理）
│   └── admin.dto.ts
│
└── entities/                          # 实体（如果需要）
    └── admin-entity.ts
```

### 4.3 依赖关系

```typescript
// 依赖注入关系

AdminModule
├── AdminController
│
├── UserManagementService
│   ├── IUserRepository (Interface)
│   └── AuditEventPublisher
│
├── ProviderManagementService
│   ├── IProviderRepository (Interface)
│   ├── CurrencyProviderService (existing)
│   └── AuditEventPublisher
│
├── CurrencyManagementService
│   ├── ICurrencyRepository (Interface)
│   ├── CurrenciesService (existing)
│   └── AuditEventPublisher
│
├── SchedulerManagementService
│   ├── ISchedulerRepository (Interface)
│   ├── RateGraphEngine (existing)
│   └── AuditEventPublisher
│
├── PluginManagementService
│   └── AuditEventPublisher
│
├── AuditLogService
│   └── IAuditLogRepository (Interface)
│
├── SystemConfigService
│   └── AuditEventPublisher
│
├── HealthMonitoringService
│   └── IHealthRepository (Interface)
│
└── AuditEventPublisher
    └── IAuditLogRepository (Interface)
```

---

## 5. 事件驱动机制

### 5.1 事件类型定义

```typescript
// backend/src/admin/events/admin-events.types.ts

export type AdminAction = 
  // 用户管理
  | 'admin.user.create'
  | 'admin.user.update'
  | 'admin.user.disable'
  | 'admin.user.reset_password'
  | 'admin.user.bulk_action'
  // 提供商管理
  | 'admin.provider.create'
  | 'admin.provider.update'
  | 'admin.provider.delete'
  | 'admin.provider.toggle'
  | 'admin.provider.test'
  // 货币管理
  | 'admin.currency.create'
  | 'admin.currency.update'
  | 'admin.currency.delete'
  | 'admin.currency.seed'
  // 调度器管理
  | 'admin.scheduler.config'
  | 'admin.scheduler.manual_fetch'
  // 插件管理
  | 'admin.plugin.upload'
  | 'admin.plugin.reload'
  // 系统配置
  | 'admin.config.update';

export interface AdminAuditEvent {
  id: string;
  action: AdminAction;
  entityType: string;
  entityId?: string;
  userId: string;
  oldValue?: any;
  newValue?: any;
  ipAddress?: string;
  userAgent?: string;
  tenantId?: string;
  timestamp: Date;
}
```

### 5.2 事件发布器

```typescript
// backend/src/admin/events/audit-event-publisher.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subject, bufferTime, filter } from 'rxjs';
import { AuditLog } from '../entities/audit-log.entity';
import { AdminAuditEvent } from './admin-events.types';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AuditEventPublisher {
  private readonly logger = new Logger(AuditEventPublisher.name);
  private eventSubject = new Subject<AdminAuditEvent>();
  private subscription?: ReturnType<typeof this.eventSubject.pipe>;

  constructor(
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
  ) {
    this.initializeSubscription();
  }

  private initializeSubscription(): void {
    // 每秒批量写入，减少数据库压力
    this.subscription = this.eventSubject.pipe(
      bufferTime(1000), // 1 秒批量
      filter(events => events.length > 0),
    ).subscribe({
      next: async (events) => {
        await this.batchSave(events);
      },
      error: (error) => {
        this.logger.error('Audit event subscription error', error);
      },
    });
  }

  publish(event: AdminAuditEvent): void {
    // 添加元数据
    const enrichedEvent: AdminAuditEvent = {
      ...event,
      id: event.id || uuidv4(),
      timestamp: event.timestamp || new Date(),
    };

    this.eventSubject.next(enrichedEvent);
  }

  private async batchSave(events: AdminAuditEvent[]): Promise<void> {
    try {
      const logs = events.map(event => 
        this.auditLogRepository.create({
          id: event.id,
          tenant_id: event.tenantId,
          user_id: event.userId,
          action: event.action,
          entity_type: event.entityType,
          entity_id: event.entityId,
          old_value: event.oldValue ? JSON.parse(JSON.stringify(event.oldValue)) : undefined,
          new_value: event.newValue ? JSON.parse(JSON.stringify(event.newValue)) : undefined,
          ip_address: event.ipAddress,
          user_agent: event.userAgent,
          created_at: event.timestamp,
        })
      );

      await this.auditLogRepository.save(logs);
      this.logger.debug(`Batch saved ${logs.length} audit logs`);
    } catch (error) {
      this.logger.error('Failed to batch save audit logs', error);
      // TODO: 考虑写入死信队列
    }
  }

  /**
   * 手动刷新未保存的事件（用于测试或优雅关闭）
   */
  async flush(): Promise<void> {
    // 触发一次批量保存
    this.subscription?.unsubscribe();
    this.initializeSubscription();
  }

  /**
   * 关闭发布器（用于应用关闭时）
   */
  async close(): Promise<void> {
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = undefined;
    }
  }
}
```

### 5.3 审计日志装饰器

```typescript
// backend/src/admin/decorators/audit-log.decorator.ts

import { AdminAction } from '../events/admin-events.types';
import { AuditEventPublisher } from '../events/audit-event-publisher.service';

export interface AuditLogOptions {
  action: AdminAction;
  entityType: string;
  getEntityId?: (args: any[], result: any) => string | undefined;
  getOldValue?: (args: any[], result: any) => any;
  getNewValue?: (args: any[], result: any) => any;
  extractIpFromArgs?: boolean;
  extractUserAgentFromArgs?: boolean;
  extractAdminIdFromArgs?: boolean;
  extractTenantIdFromArgs?: boolean;
}

export function AuditLog(options: AuditLogOptions) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const instance = this as any;
      
      // 获取事件发布器
      const eventPublisher = instance.eventPublisher as AuditEventPublisher | undefined;
      
      // 如果没有事件发布器，降级为同步日志（向后兼容）
      if (!eventPublisher) {
        console.warn(`[AuditLog] No eventPublisher found for ${options.action}`);
        return originalMethod.apply(this, args);
      }

      // 提取参数
      const adminId = options.extractAdminIdFromArgs !== false
        ? args.find((arg: any) => 
            typeof arg === 'string' && 
            arg.length === 36 && 
            /^[0-9a-f-]+$/.test(arg)
          ) || 'system'
        : 'system';

      const tenantId = options.extractTenantIdFromArgs !== false
        ? args.find((arg: any) => 
            typeof arg === 'string' && 
            arg.length === 36 && 
            /^[0-9a-f-]+$/.test(arg) &&
            arg !== adminId
          ) || undefined
        : undefined;

      const ipAddress = options.extractIpFromArgs
        ? args.find((arg: any) => 
            typeof arg === 'string' && 
            /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(arg)
          ) || undefined
        : undefined;

      const userAgent = options.extractUserAgentFromArgs
        ? args.find((arg: any) => 
            typeof arg === 'string' && 
            arg.length > 20 && 
            /^[a-zA-Z0-9\s\/\.\-\(\)]+$/.test(arg)
          ) || undefined
        : undefined;

      // 调用原始方法
      const result = await originalMethod.apply(this, args);

      // 发布审计事件（非阻塞）
      const event = {
        action: options.action,
        entityType: options.entityType,
        entityId: options.getEntityId?.(args, result),
        userId: adminId,
        tenantId,
        oldValue: options.getOldValue?.(args, result),
        newValue: options.getNewValue?.(args, result),
        ipAddress,
        userAgent,
      };

      eventPublisher.publish(event);

      return result;
    };

    return descriptor;
  };
}
```

### 5.4 使用示例

```typescript
// backend/src/admin/services/user-management.service.ts

import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { User } from '../../auth/user.entity';
import { AuditEventPublisher } from '../events/audit-event-publisher.service';
import { AuditLog } from '../decorators/audit-log.decorator';

@Injectable()
export class UserManagementService {
  private readonly logger = new Logger(UserManagementService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private eventPublisher: AuditEventPublisher,
  ) {}

  @AuditLog({
    action: 'admin.user.create',
    entityType: 'user',
    getEntityId: (args, result) => result?.id,
    getNewValue: (args, result) => ({
      email: result?.email,
      name: result?.name,
      role: result?.role,
    }),
    extractIpFromArgs: true,
    extractTenantIdFromArgs: true,
  })
  async createUser(
    tenantId: string,
    data: {
      email: string;
      name: string;
      password: string;
      role: string;
    },
    adminId: string,
    ipAddress?: string,
  ): Promise<User> {
    const existing = await this.userRepository.findOne({
      where: { email: data.email },
    });

    if (existing) {
      throw new BadRequestException('Email already exists');
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    const user = this.userRepository.create({
      id: uuidv4(),
      email: data.email,
      name: data.name,
      password: hashedPassword,
      role: data.role,
      tenant_id: tenantId,
      is_active: true,
      provider: 'credentials',
      created_at: new Date(),
      updated_at: new Date(),
    });

    await this.userRepository.save(user);
    return user;
  }

  @AuditLog({
    action: 'admin.user.update',
    entityType: 'user',
    getEntityId: (args) => args[0], // userId 是第一个参数
    getOldValue: async (args) => {
      const user = await this.userRepository.findOne({ where: { id: args[0] } });
      return user ? { ...user, password: undefined } : undefined;
    },
    getNewValue: (args, result) => ({
      ...result,
      password: undefined,
    }),
    extractIpFromArgs: true,
  })
  async updateUser(
    userId: string,
    data: Partial<{ email: string; name: string; role: string; is_active: boolean }>,
    adminId: string,
    ipAddress?: string,
  ): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    
    if (!user) {
      throw new BadRequestException('User not found');
    }

    const oldValue = { ...user, password: undefined };
    
    Object.assign(user, data);
    user.updated_at = new Date();

    await this.userRepository.save(user);
    return { ...user, password: undefined };
  }

  @AuditLog({
    action: 'admin.user.disable',
    entityType: 'user',
    getEntityId: (args) => args[0],
    getOldValue: async (args) => {
      const user = await this.userRepository.findOne({ where: { id: args[0] } });
      return user ? { is_active: user.is_active } : undefined;
    },
    getNewValue: (args, result) => ({ is_active: false }),
  })
  async disableUser(
    userId: string,
    adminId: string,
    ipAddress?: string,
  ): Promise<User> {
    if (userId === adminId) {
      throw new BadRequestException('Cannot disable yourself');
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });
    
    if (!user) {
      throw new BadRequestException('User not found');
    }

    user.is_active = false;
    user.updated_at = new Date();

    await this.userRepository.save(user);
    return user;
  }
}
```

---

## 6. 子服务详细设计

### 6.1 UserManagementService

**文件**: `services/user-management.service.ts`  
**预期行数**: ~207 行  
**依赖**: `UserRepository`, `AuditEventPublisher`

```typescript
// 职责边界
// - 用户 CRUD
// - 用户批量操作
// - 密码重置
// - 状态变更

@Injectable()
export class UserManagementService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private eventPublisher: AuditEventPublisher,
  ) {}

  // 公共方法
  async listUsers(tenantId: string, options?: PaginationParams): Promise<{ users: User[]; total: number }>
  async getUser(userId: string): Promise<User>
  @AuditLog(...) async createUser(...): Promise<User>
  @AuditLog(...) async updateUser(...): Promise<User>
  @AuditLog(...) async disableUser(...): Promise<User>
  @AuditLog(...) async resetPassword(...): Promise<void>
  @AuditLog(...) async bulkUserAction(...): Promise<{ affected: number }>
}
```

### 6.2 ProviderManagementService

**文件**: `services/provider-management.service.ts`  
**预期行数**: ~220 行  
**依赖**: `ProviderRepository`, `CurrencyProviderService`, `ProvidersService`, `AuditEventPublisher`

```typescript
@Injectable()
export class ProviderManagementService {
  constructor(
    @InjectRepository(Provider)
    private providerRepository: Repository<Provider>,
    private currencyProviderService: CurrencyProviderService,
    private providersService: ProvidersService,
    private eventPublisher: AuditEventPublisher,
  ) {}

  // 公共方法
  async listProviders(options?: PaginationParams): Promise<{ providers: Provider[]; total: number }>
  async getProvider(providerId: string): Promise<Provider>
  @AuditLog(...) async createProvider(...): Promise<Provider>
  @AuditLog(...) async updateProvider(...): Promise<Provider>
  @AuditLog(...) async deleteProvider(...): Promise<void>
  @AuditLog(...) async toggleProvider(...): Promise<Provider>
  @AuditLog(...) async testProvider(...): Promise<{ success: boolean; message: string; latency?: number }>
}
```

### 6.3 CurrencyManagementService

**文件**: `services/currency-management.service.ts`  
**预期行数**: ~120 行  
**依赖**: `CurrencyRepository`, `CurrenciesService`, `AuditEventPublisher`

### 6.4 SchedulerManagementService

**文件**: `services/scheduler-management.service.ts`  
**预期行数**: ~180 行  
**依赖**: `ProviderRepository`, `ExchangeRateRepository`, `RateGraphEngine`, `AuditEventPublisher`

### 6.5 PluginManagementService

**文件**: `services/plugin-management.service.ts`  
**预期行数**: ~130 行  
**依赖**: `AuditEventPublisher`

### 6.6 AuditLogService

**文件**: `services/audit-log.service.ts`  
**预期行数**: ~80 行  
**依赖**: `AuditLogRepository`  
**特点**: 只读服务，无事件发布

### 6.7 SystemConfigService

**文件**: `services/system-config.service.ts`  
**预期行数**: ~50 行  
**依赖**: `AuditEventPublisher`

### 6.8 HealthMonitoringService

**文件**: `services/health-monitoring.service.ts`  
**预期行数**: ~70 行  
**依赖**: `UserRepository`, `ProviderRepository`  
**特点**: 只读服务，无事件发布

---

## 7. 迁移计划

### 7.1 总体策略

**渐进式迁移**，每个阶段都能独立运行：

1. **阶段 0**: 基础设施准备（事件系统 + 装饰器）
2. **阶段 1**: 拆分用户管理
3. **阶段 2**: 拆分提供商管理
4. **阶段 3**: 拆分货币管理
5. **阶段 4**: 拆分调度器管理
6. **阶段 5**: 拆分插件管理
7. **阶段 6**: 拆分审计日志
8. **阶段 7**: 拆分系统配置 + 健康监控
9. **阶段 8**: 清理旧代码

### 7.2 详细步骤

#### 阶段 0: 基础设施准备

**任务**:
- [ ] 创建 `events/admin-events.types.ts`
- [ ] 创建 `events/audit-event-publisher.service.ts`
- [ ] 创建 `decorators/audit-log.decorator.ts`
- [ ] 创建 `interfaces/admin-repository.interface.ts`
- [ ] 更新 `admin.module.ts` 注入 `AuditEventPublisher`

**验证**:
```bash
npm run test:unit -- --testPathPattern="audit-event-publisher"
```

#### 阶段 1: 拆分用户管理

**任务**:
- [ ] 创建 `services/user-management.service.ts`
- [ ] 更新 `admin.module.ts` 注入 `UserManagementService`
- [ ] 更新 `admin.controller.ts` 调用新服务
- [ ] 删除 `admin.service.ts` 中相关方法

**验证**:
```bash
# API 测试
curl -X GET http://localhost:3001/admin/users
curl -X POST http://localhost:3001/admin/users
```

#### 阶段 2-7: 按相同模式拆分其他服务

每个阶段:
1. 创建子服务文件
2. 更新模块注入
3. 更新控制器调用
4. 删除旧方法
5. 验证功能

#### 阶段 8: 清理

**任务**:
- [ ] 删除 `admin.service.ts`
- [ ] 更新所有 import 路径
- [ ] 运行完整测试套件
- [ ] 更新文档

### 7.3 回滚计划

```bash
# 每个阶段打 git tag
git tag -a admin-refactor-0 -m "Phase 0: Event infrastructure"
git tag -a admin-refactor-1 -m "Phase 1: User management"
git tag -a admin-refactor-2 -m "Phase 2: Provider management"
# ...

# 回滚命令
git checkout admin-refactor-1
```

### 7.4 兼容性保证

- **API 兼容**: 所有 endpoint 保持不变
- **数据兼容**: 数据库结构不变
- **依赖兼容**: 保留旧服务作为 fallback

```typescript
// 过渡期：controller 同时支持新旧服务
@Controller('admin')
export class AdminController {
  constructor(
    private adminService: AdminService, // 保留，用于回滚
    private userManagementService: UserManagementService,
  ) {}

  @Get('users')
  async listUsers(@Tenant() tenantId: string, @Query() options) {
    // 优先使用新服务
    return this.userManagementService.listUsers(tenantId, options);
  }
}
```

---

## 8. 风险评估

### 8.1 风险矩阵

| 风险 | 影响 | 概率 | 风险等级 | 缓解措施 |
|------|------|------|---------|---------|
| 审计日志丢失 | 高 | 低 | 中 | 事件批量写入，增加重试机制 |
| API 不兼容 | 高 | 低 | 低 | 渐进式迁移，每个阶段验证 |
| 性能下降 | 中 | 低 | 低 | 异步事件处理，优化批量写入 |
| 回滚困难 | 中 | 低 | 低 | 每个阶段打 tag，保留旧代码 |
| 测试遗漏 | 中 | 中 | 中 | 每个阶段补充单元测试 |

### 8.2 缓解措施

1. **审计日志丢失**
   - 实现死信队列
   - 增加写入重试（最多 3 次）
   - 监控异常

2. **API 不兼容**
   - 保留旧服务作为 fallback
   - 每个阶段进行完整 API 测试
   - 灰度发布

3. **性能下降**
   - 异步事件处理
   - 批量写入优化
   - 性能监控

---

## 9. 测试策略

### 9.1 单元测试

```typescript
// services/user-management.service.spec.ts

describe('UserManagementService', () => {
  let service: UserManagementService;
  let userRepository: MockType<Repository<User>>;
  let eventPublisher: MockType<AuditEventPublisher>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UserManagementService,
        {
          provide: getRepositoryToken(User),
          useValue: createMockRepository(),
        },
        {
          provide: AuditEventPublisher,
          useValue: createMockEventPublisher(),
        },
      ],
    }).compile();

    service = module.get<UserManagementService>(UserManagementService);
    userRepository = module.get(getRepositoryToken(User));
    eventPublisher = module.get(AuditEventPublisher);
  });

  describe('createUser', () => {
    it('should create user and publish audit event', async () => {
      // Given
      const dto = { 
        email: 'test@test.com', 
        name: 'Test', 
        password: '123456', 
        role: 'user' 
      };
      
      userRepository.findOne.mockResolvedValue(null);
      userRepository.create.mockReturnValue({ ...dto, id: 'uuid', is_active: true });
      userRepository.save.mockResolvedValue({ ...dto, id: 'uuid', is_active: true });

      // When
      const result = await service.createUser('tenant-id', dto, 'admin-id');

      // Then
      expect(userRepository.save).toHaveBeenCalled();
      expect(eventPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'admin.user.create',
          entityType: 'user',
          entityId: 'uuid',
        }),
      );
    });

    it('should throw BadRequestException if email exists', async () => {
      // Given
      const dto = { 
        email: 'existing@test.com', 
        name: 'Test', 
        password: '123456', 
        role: 'user' 
      };
      userRepository.findOne.mockResolvedValue({ email: dto.email });

      // When/Then
      await expect(
        service.createUser('tenant-id', dto, 'admin-id')
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('disableUser', () => {
    it('should not allow self-disable', async () => {
      await expect(
        service.disableUser('admin-id', 'admin-id')
      ).rejects.toThrow('Cannot disable yourself');
    });
  });
});
```

### 9.2 集成测试

```typescript
// admin.e2e-spec.ts

describe('Admin API (e2e)', () => {
  it('should create user via API', async () => {
    const response = await request(app.getHttpServer())
      .post('/admin/users')
      .send({
        email: 'test@test.com',
        name: 'Test User',
        password: 'password123',
        role: 'user',
      })
      .expect(201);

    // 验证用户创建
    expect(response.body.email).toBe('test@test.com');

    // 验证审计日志
    const auditLogs = await auditLogRepository.find({
      where: { action: 'admin.user.create' },
      order: { created_at: 'DESC' },
    });
    expect(auditLogs.length).toBeGreaterThan(0);
  });
});
```

### 9.3 测试覆盖目标

| 子服务 | 单元测试覆盖率 | 集成测试 |
|--------|---------------|---------|
| UserManagementService | > 80% | ✅ |
| ProviderManagementService | > 80% | ✅ |
| CurrencyManagementService | > 70% | ✅ |
| SchedulerManagementService | > 70% | ✅ |
| PluginManagementService | > 70% | ✅ |
| AuditLogService | > 90% | ✅ |
| SystemConfigService | > 70% | ✅ |
| HealthMonitoringService | > 70% | ✅ |

---

## 10. 验收标准

### 10.1 功能验收

- [ ] 所有现有 API 保持兼容
- [ ] 审计日志功能正常工作
- [ ] 用户管理功能完整
- [ ] 提供商管理功能完整
- [ ] 货币管理功能完整
- [ ] 调度器管理功能完整
- [ ] 插件管理功能完整

### 10.2 代码质量验收

- [ ] 单文件行数 ≤ 250
- [ ] 单元测试覆盖率 > 70%
- [ ] 无 `any` 类型
- [ ] ESLint 检查通过

### 10.3 性能验收

- [ ] API 响应时间 < 200ms（P95）
- [ ] 审计日志写入不影响主流程
- [ ] 无内存泄漏

### 10.4 文档验收

- [ ] 更新 `AGENTS.md`
- [ ] 更新 README（如果需要）
- [ ] 提交设计文档

---

## 11. 附录

### 11.1 参考资料

- [NestJS 模块系统](https://docs.nestjs.com/modules)
- [TypeORM 仓储模式](https://typeorm.io/repository)
- [RxJS Subject](https://rxjs.dev/api/index/class/Subject)
- [装饰器模式](https://www.typescriptlang.org/docs/handbook/decorators.html)

### 11.2 术语表

| 术语 | 定义 |
|------|------|
| 上帝服务 | 承担过多职责的服务类 |
| 事件驱动 | 通过事件解耦业务逻辑 |
| 装饰器 | TypeScript 元编程特性 |
| 仓储模式 | 数据访问抽象层 |

### 11.3 变更日志

| 版本 | 日期 | 作者 | 描述 |
|------|------|------|------|
| 1.0 | 2026-01-22 | Sisyphus | 初始版本 |

---

**文档结束**
