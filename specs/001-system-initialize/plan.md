# Implementation Plan: System Initialization Page

**Branch**: `001-system-initialize` | **Date**: 2026-01-22 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-system-initialize/spec.md`

## Summary

Create a system initialization page for first-time setup that:
- Detects empty database and redirects to initialization flow
- Requires INIT_SECRET environment variable for security
- Creates admin user with role 'admin' and associated tenant
- Seeds default currency data
- Prevents re-initialization after first setup

## Technical Context

**Language/Version**: TypeScript (Frontend: Strict mode, Backend: Relaxed tsconfig)
**Primary Dependencies**: Next.js 14, NestJS 10, TypeORM, PostgreSQL 15, NextAuth.js
**Storage**: PostgreSQL with existing User and Tenant entities
**Testing**: Jest (backend + frontend), Playwright (E2E)
**Target Platform**: Web (Next.js frontend + NestJS backend)
**Project Type**: Full-stack web application
**Performance Goals**: API response <500ms, form validation feedback <500ms
**Constraints**: INIT_SECRET required, transactional integrity, no type suppression
**Scale/Scope**: Single admin user creation, multi-tenant ready

## Constitution Check

*GATE: Must pass before implementation. Re-check after design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Financial Integrity | ✅ N/A | No monetary calculations |
| II. Tenant Isolation | ✅ PASS | Auto-creates tenant for first user |
| III. Type Safety | ✅ PASS | No `any`, proper types throughout |
| IV. Validation & Data Integrity | ✅ PASS | class-validator DTOs, proper DTOs |
| V. Plugin System Integrity | ✅ N/A | No plugins involved |
| VI. Code Quality Standards | ✅ PASS | Single responsibility, self-documenting |
| VII. Testing Standards | ✅ PASS | Unit + integration tests required |
| VIII. UX Consistency | ✅ PASS | shadcn/ui, loading states, toasts |
| IX. Performance | ✅ PASS | Simple flow, no performance concerns |

## Project Structure

### Documentation (this feature)

```
specs/001-system-initialize/
├── plan.md              # This file (/speckit.plan output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── openapi.yaml     # API contract
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```
backend/
├── src/
│   ├── setup/                    # NEW: Setup module
│   │   ├── setup.module.ts
│   │   ├── setup.controller.ts
│   │   ├── setup.service.ts
│   │   ├── dto/
│   │   │   ├── initialize.dto.ts
│   │   │   └── index.ts
│   │   └── setup.spec.ts
│   ├── auth/
│   │   └── user.entity.ts        # REUSE
│   ├── tenants/
│   │   └── tenant.entity.ts      # REUSE
│   └── common/
│       └── seeds/
│           └── admin-user-seed.service.ts  # MODIFY: Disable when setup enabled

frontend/
├── src/
│   ├── app/
│   │   └── (setup)/              # NEW: Setup route group
│   │       └── setup/
│   │           ├── page.tsx
│   │           └── setup-form.tsx
│   ├── components/
│   │   └── ui/                   # REUSE: shadcn components
│   └── hooks/
│       └── use-setup.ts          # NEW: Setup API hook
```

**Structure Decision**: Following established backend module pattern (`src/{feature}/`) and frontend component organization (`components/{feature}/`, `hooks/use-*.ts`).

## Complexity Tracking

> None - all design decisions align with constitution and project patterns.

## Phase 0 Output

- [x] `research.md` - Technical decisions documented
- [x] `data-model.md` - DTOs and validation rules
- [x] `contracts/openapi.yaml` - API specification
- [x] `quickstart.md` - Development guide

## Phase 1 Output (Design Complete)

| Artifact | Status | Path |
|----------|--------|------|
| Research | ✅ Done | `research.md` |
| Data Model | ✅ Done | `data-model.md` |
| API Contracts | ✅ Done | `contracts/openapi.yaml` |
| Quickstart | ✅ Done | `quickstart.md` |
| Agent Context | ⏳ Pending | Run update-agent-context.sh |

## Next Steps

```bash
# Generate implementation tasks
/speckit.tasks

# Or update agent context first
.specify/scripts/bash/update-agent-context.sh opencode
```
