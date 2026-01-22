# Tasks: System Initialization Page

**Input**: Design documents from `/specs/001-system-initialize/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Tests are REQUIRED per constitution (Section VII - Testing Standards)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 Create setup module directory structure at backend/src/setup/
- [x] T002 [P] Create setup route group directory at frontend/app/(setup)/

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**CRITICAL**: No user story work can begin until this phase is complete

- [x] T003 [P] Create InitializeSystemDto with validation decorators in backend/src/setup/dto/initialize.dto.ts
- [x] T004 [P] Create InitializeSystemResponseDto in backend/src/setup/dto/initialize-response.dto.ts
- [x] T005 [P] Create InitializationStatusDto in backend/src/setup/dto/initialize-status.dto.ts
- [x] T006 [P] Create index.ts exports file in backend/src/setup/dto/
- [x] T007 Create SetupService with initialization logic in backend/src/setup/setup.service.ts
- [x] T008 Create SetupController with status and initialize endpoints in backend/src/setup/setup.controller.ts
- [x] T009 Create SetupModule in backend/src/setup/setup.module.ts
- [x] T010 Register SetupModule in backend/src/app.module.ts
- [x] T011 [P] Create useSetup hook in frontend/hooks/use-setup.ts
- [x] T012 [P] Create setup form component in frontend/app/(setup)/setup/setup-form.tsx
- [x] T013 [P] Create setup page in frontend/app/(setup)/setup/page.tsx
- [x] T014 Modify TenantMiddleware to check user count and redirect to /setup in backend/src/common/middleware/tenant.middleware.ts
- [x] T015 Disable AdminUserSeedService when setup feature is enabled in backend/src/common/seeds/admin-user-seed.service.ts

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - First-time System Setup (Priority: P1) 🎯 MVP

**Goal**: Users can complete system initialization, create admin account, and access dashboard

**Independent Test**: Simulate empty database, complete initialization form, verify admin user created and dashboard accessible

### Tests for User Story 1 (REQUIRED)

- [x] T016 [P] [US1] Unit test for SetupService.initialize() in backend/src/setup/setup.spec.ts
- [x] T017 [P] [US1] Unit test for SetupController.status() in backend/src/setup/setup.spec.ts
- [x] T018 [P] [US1] Unit test for SetupController.initialize() in backend/src/setup/setup.controller.spec.ts
- [x] T019 [P] [US1] Integration test: empty database initialization flow in backend/src/setup/setup.e2e-spec.ts
- [x] T020 [P] [US1] Frontend test: setup page renders correctly in frontend/app/(setup)/setup/page.spec.tsx
- [x] T021 [P] [US1] Frontend test: setup form submission in frontend/app/(setup)/setup/setup-form.spec.tsx

### Implementation for User Story 1

- [x] T022 [US1] Implement SetupService.createAdminUser() method for admin creation
- [x] T023 [US1] Implement SetupService.createTenant() method for tenant creation
- [x] T024 [US1] Implement transactional initialization in SetupService.initialize() with User + Tenant creation
- [x] T025 [US1] Implement currency seeding call to CurrenciesService in SetupService
- [x] T026 [US1] Add INIT_SECRET validation in SetupController.initialize()
- [x] T027 [US1] Add user count check in SetupController.status()
- [x] T028 [US1] Add audit logging for initialization event in SetupService
- [x] T029 [US1] Connect useSetup hook to initialization API
- [x] T030 [US1] Implement setup form with email, password, name fields
- [x] T031 [US1] Implement redirect to dashboard on successful initialization
- [x] T032 [US1] Configure TenantMiddleware to redirect empty database to /setup

**Checkpoint**: User Story 1 complete - initialization flow works end-to-end

---

## Phase 4: User Story 2 - Initialization Form Validation (Priority: P1)

**Goal**: Users receive clear validation feedback for secure admin account creation

**Independent Test**: Submit invalid inputs, verify error messages display within 500ms without server submission

### Tests for User Story 2 (REQUIRED)

- [x] T033 [P] [US2] Unit test for DTO validation in backend/src/setup/setup.spec.ts
- [x] T034 [P] [US2] Frontend test: validation error messages display in frontend/app/(setup)/setup/setup-form.spec.tsx

### Implementation for User Story 2

- [x] T035 [US2] Add email format validation (@IsEmail()) to InitializeSystemDto
- [x] T036 [US2] Add password strength validation (@MinLength(12), @Matches regex) to InitializeSystemDto
- [x] T037 [US2] Add name length validation to InitializeSystemDto
- [x] T038 [US2] Implement client-side validation in setup form component
- [x] T039 [US2] Add password strength indicator UI in setup form
- [x] T040 [US2] Handle duplicate email error from backend (already initialized scenario)

**Checkpoint**: User Story 2 complete - validation provides immediate feedback

---

## Phase 5: User Story 3 - System Already Initialized Flow (Priority: P2)

**Goal**: System prevents re-initialization and shows login page when already configured

**Independent Test**: Access /setup on initialized system, verify redirect to login and 403 from API

### Tests for User Story 3 (REQUIRED)

- [x] T041 [P] [US3] Test: already initialized system returns 409 in backend/src/setup/setup.controller.spec.ts
- [x] T042 [P] [US3] Test: missing INIT_SECRET returns 403 in backend/src/setup/setup.controller.spec.ts
- [x] T043 [P] [US3] Frontend test: redirect from /setup when initialized in frontend/app/(setup)/setup/page.spec.tsx

### Implementation for User Story 3

- [x] T044 [US3] Add already-initialized check (userRepository.count() > 0) in SetupController.initialize()
- [x] T045 [US3] Add INIT_SECRET validation middleware/guard for initialize endpoint
- [x] T046 [US3] Return 409 Conflict for already initialized scenario
- [x] T047 [US3] Return 403 Forbidden for invalid/missing INIT_SECRET
- [x] T048 [US3] Frontend: handle 409 response and redirect to /login
- [x] T049 [US3] Frontend: handle 403 response and show access denied

**Checkpoint**: User Story 3 complete - re-initialization properly prevented

---

## Phase 6: User Story 4 - Seed Initial Data (Priority: P2)

**Goal**: Default currencies available immediately after initialization

**Independent Test**: After initialization, verify currencies management page shows default currencies

### Tests for User Story 4 (REQUIRED)

- [x] T050 [P] [US4] Test: currencies seeded after initialization in backend/src/setup/setup.spec.ts
- [x] T051 [P] [US4] Integration test: verify currencies exist after setup in backend/src/setup/setup.e2e-spec.ts

### Implementation for User Story 4

- [x] T052 [US4] Call CurrenciesService.seedDefaultCurrencies() in SetupService.initialize()
- [x] T053 [US4] Handle currency seeding errors gracefully
- [x] T054 [US4] Include currency count in InitializationStatusDto response

**Checkpoint**: User Story 4 complete - system ready for use with default currencies

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T055 [P] Add loading states to setup form UI
- [x] T056 [P] Add toast notifications for success/error messages
- [x] T057 [P] Add accessibility attributes to form fields
- [x] T058 Ensure responsive design for mobile devices
- [x] T059 Add keyboard navigation support in setup form
- [x] T060 Update .env.example with INIT_SECRET documentation
- [x] T061 Run quickstart.md validation steps
- [x] T062 Verify all lsp_diagnostics clean on changed files

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - User stories can proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2)
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Depends on Foundational (Phase 2) - Core MVP, no other story dependencies
- **User Story 2 (P1)**: Depends on Foundational (Phase 2) - Can run in parallel with US1
- **User Story 3 (P2)**: Depends on Foundational (Phase 2) - Can run after US1 complete
- **User Story 4 (P2)**: Depends on Foundational (Phase 2) - Can run after US1 complete

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- DTOs before Services
- Services before Controllers
- Core implementation before UI
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks (T001, T002) can run in parallel
- All Foundational DTO tasks (T003, T004, T005) can run in parallel
- All frontend foundational tasks (T011, T012, T013) can run in parallel
- Once Foundational phase completes, all user stories can start in parallel
- Tests within each story marked [P] can run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task: "Unit test for SetupService.initialize() in backend/src/setup/setup.spec.ts"
Task: "Unit test for SetupController.status() in backend/src/setup/setup.spec.ts"
Task: "Integration test: empty database initialization flow in backend/src/setup/setup.e2e-spec.ts"

# Launch all model/hook tasks together:
Task: "Create InitializeSystemDto with validation decorators in backend/src/setup/dto/initialize.dto.ts"
Task: "Create useSetup hook in frontend/hooks/use-setup.ts"
Task: "Create setup form component in frontend/app/(setup)/setup/setup-form.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (P1 - Core MVP)
4. **STOP and VALIDATE**: Test User Story 1 independently
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo
4. Add User Story 3 → Test independently → Deploy/Demo
5. Add User Story 4 → Test independently → Deploy/Demo
6. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1
   - Developer B: User Story 2
   - Developer C: User Story 3 + User Story 4
3. Stories complete and integrate independently

---

## Summary

| Metric | Value |
|--------|-------|
| **Total Tasks** | 62 |
| **Phase 1 (Setup)** | 2 tasks |
| **Phase 2 (Foundational)** | 13 tasks |
| **Phase 3 (US1 - MVP)** | 17 tasks |
| **Phase 4 (US2 - Validation)** | 7 tasks |
| **Phase 5 (US3 - Already Initialized)** | 9 tasks |
| **Phase 6 (US4 - Seed Data)** | 5 tasks |
| **Phase 7 (Polish)** | 9 tasks |
| **Parallelizable Tasks** | 35 (marked with [P]) |
| **Test Tasks** | 14 |

**MVP Scope**: User Story 1 only (Phases 1-3) delivers core initialization functionality

**Recommended First Steps**:
1. T001: Create setup module directory
2. T003-T006: Create DTOs with validation
3. T007: Create SetupService
