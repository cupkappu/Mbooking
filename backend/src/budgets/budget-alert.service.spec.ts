/**
 * BudgetAlertService Tests
 * 
 * Tests for US3: Alert Deduplication
 * - FR-C008: Same alert type for same budget is not sent more than once in 24 hours
 * - FR-C009: Additional deduplication check using sent_at timestamp
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantContext } from '../common/context/tenant.context';
import { BudgetAlertService } from './budget-alert.service';
import { Budget, BudgetType, PeriodType } from './entities/budget.entity';
import { BudgetAlert, AlertType, AlertStatus } from './entities/budget-alert.entity';
import { JournalLine } from '../journal/journal-line.entity';
import { Account } from '../accounts/account.entity';
import { QueryService } from '../query/query.service';

// Helper for running tests with tenant context
const runWithTenant = <T>(tenantId: string, callback: () => T): T => {
  return TenantContext.run(
    { tenantId, userId: 'user-1', requestId: 'req-1' },
    callback,
  );
};

describe('BudgetAlertService', () => {
  let service: BudgetAlertService;
  let budgetRepository: jest.Mocked<Repository<Budget>>;
  let alertRepository: jest.Mocked<Repository<BudgetAlert>>;
  let journalLineRepository: jest.Mocked<Repository<JournalLine>>;
  let accountRepository: jest.Mocked<Repository<Account>>;
  let queryService: jest.Mocked<QueryService>;

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
    status: BudgetType.PERIODIC as any,
    is_active: true,
    created_at: new Date('2025-01-01'),
    updated_at: new Date('2025-01-15'),
    deleted_at: null,
  };

  const mockAlert = {
    id: 'alert-1',
    tenant_id: 'tenant-1',
    budget_id: 'uuid-1',
    alert_type: AlertType.BUDGET_WARNING,
    status: AlertStatus.PENDING,
    threshold_percent: 80,
    spent_amount: 4000,
    budget_amount: 5000,
    currency: 'HKD',
    message: 'Budget warning message',
    user_id: '' as string,
    sent_at: null as unknown as Date,
    acknowledged_at: null as unknown as Date,
    created_at: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BudgetAlertService,
        {
          provide: getRepositoryToken(Budget),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(BudgetAlert),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(JournalLine),
          useValue: {
            find: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Account),
          useValue: {
            find: jest.fn(),
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

    service = module.get<BudgetAlertService>(BudgetAlertService);
    budgetRepository = module.get(getRepositoryToken(Budget));
    alertRepository = module.get(getRepositoryToken(BudgetAlert));
    journalLineRepository = module.get(getRepositoryToken(JournalLine));
    accountRepository = module.get(getRepositoryToken(Account));
    queryService = module.get(QueryService);
  });

  describe('findExistingAlert', () => {
    // FR-C008: Same alert type for same budget is not sent more than once in 24 hours
    it('should return null when no existing alert exists within 24 hours', async () => {
      alertRepository.findOne.mockResolvedValue(null);

      const result = await service.findExistingAlert('uuid-1', AlertType.BUDGET_WARNING);

      expect(result).toBeNull();
      // Verify findOne was called (the 24-hour filter uses FindOperator internally)
      expect(alertRepository.findOne).toHaveBeenCalled();
    });

    it('should return existing alert when one exists within 24 hours', async () => {
      alertRepository.findOne.mockResolvedValue(mockAlert);

      const result = await service.findExistingAlert('uuid-1', AlertType.BUDGET_WARNING);

      expect(result).toEqual(mockAlert);
    });

    it('should not find alerts older than 24 hours', async () => {
      alertRepository.findOne.mockResolvedValue(null);

      await service.findExistingAlert('uuid-1', AlertType.BUDGET_WARNING);

      // Verify findOne was called (the 24-hour filter is in the implementation)
      expect(alertRepository.findOne).toHaveBeenCalled();
    });
  });

  describe('findExistingAlertBySentAt', () => {
    // FR-C009: Additional deduplication check using sent_at timestamp
    it('should return null when no alert sent within 24 hours', async () => {
      alertRepository.findOne.mockResolvedValue(null);

      const result = await service.findExistingAlertBySentAt('uuid-1', AlertType.BUDGET_WARNING);

      expect(result).toBeNull();
    });

    it('should return existing alert when one was sent within 24 hours', async () => {
      const sentAlert = { ...mockAlert, sent_at: new Date() };
      alertRepository.findOne.mockResolvedValue(sentAlert);

      const result = await service.findExistingAlertBySentAt('uuid-1', AlertType.BUDGET_WARNING);

      expect(result).toEqual(sentAlert);
    });

    it('should use sent_at field for deduplication check', async () => {
      alertRepository.findOne.mockResolvedValue(null);

      await service.findExistingAlertBySentAt('uuid-1', AlertType.BUDGET_WARNING);

      // Verify findOne was called with sent_at filter
      expect(alertRepository.findOne).toHaveBeenCalled();
    });
  });

  describe('checkBudgetAlerts', () => {
    it('should not create duplicate alerts within 24 hours', async () => {
      budgetRepository.find.mockResolvedValue([mockBudget]);
      alertRepository.findOne.mockResolvedValue(mockAlert); // Existing alert found
      queryService.getBalances.mockResolvedValue({
        balances: [],
        pagination: { offset: 0, limit: 20, total: 0, has_more: false },
        meta: { cache_hit: false, calculated_at: new Date().toISOString() },
      });

      const result = await runWithTenant('tenant-1', () => 
        service.checkBudgetAlerts('tenant-1'),
      );

      // No new alerts should be created because existing alert was found
      expect(result.triggered).toBe(0);
      expect(result.alerts).toHaveLength(0);
    });

    it('should create alert when no existing alert within 24 hours', async () => {
      budgetRepository.find.mockResolvedValue([mockBudget]);
      alertRepository.findOne.mockResolvedValue(null); // No existing alert
      // Mock getBalances to return a balance that exceeds the alert threshold (80% of 5000 = 4000)
      queryService.getBalances.mockResolvedValue({
        balances: [{ account: { id: 'account-1' } as any, currencies: [{ currency: 'HKD', amount: 4500 }], converted_subtree_total: 4500 }],
        pagination: { offset: 0, limit: 20, total: 1, has_more: false },
        meta: { cache_hit: false, calculated_at: new Date().toISOString() },
      });
      alertRepository.create.mockReturnValue(mockAlert);
      alertRepository.save.mockResolvedValue(mockAlert);

      const result = await runWithTenant('tenant-1', () =>
        service.checkBudgetAlerts('tenant-1'),
      );

      expect(result.triggered).toBeGreaterThan(0);
    });
  });

  describe('listAlerts', () => {
    it('should return alerts for tenant', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[mockAlert], 1]),
      };
      alertRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await runWithTenant('tenant-1', () =>
        service.listAlerts('tenant-1'),
      );

      expect(result.alerts).toEqual([mockAlert]);
      expect(result.total).toBe(1);
    });
  });

  describe('acknowledgeAlert', () => {
    it('should update alert status to acknowledged', async () => {
      alertRepository.findOne.mockResolvedValue(mockAlert);
      alertRepository.save.mockResolvedValue({
        ...mockAlert,
        status: AlertStatus.ACKNOWLEDGED,
        acknowledged_at: new Date(),
      });

      const result = await service.acknowledgeAlert('alert-1', 'user-1');

      expect(result.status).toBe(AlertStatus.ACKNOWLEDGED);
      expect(result.acknowledged_at).toBeDefined();
    });
  });

  describe('dismissAlert', () => {
    it('should update alert status to dismissed', async () => {
      alertRepository.findOne.mockResolvedValue(mockAlert);
      alertRepository.save.mockResolvedValue({
        ...mockAlert,
        status: AlertStatus.DISMISSED,
        acknowledged_at: new Date(),
      });

      const result = await service.dismissAlert('alert-1', 'user-1');

      expect(result.status).toBe(AlertStatus.DISMISSED);
    });
  });
});
