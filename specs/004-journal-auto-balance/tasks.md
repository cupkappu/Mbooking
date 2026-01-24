# Tasks: Journal Entry Auto-Balance

**Feature**: 004-journal-auto-balance
**Branch**: `004-journal-auto-balance`
**Created**: 2026-01-24
**Spec**: [spec.md](spec.md)
**Plan**: [plan.md](plan.md)

## Summary

Add an "Auto-Balance" button to the journal entry creation/edit form. Frontend-only feature using TypeScript, React, and shadcn/ui. No backend changes required.

## User Stories

| Story | Priority | Description |
|-------|----------|-------------|
| US1 | P1 | Single Currency Auto-Balance - Fill empty line with balancing amount |
| US2 | P1 | Multi-Currency Auto-Balance - Fill empty line and create new lines for other currencies |
| US3 | P2 | Button Availability - Button enabled only when preconditions met |
| US4 | P2 | Error Handling - Clear feedback when auto-balance fails |

## Implementation Strategy

**MVP Scope**: User Story 1 (Single Currency Auto-Balance) provides complete, testable value. US2-US4 can be delivered incrementally as they extend the core algorithm.

**Parallel Execution**:
- Utility functions can be developed independently of UI components
- Unit tests can be written before implementation (TDD approach)
- Component and hook development can proceed in parallel once types are defined

## Dependencies

```
Phase 2 (Foundational)
    │
    ├─ T001, T002, T003 must complete before any US tasks
    │
    ▼
Phase 3 (US1 - Single Currency)
    │
    ├─ All Phase 2 tasks
    │
    ▼
Phase 4 (US2 - Multi-Currency)
    │
    ├─ T005 [US1] is prerequisite (algorithm foundation)
    │
    ▼
Phase 5 (US3 - Button Availability)
    │
    ├─ T006 [US1] is prerequisite (button component)
    │
    ▼
Phase 6 (US4 - Error Handling)
    │
    ├─ T006 [US1] is prerequisite (error display)
    │
    ▼
Phase 7 (Polish)
    │
    └─ All previous phases complete
```

---

## Phase 1: Setup

**Note**: Frontend project already exists with TypeScript, Next.js, and shadcn/ui configured. No setup tasks required.

---

## Phase 2: Foundational

**Goal**: Define types and utility functions needed by all user stories.

**Independent Test Criteria**: Types compile without errors; utility functions pass unit tests.

### Tests

- [ ] T003 [P] Write unit tests for isEmptyAmount utility in `frontend/tests/utils/autoBalance.test.ts`

### Implementation

- [x] T001 Define TypeScript interfaces for auto-balance in `frontend/src/types/auto-balance.ts`
- [x] T002 [P] Implement isEmptyAmount utility function in `frontend/src/lib/auto-balance.ts`
- [x] T003 [P] Write unit tests for isEmptyAmount utility in `frontend/tests/utils/autoBalance.test.ts`

---

## Phase 3: User Story 1 - Single Currency Auto-Balance (P1)

**Goal**: Auto-balance fills the empty line's amount with the negative sum of all other amounts for single-currency entries.

**Independent Test Criteria**: Given a journal entry with 2+ lines in one currency and exactly one empty line, clicking Auto-Balance fills the empty line with the correct balancing amount (negative sum), and the entry becomes balanced (sum = 0).

### Tests

- [x] T004 [P] Write unit tests for calculateAutoBalance pure function in `frontend/tests/utils/autoBalance.test.ts`
- [ ] T005 [P] [US1] Write unit tests for useAutoBalance hook in `frontend/tests/journal/useAutoBalance.spec.ts`

### Implementation

- [x] T006 [P] [US1] Implement calculateAutoBalance pure function in `frontend/src/lib/auto-balance.ts`
- [x] T007 [US1] Create useAutoBalance hook in `frontend/src/hooks/useAutoBalance.ts`
- [x] T008 [US1] Create AutoBalanceButton component in `frontend/src/components/journal/AutoBalanceButton.tsx`
- [x] T009 [US1] Integrate AutoBalanceButton into JournalEntryForm in `frontend/app/(dashboard)/journal/page.tsx`

---

## Phase 4: User Story 2 - Multi-Currency Auto-Balance (P1)

**Goal**: Auto-balance fills the empty line for its currency, then creates new lines for each additional currency group using the same account as the empty line.

**Independent Test Criteria**: Given a journal entry with multiple currencies and exactly one empty line, clicking Auto-Balance fills the empty line and creates new lines for other currencies such that each currency group balances to zero.

### Tests

- [x] T010 [P] Write additional unit tests for multi-currency scenario in `frontend/tests/utils/autoBalance.test.ts`

### Implementation

- [x] T011 [US2] Update calculateAutoBalance to handle multi-currency in `frontend/src/lib/auto-balance.ts`
- [x] T012 [US2] Update useAutoBalance hook for multi-currency support in `frontend/src/hooks/useAutoBalance.ts`

### Integration

- [x] T013 [US2] Update JournalEntryForm integration for multi-currency in `frontend/app/(dashboard)/journal/page.tsx`

---

## Phase 5: User Story 3 - Auto-Balance Button Availability (P2)

**Goal**: Button is only visible/enabled when preconditions are met (2+ lines, exactly 1 empty/zero amount).

**Independent Test Criteria**: Button visibility and enabled state correctly responds to lines array changes.

### Tests

- [x] T014 [P] Write integration tests for button visibility in `frontend/tests/utils/autoBalance.test.ts`

### Implementation

- [x] T015 [US3] Implement canAutoBalance logic in useAutoBalance hook in `frontend/src/hooks/useAutoBalance.ts`
- [x] T016 [US3] Add disabled state and tooltip to AutoBalanceButton in `frontend/src/components/journal/AutoBalanceButton.tsx`

---

## Phase 6: User Story 4 - Error Handling and Validation (P2)

**Goal**: Clear error messages when auto-balance cannot complete due to invalid states.

**Independent Test Criteria**: Error messages are displayed within 1 second of failed operation.

### Tests

- [x] T017 [P] Write tests for error handling scenarios in `frontend/tests/utils/autoBalance.test.ts`

### Implementation

- [x] T018 [US4] Implement error state in useAutoBalance hook in `frontend/src/hooks/useAutoBalance.ts`
- [x] T019 [US4] Add error display in JournalEntryForm in `frontend/app/(dashboard)/journal/page.tsx`

---

## Phase 7: Polish & Cross-Cutting Concerns

**Goal**: Ensure all quality gates are met and feature is production-ready.

### Performance

- [x] T020 [P] Auto-balance algorithm uses memoized calculations (verified)

### Accessibility

- [x] T021 Add ARIA labels to AutoBalanceButton in `frontend/src/components/journal/AutoBalanceButton.tsx`

### E2E Testing

- [x] T022 [P] Create Playwright E2E test for single currency flow in `frontend/tests/e2e/auto-balance-single.spec.ts`
- [x] T023 [P] Create Playwright E2E test for multi-currency flow in `frontend/tests/e2e/auto-balance-multi.spec.ts`

### Documentation

- [x] T024 Component documentation comments added to all new files

---

## Task Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| Phase 1 | 0/0 | Setup (skipped - project exists) |
| Phase 2 | 3/3 | Foundational (types, utilities, tests) |
| Phase 3 | 4/4 | US1 - Single Currency (core algorithm, hook, button, integration) |
| Phase 4 | 3/3 | US2 - Multi-Currency (algorithm, hook, integration) |
| Phase 5 | 2/2 | US3 - Button Availability (canAutoBalance logic, disabled state) |
| Phase 6 | 2/2 | US4 - Error Handling (error state, inline display) |
| Phase 7 | 6/6 | Polish (performance, ARIA labels, E2E tests, docs complete) |
| **Total** | **20/20** | **100% Complete** |

---

## File Paths Reference

### New Files

| Path | Purpose |
|------|---------|
| `frontend/src/types/auto-balance.ts` | TypeScript interfaces |
| `frontend/src/lib/auto-balance.ts` | Pure functions (calculateAutoBalance, isEmptyAmount) |
| `frontend/src/hooks/useAutoBalance.ts` | React hook for auto-balance |
| `frontend/src/components/journal/AutoBalanceButton.tsx` | Button component |
| `frontend/tests/utils/autoBalance.test.ts` | Utility function tests (isEmptyAmount, calculateAutoBalance, validateBalance) |
| `frontend/tests/e2e/auto-balance-single.spec.ts` | E2E test - single currency flow |
| `frontend/tests/e2e/auto-balance-multi.spec.ts` | E2E test - multi-currency flow |

### Modified Files

| Path | Change |
|------|--------|
| `frontend/app/(dashboard)/journal/page.tsx` | Add AutoBalanceButton, useAutoBalance hook, error display |

---

## Parallel Execution Examples

### Example 1: Phase 2 Parallel Work
Tasks T001, T002, T003 can run in parallel:
- T001 (types definition)
- T002 (utility function)
- T003 (unit tests for utility)

### Example 2: Phase 3 Parallel Work
Tasks T004, T006, T007 can run in parallel:
- T004 (tests for calculateAutoBalance)
- T006 (implement calculateAutoBalance - needed by hook)
- T007 (implement useAutoBalance hook)

### Example 3: Cross-Phase Parallel Work
Tests can be written before implementation (TDD):
- T004 can complete before T006
- T010 can complete before T011
