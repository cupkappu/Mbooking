'use client';

import type { CurrencyBalance } from '@/types';

interface BalanceCellProps {
  currencies: CurrencyBalance[];
  subtreeCurrencies?: CurrencyBalance[];
  convertedSubtreeTotal?: number;
  displayCurrency: string;
}

function formatNumber(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function BalanceCell({
  currencies,
  subtreeCurrencies,
  convertedSubtreeTotal,
  displayCurrency,
}: BalanceCellProps) {
  // Format: "1,000.00 CNY + 100.00 USD + 4,000.00 HKD"
  const balanceText = currencies
    .map((c) => `${formatNumber(c.amount)} ${c.currency}`)
    .join(' + ');

  // Format: "5,800.00 HKD"
  const convertedText = subtreeCurrencies && subtreeCurrencies.length > 0
    ? subtreeCurrencies
        .map((c) => `${formatNumber(c.amount)} ${c.currency}`)
        .join(' + ')
    : null;

  const totalText = convertedSubtreeTotal
    ? `${formatNumber(convertedSubtreeTotal)} ${displayCurrency}`
    : null;

  // Check if we need to show converted total for main balance
  const showMainConverted = currencies.length > 0 && currencies[0].currency !== displayCurrency && convertedSubtreeTotal;

  return (
    <div className="flex flex-col">
      {/* Main balance */}
      <span className="font-mono">
        {balanceText || '0.00'}
      </span>
      
      {/* Converted total for this account */}
      {showMainConverted && (
        <span className="text-xs text-muted-foreground font-mono">
          = {totalText}
        </span>
      )}

      {/* Subtree balance section */}
      {subtreeCurrencies && subtreeCurrencies.length > 0 && (
        <>
          <div className="h-px bg-border my-1" />
          <span className="text-sm text-foreground font-mono">
            {convertedText}
          </span>
          {convertedSubtreeTotal && (
            <span className="text-xs text-muted-foreground font-mono">
              = {totalText}
            </span>
          )}
        </>
      )}
    </div>
  );
}
