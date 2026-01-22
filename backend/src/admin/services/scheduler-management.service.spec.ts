import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SchedulerManagementService } from './scheduler-management.service';
import { Provider, ProviderType } from '../../rates/provider.entity';
import { ExchangeRate } from '../../rates/exchange-rate.entity';
import { AuditLog } from '../entities/audit-log.entity';
import { RateGraphEngine } from '../../rates/rate-graph-engine';
import { AuditEventPublisher } from '../events/audit-event-publisher.service';

describe('SchedulerManagementService', () => {
  let service: SchedulerManagementService;
  let providerRepository: jest.Mocked<Repository<Provider>>;
  let exchangeRateRepository: jest.Mocked<Repository<ExchangeRate>>;
  let auditLogRepository: jest.Mocked<Repository<AuditLog>>;
  let rateGraphEngine: jest.Mocked<RateGraphEngine>;
  let eventPublisher: jest.Mocked<AuditEventPublisher>;

  const mockProvider: Provider = {
    id: 'provider-uuid-1',
    name: 'Test Provider',
    type: ProviderType.REST_API,
    config: { api_key: 'test-key' },
    is_active: true,
    supported_currencies: ['USD', 'EUR', 'GBP', 'BTC', 'ETH'],
    supports_historical: false,
    supports_date_query: false,
    record_history: true,
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-01'),
  };

  beforeEach(async () => {
    const mockProviderRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
    };

    const mockExchangeRateRepo = {
      delete: jest.fn(),
    };

    const mockAuditLogRepo = {
      find: jest.fn(),
    };

    const mockRateGraphEngine = {
      getRate: jest.fn(),
    };

    const mockEventPublisher = {
      publish: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchedulerManagementService,
        { provide: getRepositoryToken(Provider), useValue: mockProviderRepo },
        { provide: getRepositoryToken(ExchangeRate), useValue: mockExchangeRateRepo },
        { provide: getRepositoryToken(AuditLog), useValue: mockAuditLogRepo },
        { provide: RateGraphEngine, useValue: mockRateGraphEngine },
        { provide: AuditEventPublisher, useValue: mockEventPublisher },
      ],
    }).compile();

    service = module.get<SchedulerManagementService>(SchedulerManagementService);
    providerRepository = module.get(getRepositoryToken(Provider));
    exchangeRateRepository = module.get(getRepositoryToken(ExchangeRate));
    auditLogRepository = module.get(getRepositoryToken(AuditLog));
    rateGraphEngine = module.get(RateGraphEngine);
    eventPublisher = module.get(AuditEventPublisher);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getSchedulerConfig', () => {
    it('should return default scheduler config', async () => {
      const result = await service.getSchedulerConfig();

      expect(result).toEqual({
        enabled: true,
        interval: 3600,
        providers: [],
        currencies: [],
        base_currency: 'USD',
      });
    });
  });

  describe('updateSchedulerConfig', () => {
    it('should update scheduler config', async () => {
      const updateData = {
        enabled: false,
        interval: 7200,
        currencies: ['USD', 'EUR'],
      };

      const result = await service.updateSchedulerConfig(updateData, 'admin-uuid', '127.0.0.1');

      expect(result.enabled).toBe(false);
      expect(result.interval).toBe(7200);
      expect(result.currencies).toEqual(['USD', 'EUR']);
      expect(eventPublisher.publish).toHaveBeenCalled();
    });

    it('should preserve existing config values when not updating', async () => {
      await service.updateSchedulerConfig({ enabled: false }, 'admin-uuid');
      const result = await service.updateSchedulerConfig({ interval: 1800 }, 'admin-uuid');

      expect(result.enabled).toBe(false);
      expect(result.interval).toBe(1800);
    });
  });

  describe('triggerManualFetch', () => {
    it('should fetch rates and return result with duration', async () => {
      providerRepository.find.mockResolvedValue([mockProvider]);
      rateGraphEngine.getRate.mockResolvedValue({
        from: 'USD',
        to: 'EUR',
        rate: 1.5,
        timestamp: new Date(),
        source: 'test',
        path: ['USD', 'EUR'],
        hops: 1,
        isInferred: false,
      });

      const result = await service.triggerManualFetch({}, 'admin-uuid', '127.0.0.1');

      expect(result.job_id).toBeDefined();
      expect(result.rates_fetched).toBeGreaterThanOrEqual(0);
      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(eventPublisher.publish).toHaveBeenCalled();
    });

    it('should use configured currencies when set', async () => {
      await service.updateSchedulerConfig({ currencies: ['USD', 'JPY'] }, 'admin-uuid');
      providerRepository.find.mockResolvedValue([mockProvider]);
      rateGraphEngine.getRate.mockResolvedValue({
        from: 'USD',
        to: 'JPY',
        rate: 150,
        timestamp: new Date(),
        source: 'test',
        path: ['USD', 'JPY'],
        hops: 1,
        isInferred: false,
      });

      const result = await service.triggerManualFetch({}, 'admin-uuid');

      expect(result.job_id).toBeDefined();
      expect(providerRepository.find).toHaveBeenCalled();
    });

    it('should handle rate fetch errors gracefully', async () => {
      providerRepository.find.mockResolvedValue([mockProvider]);
      rateGraphEngine.getRate.mockRejectedValue(new Error('API error'));

      const result = await service.triggerManualFetch({}, 'admin-uuid');

      expect(result.job_id).toBeDefined();
      expect(result.rates_fetched).toBe(0);
    });

    it('should delete old exchange rates before fetching new ones', async () => {
      providerRepository.find.mockResolvedValue([mockProvider]);
      rateGraphEngine.getRate.mockResolvedValue({
        from: 'USD',
        to: 'EUR',
        rate: 1.5,
        timestamp: new Date(),
        source: 'test',
        path: ['USD', 'EUR'],
        hops: 1,
        isInferred: false,
      });

      await service.triggerManualFetch({}, 'admin-uuid');

      expect(exchangeRateRepository.delete).toHaveBeenCalled();
    });
  });

  describe('getSchedulerHistory', () => {
    it('should return scheduler history from audit logs', async () => {
      const mockAuditLog = {
        entity_id: 'job-123',
        action: 'admin.scheduler.manual_fetch',
        created_at: new Date('2024-01-01'),
        new_value: { job_id: 'job-123', rates_fetched: 10, duration: 150 },
      };
      auditLogRepository.find.mockResolvedValue([mockAuditLog] as AuditLog[]);

      const result = await service.getSchedulerHistory();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('job-123');
      expect(result[0].provider).toBe('manual');
      expect(result[0].status).toBe('success');
      expect(result[0].duration).toBe(150);
    });

    it('should use fallback duration when not in audit log', async () => {
      const mockAuditLog = {
        entity_id: 'job-456',
        action: 'admin.scheduler.manual_fetch',
        created_at: new Date('2024-01-01'),
        new_value: null,
      };
      auditLogRepository.find.mockResolvedValue([mockAuditLog] as AuditLog[]);

      const result = await service.getSchedulerHistory();

      expect(result[0].duration).toBeGreaterThan(0);
    });

    it('should return empty array when no history exists', async () => {
      auditLogRepository.find.mockResolvedValue([]);

      const result = await service.getSchedulerHistory();

      expect(result).toEqual([]);
    });

    it('should limit results to 20 entries', async () => {
      auditLogRepository.find.mockResolvedValue([]);

      await service.getSchedulerHistory();

      expect(auditLogRepository.find).toHaveBeenCalledWith({
        where: { action: 'admin.scheduler.manual_fetch' },
        order: { created_at: 'DESC' },
        take: 20,
      });
    });
  });
});
