/**
 * TypeScript types for Journal Entry Auto-Balance feature
 * Feature: 004-journal-auto-balance
 */

/**
 * Amount value type - can be a number, null (empty), or undefined
 */
export type AmountValue = number | null | undefined;

/**
 * Journal line state for form handling
 */
export interface JournalLineFormState {
  /** Existing line ID (undefined for new lines) */
  id?: string;

  /** Account ID for this line */
  account_id: string;

  /** Amount - null/undefined means empty, 0 means zero amount */
  amount: AmountValue;

  /** Currency code (e.g., USD, CNY, EUR) */
  currency: string;

  /** Tags for categorization */
  tags: string[];

  /** Optional remarks */
  remarks?: string;

  /** Marks lines created by auto-balance */
  isNew?: boolean;
}

/**
 * Journal entry form state
 */
export interface JournalEntryFormState {
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

/**
 * Result of auto-balance calculation
 */
export interface AutoBalanceResult {
  /** Whether the operation succeeded */
  success: boolean;

  /** Updated lines after auto-balance */
  lines: JournalLineFormState[];

  /** Precondition errors (e.g., wrong number of empty lines) */
  errors?: string[];

  /** Post-validation errors (e.g., not balanced) */
  validationErrors?: string[];
}

/**
 * Return type for useAutoBalance hook
 */
export interface UseAutoBalanceReturn {
  /** Function to trigger auto-balance */
  autoBalance: () => void;

  /** Whether auto-balance can be performed */
  canAutoBalance: boolean;

  /** Result of the last auto-balance operation */
  lastResult: AutoBalanceResult | null;

  /** Errors from the last operation */
  errors: string[];
}

/**
 * Props for AutoBalanceButton component
 */
export interface AutoBalanceButtonProps {
  /** Current lines state */
  lines: JournalLineFormState[];

  /** Callback when auto-balance completes */
  onAutoBalance: (result: AutoBalanceResult) => void;

  /** Whether the button is disabled */
  disabled?: boolean;

  /** Button variant from shadcn/ui */
  variant?: "default" | "outline" | "ghost";
}
