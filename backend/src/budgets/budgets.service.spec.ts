/**
 * Multi-Currency Accounting - BudgetsService Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { TenantContext } from '../common/context/tenant.context';
import { BudgetsService } from './budgets.service';
import { Budget, BudgetType, PeriodType, BudgetStatus } from './entities/budget.entity';
import { BudgetAmountValidator } from './validators/budget-amount.validator';

// Helper for running tests with tenant context
const runWithTenant = <T>(tenantId: string, callback: () => T): T => {
  return TenantContext.run(
    { tenantId, userId: 'user-1', requestId: 'req-1' },
    callback,
  );
};

describe('BudgetsService', () => {
  let service: BudgetsService;
  let budgetRepository: jest.Mocked<Repository<Budget>>;

  const mockBudget: Budget = {
    id: 'uuid-1',
    tenant_id: 'tenant-1',
    account_id: null,
    name: 'Monthly Food Budget',
    description: 'Budget for groceries and dining',
    type: BudgetType.PERIODIC,
    amount: 5000,
    currency: 'HKD',
    start_date: new Date('2025-01-01'),
    end_date: new Date('2025-12-31'),
    period_type: PeriodType.MONTHLY,
    spent_amount: 2500,
    spent_currency: 'HKD',
    alert_threshold: 0.8,
    status: BudgetStatus.ACTIVE,
    is_active: true,
    created_at: new Date('2025-01-01'),
    updated_at: new Date('2025-01-15'),
    deleted_at: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BudgetsService,
        BudgetAmountValidator,
        {
          provide: getRepositoryToken(Budget),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            createQueryBuilder: jest.fn(),
            count: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<BudgetsService>(BudgetsService);
    budgetRepository = module.get(getRepositoryToken(Budget));
  });

  describe('findAll', () => {
    it('should return all active budgets for tenant', async () => {
      const mockBudgets = [mockBudget];
      budgetRepository.find.mockResolvedValue(mockBudgets);

      const result = await runWithTenant('tenant-1', () => service.findAll());

      expect(result).toEqual(mockBudgets);
      expect(budgetRepository.find).toHaveBeenCalledWith({
        where: { tenant_id: 'tenant-1', is_active: true },
        order: { created_at: 'DESC' },
      });
    });
  });

  describe('findById', () => {
    it('should return budget when found', async () => {
      budgetRepository.findOne.mockResolvedValue(mockBudget);

      const result = await runWithTenant('tenant-1', () => service.findById('uuid-1'));

      expect(result).toEqual(mockBudget);
    });

    it('should throw NotFoundException when not found', async () => {
      budgetRepository.findOne.mockResolvedValue(null);

      await expect(
        runWithTenant('tenant-1', () => service.findById('not-found')),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create a new budget with tenant_id', async () => {
      const createDto = {
        name: 'New Budget',
        type: BudgetType.PERIODIC,
        amount: 1000,
        currency: 'USD',
        start_date: new Date('2025-01-01'),
        period_type: PeriodType.MONTHLY,
      };
      const createdBudget = { ...mockBudget, ...createDto, id: 'new-uuid' };
      budgetRepository.create.mockReturnValue(createdBudget);
      budgetRepository.save.mockResolvedValue(createdBudget);

      const result = await runWithTenant('tenant-1', () => service.create(createDto));

      expect(result).toEqual(createdBudget);
      expect(budgetRepository.create).toHaveBeenCalledWith({
        ...createDto,
        tenant_id: 'tenant-1',
        spent_amount: 0,
      });
    });
  });

  describe('update', () => {
    it('should update budget fields', async () => {
      const updateDto = { name: 'Updated Budget Name', amount: 6000 };
      const updatedBudget = { ...mockBudget, ...updateDto };
      budgetRepository.findOne.mockResolvedValue(mockBudget);
      budgetRepository.save.mockResolvedValue(updatedBudget);

      const result = await runWithTenant('tenant-1', () => service.update('uuid-1', updateDto));

      expect(result.name).toBe('Updated Budget Name');
      expect(result.amount).toBe(6000);
    });

    // FR-C001: Users cannot reduce budget amount below spent amount
    it('should reject update when amount is less than spent amount', async () => {
      const updateDto = { amount: 2000 }; // Less than spent_amount of 2500
      budgetRepository.findOne.mockResolvedValue(mockBudget);

      await expect(
        runWithTenant('tenant-1', () => service.update('uuid-1', updateDto)),
      ).rejects.toThrow(BadRequestException);
    });

    // FR-C002: Validation error message in Chinese with spent amount
    it('should throw BadRequestException with Chinese error message', async () => {
      const updateDto = { amount: 2000 }; // Less than spent_amount of 2500
      budgetRepository.findOne.mockResolvedValue(mockBudget);

      try {
        await runWithTenant('tenant-1', () => service.update('uuid-1', updateDto));
        fail('Expected BadRequestException');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect((error as BadRequestException).message).toContain('预算金额不能低于已花费金额');
        expect((error as BadRequestException).message).toContain('2500');
      }
    });

    it('should allow update when amount equals spent amount', async () => {
      const updateDto = { amount: 2500 }; // Equal to spent_amount
      const updatedBudget = { ...mockBudget, ...updateDto };
      budgetRepository.findOne.mockResolvedValue(mockBudget);
      budgetRepository.save.mockResolvedValue(updatedBudget);

      const result = await runWithTenant('tenant-1', () => service.update('uuid-1', updateDto));

      expect(result.amount).toBe(2500);
    });

    it('should allow update when amount is greater than spent amount', async () => {
      const updateDto = { amount: 3000 }; // Greater than spent_amount of 2500
      const updatedBudget = { ...mockBudget, ...updateDto };
      budgetRepository.findOne.mockResolvedValue(mockBudget);
      budgetRepository.save.mockResolvedValue(updatedBudget);

      const result = await runWithTenant('tenant-1', () => service.update('uuid-1', updateDto));

      expect(result.amount).toBe(3000);
    });

    it('should allow update without amount field', async () => {
      const updateDto = { name: 'Updated Name Only' };
      const updatedBudget = { ...mockBudget, ...updateDto };
      budgetRepository.findOne.mockResolvedValue(mockBudget);
      budgetRepository.save.mockResolvedValue(updatedBudget);

      const result = await runWithTenant('tenant-1', () => service.update('uuid-1', updateDto));

      expect(result.name).toBe('Updated Name Only');
    });
  });

  // FR-C003: Administrator override
  describe('adminUpdate', () => {
    it('should allow admin to reduce budget below spent amount', async () => {
      const updateDto = { amount: 2000 }; // Less than spent_amount of 2500
      const updatedBudget = { ...mockBudget, ...updateDto };
      budgetRepository.findOne.mockResolvedValue(mockBudget);
      budgetRepository.save.mockResolvedValue(updatedBudget);

      const result = await runWithTenant('tenant-1', () => 
        service.adminUpdate('uuid-1', updateDto, 'admin-user-1'),
      );

      expect(result.amount).toBe(2000);
    });

    it('should log admin override action', async () => {
      const updateDto = { amount: 2000 };
      const updatedBudget = { ...mockBudget, ...updateDto };
      budgetRepository.findOne.mockResolvedValue(mockBudget);
      budgetRepository.save.mockResolvedValue(updatedBudget);

      // Spy on console.log to verify audit logging
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await runWithTenant('tenant-1', () =>
        service.adminUpdate('uuid-1', updateDto, 'admin-user-1'),
      );

      expect(consoleSpy).toHaveBeenCalled();
      expect(consoleSpy.mock.calls[0][0]).toContain('[AUDIT]');

      consoleSpy.mockRestore();
    });
  });

  describe('delete (soft delete)', () => {
    it('should set is_active to false', async () => {
      budgetRepository.findOne.mockResolvedValue(mockBudget);
      budgetRepository.save.mockResolvedValue({ ...mockBudget, is_active: false });

      await runWithTenant('tenant-1', () => service.delete('uuid-1'));

      expect(budgetRepository.save).toHaveBeenCalledWith({
        ...mockBudget,
        is_active: false,
      });
    });
  });

  describe('findWithPagination', () => {
    it('should return paginated results', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[mockBudget], 1]),
      };
      budgetRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await runWithTenant('tenant-1', () =>
        service.findWithPagination({ offset: 0, limit: 10, is_active: true }),
      );

      expect(result.data).toEqual([mockBudget]);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.total_pages).toBe(1);
    });

    it('should apply search filter when provided', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[mockBudget], 1]),
      };
      budgetRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      await runWithTenant('tenant-1', () =>
        service.findWithPagination({ offset: 0, limit: 10, search: 'food' }),
      );

      expect(mockQueryBuilder.andWhere).toHaveBeenCalled();
    });

    it('should apply type filter when provided', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[mockBudget], 1]),
      };
      budgetRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      await runWithTenant('tenant-1', () =>
        service.findWithPagination({ offset: 0, limit: 10, type: 'periodic' }),
      );

      expect(mockQueryBuilder.andWhere).toHaveBeenCalled();
    });
  });

  describe('updateSpentAmount', () => {
    it('should update spent amount and currency', async () => {
      budgetRepository.findOne.mockResolvedValue(mockBudget);
      budgetRepository.save.mockResolvedValue({
        ...mockBudget,
        spent_amount: 3000,
        spent_currency: 'USD',
      });

      const result = await runWithTenant('tenant-1', () =>
        service.updateSpentAmount('uuid-1', 3000, 'USD'),
      );

      expect(result.spent_amount).toBe(3000);
      expect(result.spent_currency).toBe('USD');
    });

    it('should throw NotFoundException when budget not found', async () => {
      budgetRepository.findOne.mockResolvedValue(null);

      await expect(
        runWithTenant('tenant-1', () => service.updateSpentAmount('not-found', 1000, 'USD')),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // US5: Multi-Currency Summary
  describe('getMultiCurrencySummary', () => {
    it('should return summary with single currency', async () => {
      const singleCurrencyBudgets = [
        { ...mockBudget, currency: 'USD', amount: 1000, spent_amount: 500 },
      ];
      budgetRepository.find.mockResolvedValue(singleCurrencyBudgets as any);

      const result = await runWithTenant('tenant-1', () => 
        service.getMultiCurrencySummary('USD'),
      );

      expect(result.base_currency).toBe('USD');
      expect(result.total_budget).toBe(1000);
      expect(result.total_spent).toBe(500);
      expect(result.exposure_risk).toBe('low');
      expect(result.by_currency).toHaveLength(1);
      expect(result.by_currency[0].currency).toBe('USD');
    });

    it('should calculate medium risk for multiple currencies', async () => {
      const multiCurrencyBudgets = [
        { ...mockBudget, currency: 'USD', amount: 1000, spent_amount: 500 },
        { ...mockBudget, id: 'uuid-2', currency: 'HKD', amount: 4000, spent_amount: 2000 },
        { ...mockBudget, id: 'uuid-3', currency: 'EUR', amount: 800, spent_amount: 400 },
      ];
      budgetRepository.find.mockResolvedValue(multiCurrencyBudgets as any);

      const result = await runWithTenant('tenant-1', () => 
        service.getMultiCurrencySummary('USD'),
      );

      expect(result.exposure_risk).toBe('medium');
      expect(result.by_currency).toHaveLength(3);
      expect(result.total_budget).toBe(5800);
    });

    it('should calculate high risk for many currencies', async () => {
      const manyCurrencyBudgets = [
        { ...mockBudget, currency: 'USD', amount: 1000, spent_amount: 500 },
        { ...mockBudget, id: 'uuid-2', currency: 'HKD', amount: 4000, spent_amount: 2000 },
        { ...mockBudget, id: 'uuid-3', currency: 'EUR', amount: 800, spent_amount: 400 },
        { ...mockBudget, id: 'uuid-4', currency: 'GBP', amount: 600, spent_amount: 300 },
        { ...mockBudget, id: 'uuid-5', currency: 'JPY', amount: 50000, spent_amount: 25000 },
      ];
      budgetRepository.find.mockResolvedValue(manyCurrencyBudgets as any);

      const result = await runWithTenant('tenant-1', () => 
        service.getMultiCurrencySummary('USD'),
      );

      expect(result.exposure_risk).toBe('high');
      expect(result.by_currency).toHaveLength(5);
    });

    it('should calculate utilization percentage', async () => {
      const budget = { ...mockBudget, amount: 1000, spent_amount: 750 };
      budgetRepository.find.mockResolvedValue([budget] as any);

      const result = await runWithTenant('tenant-1', () => 
        service.getMultiCurrencySummary('USD'),
      );

      expect(result.utilization_percentage).toBe(75);
    });

    it('should return empty summary when no active budgets', async () => {
      budgetRepository.find.mockResolvedValue([]);

      const result = await runWithTenant('tenant-1', () => 
        service.getMultiCurrencySummary('USD'),
      );

      expect(result.total_budget).toBe(0);
      expect(result.total_spent).toBe(0);
      expect(result.by_currency).toHaveLength(0);
      expect(result.exposure_risk).toBe('low');
    });

    it('should use specified base currency', async () => {
      const budget = { ...mockBudget, currency: 'EUR', amount: 1000, spent_amount: 500 };
      budgetRepository.find.mockResolvedValue([budget] as any);

      const result = await runWithTenant('tenant-1', () => 
        service.getMultiCurrencySummary('GBP'),
      );

      expect(result.base_currency).toBe('GBP');
    });
  });
});
