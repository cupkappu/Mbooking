/**
 * React hook for journal entry auto-balance functionality
 * Feature: 004-journal-auto-balance
 */

import { useState, useMemo, useCallback } from "react";

import { calculateAutoBalance } from "@/lib/auto-balance";
import type {
  JournalLineFormState,
  AutoBalanceResult,
  UseAutoBalanceReturn,
} from "@/types/auto-balance";

interface UseAutoBalanceProps {
  lines: JournalLineFormState[];
  onUpdate: (lines: JournalLineFormState[]) => void;
}

export function useAutoBalance({
  lines,
  onUpdate,
}: UseAutoBalanceProps): UseAutoBalanceReturn {
  const [lastResult, setLastResult] = useState<AutoBalanceResult | null>(null);

  const canAutoBalance = useMemo(() => {
    if (lines.length < 2) return false;
    const emptyCount = lines.filter(
      (line) =>
        line.amount === null || line.amount === undefined || line.amount === 0
    ).length;
    return emptyCount === 1;
  }, [lines]);

  const autoBalance = useCallback(() => {
    const result = calculateAutoBalance(lines);
    if (result.success) {
      onUpdate(result.lines);
    }
    setLastResult(result);
  }, [lines, onUpdate]);

  const errors = useMemo(() => {
    if (!lastResult) return [];
    return [...(lastResult.errors || []), ...(lastResult.validationErrors || [])];
  }, [lastResult]);

  return {
    autoBalance,
    canAutoBalance,
    lastResult,
    errors,
  };
}
