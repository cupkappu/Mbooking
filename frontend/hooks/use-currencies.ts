import { useQuery, useMutation } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { apiClient } from '@/lib/api';

export interface Currency {
  code: string;
  name: string;
  symbol: string;
  decimal_places: number;
  is_active: boolean;
}

export interface AdminCurrency extends Currency {
  created_at?: string;
  updated_at?: string;
}

export interface SeedCurrenciesResponse {
  added: number;
  skipped: number;
  message?: string;
}

// Public read-only hook for currencies (for dropdowns, etc.)
export function useCurrencies() {
  const { data: session } = useSession();

  return useQuery({
    queryKey: ['currencies'],
    queryFn: () => apiClient.get<Currency[]>('/currencies'),
    enabled: !!session,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}

// Admin hooks for currency management
export function useAdminCurrencies() {
  const { data: session } = useSession();

  return useQuery({
    queryKey: ['admin-currencies'],
    queryFn: () => apiClient.get<AdminCurrency[]>('/admin/currencies'),
    enabled: !!session,
    staleTime: 60 * 1000, // Cache for 1 minute
  });
}

export function useCreateCurrency() {
  return useMutation({
    mutationFn: (data: Omit<Currency, 'is_active'>) =>
      apiClient.post<AdminCurrency>('/admin/currencies', data),
  });
}

export function useUpdateCurrency() {
  return useMutation({
    mutationFn: ({ code, data }: { code: string; data: Partial<Currency> }) =>
      apiClient.put<AdminCurrency>(`/admin/currencies/${code}`, data),
  });
}

export function useDeleteCurrency() {
  return useMutation({
    mutationFn: (code: string) =>
      apiClient.delete<{ success: boolean }>(`/admin/currencies/${code}`),
  });
}

export function useSeedCurrencies() {
  return useMutation({
    mutationFn: () =>
      apiClient.post<SeedCurrenciesResponse>('/admin/currencies/seed', {}),
  });
}
