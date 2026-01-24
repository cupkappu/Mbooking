/**
 * Auto-balance utility functions for journal entries
 * Feature: 004-journal-auto-balance
 */

import type {
  JournalLineFormState,
  AutoBalanceResult,
  AmountValue,
} from "@/types/auto-balance";

/**
 * Check if an amount value is considered "empty"
 * Empty means: null, undefined, or numeric zero
 * Negative amounts are NOT empty - they have accounting meaning
 */
export function isEmptyAmount(amount: AmountValue): boolean {
  return amount === null || amount === undefined || amount === 0;
}

/**
 * Group an array of items by a key function
 */
export function groupBy<T>(
  array: T[],
  keyFn: (item: T) => string
): Record<string, T[]> {
  return array.reduce(
    (groups, item) => {
      const groupKey = keyFn(item);
      return {
        ...groups,
        [groupKey]: [...(groups[groupKey] || []), item],
      };
    },
    {} as Record<string, T[]>
  );
}

/**
 * Validate that all currency groups are balanced (sum to zero)
 */
export function validateBalance(
  lines: JournalLineFormState[]
): string[] {
  const errors: string[] = [];
  const groups = groupBy(lines, (line) => line.currency);

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

/**
 * Calculate the auto-balanced result for a journal entry
 *
 * Preconditions:
 * - At least 2 lines must exist
 * - Exactly 1 line must have an empty/zero amount
 *
 * For single currency:
 * - Fills the empty line with the negative sum of all amounts
 *
 * For multi-currency:
 * - Fills the empty line for its currency
 * - Creates new lines for each additional currency group using the empty line's account
 */
export function calculateAutoBalance(
  lines: JournalLineFormState[]
): AutoBalanceResult {
  // Validate preconditions
  const emptyLines = lines.filter((line) => isEmptyAmount(line.amount));

  if (lines.length < 2) {
    return {
      success: false,
      lines,
      errors: ["At least 2 lines required for auto-balance"],
    };
  }

  if (emptyLines.length !== 1) {
    return {
      success: false,
      lines,
      errors: ["Exactly one line must have an empty amount"],
    };
  }

  // Group by currency
  const currencyGroups = groupBy(lines, (line) => line.currency);
  const emptyLineCurrency = emptyLines[0].currency;
  const emptyLineIndex = lines.findIndex((line) =>
    isEmptyAmount(line.amount)
  );

  // Calculate and fill balancing amounts
  const results: JournalLineFormState[] = [...lines];

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
        amount: balancingAmount,
      };
    } else {
      // Create new line for this currency
      const newLine: JournalLineFormState = {
        account_id: lines[emptyLineIndex].account_id,
        amount: balancingAmount,
        currency,
        tags: [],
        isNew: true,
      };
      results.push(newLine);
    }
  }

  // Validate the result
  const validationErrors = validateBalance(results);
  if (validationErrors.length > 0) {
    return {
      success: false,
      lines,
      validationErrors,
    };
  }

  return { success: true, lines: results };
}
