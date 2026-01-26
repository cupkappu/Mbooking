# Codebase Review Report

**Date:** 2026-01-26
**Branch:** vk/d01f-review-the-codeb
**Reviewers:** Security, Performance, Code Quality, Database, API, Accounting, Frontend Security

---

## Executive Summary

This is a comprehensive review of the multi-currency accounting application, covering backend (NestJS), frontend (Next.js), database (PostgreSQL/TypeORM), and business logic (double-entry bookkeeping).

### Overall Assessment

| Category | Rating | Notes |
|----------|--------|-------|
| Architecture | Good | Clean separation, proper module patterns |
| Security | Needs Work | Several critical vulnerabilities identified |
| Code Quality | Good | Type-safe with some `any` usage issues |
| Performance | Needs Work | N+1 queries, missing indexes |
| Database | Good | Proper patterns, some consistency issues |
| API Design | Good | RESTful, needs error standardization |
| Accounting Logic | Needs Work | Critical data integrity issues |

---

## Critical Issues Summary

| Priority | Category | Issue | Fix Status |
|----------|----------|-------|------------|
| P0 | Security | Plugin upload allows arbitrary code execution | Needs Fix |
| P0 | Security | Authelia middleware trusts spoofable headers | Needs Fix |
| P0 | Security | JWT decoding without verification | Needs Fix |
| P0 | Accounting | Soft-deleted entries included in balance calc | Needs Fix |
| P0 | Accounting | Hard delete of journal entries | Needs Fix |
| P0 | Accounting | Budget progress cache not tenant-isolated | Needs Fix |
| P1 | Security | No rate limiting implemented | Needs Fix |
| P1 | Security | Weak password requirements | Needs Fix |
| P1 | Security | No login attempt lockout | Needs Fix |
| P1 | Database | Missing transactions in journal operations | Needs Fix |
| P1 | Performance | N+1 query in getBalances() | Needs Fix |
| P1 | Performance | Sequential rate lookups in loop | Needs Fix |
| P1 | Frontend | Access token stored in localStorage | Needs Fix |

---

## Detailed Findings

### 1. Security Review

#### 1.1 Backend Security

**Critical: Plugin Upload RCE**
- **Location:** `backend/src/admin/services/plugin-management.service.ts`
- **Issue:** Authenticated admins can upload arbitrary JavaScript files that are executed on the server with no sandboxing
- **Risk:** Complete server compromise
- **Recommendation:** Implement sandboxing (VM2/isolated-vm), code review workflow, or base64-encoded storage

**Critical: Authelia Header Spoofing**
- **Location:** `backend/src/auth/authelia.middleware.ts`
- **Issue:** Middleware blindly trusts `X-Auth-*` headers from incoming requests
- **Risk:** Anyone can forge headers to authenticate as any user
- **Recommendation:** Validate source IP, use HMAC signatures, or require shared secret

**Critical: JWT Decoding Without Verification**
- **Location:** `backend/src/common/middleware/tenant.middleware.ts`
- **Issue:** Extracts `tenant_id` from JWT without signature verification
- **Risk:** Attacker can craft JWT with arbitrary tenant_id
- **Recommendation:** Use only verified JWT claims after JwtAuthGuard validation

**Critical: No Rate Limiting**
- **Issue:** No rate limiting anywhere in the codebase
- **Risk:** Brute force attacks, credential stuffing, resource exhaustion
- **Recommendation:** Implement `@nestjs/throttler`, progressive delays for login

**Medium: Weak Password Requirements**
- **Location:** `backend/src/auth/auth.controller.ts`
- **Issue:** Password minimum is only 6 characters with no complexity requirements
- **Recommendation:** Require minimum 12 characters, mixed case, numbers, special characters

**Medium: No Login Attempt Lockout**
- **Location:** `backend/src/auth/auth.service.ts`
- **Issue:** Failed logins don't trigger any lockout or progressive delays
- **Recommendation:** Track failed attempts, implement delays after N failures

**Medium: Missing Security Headers**
- **Location:** `backend/src/main.ts`
- **Issue:** No CSP, X-Frame-Options, etc. configured
- **Recommendation:** Add helmet.js

**Medium: CSV Injection**
- **Location:** `backend/src/export/export.service.ts`
- **Issue:** Formula injection possible in CSV exports
- **Recommendation:** Prefix formula cells with `'`

---

#### 1.2 Frontend Security

**High: Access Token in localStorage**
- **Location:** `frontend/lib/auth-options.ts`, `frontend/components/session-sync.tsx`
- **Issue:** JWT access tokens stored in localStorage (vulnerable to XSS)
- **Recommendation:** Use httpOnly cookies instead

**Medium: No CSRF Validation on API Proxy**
- **Location:** `frontend/app/api/v1/[...path]/route.ts`
- **Issue:** API proxy passes headers without CSRF token validation
- **Recommendation:** Add origin header check or SameSite cookie protections

**Medium: Excessive Polling**
- **Location:** `frontend/components/session-sync.tsx`
- **Issue:** Session sync polls every 100ms (excessive)
- **Recommendation:** Reduce polling or use session storage events

**Low: Callback URL Not Validated**
- **Location:** `frontend/app/(auth)/login/page.tsx`, `frontend/middleware.ts`
- **Issue:** Open redirect potential with callbackUrl parameter
- **Recommendation:** Validate callbackUrl is same-origin

**Low: Missing Security Headers**
- **Location:** `frontend/next.config.mjs`
- **Issue:** No Content-Security-Policy, X-Content-Type-Options, etc.
- **Recommendation:** Add security headers

---

### 2. Performance Review

**Critical: N+1 Query in getBalances()**
- **Location:** `backend/src/query/query.service.ts:136-217`
- **Issue:** Each account triggers a separate balance calculation query
- **Impact:** O(n) queries where n = number of accounts
- **Recommendation:** Batch query with GROUP BY

**Critical: Sequential Rate Lookups**
- **Location:** `backend/src/query/query.service.ts:198-213`
- **Issue:** Exchange rates fetched sequentially inside loop
- **Impact:** O(m) sequential calls where m = currencies
- **Recommendation:** Use `getRatesBatch()` for parallel fetching

**Critical: In-Memory Cache Not Production-Ready**
- **Location:** `backend/src/query/query.service.ts:89`
- **Issue:** In-memory Map cache doesn't share across instances, will leak memory
- **Recommendation:** Replace with Redis cache with TTL

**Critical: Budget Alert Triggers Full Balance Calc**
- **Location:** `backend/src/budgets/budget-alert.service.ts:77-93`
- **Issue:** Each active budget triggers expensive `getBalances()` call
- **Impact:** O(b * n) where b = budgets, n = accounts
- **Recommendation:** Cache balance calculations or compute more efficiently

**High: Missing Composite Index on Journal Lines**
- **Issue:** No index on `(account_id, tenant_id, currency)`
- **Impact:** Index scans for balance queries
- **Recommendation:** Add composite index

**High: N+1 in Budget Progress**
- **Location:** `backend/src/budgets/services/budget-progress.service.ts:248-266`
- **Issue:** Sequential queries to find budgets per account
- **Recommendation:** Batch query by all affected accounts

**Medium: Template Seeding N+1**
- **Location:** `backend/src/budgets/services/template-seeding.service.ts:50-61`
- **Issue:** Sequential existence checks for each template
- **Recommendation:** Single bulk query with `WHERE name IN (...)`

**Medium: Rate History Sequential Queries**
- **Location:** `backend/src/rates/rate-graph-engine.ts:1005-1010`
- **Issue:** Each date triggers separate `getRate()` call
- **Recommendation:** Add batch rate fetch for date range

**Low: Frontend Auto-Refresh Overload**
- **Location:** `frontend/hooks/use-budget-progress.ts:16-17`
- **Issue:** Multiple widgets poll every 60 seconds
- **Recommendation:** Consider WebSocket subscriptions

---

### 3. Code Quality Review

**Critical: Type `any` in Journal Controller**
- **Location:** `backend/src/journal/journal.controller.ts:45-47`
- **Issue:** Controller uses `any` for body, bypassing TypeScript safety
- **Recommendation:** Use `CreateJournalEntryDto` and `UpdateJournalEntryDto`

**Critical: Missing Error Handling in Mutations**
- **Location:** `frontend/hooks/use-api.ts:83-84`
- **Issue:** Mutations lack `onError` handlers for user feedback
- **Recommendation:** Add error callbacks to all mutations

**High: Duplicate Rate Calculation Logic**
- **Location:** `backend/src/journal/journal.service.ts:56-84`
- **Issue:** Similar logic in QueryService and RateGraphEngine
- **Recommendation:** Extract to shared utility function

**High: Promise.all Fails Fast**
- **Location:** `backend/src/rates/rate-graph-engine.ts:512-514`
- **Issue:** One provider failure causes entire Promise.all to fail
- **Recommendation:** Use `Promise.allSettled()` or try-catch per provider

**Medium: Long Functions**
- **Location:** `backend/src/rates/rate-graph-engine.ts`
- **Issue:** `buildGraph()` (80 lines), `findBestPath()` (100+ lines)
- **Recommendation:** Refactor into smaller helper functions

**Medium: Duplicate Type Definitions**
- **Location:** `frontend/hooks/use-api.ts:134-142` vs `@/types/index.ts`
- **Issue:** Same types defined in multiple places
- **Recommendation:** Consolidate in single source of truth

**Low: Comment Inconsistency**
- **Issue:** Some functions have extensive JSDoc, others have none
- **Recommendation:** Add consistent JSDoc to all public methods

**Low: Large Files**
- **Location:** `backend/src/rates/rate-graph-engine.ts` (1269 lines)
- **Recommendation:** Split into focused modules

---

### 4. Database Review

**Critical: Missing Transaction Boundaries**
- **Location:** `backend/src/journal/journal.service.ts:171-195`
- **Issue:** Journal entry and lines saved separately without transaction
- **Risk:** Orphaned journal entries if line save fails
- **Recommendation:** Wrap in DataSource transaction

**Critical: Missing RLS at Database Level**
- **Issue:** Tenant isolation only at application level
- **Risk:** Misconfiguration could expose cross-tenant data
- **Recommendation:** Implement PostgreSQL RLS policies

**Critical: Balance Calculation Race Condition**
- **Location:** `backend/src/query/query.service.ts`
- **Issue:** In-memory cache per-instance, N+1 queries
- **Recommendation:** Use Redis, batch queries, or materialized views

**High: Decimal Precision Inconsistency**
- **Issue:** Different precision/scale across tables:
  - `accounts.balance`: DECIMAL(20, 8)
  - `journal_lines.amount`: DECIMAL(20, 4)
  - `exchange_rates.rate`: DECIMAL(20, 8)
- **Recommendation:** Standardize to DECIMAL(20, 4) for amounts, (20, 8) for rates

**High: Missing Index on journal_lines.tenant_id**
- **Issue:** No index on tenant_id for tenant-scoped queries
- **Recommendation:** Add index

**Medium: Inconsistent Soft Delete Implementation**
- **Issue:** Some entities use `@DeleteDateColumn`, others use `is_active` boolean
- **Entities with is_active:** Budget, BudgetTemplate, BudgetAlert, Tenant, User
- **Recommendation:** Standardize on `@DeleteDateColumn`

**Medium: Missing updated_at on Several Entities**
- **Entities missing updated_at:** AuditLog, ExportAuditLog, BudgetAlert, ExchangeRate, BudgetTemplate, ReportStorage
- **Recommendation:** Add timestamp for audit trail

**Medium: Cascade Delete Risk**
- **Location:** `backend/src/journal/journal-line.entity.ts:10`
- **Issue:** `onDelete: 'CASCADE'` but hard delete in service
- **Recommendation:** Use soft delete consistently

---

### 5. API Design Review

**Critical: No DTOs for Journal Operations**
- **Location:** `backend/src/journal/journal.controller.ts`
- **Issue:** `POST @Body() data: any` - no validation DTO
- **Recommendation:** Create CreateJournalEntryDto, UpdateJournalEntryDto

**Critical: Missing Email Validation in Auth DTOs**
- **Location:** `backend/src/auth/auth.controller.ts`
- **Issue:** LoginDto, RegisterDto missing `@IsEmail`
- **Recommendation:** Add email format validation

**High: Inconsistent Error Response Format**
- **Location:** `backend/src/export/export.controller.ts:33-45`
- **Issue:** Custom error format vs standard NestJS format
- **Recommendation:** Standardize all error responses

**High: DELETE Returns 200 Instead of 204**
- **Location:** `backend/src/accounts/accounts.controller.ts:74-77`
- **Issue:** DELETE returns `{ success: true }` instead of 204 No Content
- **Recommendation:** Use 204 consistently

**Medium: Pagination Not Fully Implemented**
- **Location:** `backend/src/accounts/accounts.controller.ts:25-27`
- **Issue:** Query params declared but not used
- **Recommendation:** Pass pagination to service

**Medium: No Rate Limiting**
- **Issue:** No throttler module found
- **Recommendation:** Add `@nestjs/throttler`

**Medium: Currency Code Validation Missing**
- **Issue:** No ISO 4217 pattern validation
- **Recommendation:** Add regex validation for currency codes

**Low: No API Versioning Headers**
- **Issue:** No deprecation headers for version transitions
- **Recommendation:** Add X-API-Version and sunset headers

---

### 6. Accounting Logic Review

**Critical: Soft-Deleted Entries in Balance Calc**
- **Location:** `backend/src/query/query.service.ts:400-405`
- **Issue:** Balance query missing `deleted_at IS NULL` filter
- **Impact:** Deleted transactions affect current balances
- **Recommendation:** Add soft-delete filter

**Critical: Hard Delete of Journal Entries**
- **Location:** `backend/src/journal/journal.service.ts:264-269`
- **Issue:** `repository.delete(id)` - violates audit requirements
- **Recommendation:** Use only soft delete

**Critical: Cascade Delete on Journal Lines**
- **Location:** `backend/src/journal/journal-line.entity.ts:10`
- **Issue:** Database cascade delete with hard delete violates audit trail
- **Recommendation:** Remove cascade or use soft delete consistently

**Critical: Budget Progress Cache Not Tenant-Isolated**
- **Location:** `backend/src/budgets/services/budget-progress.service.ts:24`
- **Issue:** In-memory cache `progressCache` not keyed by tenant
- **Risk:** Cross-tenant data exposure
- **Recommendation:** Add tenant prefix to cache keys

**Medium: No Account Type Validation**
- **Issue:** Journal lines not validated against account type (asset/liability/revenue/expense)
- **Recommendation:** Validate debit/credit matches account normal balance

**Medium: Incorrect Cash Flow Classification**
- **Location:** `backend/src/reports/cash-flow.generator.ts:110-146`
- **Issue:** Sign-based classification may be incorrect for some accounts
- **Recommendation:** Use account path/tags, not name matching

**Medium: Placeholder Exchange Rate in Budgets**
- **Location:** `backend/src/budgets/budgets.service.ts:304-308`
- **Issue:** `getExchangeRate()` returns 1:1 placeholder
- **Recommendation:** Inject RateGraphEngine for proper conversion

**Medium: Budget Spent Uses Absolute Value**
- **Location:** `backend/src/budgets/budgets.service.ts:132`
- **Issue:** `Math.abs()` may be incorrect for credit balances
- **Recommendation:** Check account type for proper sign handling

---

## Best Practices Identified

### Security
- Bcrypt password hashing with salt rounds
- SQL parameterization via TypeORM
- Input validation with global ValidationPipe
- Audit logging via decorators
- Tenant isolation via TenantAwareRepository
- CORS configured with explicit origins

### Performance
- Materialized path tree for account hierarchy
- Multi-level caching in RateGraphEngine
- React Query with proper stale times
- Connection pooling via TypeORM
- Pagination on most list endpoints

### Code Quality
- Clear module separation (auth, accounts, journal, budgets, etc.)
- DTO pattern for input validation
- Proper error handling patterns
- Soft delete pattern consistent
- Decimal type for financial values

### Architecture
- NestJS module pattern
- Next.js App Router with route groups
- npm workspaces for monorepo
- Docker for development and testing
- CI-aware Playwright E2E configuration

---

## Recommendations Summary

### Immediate (P0)
1. Fix plugin upload RCE vulnerability (sandbox or code review)
2. Fix Authelia header spoofing (IP validation or HMAC)
3. Fix JWT verification in tenant middleware
4. Add `deleted_at` filter to balance calculations
5. Change journal delete to soft delete only
6. Tenant-isolate budget progress cache
7. Implement rate limiting (throttler module)

### Short-term (P1)
8. Move access token from localStorage to httpOnly cookies
9. Add transactions to journal operations
10. Fix N+1 queries in getBalances()
11. Use Promise.allSettled() for rate fetching
12. Standardize decimal precision across entities
13. Add missing indexes (journal_lines.tenant_id, composite)
14. Create proper DTOs for journal operations
15. Increase password requirements

### Medium-term (P2)
16. Add security headers (helmet.js)
17. Implement PostgreSQL RLS policies
18. Replace in-memory cache with Redis
19. Standardize error response format
20. Fix DELETE status codes (204 vs 200)
21. Implement budget RateGraphEngine integration
22. Add account type validation in journal lines

### Long-term (P3)
23. Add formula injection protection to CSV exports
24. Refactor large files (rate-graph-engine.ts)
25. Add API versioning headers
26. Implement trial balance endpoint
27. Add comprehensive load testing
28. Consider materialized views for balance queries

---

## Files Reviewed

### Backend
- `backend/src/auth/` - Authentication module
- `backend/src/common/middleware/tenant.middleware.ts`
- `backend/src/common/context/tenant.context.ts`
- `backend/src/admin/` - Admin module, plugin management
- `backend/src/journal/` - Journal entries and lines
- `backend/src/accounts/` - Account management
- `backend/src/budgets/` - Budget management
- `backend/src/query/` - Balance queries and caching
- `backend/src/rates/` - Exchange rates, rate graph engine
- `backend/src/reports/` - Financial reports
- `backend/src/export/` - CSV export
- `backend/src/main.ts` - Bootstrap
- `backend/src/app.module.ts` - Module configuration

### Frontend
- `frontend/lib/auth-options.ts` - NextAuth configuration
- `frontend/components/session-sync.tsx` - Session polling
- `frontend/app/api/v1/[...path]/route.ts` - API proxy
- `frontend/hooks/use-api.ts` - API hooks
- `frontend/middleware.ts` - Route protection
- `frontend/next.config.mjs` - Next.js configuration

### Database
- `backend/src/config/data-source.ts`
- `backend/src/migrations/1706035200000-initial-schema.ts`
- All entity files in `*/entities/`
- `backend/src/common/repositories/tenant-aware.repository.ts`

---

## Testing Notes

The codebase has E2E tests configured with Playwright (`playwright.config.ts`) and unit tests in backend. Key test coverage areas:

- Complete E2E flow (auth, navigation)
- Budget workflow (CRUD operations)
- User registration
- Data integrity (journal balance validation)

**Recommendations for additional tests:**
- Load tests for getBalances() with 100+ accounts
- Rate limiting tests
- Multi-tenancy isolation tests
- Journal entry balance validation
- Soft delete verification
- Plugin upload security tests

---

## Conclusion

The multi-currency accounting application demonstrates solid architecture and follows many best practices. However, several critical security and data integrity issues need immediate attention before production deployment.

The most pressing concerns are:
1. **Security vulnerabilities** (RCE via plugins, header spoofing, JWT issues)
2. **Data integrity** (soft-deleted entries in balances, hard deletes)
3. **Performance** (N+1 queries, missing indexes, inefficient caching)

Addressing the P0 and P1 items will significantly improve the security posture and reliability of the application.
