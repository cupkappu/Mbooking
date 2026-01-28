/**
 * Multi-Currency Accounting - JournalService Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BadRequestException } from '@nestjs/common';
import { TenantContext } from '../common/context/tenant.context';
import { JournalService } from './journal.service';
import { JournalEntry } from './journal-entry.entity';
import { JournalLine } from './journal-line.entity';
import { QueryService } from '../query/query.service';
import { CurrenciesService } from '../currencies/currencies.service';
import { RateGraphEngine } from '../rates/services/rate-graph.engine';
import { TenantsService } from '../tenants/tenants.service';
import { BudgetProgressService } from '../budgets/services/budget-progress.service';

// Helper for running tests with tenant context
const runWithTenant = <T>(tenantId: string, callback: () => T): T => {
  return TenantContext.run(
    { tenantId, userId: 'user-1', requestId: 'req-1' },
    callback,
  );
};

describe('JournalService', () => {
  let service: JournalService;
  let journalEntryRepository: jest.Mocked<Repository<JournalEntry>>;
  let journalLineRepository: jest.Mocked<Repository<JournalLine>>;

  const mockJournalEntry: JournalEntry = {
    id: 'uuid-1',
    tenant_id: 'tenant-1',
    date: new Date('2025-01-15'),
    description: 'Test Transaction',
    reference_id: null,
    is_pending: false,
    created_by: 'user-1',
    lines: [],
    created_at: new Date(),
    updated_at: new Date(),
    deleted_at: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JournalService,
        {
          provide: getRepositoryToken(JournalEntry),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            remove: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(JournalLine),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: QueryService,
          useValue: {
            invalidateCache: jest.fn(),
          },
        },
        {
          provide: CurrenciesService,
          useValue: {
            validateCurrencyExists: jest.fn().mockResolvedValue({ code: 'USD' }),
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
        {
          provide: BudgetProgressService,
          useValue: {
            onJournalEntryCreated: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<JournalService>(JournalService);
    journalEntryRepository = module.get(getRepositoryToken(JournalEntry));
    journalLineRepository = module.get(getRepositoryToken(JournalLine));
  });

  describe('findAll', () => {
    it('should return journal entries for tenant', async () => {
      const mockEntries = [mockJournalEntry];
      journalEntryRepository.find.mockResolvedValue(mockEntries);

      const result = await runWithTenant('tenant-1', () => service.findAll());

      expect(result).toEqual(mockEntries);
    });

    it('should apply pagination options', async () => {
      journalEntryRepository.find.mockResolvedValue([]);

      await runWithTenant('tenant-1', () =>
        service.findAll({ offset: 10, limit: 20 }),
      );

      expect(journalEntryRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 20,
        }),
      );
    });
  });

  describe('create', () => {
    it('should create balanced journal entry', async () => {
      const balancedLines = [
        { account_id: 'acc-1', amount: 100, currency: 'USD', tags: [] },
        { account_id: 'acc-2', amount: -100, currency: 'USD', tags: [] },
      ];

      journalEntryRepository.create.mockReturnValue(mockJournalEntry);
      journalEntryRepository.save.mockResolvedValue(mockJournalEntry);
      journalLineRepository.create.mockImplementation((data) => data as JournalLine);
      journalLineRepository.save.mockResolvedValue(balancedLines as any);

      const result = await runWithTenant('tenant-1', () =>
        service.create({
          date: new Date('2025-01-15'),
          description: 'Balanced Transaction',
          lines: balancedLines,
        }),
      );

      expect(result).toBeDefined();
    });

    it('should throw BadRequestException for unbalanced entry', async () => {
      const unbalancedLines = [
        { account_id: 'acc-1', amount: 100, currency: 'USD', tags: [] },
        { account_id: 'acc-2', amount: -50, currency: 'USD', tags: [] },
      ];

      await expect(
        runWithTenant('tenant-1', () =>
          service.create({
            date: new Date('2025-01-15'),
            description: 'Unbalanced Transaction',
            lines: unbalancedLines,
          }),
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('delete', () => {
    it('should remove journal entry', async () => {
      journalEntryRepository.findOne.mockResolvedValue(mockJournalEntry);
      journalEntryRepository.delete.mockResolvedValue({ affected: 1 } as any);

      await runWithTenant('tenant-1', () => service.delete('uuid-1'));

      expect(journalEntryRepository.delete).toHaveBeenCalledWith('uuid-1');
    });
  });
});
