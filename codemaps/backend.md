# Backend Codemap

Generated: 2026-01-27T00:00:00.000Z

## NestJS Module Structure

| Module | Path | Purpose |
|--------|------|---------|
| AuthModule | `src/auth/` | JWT authentication, user management |
| TenantsModule | `src/tenants/` | Multi-tenant context, settings |
| AccountsModule | `src/accounts/` | Chart of accounts (tree structure) |
| JournalModule | `src/journal/` | Journal entries and lines |
| QueryModule | `src/query/` | Balance queries, summaries |
| RatesModule | `src/rates/` | Exchange rates, rate providers |
| ProvidersModule | `src/providers/` | Currency data provider management |
| SchedulerModule | `src/scheduler/` | Cron job scheduling |
| BudgetsModule | `src/budgets/` | Budgets, alerts, templates |
| ReportsModule | `src/reports/` | Report generation and storage |
| CurrenciesModule | `src/currencies/` | Currency CRUD |
| AdminModule | `src/admin/` | System admin, audit logs |
| SetupModule | `src/setup/` | System initialization |
| ExportModule | `src/export/` | Data export functionality |

## Entity Definitions

### Core Entities

| Entity | Table | Key Fields |
|--------|-------|------------|
| `User` | `users` | id (uuid), email, password, tenant_id, role |
| `Tenant` | `tenants` | id (uuid), user_id, name, settings (jsonb) |
| `Account` | `accounts` | id (uuid), tenant_id, parent_id, name, type, currency, path, depth |
| `JournalEntry` | `journal_entries` | id (uuid), tenant_id, date, description, is_pending |
| `JournalLine` | `journal_lines` | id (uuid), tenant_id, entry_id, account_id, amount, currency |
| `Currency` | `currencies` | code (pk), name, symbol, decimal_places |
| `Budget` | `budgets` | id (uuid), tenant_id, account_id, type, amount, currency |
| `ExchangeRate` | `exchange_rates` | id (uuid), provider_id, from_currency, to_currency, rate, date |
| `Provider` | `providers` | id (uuid), name, type, config (jsonb) |
| `AuditLog` | `admin_audit_logs` | id (uuid), tenant_id, user_id, action, entity_type |

### Account Types

```typescript
enum AccountType {
  ASSETS = 'assets',
  LIABILITIES = 'liabilities',
  EQUITY = 'equity',
  REVENUE = 'revenue',
  EXPENSE = 'expense',
}
```

### Budget Types

```typescript
enum BudgetType {
  PERIODIC = 'periodic',
  NON_PERIODIC = 'non_periodic',
}
enum PeriodType {
  MONTHLY = 'monthly',
  WEEKLY = 'weekly',
  YEARLY = 'yearly',
}
```

## Service Layer Patterns

### Typical Service Structure

```
{module}/
├── {module}.service.ts     # Business logic
├── {module}.controller.ts  # HTTP endpoints
├── {module}.module.ts      # NestJS module
├── dto/                    # Data transfer objects
│   ├── {module}.dto.ts
│   └── index.ts
└── validators/             # Custom validators (optional)
```

### Common Service Methods

- `findAll()` - List with pagination
- `findOne(id)` - Get single entity
- `create(dto)` - Create new entity
- `update(id, dto)` - Update entity
- `remove(id)` - Soft delete
- `findByTenant()` - Tenant-scoped queries

## Controller/API Endpoints

### Auth Controller

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/auth/login` | User login |
| POST | `/auth/register` | User registration |

### Accounts Controller

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/accounts/tree` | Get account tree |
| GET | `/accounts/:id` | Get account by ID |
| POST | `/accounts` | Create account |
| PUT | `/accounts/:id` | Update account |
| DELETE | `/accounts/:id` | Delete account |

### Journal Controller

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/journal` | List journal entries |
| GET | `/journal/:id` | Get journal entry |
| POST | `/journal` | Create journal entry |
| PUT | `/journal/:id` | Update journal entry |
| DELETE | `/journal/:id` | Delete journal entry |

### Query Controller

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/query/balances` | Get account balances |
| GET | `/query/summary` | Get dashboard summary |

### Currencies Controller

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/currencies` | List currencies |
| GET | `/currencies/:code` | Get currency |
| POST | `/currencies` | Create currency |
| PUT | `/currencies/:code` | Update currency |
| DELETE | `/currencies/:code` | Delete currency |

### Budgets Controller

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/budgets` | List budgets |
| GET | `/budgets/:id` | Get budget |
| POST | `/budgets` | Create budget |
| PUT | `/budgets/:id` | Update budget |
| DELETE | `/budgets/:id` | Delete budget |

### Rates Controller

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/rates` | Get exchange rates |
| GET | `/rates/graph` | Get rate graph (for path finding) |

## DTOs and Validation

### Common DTO Pattern

```typescript
// Create DTO
export class CreateEntityDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEnum(EntityType)
  type: EntityType;

  @IsNumber()
  @Min(0)
  amount: number;
}

// Update DTO
export class UpdateEntityDto {
  @IsString()
  @IsOptional()
  name?: string;
}
```

### Pagination DTO

```typescript
export class PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
```

## Module Relationships

```
AuthModule
├── User entity ──┐
                 ├──► TenantModule (tenant_id FK)
TenantsModule ───┘    └── Tenant entity

AccountsModule
└── Account entity (tree, self-referencing parent_id)

JournalModule
├── JournalEntry entity
└── JournalLine entity ───► Account entity (FK)

BudgetsModule
└── Budget entity (optional FK to Account)

RatesModule
├── ExchangeRate entity ───► Provider entity (FK)
└── Provider entity

CurrenciesModule
└── Currency entity (code PK)

AdminModule
└── AuditLog entity

SetupModule
└── Initialization logic
```

## Middleware

### TenantMiddleware (`src/common/middleware/tenant.middleware.ts`)

- Extracts `tenant_id` from JWT token
- Stores tenant context via `TenantContext.run()`
- Handles system initialization check
- Allows bypass for `/setup`, `/health`, `/auth/login`, `/auth/register`

### Request Flow

```
Request → TenantMiddleware → JwtAuthGuard → Controller → Service → Repository
           │                     │              │            │
           ▼                     ▼              ▼            ▼
     TenantContext         Validate JWT    Handle HTTP   Database
     setup (async)         token           logic         access
```
