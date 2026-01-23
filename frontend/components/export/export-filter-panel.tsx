'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Filter, X, Calendar, Tag } from 'lucide-react';
import type { DatePreset, AccountType, ExportBillsRequest, ExportAccountsRequest } from '@/types/export';

interface ExportFilterPanelProps {
  type: 'bills' | 'accounts';
  onExport: (filters: ExportBillsRequest | ExportAccountsRequest) => void;
  onCancel?: () => void;
  defaultDatePreset?: DatePreset;
  defaultAccountTypes?: AccountType[];
}

const DATE_PRESETS = [
  { value: 'all_time', label: 'All Time' },
  { value: 'this_year', label: 'This Year' },
  { value: 'last_90_days', label: 'Last 90 Days' },
  { value: 'last_30_days', label: 'Last 30 Days' },
] as const;

const ACCOUNT_TYPES = [
  { value: 'assets', label: 'Assets' },
  { value: 'liabilities', label: 'Liabilities' },
  { value: 'equity', label: 'Equity' },
  { value: 'revenue', label: 'Revenue' },
  { value: 'expense', label: 'Expense' },
] as const;

export function ExportFilterPanel({
  type,
  onExport,
  onCancel,
  defaultDatePreset = 'all_time',
  defaultAccountTypes = [],
}: ExportFilterPanelProps) {
  const [datePreset, setDatePreset] = useState<DatePreset>(defaultDatePreset);
  const [accountTypes, setAccountTypes] = useState<AccountType[]>(defaultAccountTypes);
  const [includeInactive, setIncludeInactive] = useState(false);

  const handleAccountTypeToggle = (value: AccountType) => {
    if (accountTypes.includes(value)) {
      setAccountTypes(accountTypes.filter((t) => t !== value));
    } else {
      setAccountTypes([...accountTypes, value]);
    }
  };

  const handleReset = () => {
    setDatePreset('all_time');
    setAccountTypes([]);
    setIncludeInactive(false);
  };

  const handleExport = () => {
    if (type === 'bills') {
      const filters: ExportBillsRequest = {
        date_preset: datePreset,
        account_types: accountTypes.length > 0 ? accountTypes : undefined,
        include_header: true,
      };
      onExport(filters);
    } else {
      const filters: ExportAccountsRequest = {
        account_types: accountTypes.length > 0 ? accountTypes : undefined,
        include_inactive: includeInactive,
        include_header: true,
      };
      onExport(filters);
    }
  };

  const hasActiveFilters =
    datePreset !== 'all_time' ||
    accountTypes.length > 0 ||
    (type === 'accounts' && includeInactive);

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Filter className="h-5 w-5" />
          Export Options
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {type === 'bills' && (
          <div className="space-y-2">
            <Label htmlFor="date-preset" className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              Date Range
            </Label>
            <Select
              value={datePreset}
              onValueChange={(value) => setDatePreset(value as DatePreset)}
            >
              <SelectTrigger id="date-preset">
                <SelectValue placeholder="Select date range" />
              </SelectTrigger>
              <SelectContent>
                {DATE_PRESETS.map((preset) => (
                  <SelectItem key={preset.value} value={preset.value}>
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-2">
          <Label className="flex items-center gap-1">
            <Tag className="h-4 w-4" />
            Account Types
          </Label>
          <div className="flex flex-wrap gap-2">
            {ACCOUNT_TYPES.map((accountType) => (
              <Button
                key={accountType.value}
                variant={accountTypes.includes(accountType.value) ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleAccountTypeToggle(accountType.value)}
                className="text-xs"
              >
                {accountType.label}
              </Button>
            ))}
          </div>
          {accountTypes.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Selected: {accountTypes.join(', ')}
            </p>
          )}
        </div>

        {type === 'accounts' && (
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="include-inactive"
              checked={includeInactive}
              onChange={(e) => setIncludeInactive(e.target.checked)}
              className="rounded border-gray-300 text-primary focus:ring-primary"
            />
            <Label htmlFor="include-inactive" className="text-sm">
              Include inactive accounts
            </Label>
          </div>
        )}

        {hasActiveFilters && (
          <div className="pt-2 border-t">
            <Button variant="ghost" size="sm" onClick={handleReset} className="text-muted-foreground">
              <X className="h-3 w-3 mr-1" />
              Reset Filters
            </Button>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button onClick={handleExport} className="flex-1">
            Export CSV
          </Button>
          {onCancel && (
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
