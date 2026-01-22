import { Injectable, Logger } from '@nestjs/common';

export interface SystemConfig {
  default_currency: string;
  fiat_decimals: number;
  crypto_decimals: number;
  timezone: string;
  date_format: string;
  session_timeout: number;
  mfa_required: boolean;
}

@Injectable()
export class SystemConfigService {
  private readonly logger = new Logger(SystemConfigService.name);

  private systemConfig: SystemConfig = {
    default_currency: 'USD',
    fiat_decimals: 2,
    crypto_decimals: 8,
    timezone: 'UTC',
    date_format: 'YYYY-MM-DD',
    session_timeout: 3600,
    mfa_required: false,
  };

  async getSystemConfig(): Promise<SystemConfig> {
    return this.systemConfig;
  }

  async updateSystemConfig(
    updates: Partial<SystemConfig>,
    _adminId: string,
    _ipAddress?: string,
  ): Promise<SystemConfig> {
    const oldConfig = { ...this.systemConfig };
    Object.assign(this.systemConfig, updates);
    this.logger.log(`System config updated: ${JSON.stringify(updates)}`);
    return this.systemConfig;
  }
}
