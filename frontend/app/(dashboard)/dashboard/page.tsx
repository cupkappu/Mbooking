'use client';

import { useDashboardSummary } from '@/hooks/use-api';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
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

function SummaryCard({
  label,
  amount,
  isLoading,
}: {
  label: string;
  amount?: number;
  isLoading: boolean;
}) {
  return (
    <div className="p-6 bg-card rounded-lg border">
      <h3 className="text-sm font-medium text-muted-foreground">{label}</h3>
      {isLoading ? (
        <div className="h-8 bg-muted animate-pulse rounded mt-2" />
      ) : (
        <p className="text-2xl font-bold">{formatCurrency(amount ?? 0)}</p>
      )}
    </div>
  );
}

function TransactionItem({
  transaction,
}: {
  transaction: {
    id: string;
    date: string;
    description: string;
    amount: number;
  };
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b last:border-0">
      <div>
        <p className="font-medium">{transaction.description}</p>
        <p className="text-sm text-muted-foreground">{transaction.date}</p>
      </div>
      <span
        className={`font-medium ${
          transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'
        }`}
      >
        {formatCurrency(transaction.amount)}
      </span>
    </div>
  );
}

export default function DashboardPage() {
  const { data: summary, isLoading, error } = useDashboardSummary();

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Welcome to your accounting dashboard</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard
          label="Total Assets"
          amount={summary?.assets}
          isLoading={isLoading}
        />
        <SummaryCard
          label="Total Liabilities"
          amount={summary?.liabilities}
          isLoading={isLoading}
        />
        <SummaryCard
          label="Net Worth"
          amount={summary?.netWorth}
          isLoading={isLoading}
        />
      </div>

      <div className="p-6 bg-card rounded-lg border">
        <h3 className="text-lg font-semibold mb-4">Recent Transactions</h3>
        {isLoading ? (
          <div className="space-y-4">
            <div className="h-12 bg-muted animate-pulse rounded" />
            <div className="h-12 bg-muted animate-pulse rounded" />
            <div className="h-12 bg-muted animate-pulse rounded" />
          </div>
        ) : summary?.recentTransactions && summary.recentTransactions.length > 0 ? (
          <div className="space-y-1">
            {summary.recentTransactions.map((transaction) => (
              <TransactionItem key={transaction.id} transaction={transaction} />
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
