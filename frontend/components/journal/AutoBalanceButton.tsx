/**
 * Auto-Balance button component for journal entries
 * Feature: 004-journal-auto-balance
 */

"use client";

import { useState, useMemo } from "react";

import { Button } from "@/components/ui/button";
import { calculateAutoBalance, isEmptyAmount } from "@/lib/auto-balance";
import type {
  JournalLineFormState,
  AutoBalanceButtonProps,
} from "@/types/auto-balance";

export function AutoBalanceButton({
  lines,
  onAutoBalance,
  disabled = false,
  variant = "default",
}: AutoBalanceButtonProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  const canAutoBalance = useMemo(() => {
    if (lines.length < 2) return false;
    const emptyCount = lines.filter((line) => isEmptyAmount(line.amount)).length;
    return emptyCount === 1;
  }, [lines]);

  const handleClick = async () => {
    setIsProcessing(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 100));
      const result = calculateAutoBalance(lines);
      onAutoBalance(result);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!canAutoBalance) {
    return null;
  }

  const isDisabled = disabled || isProcessing || !canAutoBalance;
  const buttonText = isProcessing ? "Calculating..." : "Auto-Balance";

  return (
    <Button
      variant={variant}
      onClick={handleClick}
      disabled={isDisabled}
      className={isProcessing ? "cursor-wait" : ""}
      aria-label="Auto-balance journal entry"
      title="Automatically calculate the balancing amount"
    >
      {buttonText}
    </Button>
  );
}
