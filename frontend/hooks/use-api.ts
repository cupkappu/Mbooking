import { useQuery, useMutation, useInfiniteQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import type { Account, JournalEntry, AccountBalance } from '@/types';

export function useAccounts() {
  return useQuery({
    queryKey: ['accounts'],
    queryFn: () => apiClient.get<Account[]>('/api/v1/accounts/tree'),
  });
}

export function useAccount(id: string) {
  return useQuery({
    queryKey: ['accounts', id],
    queryFn: () => apiClient.get<Account>(`/api/v1/accounts/${id}`),
    enabled: !!id,
  });
}

export function useCreateAccount() {
  return useMutation({
    mutationFn: (data: Partial<Account>) =>
      apiClient.post<Account>('/api/v1/accounts', data),
    onSuccess: () => {},
  });
}

export function useJournalEntries(options?: { offset?: number; limit?: number }) {
  return useQuery({
    queryKey: ['journal-entries', options],
    queryFn: () =>
      apiClient.get<{ entries: JournalEntry[] }>(
        `/api/v1/journal?offset=${options?.offset || 0}&limit=${options?.limit || 50}`
      ),
  });
}

export function useCreateJournalEntry() {
  return useMutation({
    mutationFn: (data: any) =>
      apiClient.post<JournalEntry>('/api/v1/journal', data),
    onSuccess: () => {},
  });
}

export function useBalances(query: {
  depth?: number;
  convert_to?: string;
  date_range?: { from: string; to: string };
  include_subtree?: boolean;
}) {
  return useQuery({
    queryKey: ['balances', query],
    queryFn: () =>
      apiClient.post<{ balances: AccountBalance[] }>('/api/v1/query/balances', query),
  });
}
