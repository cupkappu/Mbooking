'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { useExportBills } from '@/hooks/use-export-bills';
import { useExportAccounts } from '@/hooks/use-export-accounts';
import { ExportBillsRequest, ExportAccountsRequest } from '@/types/export';

interface ExportButtonProps {
  type: 'bills' | 'accounts';
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  filters?: ExportBillsRequest | ExportAccountsRequest;
  onExportStart?: () => void;
  onExportComplete?: () => void;
  onExportError?: (error: Error) => void;
  disabled?: boolean;
}

export function ExportButton({
  type,
  variant = 'outline',
  size = 'default',
  filters = {},
  onExportStart,
  onExportComplete,
  onExportError,
  disabled = false,
}: ExportButtonProps) {
  const exportBills = useExportBills({
    onSuccess: onExportComplete,
    onError: onExportError,
  });

  const exportAccounts = useExportAccounts({
    onSuccess: onExportComplete,
    onError: onExportError,
  });

  const isExporting = type === 'bills' ? exportBills.isPending : exportAccounts.isPending;

  const handleClick = () => {
    onExportStart?.();
    if (type === 'bills') {
      exportBills.mutate(filters as ExportBillsRequest);
    } else {
      exportAccounts.mutate(filters as ExportAccountsRequest);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleClick}
      disabled={disabled || isExporting}
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
