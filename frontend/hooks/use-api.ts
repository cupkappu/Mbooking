import { useQuery, useMutation, useInfiniteQuery } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { apiClient } from '@/lib/api';
import type { Account, JournalEntry, AccountBalance } from '@/types';

export function useAccounts() {
  const { data: session } = useSession();

  return useQuery({
    queryKey: ['accounts'],
    queryFn: () => apiClient.get<Account[]>('/accounts/tree'),
    enabled: !!session,
  });
}

export function useAccount(id: string) {
  const { data: session } = useSession();

  return useQuery({
    queryKey: ['accounts', id],
    queryFn: () => apiClient.get<Account>(`/accounts/${id}`),
    enabled: !!id && !!session,
  });
}

export function useCreateAccount() {
  return useMutation({
    mutationFn: (data: Partial<Account>) =>
      apiClient.post<Account>('/accounts', data),
    onSuccess: () => {},
  });
}

export function useDeleteAccount() {
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.delete<Account>(`/accounts/${id}`),
    onSuccess: () => {},
  });
}

export function useUpdateAccount() {
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Account> }) =>
      apiClient.put<Account>(`/accounts/${id}`, data),
    onSuccess: () => {},
  });
}

export function useJournalEntries(options?: { offset?: number; limit?: number }) {
  const { data: session } = useSession();

  return useQuery({
    queryKey: ['journal-entries', options],
    queryFn: () =>
      apiClient.get<{ entries: JournalEntry[] }>(
        `/journal?offset=${options?.offset || 0}&limit=${options?.limit || 50}`
      ),
    enabled: !!session,
  });
}

export function useCreateJournalEntry() {
  return useMutation({
    mutationFn: (data: any) =>
      apiClient.post<JournalEntry>('/journal', data),
    onSuccess: () => {},
  });
}

export function useDeleteJournalEntry() {
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.delete<JournalEntry>(`/journal/${id}`),
    onSuccess: () => {},
  });
}

export function useBalances(query: {
  depth?: number;
  convert_to?: string;
  date_range?: { from: string; to: string };
  include_subtree?: boolean;
}) {
  const { data: session } = useSession();

  return useQuery({
    queryKey: ['balances', query],
    queryFn: () =>
      apiClient.post<{ balances: AccountBalance[] }>('/query/balances', query),
    enabled: !!session,
  });
}

export interface DashboardSummary {
  assets: number;
  liabilities: number;
  netWorth: number;
  recentTransactions: {
    id: string;
    date: string;
    description: string;
    amount: number;
  }[];
}

export function useDashboardSummary() {
  const { data: session } = useSession();

  return useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: () => apiClient.get<DashboardSummary>('/query/summary'),
    enabled: !!session,
    staleTime: 30 * 1000, // Cache for 30 seconds
  });
}
