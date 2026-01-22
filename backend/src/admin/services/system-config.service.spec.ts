import { Test, TestingModule } from '@nestjs/testing';
import { SystemConfigService, SystemConfig } from './system-config.service';

describe('SystemConfigService', () => {
  let service: SystemConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SystemConfigService],
    }).compile();

    service = module.get<SystemConfigService>(SystemConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getSystemConfig', () => {
    it('should return default system config', async () => {
      const result = await service.getSystemConfig();

      expect(result).toEqual({
        default_currency: 'USD',
        fiat_decimals: 2,
        crypto_decimals: 8,
        timezone: 'UTC',
        date_format: 'YYYY-MM-DD',
        session_timeout: 3600,
        mfa_required: false,
      });
    });

    it('should return default currency as USD', async () => {
      const result = await service.getSystemConfig();
      expect(result.default_currency).toBe('USD');
    });

    it('should return fiat_decimals as 2', async () => {
      const result = await service.getSystemConfig();
      expect(result.fiat_decimals).toBe(2);
    });

    it('should return crypto_decimals as 8', async () => {
      const result = await service.getSystemConfig();
      expect(result.crypto_decimals).toBe(8);
    });

    it('should return timezone as UTC', async () => {
      const result = await service.getSystemConfig();
      expect(result.timezone).toBe('UTC');
    });

    it('should return date_format as YYYY-MM-DD', async () => {
      const result = await service.getSystemConfig();
      expect(result.date_format).toBe('YYYY-MM-DD');
    });

    it('should return session_timeout as 3600', async () => {
      const result = await service.getSystemConfig();
      expect(result.session_timeout).toBe(3600);
    });

    it('should return mfa_required as false', async () => {
      const result = await service.getSystemConfig();
      expect(result.mfa_required).toBe(false);
    });
  });

  describe('updateSystemConfig', () => {
    it('should update default_currency', async () => {
      const result = await service.updateSystemConfig(
        { default_currency: 'EUR' },
        'admin-1',
      );

      expect(result.default_currency).toBe('EUR');
    });

    it('should update fiat_decimals', async () => {
      const result = await service.updateSystemConfig(
        { fiat_decimals: 4 },
        'admin-1',
      );

      expect(result.fiat_decimals).toBe(4);
    });

    it('should update crypto_decimals', async () => {
      const result = await service.updateSystemConfig(
        { crypto_decimals: 18 },
        'admin-1',
      );

      expect(result.crypto_decimals).toBe(18);
    });

    it('should update timezone', async () => {
      const result = await service.updateSystemConfig(
        { timezone: 'America/New_York' },
        'admin-1',
      );

      expect(result.timezone).toBe('America/New_York');
    });

    it('should update date_format', async () => {
      const result = await service.updateSystemConfig(
        { date_format: 'DD/MM/YYYY' },
        'admin-1',
      );

      expect(result.date_format).toBe('DD/MM/YYYY');
    });

    it('should update session_timeout', async () => {
      const result = await service.updateSystemConfig(
        { session_timeout: 7200 },
        'admin-1',
      );

      expect(result.session_timeout).toBe(7200);
    });

    it('should update mfa_required to true', async () => {
      const result = await service.updateSystemConfig(
        { mfa_required: true },
        'admin-1',
      );

      expect(result.mfa_required).toBe(true);
    });

    it('should update multiple fields at once', async () => {
      const updates: Partial<SystemConfig> = {
        default_currency: 'GBP',
        fiat_decimals: 4,
        timezone: 'Europe/London',
        mfa_required: true,
      };

      const result = await service.updateSystemConfig(updates, 'admin-1');

      expect(result.default_currency).toBe('GBP');
      expect(result.fiat_decimals).toBe(4);
      expect(result.timezone).toBe('Europe/London');
      expect(result.mfa_required).toBe(true);
    });

    it('should not affect other fields when updating partial config', async () => {
      await service.updateSystemConfig(
        { default_currency: 'JPY' },
        'admin-1',
      );

      const result = await service.getSystemConfig();

      expect(result.default_currency).toBe('JPY');
      expect(result.fiat_decimals).toBe(2);
      expect(result.crypto_decimals).toBe(8);
      expect(result.timezone).toBe('UTC');
      expect(result.date_format).toBe('YYYY-MM-DD');
      expect(result.session_timeout).toBe(3600);
      expect(result.mfa_required).toBe(false);
    });

    it('should accept adminId parameter', async () => {
      const result = await service.updateSystemConfig(
        { session_timeout: 1800 },
        'admin-user-123',
      );

      expect(result.session_timeout).toBe(1800);
    });

    it('should accept optional ipAddress parameter', async () => {
      const result = await service.updateSystemConfig(
        { mfa_required: true },
        'admin-1',
        '192.168.1.1',
      );

      expect(result.mfa_required).toBe(true);
    });

    it('should return updated system config', async () => {
      const updates: Partial<SystemConfig> = {
        default_currency: 'CAD',
        crypto_decimals: 12,
      };

      const result = await service.updateSystemConfig(updates, 'admin-1');

      expect(result).toEqual({
        default_currency: 'CAD',
        fiat_decimals: 2,
        crypto_decimals: 12,
        timezone: 'UTC',
        date_format: 'YYYY-MM-DD',
        session_timeout: 3600,
        mfa_required: false,
      });
    });
  });
});
