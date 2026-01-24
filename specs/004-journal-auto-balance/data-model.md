# Data Model: Journal Entry Auto-Balance

**Feature**: 004-journal-auto-balance
**Created**: 2026-01-24

## Frontend State Types

### JournalLineFormState

```typescript
interface JournalLineFormState {
  /** Existing line ID (undefined for new lines) */
  id?: string;

  /** Account ID for this line */
  account_id: string;

  /** Amount - null/undefined means empty, 0 means zero amount */
  amount: number | null | undefined;

  /** Currency code (e.g., USD, CNY, EUR) */
  currency: string;

  /** Tags for categorization */
  tags: string[];

  /** Optional remarks */
  remarks?: string;

  /** Marks lines created by auto-balance */
  isNew?: boolean;
}
```

### JournalEntryFormState

```typescript
interface JournalEntryFormState {
  /** Existing entry ID (undefined for new entries) */
  id?: string;

  /** Entry date */
  date: Date;

  /** Transaction description */
  description: string;

  /** Optional reference ID */
  reference_id?: string;

  /** All journal lines */
  lines: JournalLineFormState[];

  /** Auto-balance metadata (optional tracking) */
  _autoBalanceMetadata?: {
    originalEmptyLineIndex: number;
    createdLineIndices: number[];
    timestamp: Date;
  };
}
```

### AutoBalanceResult

```typescript
interface AutoBalanceResult {
  /** Whether the operation succeeded */
  success: boolean;

  /** Updated lines after auto-balance */
  lines: JournalLineFormState[];

  /** Precondition errors (e.g., wrong number of empty lines) */
  errors?: string[];

  /** Post-validation errors (e.g., not balanced) */
  validationErrors?: string[];
}
```

## Validation Rules

### Preconditions (checked before calculation)

| Rule | Description | Error Message |
|------|-------------|---------------|
| Minimum lines | At least 2 lines must exist | "At least 2 lines required for auto-balance" |
| Single empty | Exactly 1 line must have empty/zero amount | "Exactly one line must have an empty amount" |

### Post-Calculation Validation

| Rule | Description | Error Message |
|------|-------------|---------------|
| Balance check | Sum of each currency group must equal zero | "Currency {currency} does not balance (sum: {sum})" |

## Type Constraints

- **Amount values**: `null` = empty, `undefined` = empty, `0` = zero, any number = valid amount
- **Negative amounts**: Valid and meaningful (credits in double-entry bookkeeping)
- **Currency groups**: Determined by distinct `currency` values across all lines

## State Transitions

```
Draft Entry (unsaved)
    │
    ├─ User adds/removes lines
    │
    ├─ User fills amounts
    │
    ├─ User clicks Auto-Balance ──► Calculate & Validate
    │                                   │
    │                                   ├─ Success ──► Updated Lines
    │                                   │
    │                                   └─ Failure ──► Error State
    │
    └─ User submits ──► Backend Validation ──► Saved Entry
```

## Persistence

This feature operates entirely on frontend in-memory state. No database schema changes required.

- New lines created by auto-balance are marked with `isNew: true`
- Metadata stored in `_autoBalanceMetadata` for undo/audit purposes
- On form submit, existing backend API receives the final line configuration
