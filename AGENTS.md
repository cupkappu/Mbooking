# Multi-Currency Accounting - Agent Knowledge Base

**Generated:** 2026-01-18
**Branch:** develop
**Tech Stack:** Next.js 14 + NestJS 10 + PostgreSQL 15

---

## Project Overview

Personal accounting software with double-entry bookkeeping, multi-currency support, hierarchical accounts, and plugin-extensible rate providers.

---

## Architecture

```
multi_currency_accounting/
├── frontend/              # Next.js 14 App Router (Port 8068)
│   ├── app/              # Pages + API routes
│   ├── components/       # UI + feature components
│   ├── hooks/           # Custom React hooks
│   ├── lib/             # Utilities + API client
│   ├── providers/       # Context providers (session, query)
│   ├── tests/           # Test utilities
│   └── types/           # TypeScript definitions
├── backend/              # NestJS 10 (Port 8067)
│   ├── src/
│   │   ├── auth/        # JWT + NextAuth integration
│   │   ├── accounts/    # Account CRUD + hierarchy
│   │   ├── journal/     # Double-entry ledger
│   │   ├── query/       # Balance query engine
│   │   ├── rates/       # Exchange rate engine
│   │   ├── providers/   # Plugin system
│   │   ├── scheduler/   # Rate fetching cron
│   │   ├── budgets/     # Budget management
│   │   ├── reports/     # Financial statements
│   │   ├── tenants/     # Multi-tenant RLS
│   │   ├── currencies/  # Currency registry
│   │   ├── admin/       # Admin panel module
│   │   └── common/      # Shared utilities, seeds
│   └── plugins/         # JS provider plugins (mounted volume)
├── shared/               # Shared TypeScript types (TODO: create)
├── docs/
│   ├── requirements/    # Decomposed requirements
│   └── architecture/    # Design documents
└── database/
    ├── migrations/      # TypeORM migrations (TODO: create)
    └── seeders/         # Seed data
```

---

## Entry Points

### Backend
| File | Purpose |
|------|---------|
| `backend/src/main.ts` | Bootstrap: NestFactory, CORS, ValidationPipe, Swagger at `/api/docs` |
| `backend/src/app.module.ts` | Root module importing 12 feature modules |
| `backend/src/auth/authelia.middleware.ts` | Authelia SSO integration (optional) |

### Frontend
| File | Purpose |
|------|---------|
| `frontend/app/page.tsx` | Root: dynamic import with `ssr: false` for LandingPageContent |
| `frontend/app/layout.tsx` | Root layout with AppProviders (Session + Query) |
| `frontend/app/api/auth/[...nextauth]/route.ts` | NextAuth.js handler |
| `frontend/providers/app-providers.tsx` | SessionProvider + QueryProvider wrapper |
| `(dashboard)/layout.tsx` | Sidebar nav, SessionSync, UserMenu |
| `(auth)/layout.tsx` | Centered auth layout |
| `(admin)/layout.tsx` | Admin panel layout (8 nav items) |

---

## CI/CD Pipeline

### GitHub Actions Workflows
| File | Triggers | Purpose |
|------|----------|---------|
| `.github/workflows/docker-build.yml` | master push, v* tags | Multi-arch Docker build → GHCR |
| `.github/workflows/docker-ci.yml` | master/develop push | Docker validation, unit tests |

### Docker Configuration
- **Multi-stage builds**: `node:20-alpine` base, non-root user (UID/GID 99999)
- **Frontend**: Standalone output mode for minimal image
- **Backend**: Plugins directory copied separately for hot-reload
- **Services**: PostgreSQL 15 (5432), Backend (8067), Frontend (8068)
- **Resource limits**: Backend (1 CPU, 1GB), Frontend (0.5 CPU, 512MB)

### Non-Standard Patterns
- Chinese comments in GitHub Actions workflows
- Multi-architecture builds (amd64/arm64) via Buildx
- TypeScript source validation in CI (fails if .ts in production image)
- CI-aware Playwright: `forbidOnly: true`, retries on CI only, sequential workers

---

## Configuration Files

### TypeScript
| Location | Strictness | Key Settings |
|----------|------------|--------------|
| `frontend/tsconfig.json` | **Strict** | `strict: true`, ESNext, path aliases `@/*` → `./*` |
| `backend/tsconfig.json` | Relaxed | `strictNullChecks: false`, `noImplicitAny: false`, decorators enabled |

### Key Configs
- `frontend/next.config.mjs`: Standalone output, API rewrites (`/api/v1/*` → backend)
- `frontend/tailwind.config.ts`: shadcn/ui, dark mode, custom animations
- `frontend/jest.config.ts`: Coverage enabled, path aliases
- `playwright.config.ts`: 7 browser projects (Chromium, Firefox, WebKit, mobile)
- `docker-compose.yml`: Resource limits, health checks, plugin volume mount

### Environment Variables
```bash
# Required
DATABASE_*              # PostgreSQL connection
JWT_SECRET              # Min 32 chars
NEXTAUTH_URL/SECRET     # NextAuth
NEXT_PUBLIC_API_URL     # Backend URL

# Optional
GOOGLE_CLIENT_*/        # OAuth
AUTHELIA_URL/API_KEY    # SSO
```

---

## Subagent Responsibilities

### Frontend Tasks → `frontend-ui-ux-engineer`

**ALWAYS delegate:**
- UI/UX changes (colors, layout, animations, responsive)
- Component styling (Tailwind, shadcn/ui)
- Visual feedback (loaders, toasts, transitions)
- Dashboard visualizations (charts, graphs)
- Report styling (tables, printable formats)

**Handle directly:**
- API integration logic
- React Query hooks
- State management
- Type definitions
- Route handling

**Frontend entry:** `frontend/app/page.tsx` → redirects to dashboard
**API proxy:** `frontend/app/api/[...nextauth]` → forwards to backend

### Backend Tasks → Delegate to appropriate subagent

| Domain | Subagent | Trigger |
|--------|----------|---------|
| Auth flow | `explore` | JWT, session, OAuth |
| Database queries | `explore` | TypeORM, RLS, relations |
| Rate calculations | `librarian` | Exchange rate math, provider APIs |
| Plugin system | `librarian` | JS module loading, dynamic import |
| Performance | `oracle` | Query optimization, caching |

### Documentation → `document-writer`

**Delegate:**
- API documentation (OpenAPI/Swagger)
- User guides (README additions)
- Architecture decision records (ADRs)
- Requirements decomposition

**Handle directly:**
- Code comments
- Commit messages
- Inline documentation

### Complex Investigation → `oracle`

**Consult before:**
- Multi-system architecture decisions
- Security/permission model design
- Performance optimization strategies
- Breaking changes affecting multiple modules
- Plugin system security implications

---

## Where to Look

| Task | Location | Notes |
|------|----------|-------|
| Login/auth | `frontend/app/(auth)/login/page.tsx` + `backend/src/auth/` | NextAuth.js + JWT |
| Account tree | `backend/src/accounts/` + `frontend/components/accounts/` | Unlimited nesting |
| Journal entries | `backend/src/journal/` + `frontend/app/(dashboard)/journal/` | Double-entry |
| Exchange rates | `backend/src/rates/` + `backend/src/providers/` | Plugin-based |
| Reports | `backend/src/reports/` + `frontend/app/(dashboard)/reports/` | Balance sheet, income |
| Budgets | `backend/src/budgets/` + `frontend/components/budgets/` | Periodic + one-time |
| Settings | `frontend/app/(dashboard)/settings/` + `backend/src/currencies/` | Currencies, providers |

---

## Requirements Documentation Structure

**Critical:** All requirements are decomposed in `docs/requirements/`

| File | Scope | References |
|------|-------|------------|
| `PRD.md` | Master product document | All others |
| `REQUIREMENTS_CORE.md` | Core accounting features | Account types, journal entries |
| `REQUIREMENTS_MULTI_CURRENCY.md` | Currency handling | Rates, providers, conversion |
| `REQUIREMENTS_QUERY_ENGINE.md` | Balance queries | Depth, pagination, filters |
| `REQUIREMENTS_REPORTS.md` | Financial reports | Balance sheet, income statement |
| `REQUIREMENTS_BUDGETS.md` | Budget management | Periodic, alerts, tracking |
| `REQUIREMENTS_PLUGIN_SYSTEM.md` | Provider extensibility | JS plugins, REST APIs |
| `REQUIREMENTS_ADMIN.md` | Admin management | User management, system config |
| `REQUIREMENTS_API.md` | API specifications | Endpoints, authentication |
| `REQUIREMENTS_DATABASE.md` | Data model | Entities, RLS, migrations |

**Cross-reference pattern:**
```markdown
// In each requirements file:
See also:
- [Core Features](../REQUIREMENTS_CORE.md#account-types)
- [API Specs](../REQUIREMENTS_API.md#journal-endpoints)
- [Database](../REQUIREMENTS_DATABASE.md#journal-entries)
```

---

## Admin Management System Requirements

**Location:** `docs/requirements/REQUIREMENTS_ADMIN.md`

### Admin Features

| Module | Description |
|--------|-------------|
| User Management | Create, update, disable users; role assignment |
| System Settings | Currency defaults, timezone, date formats |
| Provider Admin | Configure rate providers, test connections |
| Audit Logs | Track all system actions, export logs |
| Data Export | Full data export for backup/migration |
| Plugin Management | Upload, configure, enable/disable plugins |
| Scheduler Control | Manage rate fetching schedules, manual triggers |
| Health Monitoring | System status, database connectivity, cache |

### Admin API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/admin/users` | List users with pagination |
| POST | `/api/v1/admin/users` | Create new user |
| PUT | `/api/v1/admin/users/:id` | Update user |
| DELETE | `/api/v1/admin/users/:id` | Soft-delete user |
| GET | `/api/v1/admin/system/config` | Get system configuration |
| PUT | `/api/v1/admin/system/config` | Update system settings |
| GET | `/api/v1/admin/logs` | Query audit logs |
| GET | `/api/v1/admin/export` | Trigger data export |
| GET | `/api/v1/admin/health` | System health check |

---

## Conventions

### Backend (NestJS)

- **Module pattern:** Each feature has its own module in `backend/src/{feature}/`
- **DTOs:** `dto/` subdirectory for input validation
- **Entities:** `entities/` subdirectory for TypeORM entities
- **Guards:** `auth/` guard for JWT validation
- **Decorators:** Custom decorators in `common/decorators/`
- **Testing:** `*.spec.ts` files co-located with modules

### Frontend (Next.js)

- **Route groups:** `(auth)` and `(dashboard)` for layout separation
- **Components:** `components/ui/` for shadcn/ui, `components/{feature}/` for feature components
- **Hooks:** `hooks/use-*.ts` for data fetching with React Query
- **API client:** `lib/api.ts` with typed methods
- **Types:** `types/` for shared TypeScript interfaces

### Database

- **RLS:** All tenant-isolated tables have Row Level Security
- **Soft delete:** Use `deleted_at` column, never hard delete
- **Timestamps:** All tables have `created_at`, `updated_at`
- **UUIDs:** Primary keys use UUID v4

---

## Commands

```bash
# Development
npm run dev              # Start frontend + backend
cd backend && npm run start:dev
cd frontend && npm run dev

# Testing
npm test                # Run all tests
cd backend && npm run test
cd frontend && npm run test

# Database
npm run db:migrate      # Run TypeORM migrations
npm run db:seed         # Seed initial data
npm run db:studio       # Open TypeORM studio

# Docker
docker-compose up -d    # Full stack
docker-compose logs -f  # View logs
```

---

## Anti-Patterns (THIS PROJECT)

- **NEVER** hard delete data → use `deleted_at`
- **NEVER** bypass RLS → always filter by tenant
- **NEVER** expose raw TypeORM entities → use DTOs
- **NEVER** skip validation → use class-validator DTOs
- **NEVER** embed secrets in frontend → use env vars only
- **NEVER** use `float` for money → use `decimal` type
- **NEVER** use `any` type in TypeScript → use proper types

---

## Gotchas

1. **Tenant isolation:** Middleware sets `app.current_tenant_id` for RLS
2. **Exchange rates:** Historical rates stored per-date; latest rates cached
3. **Account hierarchy:** `path` computed column, `depth` tracked for queries
4. **Journal balance:** Debits must equal credits; validated before save
5. **Provider plugins:** Hot-reloaded on config change; test before use
6. **Currency decimals:** Fiat = 2 decimals, Crypto = 8 decimals
7. **TypeORM synchronize:** Currently `true` - migrations not yet implemented
8. **Missing data-source.ts:** Migration CLI commands require config file
9. **Non-standard ports:** Backend 8067, Frontend 8068 (not 3000/3001)
10. **No shared types:** Shared directory exists but not populated

---

## Non-Standard Patterns (This Project)

### CI/CD
- Chinese comments in GitHub Actions workflows
- Multi-architecture Docker builds (amd64/arm64)
- TypeScript source validation in CI (fails if .ts in production image)
- CI-aware Playwright: `forbidOnly: true`, retries on CI only, sequential workers

### TypeScript
- Frontend: Strict mode enabled
- Backend: Relaxed strictness (`strictNullChecks: false`, `noImplicitAny: false`)
- Path aliases differ: `@/*` → `./*` (frontend), `@/*` → `src/*` (backend)

### Docker
- Non-root user UID/GID 99999 (avoids host conflicts)
- Frontend standalone output mode
- Backend plugins directory as mounted volume
- Resource limits in development compose

---

## Notes

- Admin system requires `admin` role (separate from regular users)
- All admin actions logged to `admin_audit_logs` table
- Rate providers can be JS plugins or REST API configs
- Reports generated on-demand; can be cached for 1 hour

---

## Missing/Issues to Address

| Issue | Location | Impact |
|-------|----------|--------|
| Missing `data-source.ts` | `backend/src/config/` | Migration CLI commands fail |
| No `shared/` types | Root | Type duplication between frontend/backend |
| `synchronize: true` | `app.module.ts` | Dangerous for production |
| No migrations | `database/migrations/` | No schema version control |
