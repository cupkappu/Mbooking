# Quickstart: Journal Entry Auto-Balance

**Feature**: 004-journal-auto-balance
**Created**: 2026-01-24

## What This Feature Does

Adds an "Auto-Balance" button to the journal entry form that automatically calculates and fills the balancing amount when exactly one line has an empty or zero amount.

## User Flow

1. User opens journal entry creation or edit form
2. User adds 2 or more lines with accounts and amounts
3. User leaves one line's amount empty or set to 0
4. User clicks "Auto-Balance" button
5. System calculates the balancing amount and either:
   - Fills the empty line (single currency), OR
   - Fills the empty line and creates new lines for other currencies (multi-currency)
6. User reviews and submits the entry

## Single Currency Example

**Before:**
| Line | Account | Amount | Currency |
|------|---------|--------|----------|
| 1 | Cash | 1000 | USD |
| 2 | Revenue | 1000 | USD |
| 3 | (empty) | (empty) | USD |

**After clicking Auto-Balance:**
| Line | Account | Amount | Currency |
|------|---------|--------|----------|
| 1 | Cash | 1000 | USD |
| 2 | Revenue | 1000 | USD |
| 3 | (empty) | **-2000** | USD |

## Multi-Currency Example

**Before:**
| Line | Account | Amount | Currency |
|------|---------|--------|----------|
| 1 | Cash (USD) | 1000 | USD |
| 2 | (empty) | (empty) | USD |
| 3 | Expense (CNY) | -600 | CNY |

**After clicking Auto-Balance:**
| Line | Account | Amount | Currency |
|------|---------|--------|----------|
| 1 | Cash (USD) | 1000 | USD |
| 2 | (empty) | **-1000** | USD |
| 3 | Expense (CNY) | -600 | CNY |
| 4 | Cash (USD) | **+600** | CNY |

## When Auto-Balance Is Available

The button is visible and enabled when:
- ✅ At least 2 lines exist
- ✅ Exactly 1 line has an empty or zero amount
- ✅ All other lines have valid (non-empty, non-zero) amounts

The button is hidden or disabled when:
- ❌ Fewer than 2 lines
- ❌ Multiple lines have empty amounts
- ❌ All lines already have amounts (entry is balanced)
- ❌ Entry already saved (read-only mode)

## Error Cases

1. **Precondition not met**: "Exactly one line must have an empty amount"
2. **Validation failed**: "Currency USD does not balance (sum: 100)"

## Implementation Overview

- **Location**: `frontend/src/components/journal/` and `frontend/src/hooks/`
- **Main components**:
  - `AutoBalanceButton.tsx` - Button with loading state
  - `useAutoBalance.ts` - Hook containing calculation logic
- **Algorithm**: Pure function `calculateAutoBalance()` for testability
- **Testing**: Jest unit tests + Playwright E2E tests

## Related Files

| File | Purpose |
|------|---------|
| `frontend/src/hooks/useAutoBalance.ts` | Main hook with calculation logic |
| `frontend/src/components/journal/AutoBalanceButton.tsx` | Button component |
| `frontend/src/components/journal/JournalEntryForm.tsx` | Integration point |
| `specs/004-journal-auto-balance/data-model.md` | Type definitions |
| `specs/004-journal-auto-balance/plan.md` | Implementation plan |
