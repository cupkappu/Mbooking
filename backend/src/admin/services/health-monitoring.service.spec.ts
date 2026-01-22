import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HealthMonitoringService, HealthStatus } from './health-monitoring.service';
import { User } from '../../auth/user.entity';
import { Provider } from '../../rates/provider.entity';

describe('HealthMonitoringService', () => {
  let service: HealthMonitoringService;
  let userRepository: jest.Mocked<Repository<User>>;
  let providerRepository: jest.Mocked<Repository<Provider>>;

  beforeEach(async () => {
    const mockUserRepository = {
      query: jest.fn(),
    };

    const mockProviderRepository = {
      find: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthMonitoringService,
        { provide: getRepositoryToken(User), useValue: mockUserRepository },
        { provide: getRepositoryToken(Provider), useValue: mockProviderRepository },
      ],
    }).compile();

    service = module.get<HealthMonitoringService>(HealthMonitoringService);
    userRepository = module.get(getRepositoryToken(User));
    providerRepository = module.get(getRepositoryToken(Provider));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getHealthStatus', () => {
    it('should return expected HealthStatus structure', async () => {
      userRepository.query.mockResolvedValue([{ '?column?': 1 }]);
      providerRepository.find.mockResolvedValue([{ id: '1' } as Provider]);

      const result = await service.getHealthStatus();

      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('components');
      expect(result).toHaveProperty('metrics');
      expect(result.components).toHaveProperty('database');
      expect(result.components).toHaveProperty('cache');
      expect(result.components).toHaveProperty('providers');
      expect(result.components).toHaveProperty('storage');
      expect(result.metrics).toHaveProperty('uptime');
      expect(result.metrics).toHaveProperty('memory_usage');
      expect(result.metrics).toHaveProperty('active_users');
      expect(result.metrics).toHaveProperty('requests_per_minute');
    });

    it('should return healthy status when database is healthy', async () => {
      userRepository.query.mockResolvedValue([{ '?column?': 1 }]);
      providerRepository.find.mockResolvedValue([{ id: '1' } as Provider]);

      const result = await service.getHealthStatus();

      expect(result.status).toBe('healthy');
      expect(result.components.database.status).toBe('healthy');
      expect(result.components.database.details).toHaveProperty('latency');
    });

    it('should return degraded status when database query throws error', async () => {
      userRepository.query.mockRejectedValue(new Error('Database connection failed'));
      providerRepository.find.mockResolvedValue([{ id: '1' } as Provider]);

      const result = await service.getHealthStatus();

      expect(result.status).toBe('fail');
      expect(result.components.database.status).toBe('fail');
      expect(result.components.database.message).toBe('Database connection failed');
    });

    it('should return degraded status when no active providers', async () => {
      userRepository.query.mockResolvedValue([{ '?column?': 1 }]);
      providerRepository.find.mockResolvedValue([]);

      const result = await service.getHealthStatus();

      expect(result.status).toBe('degraded');
      expect(result.components.providers.status).toBe('degraded');
      expect(result.components.providers.details).toEqual({ active_count: 0 });
    });

    it('should return healthy status for cache (no Redis implementation)', async () => {
      userRepository.query.mockResolvedValue([{ '?column?': 1 }]);
      providerRepository.find.mockResolvedValue([{ id: '1' } as Provider]);

      const result = await service.getHealthStatus();

      expect(result.components.cache.status).toBe('healthy');
    });

    it('should return healthy status for storage (no disk check implemented)', async () => {
      userRepository.query.mockResolvedValue([{ '?column?': 1 }]);
      providerRepository.find.mockResolvedValue([{ id: '1' } as Provider]);

      const result = await service.getHealthStatus();

      expect(result.components.storage.status).toBe('healthy');
    });

    it('should calculate overall status as degraded when provider status is degraded', async () => {
      userRepository.query.mockResolvedValue([{ '?column?': 1 }]);
      providerRepository.find.mockResolvedValue([]);

      const result = await service.getHealthStatus();

      expect(result.status).toBe('degraded');
    });

    it('should return fail status when database fails regardless of providers', async () => {
      userRepository.query.mockRejectedValue(new Error('DB error'));
      providerRepository.find.mockResolvedValue([]);

      const result = await service.getHealthStatus();

      expect(result.status).toBe('fail');
      expect(result.components.database.status).toBe('fail');
    });

    it('should return metrics with uptime, memory, active_users, and requests_per_minute', async () => {
      userRepository.query.mockResolvedValue([{ '?column?': 1 }]);
      providerRepository.find.mockResolvedValue([{ id: '1' } as Provider]);

      const result = await service.getHealthStatus();

      expect(typeof result.metrics.uptime).toBe('number');
      expect(result.metrics.uptime).toBeGreaterThanOrEqual(0);
      expect(typeof result.metrics.memory_usage).toBe('number');
      expect(result.metrics.memory_usage).toBeGreaterThan(0);
      expect(typeof result.metrics.active_users).toBe('number');
      expect(typeof result.metrics.requests_per_minute).toBe('number');
    });

    it('should include timestamp in ISO format', async () => {
      userRepository.query.mockResolvedValue([{ '?column?': 1 }]);
      providerRepository.find.mockResolvedValue([{ id: '1' } as Provider]);

      const result = await service.getHealthStatus();

      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
    });

    it('should include provider count in details when providers exist', async () => {
      userRepository.query.mockResolvedValue([{ '?column?': 1 }]);
      providerRepository.find.mockResolvedValue([
        { id: '1' } as Provider,
        { id: '2' } as Provider,
        { id: '3' } as Provider,
      ]);

      const result = await service.getHealthStatus();

      expect(result.components.providers.details).toEqual({ active_count: 3 });
    });
  });
});
