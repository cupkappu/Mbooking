/**
 * BudgetProgressService Tests
 * 
 * Tests for US2: Real-Time Budget Auto-Update
 * - Optimistic cache updates
 * - Async validation of cache vs real calculation
 * - Cache correction when validation fails
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantContext } from '../../common/context/tenant.context';
import { BudgetProgressService } from './budget-progress.service';
import { Budget, BudgetType } from '../entities/budget.entity';
import { QueryService } from '../../query/query.service';

// Helper for running tests with tenant context
const runWithTenant = <T>(tenantId: string, callback: () => T): T => {
  return TenantContext.run(
    { tenantId, userId: 'user-1', requestId: 'req-1' },
    callback,
  );
};

describe('BudgetProgressService', () => {
  let service: BudgetProgressService;
  let budgetRepository: jest.Mocked<Repository<Budget>>;
  let queryService: jest.Mocked<QueryService>;

  const mockBudget: Budget = {
    id: 'uuid-1',
    tenant_id: 'tenant-1',
    account_id: 'account-1',
    name: 'Monthly Food Budget',
    description: 'Budget for groceries and dining',
    type: BudgetType.PERIODIC,
    amount: 5000,
    currency: 'HKD',
    start_date: new Date('2025-01-01'),
    end_date: new Date('2025-12-31'),
    period_type: 'monthly' as any,
    spent_amount: 2500,
    spent_currency: 'HKD',
    alert_threshold: 0.8,
    status: 'active' as any,
    is_active: true,
    created_at: new Date('2025-01-01'),
    updated_at: new Date('2025-01-15'),
    deleted_at: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BudgetProgressService,
        {
          provide: getRepositoryToken(Budget),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
          },
        },
        {
          provide: QueryService,
          useValue: {
            getBalances: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<BudgetProgressService>(BudgetProgressService);
    budgetRepository = module.get(getRepositoryToken(Budget));
    queryService = module.get(QueryService);
  });

  describe('getCachedProgress', () => {
    it('should return null when no cache exists', () => {
      const result = service.getCachedProgress('uuid-1');
      expect(result).toBeNull();
    });

    it('should return cached progress when it exists', () => {
      service.updateCacheOptimistically('uuid-1', 3000, 'HKD');

      const result = service.getCachedProgress('uuid-1');

      expect(result).toEqual({
        spentAmount: 3000,
        currency: 'HKD',
        timestamp: expect.any(Date),
      });
    });
  });

  describe('updateCacheOptimistically', () => {
    it('should update cache with new values', () => {
      service.updateCacheOptimistically('uuid-1', 3000, 'HKD');

      const result = service.getCachedProgress('uuid-1');

      expect(result?.spentAmount).toBe(3000);
      expect(result?.currency).toBe('HKD');
    });

    it('should overwrite existing cache', () => {
      service.updateCacheOptimistically('uuid-1', 2500, 'HKD');
      service.updateCacheOptimistically('uuid-1', 3000, 'HKD');

      const result = service.getCachedProgress('uuid-1');

      expect(result?.spentAmount).toBe(3000);
    });
  });

  describe('validateCache', () => {
    it('should return true when no cache exists', async () => {
      const result = await service.validateCache('uuid-1');
      expect(result).toBe(true);
    });

    it('should return true when cache matches real calculation', async () => {
      service.updateCacheOptimistically('uuid-1', 2500, 'HKD');
      budgetRepository.findOne.mockResolvedValue(mockBudget);
      queryService.getBalances.mockResolvedValue({
        balances: [{
          account: { id: 'account-1' } as any,
          currencies: [{ currency: 'HKD', amount: -2500 }],
        }],
        pagination: { offset: 0, limit: 20, total: 1, has_more: false },
        meta: { cache_hit: false, calculated_at: new Date().toISOString() },
      });

      const result = await service.validateCache('uuid-1');

      expect(result).toBe(true);
    });

    it('should return false when cache differs from real calculation', async () => {
      service.updateCacheOptimistically('uuid-1', 2000, 'HKD'); // Wrong value
      budgetRepository.findOne.mockResolvedValue(mockBudget);
      queryService.getBalances.mockResolvedValue({
        balances: [{
          account: { id: 'account-1' } as any,
          currencies: [{ currency: 'HKD', amount: -2500 }],
        }],
        pagination: { offset: 0, limit: 20, total: 1, has_more: false },
        meta: { cache_hit: false, calculated_at: new Date().toISOString() },
      });

      const result = await service.validateCache('uuid-1');

      expect(result).toBe(false);
    });
  });

  describe('correctCache', () => {
    it('should update cache with real calculation', async () => {
      budgetRepository.findOne.mockResolvedValue(mockBudget);
      queryService.getBalances.mockResolvedValue({
        balances: [{
          account: { id: 'account-1' } as any,
          currencies: [{ currency: 'HKD', amount: -3000 }],
        }],
        pagination: { offset: 0, limit: 20, total: 1, has_more: false },
        meta: { cache_hit: false, calculated_at: new Date().toISOString() },
      });

      const result = await service.correctCache('uuid-1');

      expect(result).toBe(3000);
      expect(service.getCachedProgress('uuid-1')?.spentAmount).toBe(3000);
    });

    it('should return 0 when budget not found', async () => {
      budgetRepository.findOne.mockResolvedValue(null);

      const result = await service.correctCache('not-found');

      expect(result).toBe(0);
    });
  });

  describe('getProgress', () => {
    it('should return cached progress when available', async () => {
      service.updateCacheOptimistically('uuid-1', 3000, 'HKD');

      const result = await runWithTenant('tenant-1', () => service.getProgress('uuid-1'));

      expect(result.spentAmount).toBe(3000);
      expect(result.isFromCache).toBe(true);
    });

    it('should return database value when no cache exists', async () => {
      budgetRepository.findOne.mockResolvedValue(mockBudget);

      const result = await runWithTenant('tenant-1', () => service.getProgress('uuid-1'));

      expect(result.spentAmount).toBe(2500);
      expect(result.isFromCache).toBe(false);
    });

    it('should return zero values when budget not found', async () => {
      budgetRepository.findOne.mockResolvedValue(null);

      const result = await runWithTenant('tenant-1', () => service.getProgress('not-found'));

      expect(result.spentAmount).toBe(0);
      expect(result.currency).toBe('USD');
    });
  });

  describe('invalidateCache', () => {
    it('should remove cache for specific budget', () => {
      service.updateCacheOptimistically('uuid-1', 3000, 'HKD');

      service.invalidateCache('uuid-1');

      expect(service.getCachedProgress('uuid-1')).toBeNull();
    });

    it('should not affect other budgets', () => {
      service.updateCacheOptimistically('uuid-1', 3000, 'HKD');
      service.updateCacheOptimistically('uuid-2', 4000, 'HKD');

      service.invalidateCache('uuid-1');

      expect(service.getCachedProgress('uuid-1')).toBeNull();
      expect(service.getCachedProgress('uuid-2')?.spentAmount).toBe(4000);
    });
  });

  describe('onJournalEntryCreated', () => {
    it('should update cache for affected budgets', async () => {
      // Mock find to return budgets associated with the account
      budgetRepository.find.mockResolvedValue([mockBudget]);
      queryService.getBalances.mockResolvedValue({
        balances: [{
          account: { id: 'account-1' } as any,
          currencies: [{ currency: 'HKD', amount: -2500 }],
        }],
        pagination: { offset: 0, limit: 20, total: 1, has_more: false },
        meta: { cache_hit: false, calculated_at: new Date().toISOString() },
      });

      const journalLines = [
        { account_id: 'account-1', amount: -500, currency: 'HKD' },
      ];

      await runWithTenant('tenant-1', () =>
        service.onJournalEntryCreated(journalLines as any),
      );

      const cached = service.getCachedProgress('uuid-1');
      expect(cached).not.toBeNull();
      expect(cached?.spentAmount).toBeGreaterThan(mockBudget.spent_amount);
    });

    it('should handle empty journal lines', async () => {
      await runWithTenant('tenant-1', () =>
        service.onJournalEntryCreated([]),
      );

      // Should not throw
    });
  });
});
