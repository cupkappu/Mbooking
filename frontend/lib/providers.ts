import { apiClient } from './api';
import type { RateProvider, CreateProviderRequest, UpdateProviderRequest } from '@/types/provider';

export const providersApi = {
  async getAll(): Promise<RateProvider[]> {
    return apiClient.get<RateProvider[]>('/providers');
  },

  async getById(id: string): Promise<RateProvider> {
    return apiClient.get<RateProvider>(`/providers/${id}`);
  },

  async create(data: CreateProviderRequest): Promise<RateProvider> {
    return apiClient.post<RateProvider>('/providers', data);
  },

  async update(id: string, data: UpdateProviderRequest): Promise<RateProvider> {
    return apiClient.put<RateProvider>(`/providers/${id}`, data);
  },

  async delete(id: string): Promise<void> {
    return apiClient.delete<void>(`/providers/${id}`);
  },

  async setDefault(id: string): Promise<RateProvider> {
    return apiClient.post<RateProvider>(`/providers/${id}/set-default`, {});
  },

  async testConnection(id: string): Promise<{ success: boolean; message: string }> {
    return apiClient.post<{ success: boolean; message: string }>(`/providers/${id}/test`, {});
  },
};
