# Backend Module Guide (NestJS)

**Location:** `backend/src/`
**Port:** 3001
**Last Updated:** 2026-01-24
**Commit:** 0f48536a217e5f1a79340c5a79f1cf94b023d801
**Branch:** master

---

## Module Structure

```
backend/src/
├── auth/           # JWT + NextAuth integration
├── accounts/       # Account CRUD + hierarchy
├── admin/          # Admin panel + granular services
│   ├── services/   # Granular admin services (17 files)
│   ├── dto/        # Admin DTOs
│   ├── entities/   # Admin entities
│   ├── decorators/ # Admin-specific decorators
│   ├── guards/     # Admin guards
│   └── events/     # Admin event handlers
├── journal/        # Double-entry ledger
├── query/          # Balance query engine
├── rates/          # Exchange rate engine
├── providers/      # Plugin system
├── scheduler/      # Rate fetching cron
├── budgets/        # Budget management
├── reports/        # Financial statements
├── export/         # CSV export functionality
│   ├── dto/        # Export DTOs
│   ├── entities/   # Export entities
│   └── streams/    # CSV transformation streams
├── tenants/        # Multi-tenant RLS
├── currencies/     # Currency registry
├── common/         # Shared utilities
└── app.module.ts   # Root module
```

---

## Module Responsibilities

### auth/ (Authentication)

**Handles:**
- JWT token validation
- User session management
- Role-based access control
- Authelia header processing

**Key files:**
- `auth.guard.ts` - JWT validation
- `strategies/` - Passport strategies
- `decorators/` - Auth decorators

**Related:** `frontend/lib/auth-options.ts`

---

### accounts/ (Account Management)

**Handles:**
- CRUD operations for accounts
- Hierarchical tree management
- Path and depth computation
- Parent/child relationships

**Key files:**
- `accounts.service.ts` - Business logic
- `accounts.controller.ts` - REST endpoints
- `entities/account.entity.ts` - TypeORM entity
- `dto/` - Validation DTOs

**Related:**
- [Requirements - Core Features](../docs/requirements/REQUIREMENTS_CORE.md)
- [Requirements - Database](../docs/requirements/REQUIREMENTS_DATABASE.md)

---

### admin/ (Admin Panel)

**Handles:**
- User management (CRUD, roles, permissions)
- System configuration management
- Currency management
- Provider management (rate providers)
- Plugin management (JS plugins)
- Scheduler management (cron jobs)
- Health monitoring
- Audit logging

**Key files:**
- `admin.service.ts` - Monolithic admin service (root level)
- `admin.controller.ts` - Admin REST endpoints
- `admin.module.ts` - Module definition

**Key files in `services/` subdirectory:**
- `user-management.service.ts` - User CRUD, role management
- `system-config.service.ts` - System configuration
- `currency-management.service.ts` - Currency settings
- `provider-management.service.ts` - Rate provider management
- `plugin-management.service.ts` - JS plugin management
- `scheduler-management.service.ts` - Cron job management
- `health-monitoring.service.ts` - System health checks
- `audit-log.service.ts` - Audit trail logging

**Related:**
- [Requirements - Admin](../docs/requirements/REQUIREMENTS_ADMIN.md)

---

### journal/ (Journal Entries)

**Handles:**
- Double-entry bookkeeping
- Transaction validation (balance check)
- Multi-currency support
- Tag management

**Key files:**
- `journal.service.ts` - Entry management
- `journal.controller.ts` - REST endpoints
- `entities/` - Entry and line entities
- `validators/` - Balance validation

**Related:**
- [Requirements - Core Features](../docs/requirements/REQUIREMENTS_CORE.md#journal-entries)
- [Requirements - API](../docs/requirements/REQUIREMENTS_API.md#journal-management-api)

---

### query/ (Query Engine)

**Handles:**
- Balance queries with depth
- Transaction search
- Pagination and filtering
- Cache management

**Key files:**
- `query.service.ts` - Query logic
- `query.controller.ts` - Query endpoints
- `cache/` - Redis/memory caching

**Related:**
- [Requirements - Query Engine](../docs/requirements/REQUIREMENTS_QUERY_ENGINE.md)

---

### rates/ (Exchange Rates)

**Handles:**
- Rate retrieval and storage
- Currency conversion
- Historical rate queries
- Rate caching

**Key files:**
- `rates.service.ts` - Rate operations
- `rates.controller.ts` - REST endpoints
- `entities/exchange-rate.entity.ts`

**Related:**
- [Requirements - Multi-Currency](../docs/requirements/REQUIREMENTS_MULTI_CURRENCY.md)

---

### providers/ (Plugin System)

**Handles:**
- JS plugin loading
- REST API provider configuration
- Provider lifecycle management
- Hot-reload on config change

**Key files:**
- `providers.service.ts` - Provider management
- `plugins/` - Plugin loader
- `rest-api-provider.ts` - REST provider impl

**Related:**
- [Requirements - Plugin System](../docs/requirements/REQUIREMENTS_PLUGIN_SYSTEM.md)

---

### scheduler/ (Cron Jobs)

**Handles:**
- Scheduled rate fetching
- Provider health checks
- Cache expiration

**Key files:**
- `scheduler.service.ts` - Cron jobs
- `decorators/` - @Interval, @Cron

---

### budgets/ (Budget Management)

**Handles:**
- Budget CRUD
- Progress tracking
- Alert generation

**Key files:**
- `budgets.service.ts` - Budget logic
- `budgets.controller.ts` - REST endpoints
- `entities/budget.entity.ts`

**Related:**
- [Requirements - Budgets](../docs/requirements/REQUIREMENTS_BUDGETS.md)

---

### reports/ (Financial Reports)

**Handles:**
- Balance sheet generation
- Income statement generation
- Report caching

**Key files:**
- `reports.service.ts` - Report generation
- `reports.controller.ts` - Report endpoints

**Related:**
- [Requirements - Reports](../docs/requirements/REQUIREMENTS_REPORTS.md)

---

### export/ (CSV Export)

**Handles:**
- Journal entry exports to CSV
- Account exports to CSV
- Export audit logging
- Streaming CSV transformations
- Date preset filtering

**Key files:**
- `export.service.ts` - Export business logic
- `export.controller.ts` - Export REST endpoints
- `export.module.ts` - Module definition

**Key files in `streams/` subdirectory:**
- `csv-transform.stream.ts` - Stream-based CSV transformation
- `csv-formatter.util.ts` - CSV formatting utilities

**Key files in `dto/` subdirectory:**
- `export-bills.dto.ts` - Bills export DTO with date presets
- `export-filters.dto.ts` - Export filter DTOs
- `export-accounts.dto.ts` - Account export DTO

**Key files in `entities/` subdirectory:**
- `export-audit.entity.ts` - Export audit log entity

**Related:**
- [Requirements - Export CSV](../docs/requirements/REQUIREMENTS_API.md#export-endpoints)

---

### tenants/ (Multi-Tenancy)

**Handles:**
- Tenant isolation
- RLS context management
- Tenant settings

**Key files:**
- `tenants.service.ts` - Tenant operations
- `middleware/` - RLS middleware

**Related:**
- [Requirements - Database RLS](../docs/requirements/REQUIREMENTS_DATABASE.md#row-level-security)

---

### currencies/ (Currency Registry)

**Handles:**
- Currency CRUD
- Currency validation
- Decimal place management

**Key files:**
- `currencies.service.ts` - Currency operations
- `currencies.controller.ts` - REST endpoints

**Related:**
- [Requirements - Multi-Currency](../docs/requirements/REQUIREMENTS_MULTI_CURRENCY.md#currency-registry)

---

## Common Utilities

### common/ directory

| Directory | Purpose |
|-----------|---------|
| `decorators/` | Custom decorators (@User, @Tenant) |
| `filters/` | Exception filters |
| `guards/` | Auth guards |
| `interceptors/` | Response formatting |
| `pipes/` | Validation pipes |

---

## Development Conventions

### Module Pattern

Each feature module follows:
```
src/{feature}/
├── {feature}.module.ts    # Module definition
├── {feature}.service.ts   # Business logic
├── {feature}.controller.ts # REST endpoints
├── entities/             # TypeORM entities
├── dto/                  # Input validation
└── {feature}.spec.ts     # Tests
```

**Exception:** The `admin/` module has a `services/` subdirectory with granular services:
```
src/admin/
├── admin.module.ts         # Module definition
├── admin.service.ts        # Monolithic service (legacy)
├── admin.controller.ts     # REST endpoints
├── services/               # Granular admin services
│   ├── user-management.service.ts
│   ├── system-config.service.ts
│   ├── currency-management.service.ts
│   ├── provider-management.service.ts
│   ├── plugin-management.service.ts
│   ├── scheduler-management.service.ts
│   ├── health-monitoring.service.ts
│   └── audit-log.service.ts
├── dto/                   # Admin DTOs
├── entities/              # Admin entities
├── decorators/            # Admin decorators
└── guards/                # Admin guards
```

### Entity Design

- Use UUID for primary keys
- Add `created_at`, `updated_at`, `deleted_at`
- Use `Decimal` for money, not `float`
- Index foreign keys and frequently queried columns

### DTO Pattern

```typescript
// Create DTO
export class CreateAccountDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name: string;

  @IsEnum(AccountType)
  type: AccountType;

  @IsString()
  @IsOptional()
  parent_id?: string;

  @IsString()
  currency: string;
}
```

### Testing

- Unit tests: `*.spec.ts` files
- Integration tests: `*.e2e-spec.ts` files
- Use Jest framework
- Mock external dependencies

---

## Commands

```bash
# Development
cd backend
npm run start:dev       # Watch mode
npm run start           # Normal mode
npm run build           # Production build

# Testing
npm run test            # Unit tests
npm run test:e2e        # E2E tests
npm run test:coverage   # Coverage report

# Database
npm run migration:generate -- -n Name
npm run migration:run
npm run migration:revert
```

---

## Anti-Patterns

- **NEVER** expose raw TypeORM entities → use DTOs
- **NEVER** skip validation → use class-validator
- **NEVER** hard delete → use `deleted_at`
- **NEVER** bypass RLS → always use tenant filter
- **NEVER** use `float` for money → use `decimal`

---

## Testing Conventions

### Backend Test Pattern
```typescript
// *.spec.ts files co-located with modules
describe('ServiceName', () => {
  let service: ServiceName;
  let repository: jest.Mocked<Repository<Entity>>;
  
  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ServiceName,
        { provide: getRepositoryToken(Entity), useValue: { ... } },
      ],
    }).compile();
    service = module.get<ServiceName>(ServiceName);
  });
});
```

### Test Files
- `backend/src/*.spec.ts` - Service tests (co-located)
- `backend/src/comprehensive.tdd.spec.ts` - Giant 973-line integration test (anti-pattern)

### Backend Jest Config (embedded in package.json)
```json
"jest": {
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": "src",
  "testRegex": ".*\\.spec\\.ts$",
  "transform": { "^.+\\.(t|j)s$": "ts-jest" },
  "collectCoverageFrom": ["**/*.(t|j)s"]
}
```

### Critical Issues

1. **Missing `data-source.ts`**: Migration CLI commands require `backend/src/config/data-source.ts`
2. **`synchronize: true` in app.module.ts**: Dangerous for production - use migrations instead
3. **TypeScript strictness**: Backend uses relaxed settings (`strictNullChecks: false`, `noImplicitAny: false`)
4. **Giant TDD test**: `comprehensive.tdd.spec.ts` contains tests for ALL services (not recommended)
