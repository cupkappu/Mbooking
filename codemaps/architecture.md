# Architecture Codemap

Generated: 2026-01-27T00:00:00.000Z

## Project Overview

Multi-currency personal accounting software with double-entry bookkeeping.

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14 (App Router) |
| Backend | NestJS 10 |
| Database | PostgreSQL 15 |
| ORM | TypeORM |
| State Management | React Query |
| Authentication | NextAuth.js + JWT |

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  (auth)      │  │  (dashboard) │  │  (admin)             │  │
│  │  - Login     │  │  - Dashboard │  │  - System Config     │  │
│  │  - Register  │  │  - Accounts  │  │  - User Management   │  │
│  └──────────────┘  │  - Journal    │  │  - Health Monitoring │  │
│                    │  - Budgets     │  └──────────────────────┘  │
│                    │  - Reports     │                          │
│                    └──────────────┘                             │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  API Proxy: /api/v1/* → Backend (localhost:3001)          │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Backend (NestJS)                            │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────────┐   │
│  │ Auth   │ │Tenant  │ │Journal │ │Accounts│ │ Currencies │   │
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────────┘   │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────────┐   │
│  │ Budgets│ │ Rates  │ │Providers│ │ Query  │ │ Reports    │   │
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────────┘   │
│  ┌────────┐ ┌────────┐ ┌───────────────────────────────────┐ │
│  │ Admin  │ │ Setup  │ │ Scheduler, Export, Common         │ │
│  └────────┘ └────────┘ └───────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Database (PostgreSQL)                        │
│  - Multi-tenancy via RLS                                        │
│  - Soft deletes (deleted_at)                                    │
│  - UUID primary keys                                            │
│  - Decimal for money values                                     │
└─────────────────────────────────────────────────────────────────┘
```

## Backend Module Dependencies

```
app.module.ts
├── AuthModule (JWT, User entity)
├── TenantsModule (Tenant context, settings)
├── AccountsModule (Chart of accounts, tree structure)
├── JournalModule (Journal entries, journal lines)
├── QueryModule (Balances, summaries)
├── RatesModule (Exchange rates, graph engine)
├── ProvidersModule (Currency data providers)
├── SchedulerModule (Cron jobs)
├── BudgetsModule (Budgets, alerts, templates)
├── ReportsModule (Report generation, storage)
├── CurrenciesModule (Currency management)
├── AdminModule (Audit logs, system management)
├── SetupModule (System initialization)
└── ExportModule (Data export)
```

## Frontend Route Groups

| Route Group | Purpose | Layout |
|-------------|---------|--------|
| `(auth)` | Login, Register | Minimal (no sidebar) |
| `(dashboard)` | Main app pages | Sidebar + Header |
| `(setup)` | Initial setup | Minimal |
| `admin` | Admin panel | Admin layout |

## API Integration Pattern

```
Frontend          Next.js Proxy              NestJS Backend
  │                   │                           │
  ├── use-*.ts ─────►│── /api/v1/[...path] ─────►│── Controllers
  │                   │                           │      │
  │                   │                           │      ▼
  │                   │                           │── Services
  │                   │                           │      │
  │                   │                           │      ▼
  │                   │                           │── Repositories
  │                   ◄───────────────────────────│── Responses
  │                   │                           │
  ▼                   ▼                           ▼
React Query    JSON Response
```

## Multi-Tenancy Pattern

1. JWT token contains `tenant_id` claim
2. `TenantMiddleware` extracts tenant from JWT
3. `TenantContext` stores tenant ID in async local storage
4. All queries filtered by tenant via RLS or explicit filters
5. Never bypass RLS - always filter by tenant

## Key Conventions

- **Soft Deletes**: All entities use `deleted_at` column
- **Money Values**: Always `decimal` type, never float
- **Primary Keys**: UUID v4 on all tables
- **Timestamps**: `created_at`, `updated_at` on all entities
- **DTOs**: Never expose raw TypeORM entities to API
