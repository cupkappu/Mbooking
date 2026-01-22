<!--
Sync Impact Report
==================
Version Change: 1.0.0 → 1.1.0

Modified Principles: None (all additions)

Added Sections:
- VI. Code Quality Standards
- VII. Testing Standards
- VIII. User Experience Consistency
- IX. Performance Requirements

Removed Sections: N/A

Templates Requiring Updates:
- ✅ .specify/templates/ directory not present (no updates needed)
- ✅ AGENTS.md "Anti-Patterns" section aligns with new Testing Standards principle
- ✅ AGENTS.md "Subagent Responsibilities" aligns with UX Consistency principle

Follow-up TODOs:
- None (all placeholders filled)
-->

# Multi-Currency Accounting Constitution

## Core Principles

### I. Financial Integrity (NON-NEGOTIABLE)

All monetary calculations MUST use DECIMAL type, never floating-point. All data MUST use soft deletes with `deleted_at` column—hard deletes are forbidden to maintain audit trail and enable recovery. Double-entry bookkeeping validation MUST be enforced: debits MUST equal credits before any journal entry is saved. Currency decimals MUST respect fiat (2 decimals) vs crypto (8 decimals) requirements. These rules exist because floating-point errors cause silent data corruption, hard deletes break accounting audit trails, and unbalanced entries invalidate the entire ledger.

### II. Tenant Isolation (NON-NEGOTIABLE)

Row Level Security (RLS) MUST be applied to all tenant-isolated tables. Query filters MUST always include tenant context—bypassing RLS is forbidden. The tenant context middleware that sets `app.current_tenant_id` MUST be used for all database operations. These rules exist because multi-tenant security isolation prevents data leakage between users, which is fundamental to the application's trust model.

### III. Type Safety

TypeScript code MUST NOT use `any` type, `@ts-ignore`, `as any`, `@ts-expect-error`, or any type suppression. Backend code despite relaxed tsconfig MUST follow strict typing practices. Frontend MUST remain in strict mode. These rules exist because type safety prevents runtime errors, improves maintainability, and catches bugs at compile time rather than production.

### IV. Validation & Data Integrity

API endpoints MUST use class-validator DTOs for all input validation. Raw TypeORM entities MUST NOT be exposed in API responses—DTOs MUST be used for API contracts. Input sanitization MUST be applied to all external inputs. These rules exist because exposed entities create tight coupling between database and API, leading to breaking changes when schema evolves, and validation prevents corrupt data from entering the system.

### V. Plugin System Integrity

Rate provider plugins MUST be tested before use in production. Hot-reload of JS plugins MUST validate plugin integrity. Provider plugins MUST follow the documented API contract. These rules exist because dynamic plugin loading introduces security and stability risks that require explicit validation.

### VI. Code Quality Standards

Code MUST follow the Single Responsibility Principle—each function, class, and module MUST have one clear purpose. Code MUST be self-documenting with clear naming; complex logic MUST include explanatory comments. The DRY (Don't Repeat Yourself) principle MUST be followed—duplicated logic MUST be extracted into shared utilities. File and directory structure MUST follow established patterns: backend uses `src/{feature}/{module,dto,entities,spec}.ts`, frontend uses `components/{feature}/`, `hooks/use-*.ts`, and `lib/`. These standards exist because maintainable codebases require consistency, and unclear code causes bugs and slows development.

### VII. Testing Standards

Unit tests MUST exist for all backend services and frontend hooks—no exceptions for "simple" logic. Test files MUST be co-located with implementation: `*.spec.ts` alongside modules (backend) or `*.spec.tsx` alongside components (frontend). Test coverage MUST be measured: new code MUST maintain or improve coverage ratios. Tests MUST be CI-aware: use `forbidOnly: !!process.env.CI`, conditional retries, and sequential workers in CI. Giant test files (like the 1012-line `comprehensive.tdd.spec.ts`) are anti-patterns—split into focused, single-responsibility tests. These standards exist because tests prevent regressions, enable refactoring, and serve as documentation for expected behavior.

### VIII. User Experience Consistency

Visual and interactive components MUST use the established design system—shadcn/ui components with consistent Tailwind styling. All interactive elements MUST provide immediate visual feedback: buttons MUST show loading states, form submissions MUST show success/error toasts, and async operations MUST show loading indicators. Responsive design MUST work across all supported viewports (mobile to desktop). Accessibility MUST be maintained: semantic HTML, proper ARIA labels, and keyboard navigation support. UI logic changes MUST be delegated to `frontend-ui-ux-engineer` subagent; direct logic changes in UI files are permitted. These standards exist because inconsistent UX erodes user trust, and financial applications demand predictable, polished interactions.

### IX. Performance Requirements

Database queries MUST use proper indexing and avoid N+1 problems—use TypeORM relations with eager loading or batch loading as appropriate. API responses MUST be paginated for collections exceeding 50 items. Frontend bundles MUST remain optimized—Next.js standalone output mode and lazy loading for routes. Performance budgets MUST be established: API response times under 500ms for standard queries, frontend load times under 3 seconds on 3G. Caching strategies MUST be implemented: exchange rates cached for 1 hour (as documented), and React Query MUST be used for server state. These standards exist because slow applications lose users, and accounting work sessions can be lengthy—performance directly impacts productivity.

## Security & Compliance Requirements

All authentication MUST use NextAuth.js with JWT session management. OAuth providers and Authelia SSO MUST be configured according to security best practices. JWT tokens MUST NOT be stored in localStorage in production environments—use httpOnly cookies. All admin actions MUST be logged to `admin_audit_logs` table. Default secrets in Docker configurations MUST be replaced before deployment. These requirements exist because financial data demands enterprise-grade security controls, and audit trails are essential for compliance.

## Development Workflow & Quality Gates

Code reviews MUST verify constitution compliance for all changes. Integration tests MUST cover multi-tenant isolation, currency conversion accuracy, and journal entry balance validation. Linting MUST pass before merge—no suppressing type errors. Migration commands require `data-source.ts` configuration file. Docker builds MUST validate that no TypeScript source files leak into production images. These gates exist because discipline in development prevents regressions, and automated enforcement of standards scales with the team.

## Governance

This constitution SUPERSEDES all other development practices, code conventions, and architectural decisions. Amendments to the constitution REQUIRE documentation of rationale, migration plan for affected code, and version bump following semantic versioning rules. All PRs and code reviews MUST verify compliance with constitution principles. Complexity MUST be justified—simple solutions are preferred over clever ones. Refer to AGENTS.md for runtime development guidance including commands, patterns, and anti-patterns.

**Version**: 1.1.0 | **Ratified**: 2026-01-22 | **Last Amended**: 2026-01-22
