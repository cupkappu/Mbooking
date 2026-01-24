'use client';

// Force dynamic rendering to avoid SSR pre-rendering issues with hooks
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useJournalEntries, useAccounts, useCreateJournalEntry, useUpdateJournalEntry, useDeleteJournalEntry, useDefaultCurrency } from '@/hooks/use-api';
import { useCurrencies } from '@/hooks/use-currencies';
import { setCurrenciesCache, formatCurrency, formatCurrencyWithSign } from '@/lib/currency-formatter';
import type { JournalEntry, Account } from '@/types';
import type { JournalLineFormState } from '@/types/auto-balance';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit2, Trash2, Calendar, FileText, Download } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ExportButton } from '@/components/export/export-button';
import { AutoBalanceButton } from '@/components/journal/AutoBalanceButton';
import { useAutoBalance } from '@/hooks/useAutoBalance';

// Form state interface
interface JournalFormState {
  date: string;
  description: string;
  lines: JournalLineFormState[];
}

// Create empty lines
const createEmptyLines = (count: number, currency: string): JournalLineFormState[] =>
  Array.from({ length: count }, () => ({
    account_id: '',
    amount: 0,
    currency,
    tags: [],
  }));

// Initial form state
const createInitialFormState = (currency: string): JournalFormState => ({
  date: new Date().toISOString().split('T')[0],
  description: '',
  lines: createEmptyLines(2, currency),
});

export default function JournalPage() {
  const { data: journalData, isLoading, refetch } = useJournalEntries();
  const { data: accounts } = useAccounts();
  const { data: currencies } = useCurrencies();
  const { data: defaultCurrency } = useDefaultCurrency();
  const createEntry = useCreateJournalEntry();
  const updateEntry = useUpdateJournalEntry();
  const deleteEntry = useDeleteJournalEntry();

  useEffect(() => {
    if (currencies) {
      setCurrenciesCache(currencies);
    }
  }, [currencies]);

  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);
  const [deletingEntry, setDeletingEntry] = useState<JournalEntry | null>(null);
  const [formData, setFormData] = useState<JournalFormState>(
    createInitialFormState(defaultCurrency || 'USD')
  );

  // Helper to handle amount changes including negative numbers
  const handleAmountChange = (index: number, value: string) => {
    const numValue = value === '' ? 0 : parseFloat(value);
    updateLine(index, 'amount', isNaN(numValue) ? 0 : numValue);
  };

  const handleEdit = (entry: JournalEntry) => {
    setEditingEntry(entry);
    setFormData({
      date: new Date(entry.date).toISOString().split('T')[0],
      description: entry.description,
      lines: entry.lines?.map(line => ({
        account_id: line.account_id,
        amount: parseFloat(String(line.amount)) || 0,
        currency: line.currency,
        tags: line.tags || [],
      })) || createEmptyLines(2, defaultCurrency || 'USD'),
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const filteredLines = formData.lines.filter((line) => line.account_id && line.amount !== 0);

    if (editingEntry) {
      await updateEntry.mutateAsync({
        id: editingEntry.id,
        data: {
          date: formData.date,
          description: formData.description,
          lines: filteredLines,
        },
      });
    } else {
      await createEntry.mutateAsync({
        date: formData.date,
        description: formData.description,
        lines: filteredLines,
      });
    }

    setShowForm(false);
    setEditingEntry(null);
    setFormData(createInitialFormState(defaultCurrency || 'USD'));
    refetch();
  };

  const addLine = () => {
    setFormData({
      ...formData,
      lines: [...formData.lines, { account_id: '', amount: 0, currency: defaultCurrency || 'USD', tags: [] }],
    });
  };

  const updateLine = (index: number, field: string, value: any) => {
    const newLines = [...formData.lines];
    newLines[index] = { ...newLines[index], [field]: value };
    setFormData({ ...formData, lines: newLines });
  };

  const removeLine = (index: number) => {
    if (formData.lines.length > 2) {
      const newLines = formData.lines.filter((_, i) => i !== index);
      setFormData({ ...formData, lines: newLines });
    }
  };

  // Auto-balance hook integration
  const handleAutoBalance = (result: { success: boolean; lines: JournalLineFormState[] }) => {
    if (result.success) {
      setFormData({ ...formData, lines: result.lines });
    }
  };

  const autoBalanceHook = useAutoBalance({
    lines: formData.lines,
    onUpdate: (lines) => setFormData({ ...formData, lines }),
  });

  const handleDelete = async () => {
    if (deletingEntry) {
      await deleteEntry.mutateAsync(deletingEntry.id);
      setDeletingEntry(null);
      refetch();
    }
  };

  const getAccountName = (id: string): string => {
    const account = accounts?.find((a: Account) => a.id === id);
    return account?.path || 'Unknown';
  };

  const calculateTotalsByCurrency = (lines: typeof formData.lines): Map<string, number> => {
    const totals = new Map<string, number>();
    for (const line of lines) {
      if (!line.account_id) continue;
      const current = totals.get(line.currency) || 0;
      totals.set(line.currency, current + (line.amount || 0));
    }
    return totals;
  };

  const isBalanced = (lines: typeof formData.lines): boolean => {
    const totals = calculateTotalsByCurrency(lines);
    return Array.from(totals.values()).every(total => Math.abs(total) <= 0.0001);
  };

  const getUnbalancedCurrencies = (lines: typeof formData.lines): string[] => {
    const totals = calculateTotalsByCurrency(lines);
    const unbalanced: string[] = [];
    Array.from(totals.entries()).forEach(([currency, total]) => {
      if (Math.abs(total) > 0.0001) {
        unbalanced.push(currency);
      }
    });
    return unbalanced;
  };

  if (isLoading) {
    return <div className="p-8 text-center">Loading journal entries...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Journal</h1>
          <p className="text-muted-foreground">Record your financial transactions</p>
        </div>
        <div className="flex gap-2">
          <ExportButton type="bills" />
          <Button onClick={() => {
            setEditingEntry(null);
            setFormData({
              date: new Date().toISOString().split('T')[0],
              description: '',
              lines: [
                { account_id: '', amount: 0, currency: 'USD', tags: [] },
                { account_id: '', amount: 0, currency: 'USD', tags: [] },
              ],
            });
            setShowForm(true);
          }}>
            <Plus className="h-4 w-4 mr-2" />
            New Entry
          </Button>
        </div>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingEntry ? 'Edit Journal Entry' : 'Create Journal Entry'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Date</label>
                  <Input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Description</label>
                  <Input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Transaction description"
                    required
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium">Journal Lines</label>
                {formData.lines.map((line, index) => (
                  <div key={index} className="flex gap-2 items-start">
                    <Select
                      value={line.account_id}
                      onValueChange={(value) => updateLine(index, 'account_id', value)}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select account" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts?.map((account: Account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.path} ({account.type})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    <Input
                      type="number"
                      step="any"
                      placeholder="Amount"
                      value={line.amount === null || line.amount === undefined || line.amount === 0 ? '' : String(line.amount)}
                      onChange={(e) => handleAmountChange(index, e.target.value)}
                      className="w-32"
                      required
                    />

                    <Select
                      value={line.currency}
                      onValueChange={(value) => updateLine(index, 'currency', value)}
                    >
                      <SelectTrigger className="w-28">
                        <SelectValue placeholder="Currency" />
                      </SelectTrigger>
                      <SelectContent>
                        {currencies?.map((currency) => (
                          <SelectItem key={currency.code} value={currency.code}>
                            {currency.code}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    {formData.lines.length > 2 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-10 w-10"
                        onClick={() => removeLine(index)}
                      >
                        <span className="sr-only">Remove</span>
                        ×
                      </Button>
                    )}
                  </div>
                ))}
                
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addLine}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add Line
                </Button>
                <AutoBalanceButton
                  lines={formData.lines}
                  onAutoBalance={handleAutoBalance}
                />
              </div>

              <div className={`p-4 rounded-lg ${
                isBalanced(formData.lines)
                  ? 'bg-muted'
                  : 'bg-red-50 border border-red-200'
              }`}>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Balance by Currency:</span>
                    {isBalanced(formData.lines) ? (
                      <span className="text-green-600 font-medium">✓ Balanced</span>
                    ) : (
                      <span className="text-red-600 font-bold">✗ Unbalanced</span>
                    )}
                  </div>
                  {Array.from(calculateTotalsByCurrency(formData.lines).entries()).map(([currency, total]) => {
                    if (!formData.lines.some(l => l.currency === currency && l.account_id)) return null;
                    return (
                      <div key={currency} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{currency}:</span>
                        <span className={Math.abs(total) > 0.0001 ? 'text-red-600 font-medium' : 'text-green-600'}>
                          {formatCurrencyWithSign(total, currency)}
                        </span>
                      </div>
                    );
                  })}
                  {!isBalanced(formData.lines) && (
                    <p className="text-xs text-red-600 mt-1">
                      Each currency must balance to 0. Unbalanced: {getUnbalancedCurrencies(formData.lines).join(', ')}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                {autoBalanceHook.errors.length > 0 && (
                  <div className="text-sm text-red-600 flex items-center gap-1">
                    <span>⚠</span>
                    {autoBalanceHook.errors[0]}
                  </div>
                )}
                <Button
                  type="submit"
                  disabled={createEntry.isPending || updateEntry.isPending || !isBalanced(formData.lines)}
                >
                  {createEntry.isPending || updateEntry.isPending ? 'Saving...' : (editingEntry ? 'Update Entry' : 'Create Entry')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowForm(false);
                    setEditingEntry(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {journalData?.entries?.map((entry: JournalEntry) => (
          <Card key={entry.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    {new Date(entry.date).toLocaleDateString()}
                  </div>
                  <Badge variant="secondary">
                    {entry.lines?.length || 0} lines
                  </Badge>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(entry)}
                  >
                    <Edit2 className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => setDeletingEntry(entry)}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                </div>
              </div>
              
              <div className="flex items-center gap-2 mb-3">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold">{entry.description}</span>
              </div>
              
              {entry.lines && entry.lines.length > 0 ? (
                <div className="space-y-2 bg-muted/30 rounded-lg p-3">
                  {entry.lines.map((line, index) => (
                    <div key={index} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        {getAccountName(line.account_id)}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className={
                          parseFloat(String(line.amount)) < 0 
                            ? 'text-red-600 font-medium' 
                            : 'text-green-600 font-medium'
                        }>
                          {formatCurrencyWithSign(parseFloat(String(line.amount)), line.currency || defaultCurrency || 'USD')}
                        </span>
                        {line.converted_amount !== undefined && line.converted_amount !== null && line.currency !== defaultCurrency && (
                          <span className="text-xs text-muted-foreground">
                            = {formatCurrency(line.converted_amount, defaultCurrency || 'USD')}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">No line items</p>
              )}
            </CardContent>
          </Card>
        ))}

        {(!journalData?.entries || journalData.entries.length === 0) && (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No journal entries yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first entry to record a transaction.
              </p>
              <Button
                onClick={() => {
                  setFormData({
                    date: new Date().toISOString().split('T')[0],
                    description: '',
                    lines: [
                      { account_id: '', amount: 0, currency: 'USD', tags: [] },
                      { account_id: '', amount: 0, currency: 'USD', tags: [] },
                    ],
                  });
                  setShowForm(true);
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Entry
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deletingEntry} onOpenChange={() => setDeletingEntry(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Journal Entry</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this journal entry "{deletingEntry?.description}"? 
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeletingEntry(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteEntry.isPending}
            >
              {deleteEntry.isPending ? 'Deleting...' : 'Delete Entry'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
