# Data Codemap

Generated: 2026-01-27T00:00:00.000Z

## TypeORM Entities Overview

All entities follow these conventions:
- **Primary Keys**: UUID v4 (via `@PrimaryGeneratedColumn('uuid')`)
- **Timestamps**: `created_at`, `updated_at`
- **Soft Deletes**: `deleted_at` column on all entities
- **Money**: `decimal` type with appropriate precision/scale

## Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Tenant                                   │
│  id (uuid), user_id, name, settings (jsonb), is_active          │
└─────────────────────────────────────────────────────────────────┘
       │1                                              │N
       │                                               │
       ▼                                               ▼
┌──────────────┐     ┌─────────────────┐    ┌─────────────────┐
│     User     │────►│   JournalEntry  │◄───│    Account      │
│ id, email,   │     │ id, tenant_id,  │     │ id, parent_id,  │
│ password,    │     │ date, desc,     │     │ name, type,     │
│ tenant_id    │     │ is_pending      │     │ currency, path  │
└──────────────┘     └────────┬────────┘     └────────┬────────┘
                              │                       │
                              │N                      │N
                              ▼                       ▼
                      ┌────────────────┐    ┌────────────────┐
                      │  JournalLine   │    │    Budget      │
                      │ id, entry_id,  │    │ id, account_id,│
                      │ account_id,    │    │ type, amount,  │
                      │ amount,        │    │ currency,      │
                      │ currency, tags │    │ period_type    │
                      └────────────────┘    └────────────────┘
                              │
                              │N
                              ▼
                      ┌────────────────┐
                      │  ExchangeRate  │
                      │ id, from_currency,
                      │ to_currency, rate,
                      │ date, fetched_at
                      └────────────────┘
                              │
                              │N
                              ▼
                      ┌────────────────┐
                      │    Provider    │
                      │ id, name, type,│
                      │ config (jsonb) │
                      └────────────────┘
```

## Entity Definitions

### User Entity (`src/auth/user.entity.ts`)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK | User UUID |
| email | string | UNIQUE | User email |
| password | string | NULLABLE | Hashed password |
| name | string | NULLABLE | Display name |
| image | string | NULLABLE | Avatar URL |
| provider | string | NULLABLE | Auth provider (credentials, google, etc.) |
| provider_id | string | NULLABLE | External provider ID |
| is_active | boolean | DEFAULT true | Account active |
| role | string | DEFAULT 'user' | User role (user, admin) |
| tenant_id | uuid | FK -> tenants.id | Associated tenant |
| created_at | timestamp | | Record creation |
| updated_at | timestamp | | Record update |

### Tenant Entity (`src/tenants/tenant.entity.ts`)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK | Tenant UUID |
| user_id | uuid | UNIQUE | Owner user ID |
| name | string | | Tenant/organization name |
| settings | jsonb | NULLABLE | Tenant configuration |
| is_active | boolean | DEFAULT true | Tenant active |
| created_at | timestamp | | Record creation |
| updated_at | timestamp | | Record update |

**Settings Structure:**
```typescript
interface TenantSettings {
  default_currency?: string;
  timezone?: string;
  [key: string]: any;
}
```

### Account Entity (`src/accounts/account.entity.ts`)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK | Account UUID |
| tenant_id | uuid | NOT NULL | Tenant reference |
| parent_id | uuid | FK -> accounts.id | Parent account (tree) |
| name | string | NOT NULL | Account name |
| type | enum | NOT NULL | AccountType (assets, liabilities, equity, revenue, expense) |
| currency | string(10) | NOT NULL | Account currency |
| path | varchar(500) | NULLABLE | Materialized path for tree |
| depth | int | DEFAULT 0 | Tree depth |
| is_active | boolean | DEFAULT true | Account active |
| created_at | timestamp | | Record creation |
| updated_at | timestamp | | Record update |
| deleted_at | timestamp | NULLABLE | Soft delete |

**Tree Structure:** Uses TypeORM `@Tree('materialized-path')` for hierarchical accounts.

### JournalEntry Entity (`src/journal/journal-entry.entity.ts`)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK | Entry UUID |
| tenant_id | uuid | NOT NULL | Tenant reference |
| date | timestamp | NOT NULL | Transaction date |
| description | string | NOT NULL | Entry description |
| reference_id | uuid | NULLABLE | External reference |
| is_pending | boolean | DEFAULT false | Pending status |
| created_by | string | NOT NULL | Creator user ID |
| created_at | timestamp | | Record creation |
| updated_at | timestamp | | Record update |
| deleted_at | timestamp | NULLABLE | Soft delete |

**Relationships:**
- One-to-Many with `JournalLine` (cascade delete)

### JournalLine Entity (`src/journal/journal-line.entity.ts`)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK | Line UUID |
| journal_entry_id | uuid | FK -> journal_entries.id | Entry reference |
| tenant_id | uuid | NOT NULL | Tenant reference |
| account_id | uuid | FK -> accounts.id | Account reference |
| amount | decimal(20,4) | NOT NULL | Line amount |
| currency | string(10) | NOT NULL | Line currency |
| tags | text[] | DEFAULT '{}' | Transaction tags |
| remarks | text | NULLABLE | Line notes |
| created_at | timestamp | | Record creation |

### Currency Entity (`src/currencies/currency.entity.ts`)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| code | string(10) | PK | Currency code (ISO 4217) |
| name | string | NOT NULL | Currency name |
| symbol | string(10) | NULLABLE | Currency symbol |
| decimal_places | int | DEFAULT 2 | Decimal places |
| is_active | boolean | DEFAULT true | Currency active |
| created_at | timestamp | | Record creation |
| updated_at | timestamp | | Record update |
| deleted_at | timestamp | NULLABLE | Soft delete |

### Budget Entity (`src/budgets/budget.entity.ts`)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK | Budget UUID |
| tenant_id | uuid | NOT NULL | Tenant reference |
| account_id | uuid | NULLABLE | Optional account FK |
| name | string | NOT NULL | Budget name |
| type NULL | BudgetType | enum | NOT (periodic, non_periodic) |
| amount | decimal(20,4) | NOT NULL | Budget amount |
| currency | string(10) | NOT NULL | Budget currency |
| start_date | date | NOT NULL | Budget start |
| end_date | date | NULLABLE | Budget end |
| period_type | enum | NULLABLE | PeriodType (monthly, weekly, yearly) |
| spent_amount | decimal(20,4) | DEFAULT 0 | Amount spent |
| spent_currency | string(10) | DEFAULT 'USD' | Spent currency |
| alert_threshold | decimal(3,2) | NULLABLE | Alert percentage |
| is_active | boolean | DEFAULT true | Budget active |
| created_at | timestamp | | Record creation |
| updated_at | timestamp | | Record update |
| deleted_at | timestamp | NULLABLE | Soft delete |

### ExchangeRate Entity (`src/rates/exchange-rate.entity.ts`)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK | Rate UUID |
| provider_id | uuid | NOT NULL | Provider FK |
| from_currency | string(10) | INDEX | Source currency |
| to_currency | string(10) | INDEX | Target currency |
| rate | decimal(20,8) | NOT NULL | Exchange rate |
| date | date | INDEX, NOT NULL | Rate date |
| fetched_at | timestamp | INDEX | Fetch timestamp |

**Indexes:**
- `['from_currency', 'to_currency', 'date']`
- `['provider_id']`
- `['fetched_at']`
- `['date', 'fetched_at']`

### Provider Entity (`src/providers/provider.entity.ts`)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK | Provider UUID |
| name | string(100) | NOT NULL | Provider name |
| provider_type | varchar(20) | DEFAULT 'rest_api' | ProviderType (rest_api, js_plugin) |
| config | jsonb | NULLABLE | Provider configuration |
| is_active | boolean | DEFAULT true | Provider active |
| record_history | boolean | DEFAULT true | Record rate history |
| supported_currencies | jsonb | NULLABLE | Supported currencies list |
| supports_historical | boolean | DEFAULT false | Historical rates support |
| supports_date_query | boolean | DEFAULT false | Date query support |
| created_at | timestamp | | Record creation |
| updated_at | timestamp | | Record update |
| deleted_at | timestamp | NULLABLE | Soft delete |

**Config Structure:**
```typescript
interface ProviderConfig {
  api_url?: string;
  api_key?: string;
  timeout?: number;
  refresh_interval?: number;
  [key: string]: any;
}
```

### AuditLog Entity (`src/admin/entities/audit-log.entity.ts`)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK | Log UUID |
| tenant_id | uuid | NULLABLE | Tenant reference |
| user_id | uuid | NOT NULL | User reference |
| action | varchar(100) | NOT NULL | Action type |
| entity_type | varchar(100) | NOT NULL | Entity affected |
| entity_id | varchar(100) | NULLABLE | Entity ID |
| old_value | jsonb | NULLABLE | Previous state |
| new_value | jsonb | NULLABLE | New state |
| ip_address | varchar(45) | NULLABLE | Client IP |
| user_agent | varchar(500) | NULLABLE | Client user agent |
| created_at | timestamp | | Record creation |
| updated_at | timestamp | | Record update |

## Soft Delete Pattern

All entities include the `DeleteDateColumn`:

```typescript
@DeleteDateColumn()
deleted_at: Date | null;
```

**Query Pattern:**
```typescript
// TypeORM automatically filters soft-deleted records
// To include deleted: withDeleted()
```

## Money/Decimal Handling

| Entity | Column | Type | Precision | Scale |
|--------|--------|------|-----------|-------|
| JournalLine | amount | decimal | 20 | 4 |
| Budget | amount | decimal | 20 | 4 |
| Budget | spent_amount | decimal | 20 | 4 |
| Budget | alert_threshold | decimal | 3 | 2 |
| ExchangeRate | rate | decimal | 20 | 8 |

**Never use float for money values.**

## Multi-Tenancy Implementation

1. **Row Level Security**: All tenant-scoped tables include `tenant_id` column
2. **Tenant Middleware**: Extracts `tenant_id` from JWT and sets context
3. **Repository Queries**: All queries include `tenant_id` filter
4. **TenantContext**: Async local storage for tenant information

```typescript
// Example tenant-aware query
const accounts = await repo.find({
  where: { tenant_id: TenantContext.getTenantId() },
});
```

## Database Indexes Summary

| Table | Index | Columns |
|-------|-------|---------|
| accounts | PK | id |
| accounts | FK | tenant_id |
| accounts | FK | parent_id |
| exchange_rates | INDEX | from_currency, to_currency, date |
| exchange_rates | INDEX | provider_id |
| exchange_rates | INDEX | fetched_at |
| exchange_rates | INDEX | date, fetched_at |
| journal_entries | INDEX | tenant_id |
| journal_entries | INDEX | date |
| admin_audit_logs | INDEX | tenant_id |
| admin_audit_logs | INDEX | user_id |
| admin_audit_logs | INDEX | created_at |
