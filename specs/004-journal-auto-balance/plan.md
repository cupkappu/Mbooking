# Implementation Plan: Journal Entry Auto-Balance

**Branch**: `004-journal-auto-balance` | **Date**: 2026-01-24 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/004-journal-auto-balance/spec.md`

## Summary

Add an "Auto-Balance" button to the journal entry creation/edit form that automatically calculates and fills the balancing amount when exactly one line has an empty or zero amount. For single-currency entries, the empty line is filled with the negative sum of all other amounts. For multi-currency entries, the empty line is filled for its currency, and new lines are created for each additional currency group using the same account. This is a frontend-only feature that operates on in-memory entry state before submission.

## Technical Context

**Language/Version**: TypeScript 5.x (frontend strict mode)
**Primary Dependencies**: React, Next.js 14, Tailwind CSS, shadcn/ui, React Query
**Storage**: N/A (frontend-only, operates on in-memory state)
**Testing**: Jest + React Testing Library (frontend), Playwright E2E
**Target Platform**: Web browser (desktop + responsive)
**Project Type**: Web application (Next.js frontend with NestJS backend)
**Performance Goals**: Auto-balance completes within 2 seconds for up to 20 lines
**Constraints**: No backend changes; operates on unsaved in-memory entries only
**Scale/Scope**: Works with any number of lines; typical entries have 2-10 lines

## Constitution Check

### Gates (Pre-Phase 0)

| Gate | Status | Justification |
|------|--------|---------------|
| I. Financial Integrity (Decimal type) | ✅ N/A | Frontend-only calculation; backend validation enforces decimal when saving |
| II. Tenant Isolation (RLS) | ✅ N/A | No backend changes; frontend operates on tenant-isolated data |
| III. Type Safety (no `any`) | ✅ REQUIRED | Frontend TypeScript must use strict typing, no `as any` |
| IV. Validation & Data Integrity | ✅ N/A | No new API endpoints; existing backend validation applies on submit |
| V. Plugin System Integrity | ✅ N/A | No plugin changes |
| VI. Code Quality (SRP) | ✅ REQUIRED | Auto-balance logic must be isolated in dedicated hook/component |
| VII. Testing Standards | ✅ REQUIRED | Unit tests for hook; E2E tests for user flow |
| VIII. UX Consistency | ✅ REQUIRED | Use shadcn/ui; provide loading state and error feedback |
| IX. Performance Requirements | ✅ REQUIRED | <2s completion time for 20 lines |

**Result**: 4 gates require compliance (III, VI, VII, VIII, IX)

## Project Structure

### Documentation (this feature)

```text
specs/004-journal-auto-balance/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (if needed)
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
└── contracts/           # Phase 1 output (N/A - no API changes)
```

### Source Code (repository root)

```text
frontend/
├── src/
│   ├── components/
│   │   ├── journal/
│   │   │   ├── JournalEntryForm.tsx    # Main form component
│   │   │   └── AutoBalanceButton.tsx   # New button component
│   │   └── ui/                         # shadcn/ui components
│   ├── hooks/
│   │   ├── useJournalEntry.ts          # Existing entry state hook
│   │   └── useAutoBalance.ts           # NEW: auto-balance logic hook
│   └── lib/
│       └── utils.ts                    # Existing utilities
└── tests/
    ├── journal/
    │   ├── useAutoBalance.spec.ts      # NEW: unit tests
    │   └── JournalEntryForm.spec.tsx   # Updated: component tests
    └── utils/
        └── autoBalance.test.ts         # NEW: pure function tests
```

**Structure Decision**: This is a frontend-only enhancement. The auto-balance logic is extracted into a dedicated `useAutoBalance` hook for single responsibility. The button is a standalone component. Existing journal entry form is modified to include the button and hook integration. Tests are co-located with implementations.

## Complexity Tracking

> **No constitution violations requiring justification**

All requirements are satisfied with standard patterns:
- Frontend-only: aligns with feature spec clarifications
- No backend: reduces complexity
- Hook-based logic: clean separation of concerns
- Standard testing: Jest + React Testing Library

---

## Phase 0: Research (SKIPPED)

**Reason**: No unresolved technical unknowns. All technical decisions are clear:
- Frontend-only implementation confirmed
- Hook-based architecture follows existing patterns
- No external dependencies beyond existing stack

If research were needed, it would investigate:
- Best practices for financial calculation precision in JavaScript
- React state management patterns for complex form validation

---

## Phase 1: Design & Contracts

### Data Model (Frontend State)

```typescript
// Line amount states
type AmountValue = number | null | undefined;

// Journal line in the form state
interface JournalLineFormState {
  id?: string;                    // Existing line ID (for edits)
  account_id: string;
  amount: AmountValue;
  currency: string;
  tags: string[];
  remarks?: string;
  isNew?: boolean;                // Marks lines added by auto-balance
}

// Form state with auto-balance metadata
interface JournalEntryFormState {
  id?: string;                    // Existing entry ID (for edits)
  date: Date;
  description: string;
  reference_id?: string;
  lines: JournalLineFormState[];
  _autoBalanceMetadata?: {
    originalEmptyLineIndex: number;
    createdLineIndices: number[];
    timestamp: Date;
  };
}

// Auto-balance calculation result
interface AutoBalanceResult {
  success: boolean;
  lines: JournalLineFormState[];
  errors?: string[];
  validationErrors?: string[];
}
```

### Auto-Balance Algorithm

```typescript
// Pure function for auto-balance calculation
function calculateAutoBalance(
  lines: JournalLineFormState[]
): AutoBalanceResult {
  // 1. Validate preconditions
  const emptyLines = lines.filter(l => isEmptyAmount(l.amount));
  if (emptyLines.length !== 1) {
    return {
      success: false,
      lines,
      errors: ['Exactly one line must have an empty amount']
    };
  }

  // 2. Group by currency
  const currencyGroups = groupBy(lines, 'currency');
  const emptyLineCurrency = emptyLines[0].currency;

  // 3. Calculate balancing amounts for each currency
  const results: JournalLineFormState[] = [...lines];
  const emptyLineIndex = lines.findIndex(l => isEmptyAmount(l.amount));

  for (const [currency, currencyLines] of Object.entries(currencyGroups)) {
    const sum = currencyLines.reduce(
      (total, line) => total + (line.amount || 0),
      0
    );
    const balancingAmount = -sum;

    if (currency === emptyLineCurrency) {
      // Fill the empty line
      results[emptyLineIndex] = {
        ...results[emptyLineIndex],
        amount: balancingAmount
      };
    } else {
      // Create new line for this currency
      const newLine: JournalLineFormState = {
        account_id: lines[emptyLineIndex].account_id,
        amount: balancingAmount,
        currency,
        tags: [],
        isNew: true
      };
      results.push(newLine);
    }
  }

  // 4. Validate balance
  const validationErrors = validateBalance(results);
  if (validationErrors.length > 0) {
    return {
      success: false,
      lines,
      validationErrors
    };
  }

  return { success: true, lines: results };
}

// Helper functions
function isEmptyAmount(amount: AmountValue): boolean {
  return amount === null || amount === undefined || amount === 0;
}

function groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
  return array.reduce((groups, item) => {
    const groupKey = String(item[key]);
    return {
      ...groups,
      [groupKey]: [...(groups[groupKey] || []), item]
    };
  }, {} as Record<string, T[]>);
}

function validateBalance(lines: JournalLineFormState[]): string[] {
  const errors: string[] = [];
  const groups = groupBy(lines, 'currency');

  for (const [currency, currencyLines] of Object.entries(groups)) {
    const sum = currencyLines.reduce(
      (total, line) => total + (line.amount || 0),
      0
    );
    if (Math.abs(sum) > 0.0001) {
      errors.push(`Currency ${currency} does not balance (sum: ${sum})`);
    }
  }

  return errors;
}
```

### UI Components

#### AutoBalanceButton

```typescript
// frontend/src/components/journal/AutoBalanceButton.tsx
interface AutoBalanceButtonProps {
  lines: JournalLineFormState[];
  onAutoBalance: (result: AutoBalanceResult) => void;
  disabled?: boolean;
  variant?: 'default' | 'outline' | 'ghost';
}

export function AutoBalanceButton({
  lines,
  onAutoBalance,
  disabled = false,
  variant = 'default'
}: AutoBalanceButtonProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  const canAutoBalance = useMemo(() => {
    if (lines.length < 2) return false;
    const emptyCount = lines.filter(l => isEmptyAmount(l.amount)).length;
    return emptyCount === 1;
  }, [lines]);

  const handleClick = async () => {
    setIsProcessing(true);
    try {
      // Simulate small delay for UX (enables loading state)
      await new Promise(resolve => setTimeout(resolve, 100));
      const result = calculateAutoBalance(lines);
      onAutoBalance(result);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!canAutoBalance) {
    return null; // Or render disabled state
  }

  return (
    <Button
      variant={variant}
      onClick={handleClick}
      disabled={disabled || isProcessing || !canAutoBalance}
      loading={isProcessing}
    >
      {isProcessing ? 'Calculating...' : 'Auto-Balance'}
    </Button>
  );
}
```

#### useAutoBalance Hook

```typescript
// frontend/src/hooks/useAutoBalance.ts
interface UseAutoBalanceReturn {
  autoBalance: () => void;
  canAutoBalance: boolean;
  lastResult: AutoBalanceResult | null;
  errors: string[];
}

export function useAutoBalance(
  lines: JournalLineFormState[],
  onUpdate: (lines: JournalLineFormState[]) => void
): UseAutoBalanceReturn {
  const [lastResult, setLastResult] = useState<AutoBalanceResult | null>(null);

  const canAutoBalance = useMemo(() => {
    if (lines.length < 2) return false;
    const emptyCount = lines.filter(l => isEmptyAmount(l.amount)).length;
    return emptyCount === 1;
  }, [lines]);

  const autoBalance = useCallback(() => {
    const result = calculateAutoBalance(lines);
    if (result.success) {
      onUpdate(result.lines);
      setLastResult(result);
    }
    setLastResult(result);
  }, [lines, onUpdate]);

  const errors = useMemo(() => {
    if (!lastResult) return [];
    return [
      ...(result.errors || []),
      ...(result.validationErrors || [])
    ];
  }, [lastResult]);

  return {
    autoBalance,
    canAutoBalance,
    lastResult,
    errors
  };
}
```

### Integration Points

1. **JournalEntryForm** - Existing form component
   - Import `AutoBalanceButton`
   - Import `useAutoBalance` hook
   - Place button in toolbar area
   - Pass lines state to hook
   - Handle hook callbacks

2. **Error Handling**
   - Display errors in toast notification
   - Show validation errors inline near line amounts
   - Preserve user input on failure

3. **Accessibility**
   - Button has `aria-label` describing action
   - Keyboard navigation support
   - Focus management after auto-balance

### No API Contracts Required

This feature operates entirely on frontend state. The existing journal entry API is unchanged. Backend validation (`JournalService.validateBalancedLines()`) will validate the final submission.

---

## Phase 2: Tasks (NOT CREATED)

Task decomposition is handled by the `/speckit.tasks` command, not `/speckit.plan`.

---

## Post-Design Constitution Re-check

| Gate | Status | Evidence |
|------|--------|----------|
| I. Financial Integrity | ✅ N/A | No data changes; backend validates on submit |
| II. Tenant Isolation | ✅ N/A | No backend changes |
| III. Type Safety | ✅ PASS | TypeScript with explicit interfaces, no `any` |
| IV. Validation | ✅ N/A | No new API endpoints |
| V. Plugin System | ✅ N/A | No plugin changes |
| VI. Code Quality | ✅ PASS | Dedicated hook (`useAutoBalance`), pure functions |
| VII. Testing | ✅ PASS | Unit tests for hook, E2E for user flow planned |
| VIII. UX Consistency | ✅ PASS | Uses shadcn/ui Button, loading state, error feedback |
| IX. Performance | ✅ PASS | <2s completion, memoized calculations |

**Result**: All gates compliant. Feature ready for implementation.
