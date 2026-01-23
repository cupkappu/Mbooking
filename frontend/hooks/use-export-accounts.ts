'use client';

import { useMutation } from '@tanstack/react-query';
import { ExportAccountsRequest } from '@/types/export';

interface UseExportAccountsOptions {
  onSuccess?: (blob: Blob) => void;
  onError?: (error: Error) => void;
}

export function useExportAccounts(options: UseExportAccountsOptions = {}) {
  return useMutation({
    mutationFn: async (filters: ExportAccountsRequest = {}) => {
      const response = await fetch(`/api/v1/export/accounts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('accessToken') || ''}`,
        },
        body: JSON.stringify(filters),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Export failed' }));
        throw new Error(error.message || `Export failed with status ${response.status}`);
      }

      return response.blob();
    },
    onSuccess: (blob) => {
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
