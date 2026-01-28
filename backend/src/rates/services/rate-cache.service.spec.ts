import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RateCacheService } from './rate-cache.service';

describe('RateCacheService', () => {
  let service: RateCacheService;
  let mockConfigService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    // Create mock config service
    mockConfigService = {
      get: jest.fn().mockReturnValue(undefined), // No Redis URL = in-memory
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RateCacheService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<RateCacheService>(RateCacheService);
    await service.onModuleInit();
  });

  afterEach(async () => {
    await service.clear();
  });

  describe('get', () => {
    it('should return null for non-existent key', async () => {
      const result = await service.get('USD', 'EUR', new Date());
      expect(result).toBeNull();
    });

    it('should return cached entry', async () => {
      const date = new Date('2026-01-27');
      const entry = {
        rate: 0.92,
        providerId: 'rest:exchangerate-host',
        fetchedAt: new Date(),
      };

      await service.set('USD', 'EUR', date, entry);

      const result = await service.get('USD', 'EUR', date);

      expect(result).not.toBeNull();
      expect(result?.rate).toBe(0.92);
      expect(result?.providerId).toBe('rest:exchangerate-host');
    });

    it('should be case-insensitive for currencies', async () => {
      const date = new Date('2026-01-27');
      const entry = {
        rate: 0.92,
        providerId: 'test',
        fetchedAt: new Date(),
      };

      // Set with uppercase
      await service.set('USD', 'EUR', date, entry);

      // Get with lowercase
      const result = await service.get('usd', 'eur', date);

      expect(result).not.toBeNull();
    });
  });

  describe('set', () => {
    it('should store entry with expiration', async () => {
      const date = new Date('2026-01-27');
      const entry = {
        rate: 0.92,
        providerId: 'test',
        fetchedAt: new Date(),
      };

      await service.set('USD', 'EUR', date, entry);

      const result = await service.get('USD', 'EUR', date);
      expect(result).not.toBeNull();
      expect(result?.rate).toBe(0.92);
    });
  });

  describe('getBatch', () => {
    it('should return empty map for no entries', async () => {
      const pairs = [
        { from: 'USD', to: 'EUR', date: new Date() },
        { from: 'USD', to: 'GBP', date: new Date() },
      ];

      const result = await service.getBatch(pairs);

      expect(result.size).toBe(0);
    });

    it('should return cached entries', async () => {
      const date = new Date('2026-01-27');

      await service.set('USD', 'EUR', date, {
        rate: 0.92,
        providerId: 'test',
        fetchedAt: new Date(),
      });

      await service.set('USD', 'GBP', date, {
        rate: 0.79,
        providerId: 'test',
        fetchedAt: new Date(),
      });

      const pairs = [
        { from: 'USD', to: 'EUR', date },
        { from: 'USD', to: 'GBP', date },
        { from: 'USD', to: 'JPY', date }, // Not cached
      ];

      const result = await service.getBatch(pairs);

      expect(result.size).toBe(2);
      expect(result.get('USD:EUR')?.rate).toBe(0.92);
      expect(result.get('USD:GBP')?.rate).toBe(0.79);
    });
  });

  describe('setBatch', () => {
    it('should store multiple rates', async () => {
      const date = new Date('2026-01-27');
      const rates = new Map<string, number>([
        ['EUR', 0.92],
        ['GBP', 0.79],
        ['JPY', 149.5],
      ]);

      await service.setBatch('USD', date, rates, 'test-provider');

      const result1 = await service.get('USD', 'EUR', date);
      const result2 = await service.get('USD', 'GBP', date);
      const result3 = await service.get('USD', 'JPY', date);

      expect(result1?.rate).toBe(0.92);
      expect(result2?.rate).toBe(0.79);
      expect(result3?.rate).toBe(149.5);
    });
  });

  describe('delete', () => {
    it('should delete cached entry', async () => {
      const date = new Date('2026-01-27');
      await service.set('USD', 'EUR', date, {
        rate: 0.92,
        providerId: 'test',
        fetchedAt: new Date(),
      });

      await service.delete('USD', 'EUR', date);

      const result = await service.get('USD', 'EUR', date);
      expect(result).toBeNull();
    });
  });

  describe('clear', () => {
    it('should clear all cached entries', async () => {
      const date = new Date('2026-01-27');

      await service.set('USD', 'EUR', date, { rate: 0.92, providerId: 'test', fetchedAt: new Date() });
      await service.set('USD', 'GBP', date, { rate: 0.79, providerId: 'test', fetchedAt: new Date() });

      await service.clear();

      const result1 = await service.get('USD', 'EUR', date);
      const result2 = await service.get('USD', 'GBP', date);

      expect(result1).toBeNull();
      expect(result2).toBeNull();
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', async () => {
      const date = new Date('2026-01-27');

      await service.set('USD', 'EUR', date, { rate: 0.92, providerId: 'test', fetchedAt: new Date() });
      await service.set('USD', 'GBP', date, { rate: 0.79, providerId: 'test', fetchedAt: new Date() });

      const stats = await service.getStats();

      expect(stats.size).toBe(2);
      expect(stats.keys.length).toBe(2);
    });
  });
});
