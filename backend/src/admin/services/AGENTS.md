# Admin Services - Agent Knowledge Base

**Location:** `backend/src/admin/services/`
**Generated:** 2026-01-24

---

## OVERVIEW

Specialized services for administrative operations including user management, system configuration, health monitoring, and exchange rate infrastructure. Each service handles a distinct admin domain with consistent audit logging and error handling patterns.

---

## SERVICES

| Service File | Purpose |
|--------------|---------|
| `user-management.service.ts` | User CRUD, role management, password reset, bulk enable/disable/role_change actions |
| `system-config.service.ts` | Global settings: default currency, decimals, timezone, date_format, session timeout, MFA toggle |
| `audit-log.service.ts` | Query audit logs with filters (user_id, action, entity_type, date range), CSV export to `admin_audit_logs` table |
| `currency-management.service.ts` | Currency CRUD, seed default currencies via `currenciesService` |
| `health-monitoring.service.ts` | System health checks: database (latency query), cache, active providers count, storage; returns uptime, memory usage, active users, RPM |
| `plugin-management.service.ts` | JS plugin file listing, upload to `PLUGIN_DIR` (default `./plugins`), reload hot-swappable rate provider plugins |
| `provider-management.service.ts` | Provider CRUD, toggle active/inactive, test connection latency; auto-associates currencies on create |
| `scheduler-management.service.ts` | Scheduler config (enabled, interval, currencies, base_currency), manual rate fetch trigger, history from audit logs |

---

## PATTERNS

- **@Injectable()** decorator on all service classes
- **@AuditLog** decorator on create/update/delete operations with:
  - `action` (e.g., `admin.user.create`)
  - `entityType` (e.g., `user`, `provider`)
  - `getEntityId` / `getOldValue` / `getNewValue` functions
  - `extractIpFromArgs`, `extractTenantIdFromArgs` flags
- **Pagination params**: `{ offset?: number; limit?: number }` pattern
- **Method signatures**: `(id, data?, adminId, ipAddress?)` for consistency
- **Repository injection**: `@InjectRepository(Entity)` via TypeORM
- **Bulk operations**: Loop with individual saves (not batch), return `{ affected: number }`
- **CSV export**: Simple string construction, headers + rows mapping

---

## CROSS-CUTTING

| Concern | Implementation |
|---------|----------------|
| **Audit logging** | `@AuditLog` decorator + `AuditEventPublisher` |
| **Event publishing** | `AuditEventPublisher` injected in services needing async event emission |
| **TypeORM** | Repositories for User, Currency, Provider, ExchangeRate, AuditLog entities |
| **Error handling** | `NotFoundException`, `BadRequestException`, `ConflictException` from `@nestjs/common` |
| **Logging** | `Logger` from `@nestjs/common` for service operations |
| **Password hashing** | `bcrypt` with salt rounds (user-management.service.ts) |

---

## ANTI-PATTERNS

- **Self-disable prevention**: `disableUser()` skips self via `if (user.id === adminId)` - ensure all user-altering operations have this check
- **Plugin file parsing**: Regex-based extraction of `name`, `version`, `description` - fragile for malformed JS; validate before upload
- **Manual fetch loop**: Triple-nested `for` loops (providers × currencies × base) - consider batching for performance at scale
- **In-memory scheduler config**: `schedulerConfig` stored as instance variable - lost on restart; should persist to database

---

## CROSS-REFERENCES

- **Parent AGENTS.md**: [backend/AGENTS.md](../AGENTS.md) - Module overview, auth, accounts, journal, rates, providers, scheduler, budgets, reports, tenants, currencies
- **Related modules**:
  - `auth/user.entity.ts` - User entity referenced by user-management
  - `rates/provider.entity.ts` - Provider entity for provider/scheduler management
  - `currencies/currency.entity.ts` - Currency entity for currency management
  - `currencies/currencies.service.ts` - Delegated for currency CRUD operations
- **Requirements docs**:
  - [Requirements - Admin](../docs/requirements/REQUIREMENTS_ADMIN.md)
  - [Requirements - Plugin System](../docs/requirements/REQUIREMENTS_PLUGIN_SYSTEM.md)
  - [Requirements - Multi-Currency](../docs/requirements/REQUIREMENTS_MULTI_CURRENCY.md)
