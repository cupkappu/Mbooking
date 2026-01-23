# Implementation Plan: CSV Export for Bills and Accounts

**Branch**: `001-export-csv` | **Date**: 2026-01-23 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-export-csv/spec.md`

## Summary

Add CSV export functionality for bills (journal entries) and accounts in a multi-currency personal accounting application. Users can export data from bills and accounts sections with filtering capabilities (date range for bills, account type for accounts). CSV files must support UTF-8 encoding and proper escaping of special characters. Target performance: export 10,000 records within 10 seconds with 95% success rate.

## Technical Context

**Language/Version**: TypeScript (both frontend and backend - Next.js 14 + NestJS 10)  
**Primary Dependencies**: Next.js 14 App Router, NestJS 10, TypeORM, PostgreSQL 15, React Query  
**Storage**: PostgreSQL 15 with TypeORM entities  
**Testing**: Jest (backend unit tests), Playwright (E2E tests), React Testing Library (frontend components)  
**Target Platform**: Web application (desktop browser, responsive for mobile)  
**Project Type**: web (frontend + backend)  
**Performance Goals**: Export 10,000 records within 10 seconds (SC-001)  
**Constraints**: Tenant isolation required (VII), UTF-8 CSV encoding (III), Type safety (III)  
**Scale/Scope**: Single-tenant user data export, typical datasets up to 10,000 records  

## Constitution Check (Post-Design)

*Re-evaluated after Phase 1 design*

| Principle | Requirement | Status | Notes |
|-----------|-------------|--------|-------|
| I. Financial Integrity | N/A - read-only export | ✅ Pass | No monetary calculations or modifications |
| II. Tenant Isolation | User data only, no cross-tenant access | ✅ Pass | Respects `TenantContext.requireTenantId()` for all queries |
| III. Type Safety | No `any`, proper TypeScript strict mode | ✅ Pass | DTOs with class-validator, streaming types defined |
| IV. Validation & Data Integrity | DTOs for API contracts | ✅ Pass | Export filter DTOs with validation rules |
| V. Plugin System Integrity | N/A | ✅ Pass | No plugins involved |
| VI. Code Quality Standards | Single responsibility, DRY, self-documenting | ✅ Pass | Export module isolated, CSV transforms separated |
| VII. Testing Standards | Unit + E2E tests required | ✅ Pass | Service tests + E2E scenarios defined |
| VIII. UX Consistency | shadcn/ui, loading states, error toasts | ✅ Pass | ExportButton component with loading state |
| IX. Performance Requirements | Pagination for large exports | ✅ Pass | Cursor pagination + streaming (resolved in research) |

**GATE RESULT**: ✅ PASS - All constitution principles satisfied

---

## Phase 0: Research & Clarifications - COMPLETED

### Research Outputs

| Task | Topic | Result |
|------|-------|--------|
| Research 1 | CSV export strategy | Server-side streaming with UTF-8 BOM |
| Research 2 | TypeORM pagination | Cursor-based pagination with stream() |
| Research 3 | Date picker | shadcn/ui DatePicker available in frontend/components/ui |

### Resolved Unknowns

1. **CSV Export Strategy**: Server-side streaming (not browser-based) to handle 10,000+ records
2. **Pagination/Streaming**: Cursor-based pagination with TypeORM stream() for memory efficiency
3. **Date Filter UI**: Use existing shadcn/ui DatePicker component

**Research document**: [research.md](./research.md)

---

## Phase 1: Design & Contracts - COMPLETED

### Generated Artifacts

| Artifact | Path | Description |
|----------|------|-------------|
| Data Model | [data-model.md](./data-model.md) | Export audit entity, DTOs, CSV schemas |
| API Contracts | [contracts/export-api.yaml](./contracts/export-api.yaml) | OpenAPI 3.0.3 specification |
| Frontend Contracts | [contracts/frontend-contracts.md](./contracts/frontend-contracts.md) | React hooks, components, API types |
| Quickstart | [quickstart.md](./quickstart.md) | Development guide, API examples, testing |

### Design Summary

**Backend Architecture**:
- New `export/` module following existing module pattern
- `ExportService` with cursor-based pagination and streaming
- `ExportController` with StreamableFile response
- RFC 4180 compliant CSV formatting with UTF-8 BOM

**Frontend Architecture**:
- `useExportBills` and `useExportAccounts` React Query hooks
- `ExportButton` component with loading states
- Optional `ExportFilterPanel` for P2 date/account type filters

**Performance Strategy**:
- Streaming response (not buffered)
- Cursor pagination (O(1) per batch)
- Batch size: 1000 records
- Target: 10,000 records in < 10 seconds

---

## Phase 2: Task Generation

Run `/speckit.tasks` to generate implementation tasks from this plan.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| N/A | No violations requiring justification | - |
