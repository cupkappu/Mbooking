'use client';

import { useState, useMemo, useEffect } from 'react';
import { useAccounts, useCreateAccount, useDeleteAccount, useUpdateAccount, useBalances } from '@/hooks/use-api';
import { useCurrencies } from '@/hooks/use-currencies';
import type { Account } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Plus, Edit2, Trash2, Folder, ChevronRight, ChevronDown, Loader2, Search } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { currenciesApi } from '@/lib/currencies';
import type { Currency } from '@/types/currency';
import { BalanceCell } from '@/components/accounts/BalanceCell';
import { TotalCell } from '@/components/accounts/TotalCell';
import type { CurrencyBalance, AccountBalance } from '@/types';

function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function getAccountBalance(accountId: string, balancesData: Map<string, AccountBalance>): AccountBalance | undefined {
  return balancesData.get(accountId);
}

function formatAmount(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export default function AccountsPage() {
  const [showForm, setShowForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [deletingAccount, setDeletingAccount] = useState<Account | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'assets' as const,
    parent_id: '',
    currency: 'USD',
  });
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedParent, setSelectedParent] = useState('all');
  const [displayCurrency, setDisplayCurrency] = useState<string>('USD');
  const [availableCurrencies, setAvailableCurrencies] = useState<Currency[]>([]);
  const [maxExpandedDepth, setMaxExpandedDepth] = useState<number>(1);

  const { data: accounts, isLoading: accountsLoading, refetch: refetchAccounts } = useAccounts();
  const { data: balancesData, isLoading: balancesLoading, refetch: refetchBalances } = useBalances({ 
    depth: maxExpandedDepth, 
    convert_to: displayCurrency, 
    include_subtree: true 
  });
  const createAccount = useCreateAccount();
  const updateAccount = useUpdateAccount();
  const deleteAccount = useDeleteAccount();
  const { data: currencies } = useCurrencies();

  const accountTypes = ['assets', 'liabilities', 'equity', 'revenue', 'expense'];

  useEffect(() => {
    const savedCurrency = localStorage.getItem('accounts_display_currency');
    if (savedCurrency) {
      setDisplayCurrency(savedCurrency);
    }

    const fetchCurrencies = async () => {
      try {
        const currencies = await currenciesApi.getAll();
        setAvailableCurrencies(currencies.filter(currency => currency.is_active));
      } catch (error) {
        console.error('Failed to fetch currencies:', error);
      }
    };

    fetchCurrencies();
  }, []);

  const balanceMap = useMemo(() => {
    const map = new Map<string, AccountBalance>();
    if (balancesData?.balances) {
      for (const item of balancesData.balances) {
        map.set(item.account.id, item);
      }
    }
    return map;
  }, [balancesData]);

  const parentAccounts = useMemo(() => {
    if (!accounts) return [];
    return accounts.filter((account: Account) =>
      accounts.some((a: Account) => a.parent_id === account.id)
    );
  }, [accounts]);

  const filteredAccounts = useMemo(() => {
    if (!accounts) return [];

    return accounts.filter((account: Account) => {
      if (activeTab !== 'all' && account.type !== activeTab) {
        return false;
      }

      if (searchTerm && !account.name.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }

      if (selectedParent !== 'all' && account.parent_id !== selectedParent) {
        return false;
      }

      return true;
    });
  }, [accounts, activeTab, searchTerm, selectedParent]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const submitData = {
      ...formData,
      parent_id: formData.parent_id || undefined,
    };
    
    if (editingAccount) {
      await updateAccount.mutateAsync({
        id: editingAccount.id,
        data: submitData,
      });
    } else {
      await createAccount.mutateAsync(submitData);
      
      // Auto-expand parent to show the new child account
      if (formData.parent_id) {
        setExpandedAccounts(prev => new Set(prev).add(formData.parent_id!));
      }
    }
    
    setShowForm(false);
    setEditingAccount(null);
    setFormData({ name: '', type: 'assets' as const, parent_id: '', currency: 'USD' });
    refetchAccounts();
    refetchBalances();
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

  const handleAddNew = () => {
    setEditingAccount(null);
    setFormData({ name: '', type: 'assets', parent_id: '', currency: 'USD' });
    setShowForm(true);
  };

  // Get maximum depth from all accounts
  const getMaxAccountDepth = (): number => {
    let maxDepth = 1;
    for (const account of accounts || []) {
      maxDepth = Math.max(maxDepth, account.depth);
    }
    return maxDepth;
  };

  const getMaxDepthForExpandedAccounts = (): number => {
    const maxDepth = getMaxAccountDepth();
    
    if (expandedAccounts.size === 0) {
      return 1;
    }
    
    let requiredDepth = 1;
    
    for (const expandedId of Array.from(expandedAccounts)) {
      const expandedAccount = accounts?.find((a: Account) => a.id === expandedId);
      if (expandedAccount) {
        requiredDepth = Math.max(requiredDepth, maxDepth);
      }
    }
    
    for (const account of accounts || []) {
      if (account.parent_id && expandedAccounts.has(account.parent_id)) {
        requiredDepth = Math.max(requiredDepth, account.depth);
      }
    }
    
    return requiredDepth;
  };

  const toggleExpand = (accountId: string) => {
    const newExpanded = new Set(expandedAccounts);
    if (newExpanded.has(accountId)) {
      newExpanded.delete(accountId);
    } else {
      newExpanded.add(accountId);
    }
    setExpandedAccounts(newExpanded);
    setMaxExpandedDepth(getMaxDepthForExpandedAccounts());
  };

  const handleCurrencyChange = (currencyCode: string) => {
    setDisplayCurrency(currencyCode);
    localStorage.setItem('accounts_display_currency', currencyCode);
    refetchBalances();
  };

  const handleDelete = async () => {
    if (deletingAccount) {
      await deleteAccount.mutateAsync(deletingAccount.id);
      setDeletingAccount(null);
      refetchAccounts();
      refetchBalances();
    }
  };

  if (accountsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const renderAccountTree = (parentId: string | null, level: number = 0): JSX.Element[] => {
    const children = filteredAccounts?.filter((a: Account) => {
      const accountParentId = a.parent_id ?? null;
      return accountParentId === parentId;
    }) || [];

    return children.map((account: Account) => {
      const hasChildren = filteredAccounts?.some((a: Account) => (a.parent_id ?? null) === account.id);
      const isExpanded = expandedAccounts.has(account.id);
      const balance = getAccountBalance(account.id, balanceMap);
      const isLoading = balancesLoading;

      return (
        <div key={account.id}>
          <div className={`
            flex items-center gap-2 py-3 px-3 rounded-lg
            hover:bg-muted/50 transition-colors group
            ${level > 0 ? 'ml-6' : ''}
          `}>
            <div className="w-6 flex items-center justify-center">
              {hasChildren ? (
                <button
                  onClick={() => toggleExpand(account.id)}
                  className="p-1 hover:bg-secondary rounded transition-colors"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
              ) : (
                <div className="w-6" />
              )}
            </div>
            
            <Folder className="h-4 w-4 text-primary shrink-0" />
            
            <div className="min-w-0 flex-1">
              <span className="font-medium truncate block">{account.name}</span>
            </div>
            
            <div className="w-20 flex-shrink-0">
              <Badge variant="outline" className="text-xs">
                {account.type}
              </Badge>
            </div>

            <div className="w-16 flex-shrink-0 text-sm text-muted-foreground">
              {account.currency}
            </div>

            <div className="w-36 text-right shrink-0">
              <BalanceCell
                currencies={balance?.currencies || []}
                displayCurrency={displayCurrency}
              />
            </div>
            
            <div className="w-36 text-right shrink-0">
              <TotalCell
                subtreeCurrencies={balance?.subtree_currencies}
                convertedSubtreeTotal={balance?.converted_subtree_total}
                displayCurrency={displayCurrency}
              />
            </div>

            <div className="w-24 flex items-center justify-end gap-1 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => handleEdit(account)}
                title="Edit account"
              >
                <Edit2 className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => setDeletingAccount(account)}
                title="Delete account"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          
          {hasChildren && isExpanded && (
            <div className="border-l-2 border-muted ml-3">
              {renderAccountTree(account.id, level + 1)}
            </div>
          )}
        </div>
      );
    });
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
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search accounts..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="md:w-64">
              <Select value={selectedParent} onValueChange={setSelectedParent}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by parent" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Parents</SelectItem>
                  {parentAccounts.map((account: Account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:w-32">
              <Select value={displayCurrency} onValueChange={handleCurrencyChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableCurrencies.map((currency: Currency) => (
                    <SelectItem key={currency.id} value={currency.code}>
                      {currency.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="assets">Assets</TabsTrigger>
            <TabsTrigger value="liabilities">Liabilities</TabsTrigger>
            <TabsTrigger value="equity">Equity</TabsTrigger>
            <TabsTrigger value="revenue">Revenue</TabsTrigger>
            <TabsTrigger value="expense">Expense</TabsTrigger>
          </TabsList>
          <TabsContent value={activeTab} className="mt-4">
          </TabsContent>
        </Tabs>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Account Tree</span>
            {balancesLoading && (
              <span className="text-sm font-normal text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading balances...
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 px-3 pb-2 text-sm text-muted-foreground border-b">
            <div className="w-6 flex-shrink-0" />
            <div className="w-6 flex-shrink-0" />
            <div className="min-w-0 flex-1">Account</div>
            <div className="w-20 flex-shrink-0">Type</div>
            <div className="w-16 flex-shrink-0">Currency</div>
            <div className="w-36 flex-shrink-0 text-right">Balance</div>
            <div className="w-36 flex-shrink-0 text-right">Total</div>
            <div className="w-24 flex-shrink-0 text-right">Actions</div>
          </div>

          {filteredAccounts && filteredAccounts.length > 0 ? (
            <div className="space-y-1">
              {renderAccountTree(null)}
            </div>
          ) : accounts && accounts.length > 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No accounts match your filters</p>
            </div>
          ) : (
            <div className="text-center py-12">
              <Folder className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No accounts yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first account to get started with double-entry bookkeeping.
              </p>
              <Button onClick={handleAddNew}>
                <Plus className="h-4 w-4 mr-2" />
                Create Account
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Account Form Dialog */}
      <Dialog open={showForm} onOpenChange={(open) => {
        setShowForm(open);
        if (!open) {
          setEditingAccount(null);
          setFormData({ name: '', type: 'assets' as const, parent_id: '', currency: 'USD' });
        }
      }}>
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
                <label className="text-sm font-medium">Name</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Account name"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Type</label>
                <Select
                  value={formData.type}
                  onValueChange={(value: any) => setFormData({ ...formData, type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {accountTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Currency</label>
                <Select
                  value={formData.currency}
                  onValueChange={(value) => setFormData({ ...formData, currency: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent>
                    {currencies?.map((currency) => (
                      <SelectItem key={currency.code} value={currency.code}>
                        {currency.code} - {currency.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Parent Account (optional)</label>
                <Select
                  value={formData.parent_id || '__none__'}
                  onValueChange={(value) => setFormData({ ...formData, parent_id: value === '__none__' ? '' : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="None (Top Level)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None (Top Level)</SelectItem>
                    {accounts?.map((account: Account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name} ({account.type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="submit" disabled={createAccount.isPending || updateAccount.isPending}>
                {(createAccount.isPending || updateAccount.isPending) ? 'Saving...' : (editingAccount ? 'Update Account' : 'Create Account')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowForm(false);
                  setEditingAccount(null);
                  setFormData({ name: '', type: 'assets' as const, parent_id: '', currency: 'USD' });
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deletingAccount} onOpenChange={() => setDeletingAccount(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Account</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deletingAccount?.name}"? This action cannot be undone.
              Any child accounts will also be affected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeletingAccount(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteAccount.isPending}
            >
              {deleteAccount.isPending ? 'Deleting...' : 'Delete Account'}
            </Button>
          </DialogFooter>
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
