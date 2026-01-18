'use client';

import { useState, useMemo, useEffect } from 'react';
import { useAccounts, useCreateAccount, useBalances } from '@/hooks/use-api';
import { currenciesApi } from '@/lib/currencies';
import type { Account, AccountBalance } from '@/types';
import type { Currency } from '@/types/currency';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatAmount(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function getAccountBalance(
  accountId: string,
  balancesData: AccountBalance[],
  showSubtree: boolean
): { amount: number; currency: string } | null {
  const balance = balancesData.find((b) => b.account.id === accountId);
  if (!balance) return null;

  if (showSubtree && balance.converted_subtree_total !== undefined) {
    return {
      amount: balance.converted_subtree_total,
      currency: balance.converted_subtree_currency || 'USD',
    };
  }

  if (balance.converted_amount !== undefined) {
    return { amount: balance.converted_amount, currency: 'USD' };
  }

  const totalAmount = balance.currencies.reduce((sum, c) => sum + c.amount, 0);
  return { amount: totalAmount, currency: balance.currencies[0]?.currency || 'USD' };
}

function BalanceCell({
  amount,
  currency,
  displayCurrency,
}: {
  amount: number;
  currency: string;
  displayCurrency: string;
}) {
  const isNegative = amount < 0;
  const displayAmount = Math.abs(amount);

  return (
    <span className={isNegative ? 'text-red-600 font-medium' : 'font-medium'}>
      {isNegative && '-'}
      {formatAmount(displayAmount)} {displayCurrency}
    </span>
  );
}

export default function AccountsPage() {
  const { data: accounts, isLoading: accountsLoading, refetch: refetchAccounts } = useAccounts();
  const { data: balancesData, isLoading: balancesLoading, refetch: refetchBalances } = useBalances({
    depth: 1,
    convert_to: 'USD',
  });
  const createAccount = useCreateAccount();

  const [showForm, setShowForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'assets' as const,
    parent_id: '',
    currency: 'USD',
  });
  const [showSubtreeBalances, setShowSubtreeBalances] = useState(false);
  const [displayCurrency, setDisplayCurrency] = useState<string>('USD');
  const [availableCurrencies, setAvailableCurrencies] = useState<Currency[]>([]);

  const accountTypes = ['assets', 'liabilities', 'equity', 'revenue', 'expense'];

  useEffect(() => {
    const fetchCurrencies = async () => {
      try {
        const currencies = await currenciesApi.getAll();
        setAvailableCurrencies(currencies.filter((c) => c.is_active));
      } catch (error) {
        console.error('Failed to fetch currencies:', error);
      }
    };

    fetchCurrencies();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const submitData = {
      ...formData,
      parent_id: formData.parent_id || undefined,
    };

    if (editingAccount) {
      await createAccount.mutateAsync({
        id: editingAccount.id,
        ...submitData,
      });
    } else {
      await createAccount.mutateAsync(submitData);
    }

    setShowForm(false);
    setEditingAccount(null);
    setFormData({ name: '', type: 'assets' as const, parent_id: '', currency: 'USD' });
    refetchAccounts();
  };

  const handleAddNew = () => {
    setEditingAccount(null);
    setFormData({ name: '', type: 'assets', parent_id: '', currency: 'USD' });
    setShowForm(true);
  };

  if (accountsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading accounts...</div>
      </div>
    );
  }

  const renderAccountTree = (parentId: string | null, level: number = 0): JSX.Element[] => {
    const children = accounts?.filter((a: Account) => (a.parent_id ?? null) === parentId) || [];

    return children.map((account: Account) => {
      const hasChildren = accounts?.some((a: Account) => (a.parent_id ?? null) === account.id);
      const balance = getAccountBalance(
        account.id,
        balancesData?.balances || [],
        showSubtreeBalances
      );

      return (
        <div key={account.id}>
          <div
            className={`
              flex items-center gap-2 py-3 px-3 rounded-lg
              hover:bg-muted/50 transition-colors group
              ${level > 0 ? 'ml-6' : ''}
            `}
          >
            <div className="w-6 flex items-center justify-center">
              <div className="w-6" />
            </div>

            <div className="min-w-0 flex-1">
              <span className="font-medium truncate block">{account.name}</span>
            </div>

            <span className="text-xs px-2 py-0.5 bg-secondary rounded shrink-0">
              {account.type}
            </span>

            <span className="text-sm text-muted-foreground shrink-0">{account.currency}</span>

            <div className="w-32 text-right shrink-0">
              {balance ? (
                <BalanceCell
                  amount={balance.amount}
                  currency={balance.currency}
                  displayCurrency={displayCurrency}
                />
              ) : (
                <span className="text-muted-foreground">--</span>
              )}
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => handleEdit(account)}
                title="Edit account"
              >
                <EditIcon className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {hasChildren && (
            <div className="border-l-2 border-muted ml-3">
              {renderAccountTree(account.id, level + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  const handleEdit = (account: Account) => {
    setEditingAccount(account);
    setFormData({
      name: account.name,
      type: account.type as any,
      parent_id: account.parent_id || '',
      currency: account.currency,
    });
    setShowForm(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Accounts</h1>
          <p className="text-muted-foreground">Manage your chart of accounts</p>
        </div>
        <Button onClick={handleAddNew}>
          <Plus className="h-4 w-4 mr-2" />
          New Account
        </Button>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <Switch
              id="show-subtree"
              checked={showSubtreeBalances}
              onCheckedChange={setShowSubtreeBalances}
            />
            <Label htmlFor="show-subtree">Show Subtree Balances</Label>
          </div>

          <div className="flex items-center gap-2">
            <Label htmlFor="display-currency">Display Currency:</Label>
            <select
              id="display-currency"
              value={displayCurrency}
              onChange={(e) => setDisplayCurrency(e.target.value)}
              className="px-3 py-2 border rounded-md bg-background"
            >
              {availableCurrencies.map((currency: Currency) => (
                <option key={currency.id} value={currency.code}>
                  {currency.code}
                </option>
              ))}
            </select>
          </div>

          {balancesLoading && (
            <span className="text-sm text-muted-foreground">Loading balances...</span>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account Tree</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-2 px-3 pb-2 text-sm text-muted-foreground border-b">
            <div className="w-6" />
            <div className="min-w-0">Account</div>
            <div className="w-20">Type</div>
            <div className="w-16">Currency</div>
            <div className="w-32 text-right">Balance</div>
            <div className="w-10" />
          </div>

          {accounts && accounts.length > 0 ? (
            <div className="space-y-1">{renderAccountTree(null)}</div>
          ) : (
            <div className="text-center py-12">
              <div className="text-muted-foreground mb-4">
                No accounts yet. Create your first account to get started.
              </div>
              <Button onClick={handleAddNew}>
                <Plus className="h-4 w-4 mr-2" />
                Create Account
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={showForm}
        onOpenChange={(open) => {
          setShowForm(open);
          if (!open) {
            setEditingAccount(null);
            setFormData({ name: '', type: 'assets' as const, parent_id: '', currency: 'USD' });
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingAccount ? 'Edit Account' : 'Create Account'}</DialogTitle>
            <DialogDescription>
              {editingAccount
                ? 'Update the account details below.'
                : 'Fill in the details to create a new account.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md bg-background"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <select
                  id="type"
                  value={formData.type}
                  onChange={(e) =>
                    setFormData({ ...formData, type: e.target.value as any })
                  }
                  className="w-full px-3 py-2 border rounded-md bg-background"
                >
                  {accountTypes.map((type) => (
                    <option key={type} value={type}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <input
                  id="currency"
                  type="text"
                  value={formData.currency}
                  onChange={(e) =>
                    setFormData({ ...formData, currency: e.target.value.toUpperCase() })
                  }
                  className="w-full px-3 py-2 border rounded-md bg-background"
                  maxLength={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="parent">Parent Account (optional)</Label>
                <select
                  id="parent"
                  value={formData.parent_id}
                  onChange={(e) => setFormData({ ...formData, parent_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md bg-background"
                >
                  <option value="">None (Top Level)</option>
                  {accounts?.map((account: Account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={createAccount.isPending}>
                {createAccount.isPending
                  ? 'Saving...'
                  : editingAccount
                    ? 'Update Account'
                    : 'Create Account'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowForm(false);
                  setEditingAccount(null);
                  setFormData({
                    name: '',
                    type: 'assets' as const,
                    parent_id: '',
                    currency: 'USD',
                  });
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EditIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}
