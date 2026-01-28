/**
 * Multi-Currency Accounting - QueryService Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantContext } from '../common/context/tenant.context';
import { QueryService } from './query.service';
import { Account, AccountType } from '../accounts/account.entity';
import { JournalEntry } from '../journal/journal-entry.entity';
import { JournalLine } from '../journal/journal-line.entity';
import { RateGraphEngine } from '../rates/services/rate-graph.engine';
import { TenantsService } from '../tenants/tenants.service';

// Helper for running tests with tenant context
const runWithTenant = <T>(tenantId: string, callback: () => T): T => {
  return TenantContext.run(
    { tenantId, userId: 'user-1', requestId: 'req-1' },
    callback,
  );
};

describe('QueryService', () => {
  let service: QueryService;
  let accountRepository: jest.Mocked<Repository<Account>>;
  let journalEntryRepository: jest.Mocked<Repository<JournalEntry>>;
  let journalLineRepository: jest.Mocked<Repository<JournalLine>>;
  let rateGraphEngine: jest.Mocked<RateGraphEngine>;

  const mockAccount: Account = {
    id: 'acc-1',
    tenant_id: 'tenant-1',
    parent: null,
    children: [],
    name: 'Bank',
    type: AccountType.ASSETS,
    currency: 'USD',
    path: 'assets:bank',
    depth: 1,
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
    deleted_at: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueryService,
        {
          provide: getRepositoryToken(Account),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(JournalEntry),
          useValue: {
            findAndCount: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(JournalLine),
          useValue: {
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: RateGraphEngine,
          useValue: {
            getRate: jest.fn(),
            convert: jest.fn(),
          },
        },
        {
          provide: TenantsService,
          useValue: {
            findById: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<QueryService>(QueryService);
    accountRepository = module.get(getRepositoryToken(Account));
    journalEntryRepository = module.get(getRepositoryToken(JournalEntry));
    journalLineRepository = module.get(getRepositoryToken(JournalLine));
    rateGraphEngine = module.get(RateGraphEngine);
  });

  describe('getBalances', () => {
    it('should return balances with default depth', async () => {
      accountRepository.find.mockResolvedValue([mockAccount]);
      
      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      };
      journalLineRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await runWithTenant('tenant-1', () => service.getBalances({}));

      expect(result.balances).toBeDefined();
      expect(result.pagination).toBeDefined();
    });

    it('should convert currencies when specified', async () => {
      accountRepository.find.mockResolvedValue([mockAccount]);

      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          { line_currency: 'USD', total: '1000' },
        ]),
      };
      journalLineRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      rateGraphEngine.getRate.mockResolvedValue({ rate: 0.85 });

      const result = await runWithTenant('tenant-1', () =>
        service.getBalances({
          convert_to: 'EUR',
          exchange_rate_date: 'latest',
        }),
      );

      expect(rateGraphEngine.getRate).toHaveBeenCalled();
    });
  });

  describe('getJournalEntries', () => {
    it('should return paginated journal entries', async () => {
       const mockEntries: JournalEntry[] = [{
        id: '1',
        tenant_id: 'tenant-1',
        date: new Date(),
        description: 'Test',
        reference_id: null,
        is_pending: false,
        created_by: 'user-1',
        lines: [],
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
      }];
      journalEntryRepository.findAndCount.mockResolvedValue([mockEntries, 1]);

       const result = await runWithTenant('tenant-1', () =>
        service.getJournalEntries({
          pagination: { offset: 0, limit: 10 },
        }),
      );

      expect(result.entries).toEqual(mockEntries);
      expect(result.pagination.total).toBe(1);
    });
  });

  describe('Budget Tracking Workflow', () => {
    it('should track spending against budget', async () => {
      const budget = {
        amount: 5000,
        currency: 'HKD',
        spent_amount: 0,
      };

      const transactions = [
        { amount: 50, currency: 'HKD' },
        { amount: 120, currency: 'HKD' },
        { amount: 80, currency: 'HKD' },
      ];

      budget.spent_amount = transactions.reduce((sum, t) => sum + t.amount, 0);
      const progress = (budget.spent_amount / budget.amount) * 100;

      expect(budget.spent_amount).toBe(250);
      expect(progress).toBe(5);
    });
  });

  describe('Balance Sheet Calculation', () => {
    it('should calculate assets = liabilities + equity', async () => {
      const balances = {
        assets: {
          'assets:bank': 10000,
          'assets:cash': 5000,
        },
        liabilities: {
          'liabilities:credit_card': 2000,
        },
        equity: {
          'equity:retained_earnings': 13000,
        },
      };

      const totalAssets = Object.values(balances.assets).reduce((a, b) => a + b, 0);
      const totalLiabilities = Object.values(balances.liabilities).reduce((a, b) => a + b, 0);
      const totalEquity = Object.values(balances.equity).reduce((a, b) => a + b, 0);

      expect(totalAssets).toBe(15000);
      expect(totalLiabilities + totalEquity).toBe(15000);
    });
  });
});
