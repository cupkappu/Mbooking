# Research: System Initialization Page

## Decision: Initialization Detection Strategy

**Chosen**: Infer from user count (check if users exist)

**Rationale**:
- Simplest approach - no additional database table required
- Aligns with existing `AdminUserSeedService` pattern that already uses `userRepository.count()`
- Eliminates potential synchronization issues between state table and actual user data

**Alternatives Considered**:
- `SystemSettings` table with flag: Rejected - adds unnecessary complexity
- Environment variable: Rejected - not persistent, could cause issues with container restarts
- Redis/cache key: Rejected - critical adds external dependency for initialization flow

---

## Decision: Initialization Access Control

**Chosen**: Require INIT_SECRET environment variable

**Rationale**:
- Prevents accidental exposure of initialization endpoint in production
- Simple to configure via environment variable
- No additional infrastructure needed
- Aligns with security best practice of "defense in depth"

**Implementation**:
- Backend: Validate `INIT_SECRET` header against `process.env.INIT_SECRET`
- Frontend: Prompt for secret on first load, store in session storage
- Error: Return 403 if secret missing or invalid

---

## Decision: Entity Reuse Strategy

**Chosen**: Reuse existing User and Tenant entities

**Rationale**:
- Avoids duplication of existing well-tested entities
- Consistent with system architecture
- First user becomes both admin user and tenant owner

**Flow**:
1. Check `userRepository.count() === 0` to detect uninitialized state
2. Create User with `role: 'admin'`
3. Create Tenant with user as owner
4. Link User to Tenant via `tenant_id`
5. Seed currencies via existing `CurrenciesService.seedDefaultCurrencies()`

---

## Decision: Form Validation Approach

**Chosen**: Use class-validator DTOs on backend, client-side validation mirrors

**Rationale**:
- Consistent with existing API validation patterns
- Single source of truth for validation rules
- Immediate user feedback via client validation

**Validation Rules**:
- Email: `IsEmail()`, `IsNotEmpty()`
- Password: `MinLength(12)`, `IsStrongPassword()` (uppercase, lowercase, number, special)
- Name: `MinLength(1)`, `MaxLength(100)`

---

## Decision: Error Handling Strategy

**Chosen**: Transactional creation with explicit error messages

**Rationale**:
- Ensures atomicity: either all data created or none
- User-friendly error messages without sensitive information
- Consistent with financial application requirements

**Error Scenarios**:
- Concurrent initialization: First request wins, subsequent get "already initialized" error
- Database connection failure: Return 500 with retry instructions
- Validation failure: Return 400 with field-specific errors

---

## Decision: Frontend Architecture

**Chosen**: New route group `(setup)` with initialization page

**Rationale**:
- Isolates setup concerns from auth flows
- Can apply different layout (no sidebar, centered content)
- Easy to protect via middleware

**Pages**:
- `/setup` - Initialization form
- Middleware redirects based on `userRepository.count()`

---

## Best Practices Applied

1. **Security**:
   - INIT_SECRET validation
   - Password hashing with bcrypt (cost factor 10+)
   - No sensitive info in error responses

2. **UX**:
   - Client-side validation for immediate feedback
   - Loading states on form submission
   - Clear success/error toasts

3. **Performance**:
   - Single API call for initialization
   - No blocking operations during creation

4. **Testing**:
   - Mock database operations in tests
   - Test concurrent initialization handling
   - E2E test for complete flow
