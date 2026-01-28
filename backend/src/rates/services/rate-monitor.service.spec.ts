import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RateMonitorService } from './rate-monitor.service';
import { RateStats } from '../entities/rate-stats.entity';

describe('RateMonitorService', () => {
  let service: RateMonitorService;
  let mockRepo: jest.Mocked<Repository<RateStats>>;

  beforeEach(async () => {
    mockRepo = {
      create: jest.fn().mockReturnValue({}),
      save: jest.fn().mockResolvedValue({}),
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
      createQueryBuilder: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
        delete: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 0 }),
      }),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RateMonitorService,
        {
          provide: getRepositoryToken(RateStats),
          useValue: mockRepo,
        },
      ],
    }).compile();

    service = module.get<RateMonitorService>(RateMonitorService);
    await service.onModuleInit();
  });

  describe('recordQuery', () => {
    it('should increment total queries', () => {
      service.recordQuery({
        cacheHit: true,
        latencyMs: 50,
        providerCalled: false,
        providerFailed: false,
        inferred: false,
      });

      const stats = service.getCurrentStats();
      expect(stats.totalQueries).toBe(1);
    });

    it('should increment cache hits', () => {
      service.recordQuery({
        cacheHit: true,
        latencyMs: 10,
        providerCalled: false,
        providerFailed: false,
        inferred: false,
      });

      const stats = service.getCurrentStats();
      expect(stats.cacheHits).toBe(1);
      expect(stats.cacheMisses).toBe(0);
    });

    it('should increment cache misses', () => {
      service.recordQuery({
        cacheHit: false,
        latencyMs: 100,
        providerCalled: true,
        providerFailed: false,
        inferred: false,
      });

      const stats = service.getCurrentStats();
      expect(stats.cacheMisses).toBe(1);
      expect(stats.cacheHits).toBe(0);
    });

    it('should track provider calls and failures', () => {
      service.recordQuery({
        cacheHit: false,
        latencyMs: 200,
        providerCalled: true,
        providerFailed: true,
        inferred: false,
      });

      const stats = service.getCurrentStats();
      expect(stats.providerSuccessRate).toBe(0); // 0% because 1 call, 1 failure
    });

    it('should track inferred rates', () => {
      service.recordQuery({
        cacheHit: false,
        latencyMs: 150,
        providerCalled: true,
        providerFailed: false,
        inferred: true,
      });

      const stats = service.getCurrentStats();
      expect(stats.inferredRates).toBe(1);
    });

    it('should calculate cache hit rate', () => {
      // 3 cache hits, 1 miss
      service.recordQuery({ cacheHit: true, latencyMs: 10, providerCalled: false, providerFailed: false, inferred: false });
      service.recordQuery({ cacheHit: true, latencyMs: 10, providerCalled: false, providerFailed: false, inferred: false });
      service.recordQuery({ cacheHit: true, latencyMs: 10, providerCalled: false, providerFailed: false, inferred: false });
      service.recordQuery({ cacheHit: false, latencyMs: 100, providerCalled: true, providerFailed: false, inferred: false });

      const stats = service.getCurrentStats();
      expect(stats.cacheHitRate).toBe(75); // 75%
    });

    it('should calculate average latency', () => {
      service.recordQuery({ cacheHit: true, latencyMs: 10, providerCalled: false, providerFailed: false, inferred: false });
      service.recordQuery({ cacheHit: true, latencyMs: 20, providerCalled: false, providerFailed: false, inferred: false });
      service.recordQuery({ cacheHit: true, latencyMs: 30, providerCalled: false, providerFailed: false, inferred: false });

      const stats = service.getCurrentStats();
      expect(stats.avgLatency).toBe(20); // (10 + 20 + 30) / 3
    });
  });

  describe('getCurrentStats', () => {
    it('should return all stats', () => {
      service.recordQuery({
        cacheHit: true,
        latencyMs: 50,
        providerCalled: false,
        providerFailed: false,
        inferred: false,
      });

      const stats = service.getCurrentStats();

      expect(stats).toHaveProperty('cacheHitRate');
      expect(stats).toHaveProperty('providerSuccessRate');
      expect(stats).toHaveProperty('avgLatency');
      expect(stats).toHaveProperty('totalQueries');
      expect(stats).toHaveProperty('cacheHits');
      expect(stats).toHaveProperty('cacheMisses');
      expect(stats).toHaveProperty('inferredRates');
    });

    it('should return zeros when no queries', () => {
      const stats = service.getCurrentStats();

      expect(stats.totalQueries).toBe(0);
      expect(stats.cacheHitRate).toBe(0);
      expect(stats.providerSuccessRate).toBe(100); // No calls = 100%
      expect(stats.avgLatency).toBe(0);
    });
  });

  describe('getStatsHistory', () => {
    it('should call repository with correct parameters', async () => {
      const fromDate = new Date('2026-01-01');
      const toDate = new Date('2026-01-31');

      // Reset the mock to return a proper chainable query builder
      mockRepo.createQueryBuilder = jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      }) as any;

      await service.getStatsHistory(fromDate, toDate);

      expect(mockRepo.createQueryBuilder).toHaveBeenCalledWith('stats');
    });
  });
});
