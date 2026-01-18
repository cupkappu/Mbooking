import { apiClient } from './api';
import type { Tenant } from '../types/tenant';

export interface TenantSettings {
  default_currency?: string;
  timezone?: string;
  [key: string]: any;
}

export interface UpdateTenantSettingsRequest {
  default_currency?: string;
  timezone?: string;
}

export const tenantsApi = {
  async getCurrent(): Promise<Tenant> {
    return apiClient.get<Tenant>('/tenants/current');
  },

  async updateSettings(data: UpdateTenantSettingsRequest): Promise<Tenant> {
    return apiClient.put<Tenant>('/tenants/settings', data);
  },
};