# Frontend Contracts: CSV Export Feature

**Feature**: Export bills and accounts to CSV  
**Date**: 2026-01-23

## API Endpoints

### POST /api/v1/export/bills

Export bills (journal entries) to CSV.

**Request:**
```typescript
// frontend/src/lib/api.ts

export interface ExportBillsRequest {
  /** Start date (ISO 8601 format) */
  date_from?: string;
  /** End date (ISO 8601 format) */
  date_to?: string;
  /** Preset date range (mutually exclusive with date_from/date_to) */
  date_preset?: 'last_30_days' | 'last_90_days' | 'this_year' | 'all_time';
  /** Filter by account types involved in transactions */
  account_types?: AccountType[];
  /** Include column headers in output (default: true) */
  include_header?: boolean;
  /** CSV delimiter character (default: ',') */
  delimiter?: ',' | ';' | '\t';
}

export type AccountType = 'assets' | 'liabilities' | 'equity' | 'revenue' | 'expense';
```

**Response**: Streaming CSV file (text/csv; charset=utf-8)

**Headers:**
- `Content-Type: text/csv; charset=utf-8`
- `Content-Disposition: attachment; filename="bills-YYYY-MM-DD.csv"`

---

### POST /api/v1/export/accounts

Export accounts to CSV.

**Request:**
```typescript
export interface ExportAccountsRequest {
  /** Filter by account types */
  account_types?: AccountType[];
  /** Include inactive accounts (default: false) */
  include_inactive?: boolean;
  /** Include column headers in output (default: true) */
  include_header?: boolean;
  /** CSV delimiter character (default: ',') */
  delimiter?: ',' | ';' | '\t';
}
```

**Response**: Streaming CSV file (text/csv; charset=utf-8)

**Headers:**
- `Content-Type: text/csv; charset=utf-8`
- `Content-Disposition: attachment; filename="accounts-YYYY-MM-DD.csv"`

---

## Frontend Hooks

### useExportBills

```typescript
// frontend/src/hooks/use-export-bills.ts
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { AccountType, ExportBillsRequest } from '@/lib/api';

interface UseExportBillsOptions {
  onSuccess?: (blob: Blob) => void;
  onError?: (error: Error) => void;
}

export function useExportBills(options: UseExportBillsOptions = {}) {
  return useMutation({
    mutationFn: async (filters: ExportBillsRequest) => {
      const response = await api.post('/export/bills', filters, {
        responseType: 'blob',
      });
      return response.data as Blob;
    },
    onSuccess: (blob) => {
      // Trigger download
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `bills-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      options.onSuccess?.(blob);
    },
    onError: (error) => {
      console.error('Failed to export bills:', error);
      options.onError?.(error as Error);
    },
  });
}
```

### useExportAccounts

```typescript
// frontend/src/hooks/use-export-accounts.ts
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { AccountType, ExportAccountsRequest } from '@/lib/api';

interface UseExportAccountsOptions {
  onSuccess?: (blob: Blob) => void;
  onError?: (error: Error) => void;
}

export function useExportAccounts(options: UseExportAccountsOptions = {}) {
  return useMutation({
    mutationFn: async (filters: ExportAccountsRequest) => {
      const response = await api.post('/export/accounts', filters, {
        responseType: 'blob',
      });
      return response.data as Blob;
    },
    onSuccess: (blob) => {
      // Trigger download
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `accounts-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      options.onSuccess?.(blob);
    },
    onError: (error) => {
      console.error('Failed to export accounts:', error);
      options.onError?.(error as Error);
    },
  });
}
```

---

## UI Components

### ExportButton

```typescript
// frontend/src/components/export/export-button.tsx
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { useExportBills } from '@/hooks/use-export-bills';
import { useExportAccounts } from '@/hooks/use-export-accounts';

interface ExportButtonProps {
  type: 'bills' | 'accounts';
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  filters?: Record<string, any>;
  onExportStart?: () => void;
  onExportComplete?: () => void;
}

export function ExportButton({
  type,
  variant = 'outline',
  size = 'default',
  filters = {},
  onExportStart,
  onExportComplete,
}: ExportButtonProps) {
  const exportBills = useExportBills({
    onSuccess: onExportComplete,
  });

  const exportAccounts = useExportAccounts({
    onSuccess: onExportComplete,
  });

  const isExporting = type === 'bills' 
    ? exportBills.isPending 
    : exportAccounts.isPending;

  const handleClick = () => {
    onExportStart?.();
    if (type === 'bills') {
      exportBills.mutate(filters);
    } else {
      exportAccounts.mutate(filters);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleClick}
      disabled={isExporting}
    >
      {isExporting ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Download className="mr-2 h-4 w-4" />
      )}
      Export CSV
    </Button>
  );
}
```

### ExportFilterPanel (Optional - P2)

```typescript
// frontend/src/components/export/export-filter-panel.tsx
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ExportButton } from './export-button';

interface ExportFilterPanelProps {
  type: 'bills' | 'accounts';
  onFilterChange?: (filters: Record<string, any>) => void;
}

export function ExportFilterPanel({ type, onFilterChange }: ExportFilterPanelProps) {
  const [datePreset, setDatePreset] = useState<string>('all_time');
  const [accountTypes, setAccountTypes] = useState<string[]>([]);

  const handleExport = () => {
    const filters: Record<string, any> = {};
    
    if (datePreset !== 'all_time') {
      filters.date_preset = datePreset;
    }
    
    if (accountTypes.length > 0) {
      filters.account_types = accountTypes;
    }
    
    onFilterChange?.(filters);
    return filters;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Export Options</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Date Range Filter (bills only) */}
        {type === 'bills' && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Date Range</label>
            <Select value={datePreset} onValueChange={setDatePreset}>
              <SelectTrigger>
                <SelectValue placeholder="Select date range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all_time">All Time</SelectItem>
                <SelectItem value="last_30_days">Last 30 Days</SelectItem>
                <SelectItem value="last_90_days">Last 90 Days</SelectItem>
                <SelectItem value="this_year">This Year</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Account Type Filter */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Account Types</label>
          <Select
            value={accountTypes[0] || ''}
            onValueChange={(value) => setAccountTypes(value ? [value] : [])}
          >
            <SelectTrigger>
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Types</SelectItem>
              <SelectItem value="assets">Assets</SelectItem>
              <SelectItem value="liabilities">Liabilities</SelectItem>
              <SelectItem value="equity">Equity</SelectItem>
              <SelectItem value="revenue">Revenue</SelectItem>
              <SelectItem value="expense">Expense</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Export Button */}
        <ExportButton
          type={type}
          filters={handleExport()}
        />
      </CardContent>
    </Card>
  );
}
```

---

## CSV Output Examples

### Bills CSV

```csv
Date,Description,Debit Account,Credit Account,Amount,Currency,Reference ID
2024-01-15,Office supplies purchase,Expenses:Office:Supplies,Assets:Cash:USD,150.50,USD,
2024-01-16,Software subscription,Expenses:Software:SaaS,Assets:Bank:USD,299.00,USD,INV-2024-001
2024-01-17,Client payment received,Assets:Bank:USD,Revenue:Consulting,5000.00,USD,
```

### Accounts CSV

```csv
Account Name,Account Type,Parent Account,Currency,Balance,Is Active,Depth
Assets,assets,,USD,0.00,true,0
Assets:Cash,assets,Assets,USD,5000.00,true,1
Assets:Bank,assets,Assets,USD,15000.00,true,1
Expenses,expenses,,USD,0.00,true,0
Expenses:Office,expenses,Expenses,USD,0.00,true,1
Expenses:Office:Supplies,expenses,Expenses:Office,USD,450.50,true,2
```

---

## Error Handling

### API Errors

```typescript
// Error response format
interface ErrorResponse {
  success: false;
  error_code: string;
  error_message: string;
  details?: Record<string, any>;
}

// Common error codes
const EXPORT_ERRORS = {
  INVALID_DATE_RANGE: 'date_from must be before or equal to date_to',
  DATE_RANGE_TOO_LARGE: 'Date range cannot exceed 1 year',
  NO_DATA_TO_EXPORT: 'No records match the specified filters',
  EXPORT_IN_PROGRESS: 'An export is already in progress for this tenant',
} as const;
```

### Frontend Error Toast

```typescript
import { toast } from 'sonner';

function showExportError(error: Error) {
  toast.error('Export Failed', {
    description: error.message || 'Failed to export data. Please try again.',
    duration: 5000,
  });
}
```
