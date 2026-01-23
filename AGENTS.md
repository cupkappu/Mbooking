# Multi-Currency Accounting - Agent Knowledge Base

**Generated:** 2026-01-21
**Commit:** 0dc90cf0 (feat: enhance provider creation form with new fields and validation)
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
│   ├── hooks/           # Custom React hooks (use-*.ts)
│   ├── lib/             # Utilities + API client
│   ├── providers/       # Context providers (session, query)
│   ├── tests/           # Test utilities + E2E page objects
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
├── database/
│   ├── migrations/      # TypeORM migrations (TODO: create)
│   └── seeders/         # Seed data
└── e2e/                 # Root E2E tests (10 spec files)
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
| `(admin)/layout.tsx` | Admin panel layout (10 nav items) |

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
- **Services**: PostgreSQL 15 (5432), Backend (8067→3001), Frontend (8068→3000)
- **Resource limits**: Backend (1 CPU, 1GB), Frontend (0.5 CPU, 512MB)

### Non-Standard CI/CD Patterns
- **Chinese comments** in GitHub Actions workflows
- **Multi-architecture builds** (amd64/arm64) via Buildx
- **TypeScript source validation** in CI (fails if .ts in production image)
- **CI-aware Playwright**: `forbidOnly: true`, retries on CI only, sequential workers
- **TS source leak prevention**: Build fails if .ts files exist in production Docker image

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

## Test Patterns

### Test Configuration Summary
| Aspect | Frontend | Backend | E2E |
|--------|----------|---------|-----|
| **Framework** | Jest + jsdom | Jest + node | Playwright |
| **Config** | jest.config.ts | package.json | playwright.config.ts (root + frontend) |
| **Test Pattern** | `*.spec.ts`, `*.spec.tsx` | `*.spec.ts` (co-located) | `*.spec.ts` |
| **Port** | 3000 | 3001 | 8068 (root) / 3000 (frontend) |

### Unique Conventions

**CI-Aware Playwright:**
```typescript
forbidOnly: !!process.env.CI,        // Fails if test.only left in code
retries: process.env.CI ? 2 : 0,     // Retries only in CI
workers: process.env.CI ? 1 : undefined, // Sequential in CI
reuseExistingServer: !process.env.CI // Fresh server in CI
```

**Tenant Context Helper (Backend):**
```typescript
const result = await runWithTenant('tenant-1', () => service.findAll());
```

**Page Object Model (Frontend E2E):**
- `tests/utils/auth.ts`: loginAsAdmin(), loginAsUser()
- `tests/utils/page-objects.ts`: BasePage, LoginPage, DashboardPage

### Test Files Found
| Category | Count | Notable Files |
|----------|-------|---------------|
| Backend .spec.ts | 13 | `comprehensive.tdd.spec.ts` (1012 lines - anti-pattern) |
| E2E .spec.ts (root) | 10 | `complete-e2e-flow.spec.ts`, `tdd-dashboard.spec.ts` |
| Frontend tests/ | 8 | Page objects, auth helpers, test data constants |

### Commands
```bash
npm test                # All workspace tests
npm run test:e2e        # Playwright E2E tests
cd backend && npm run test:cov  # Backend coverage
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
| Admin panel | `frontend/app/admin/` + `backend/src/admin/` | 10 admin modules |

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
npm run test:e2e        # Playwright E2E
cd backend && npm run test:cov

# Database
npm run db:migrate      # Run TypeORM migrations (requires data-source.ts)
npm run db:seed         # Seed initial data
npm run db:studio       # Open TypeORM studio

# Docker
docker-compose up -d    # Full stack
docker-compose logs -f  # View logs
```

---

## Anti-Patterns (THIS PROJECT)

### Core NEVER Rules
| Rule | Why |
|------|-----|
| **NEVER hard delete data** → use `deleted_at` | Audit trail, recovery, double-entry consistency |
| **NEVER bypass RLS** → always filter by tenant | Multi-tenant security isolation |
| **NEVER use `float` for money** → use `decimal` type | Floating-point rounding errors |
| **NEVER use `any` type** → use proper types | Type safety, maintainability |
| **NEVER expose raw TypeORM entities** → use DTOs | API contract stability |
| **NEVER skip validation** → use class-validator DTOs | Data integrity |

### Critical Issues
| Issue | Location | Impact |
|-------|----------|--------|
| Giant TDD test | `backend/src/comprehensive.tdd.spec.ts` (1012 lines) | Tests ALL services together - single responsibility violation |
| Missing `data-source.ts` | `backend/src/config/` | Migration CLI commands fail |
| `synchronize: true` | `app.module.ts` | Dangerous for production |
| Default secrets in Dockerfiles | `frontend/frontend/Dockerfile`, `docker-compose.yml` | Security risk if used in production |
| No frontend unit tests | `frontend/tests/` | Missing component/hook tests |

### Non-Standard Patterns
- **Chinese comments** in GitHub Actions and some test files
- **Non-standard ports**: Backend 8067, Frontend 8068 (not 3000/3001)
- **Two Playwright configs**: Root (port 8068, 3 browsers) + frontend (port 3000, 7 browsers + mobile)
- **TypeScript strictness mismatch**: Frontend strict, backend relaxed

---

## Gotchas

1. **Tenant isolation:** Middleware sets `app.current_tenant_id` for RLS
2. **Exchange rates:** Historical rates stored per-date; latest rates cached
3. **Account hierarchy:** `path` computed column, `depth` tracked for queries
4. **Journal balance:** Debits must equal credits, validated before save
5. **Provider plugins:** Hot-reloaded on config change; test before use
6. **Currency decimals:** Fiat = 2 decimals, Crypto = 8 decimals
7. **TypeORM synchronize:** Currently `true` - migrations not yet implemented
8. **Missing data-source.ts:** Migration CLI commands require config file
9. **Non-standard ports:** Backend 8067, Frontend 8068 (not 3000/3001)
10. **No shared types:** Shared directory exists but not populated
11. **JWT token in localStorage:** `auth-options.ts` stores token in client storage (security concern)
12. **SeedsModule in production:** `SeedsModule` imported in app.module.ts (typically dev-only)

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

### Testing
- CI-aware Playwright with mobile viewport testing
- Tenant context helper for RLS testing
- Page Object Model for E2E tests

---

## Missing/Issues to Address

| Issue | Location | Impact | Priority |
|-------|----------|--------|----------|
| Missing `data-source.ts` | `backend/src/config/` | Migration CLI commands fail | **Critical** |
| Default secrets in Dockerfiles | `Dockerfile`, `docker-compose.yml` | Security risk in production | **Critical** |
| Giant TDD test file | `backend/src/comprehensive.tdd.spec.ts` | Maintenance burden | High |
| No frontend unit tests | `frontend/tests/` | Missing test coverage | Medium |
| Duplicate Playwright configs | Root + frontend | Confusing which to run | Medium |
| TypeScript strictness mismatch | `tsconfig.json` files | Inconsistent code quality | Low |
| Chinese comments in CI | `.github/workflows/` | Confusion for contributors | Low |

---

## Notes

- Admin system requires `admin` role (separate from regular users)
- All admin actions logged to `admin_audit_logs` table
- Rate providers can be JS plugins or REST API configs
- Reports generated on-demand; can be cached for 1 hour
- Root page uses `dynamic()` with `ssr: false` to avoid useSession SSR issues

## Active Technologies
- TypeScript (Frontend: Strict mode, Backend: Relaxed tsconfig) + Next.js 14, NestJS 10, TypeORM, PostgreSQL 15, NextAuth.js (001-system-initialize)
- PostgreSQL with existing User and Tenant entities (001-system-initialize)
- TypeScript (both frontend and backend - Next.js 14 + NestJS 10) + Next.js 14 App Router, NestJS 10, TypeORM, PostgreSQL 15, React Query (001-export-csv)
- PostgreSQL 15 with TypeORM entities (001-export-csv)

## Recent Changes
- 001-system-initialize: Added TypeScript (Frontend: Strict mode, Backend: Relaxed tsconfig) + Next.js 14, NestJS 10, TypeORM, PostgreSQL 15, NextAuth.js
