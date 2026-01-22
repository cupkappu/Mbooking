'use client';

import { useDashboardSummary, useDefaultCurrency, useAccounts } from '@/hooks/use-api';
import { useCurrencies } from '@/hooks/use-currencies';
import { formatCurrency, setCurrenciesCache } from '@/lib/currency-formatter';
import { JournalEntryCard } from '@/components/journal/journal-entry-card';

function formatNumber(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function LoadingCard({ label }: { label: string }) {
  return (
    <div className="p-6 bg-card rounded-lg border">
      <h3 className="text-sm font-medium text-muted-foreground">{label}</h3>
      <div className="h-8 bg-muted animate-pulse rounded mt-2" />
    </div>
  );
}

/** 显示按货币分别的余额，如 "1,000.00 HKD" */
function MultiCurrencyAmount({ amounts }: { amounts: { [currency: string]: number } | undefined | null }) {
  if (!amounts || Object.keys(amounts).length === 0) {
    return <span className="text-muted-foreground">-</span>;
  }

  const parts = Object.entries(amounts)
    .filter(([, amount]) => amount !== undefined && amount !== null && !Number.isNaN(amount) && Math.abs(amount) > 0.001)
    .map(([currency, amount]) => formatCurrency(amount, currency));

  if (parts.length === 0) {
    return <span className="text-muted-foreground">-</span>;
  }

  return (
    <div className="flex flex-col">
      {parts.map((part, index) => (
        <span key={index} className="font-mono text-lg">
          {part}
        </span>
      ))}
    </div>
  );
}

function SummaryCard({
  label,
  amounts,
  convertedAmount,
  isLoading,
  defaultCurrency,
}: {
  label: string;
  amounts: { [currency: string]: number } | undefined | null;
  convertedAmount?: number | undefined | null;
  isLoading: boolean;
  defaultCurrency?: string;
}) {
  return (
    <div className="p-6 bg-card rounded-lg border">
      <h3 className="text-sm font-medium text-muted-foreground">{label}</h3>
      {isLoading ? (
        <div className="h-8 bg-muted animate-pulse rounded mt-2" />
      ) : (
        <div className="mt-1">
          <MultiCurrencyAmount amounts={amounts} />
          {convertedAmount !== undefined && convertedAmount !== null && !Number.isNaN(convertedAmount) && (
            <p className="text-xl font-bold mt-1">
              = {formatCurrency(convertedAmount as number, defaultCurrency || 'USD')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { data: summary, isLoading, error } = useDashboardSummary();
  const { data: currencies } = useCurrencies();
  const { data: defaultCurrency } = useDefaultCurrency();
  const { data: accounts } = useAccounts();

  if (currencies) {
    setCurrenciesCache(currencies);
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Welcome to your accounting dashboard</p>
        </div>
        <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600">Error loading dashboard data. Please try again.</p>
        </div>
      </div>
    );
  }

  const accountList = accounts?.map((a: { id: string; path: string }) => ({
    id: a.id,
    path: a.path,
  })) || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Welcome to your accounting dashboard</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard
          label="Total Assets"
          amounts={summary?.assets}
          convertedAmount={summary?.converted_assets ?? undefined}
          isLoading={isLoading}
          defaultCurrency={defaultCurrency}
        />
        <SummaryCard
          label="Total Liabilities"
          amounts={summary?.liabilities}
          convertedAmount={summary?.converted_liabilities ?? undefined}
          isLoading={isLoading}
          defaultCurrency={defaultCurrency}
        />
        <SummaryCard
          label="Net Worth"
          amounts={undefined}
          convertedAmount={summary?.netWorth ?? undefined}
          isLoading={isLoading}
          defaultCurrency={defaultCurrency}
        />
      </div>

      <div className="p-6 bg-card rounded-lg border">
        <h3 className="text-lg font-semibold mb-4">Recent Transactions</h3>
        {isLoading ? (
          <div className="space-y-4">
            <div className="h-32 bg-muted animate-pulse rounded" />
            <div className="h-32 bg-muted animate-pulse rounded" />
            <div className="h-32 bg-muted animate-pulse rounded" />
          </div>
        ) : summary?.recentTransactions && summary.recentTransactions.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {summary.recentTransactions.map((transaction) => (
              <JournalEntryCard
                key={transaction.id}
                entry={transaction as any}
                accounts={accountList}
                defaultCurrency={defaultCurrency}
                variant="compact"
              />
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground">
            No transactions yet. Create your first journal entry to get started.
          </p>
        )}
      </div>
    </div>
  );
}
