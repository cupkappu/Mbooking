'use client';

import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { ExportBillsRequest } from '@/types/export';

interface UseExportBillsOptions {
  onSuccess?: (blob: Blob) => void;
  onError?: (error: Error) => void;
}

export function useExportBills(options: UseExportBillsOptions = {}) {
  return useMutation({
    mutationFn: async (filters: ExportBillsRequest = {}) => {
      const response = await fetch(`/api/v1/export/bills`, {
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
