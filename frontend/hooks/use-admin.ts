import { useQuery, useMutation, useInfiniteQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
  is_active: boolean;
  created_at: string;
  last_login?: string;
}

export interface AdminUsersResponse {
  users: AdminUser[];
  total: number;
}

export interface SystemConfig {
  default_currency: string;
  fiat_decimals: number;
  crypto_decimals: number;
  timezone: string;
  date_format: string;
  session_timeout: number;
  mfa_required: boolean;
}

export interface Provider {
  id: string;
  name: string;
  type: string;
  is_active: boolean;
  config: Record<string, any>;
  supported_currencies: string[];
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  ip_address?: string;
  created_at: string;
}

export interface AuditLogsResponse {
  logs: AuditLog[];
  total: number;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'fail';
  timestamp: string;
  components: {
    database: { status: string; details?: any };
    cache: { status: string };
    providers: { status: string; details?: any };
    storage: { status: string };
  };
  metrics: {
    uptime: number;
    memory_usage: number;
    active_users: number;
    requests_per_minute: number;
  };
}

export interface SchedulerConfig {
  enabled: boolean;
  interval: number;
  providers: string[];
  currencies: string[];
  base_currency: string;
}

export function useAdminUsers(options?: { offset?: number; limit?: number }) {
  return useQuery({
    queryKey: ['admin-users', options],
    queryFn: () =>
      apiClient.get<AdminUsersResponse>(
        `/admin/users?offset=${options?.offset || 0}&limit=${options?.limit || 50}`
      ),
  });
}

export function useCreateAdminUser() {
  return useMutation({
    mutationFn: (data: { email: string; name: string; password: string; role: string }) =>
      apiClient.post<AdminUser>('/admin/users', data),
  });
}

export function useUpdateAdminUser() {
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<AdminUser> }) =>
      apiClient.put<AdminUser>(`/admin/users/${id}`, data),
  });
}

export function useDisableAdminUser() {
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.delete(`/admin/users/${id}`),
  });
}

export function useResetUserPassword() {
  return useMutation({
    mutationFn: ({ id, new_password }: { id: string; new_password: string }) =>
      apiClient.post(`/admin/users/${id}/reset-password`, { new_password }),
  });
}

export function useBulkUserAction() {
  return useMutation({
    mutationFn: (data: { action: string; user_ids: string[]; parameters?: any }) =>
      apiClient.post('/admin/users/bulk-action', data),
  });
}

export function useSystemConfig() {
  return useQuery({
    queryKey: ['admin-system-config'],
    queryFn: () => apiClient.get<SystemConfig>('/admin/system/config'),
  });
}

export function useUpdateSystemConfig() {
  return useMutation({
    mutationFn: (data: Partial<SystemConfig>) =>
      apiClient.put<SystemConfig>('/admin/system/config', data),
  });
}

export function useAdminProviders(options?: { offset?: number; limit?: number }) {
  return useQuery({
    queryKey: ['admin-providers', options],
    queryFn: () =>
      apiClient.get<{ providers: Provider[]; total: number }>(
        `/admin/providers?offset=${options?.offset || 0}&limit=${options?.limit || 50}`
      ),
  });
}

export function useCreateProvider() {
  return useMutation({
    mutationFn: (data: { name: string; type: string; config: any }) =>
      apiClient.post<Provider>('/admin/providers', data),
  });
}

export function useUpdateProvider() {
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiClient.put<Provider>(`/admin/providers/${id}`, data),
  });
}

export function useToggleProvider() {
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.post<Provider>(`/admin/providers/${id}/toggle`, {}),
  });
}

export function useTestProvider() {
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.post<{ success: boolean; message: string }>(`/admin/providers/${id}/test`, {}),
  });
}

export function useAuditLogs(options?: {
  offset?: number;
  limit?: number;
  user_id?: string;
  action?: string;
  entity_type?: string;
  date_from?: string;
  date_to?: string;
}) {
  return useQuery({
    queryKey: ['admin-logs', options],
    queryFn: () => {
      const params = new URLSearchParams();
      if (options?.offset) params.append('offset', options.offset.toString());
      if (options?.limit) params.append('limit', options.limit.toString());
      if (options?.user_id) params.append('user_id', options.user_id);
      if (options?.action) params.append('action', options.action);
      if (options?.entity_type) params.append('entity_type', options.entity_type);
      if (options?.date_from) params.append('date_from', options.date_from);
      if (options?.date_to) params.append('date_to', options.date_to);
      
      return apiClient.get<AuditLogsResponse>(`/admin/logs?${params.toString()}`);
    },
  });
}

export function useExportAuditLogs() {
  return useMutation({
    mutationFn: (options?: { user_id?: string; action?: string; entity_type?: string }) => {
      const params = new URLSearchParams();
      if (options?.user_id) params.append('user_id', options.user_id);
      if (options?.action) params.append('action', options.action);
      if (options?.entity_type) params.append('entity_type', options.entity_type);
      
      return apiClient.get<string>(`/admin/logs/export?${params.toString()}`);
    },
  });
}

export function useAdminHealth() {
  return useQuery({
    queryKey: ['admin-health'],
    queryFn: () => apiClient.get<HealthStatus>('/admin/health'),
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

export function useSchedulerConfig() {
  return useQuery({
    queryKey: ['admin-scheduler-config'],
    queryFn: () => apiClient.get<SchedulerConfig>('/admin/scheduler/config'),
  });
}

export function useUpdateSchedulerConfig() {
  return useMutation({
    mutationFn: (data: Partial<SchedulerConfig>) =>
      apiClient.put<SchedulerConfig>('/admin/scheduler/config', data),
  });
}

export function useTriggerManualFetch() {
  return useMutation({
    mutationFn: (data?: { provider_ids?: string[]; currencies?: string[] }) =>
      apiClient.post<{ message: string; job_id: string }>('/admin/scheduler/fetch', data || {}),
  });
}

export function useDataExport() {
  return useMutation({
    mutationFn: (data: { scope: string; format: string }) =>
      apiClient.post<any>('/admin/export', data),
  });
}

export interface Plugin {
  id: string;
  name: string;
  version: string;
  description: string;
  status: 'loaded' | 'unloaded' | 'error';
  file_path: string;
  loaded_at?: string;
  error?: string;
}

export function useAdminPlugins() {
  return useQuery({
    queryKey: ['admin-plugins'],
    queryFn: () => apiClient.get<{ plugins: Plugin[] }>('/admin/plugins'),
  });
}

export function useUploadPlugin() {
  return useMutation({
    mutationFn: (data: { filename: string; content: string }) =>
      apiClient.post<{ message: string }>('/admin/plugins', data),
  });
}

export function useReloadPlugin() {
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.post<{ message: string }>(`/admin/plugins/${id}/reload`, {}),
  });
}

export function useSchedulerHistory() {
  return useQuery({
    queryKey: ['admin-scheduler-history'],
    queryFn: () => apiClient.get<any[]>('/admin/scheduler/history'),
  });
}
