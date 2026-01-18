import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QueryService } from './query.service';
import { Account, AccountType } from '../accounts/account.entity';
import { JournalEntry } from '../journal/journal-entry.entity';
import { JournalLine } from '../journal/journal-line.entity';
import { RateEngine } from '../rates/rate.engine';

describe('QueryService', () => {
  let service: QueryService;
  let accountRepository: jest.Mocked<Repository<Account>>;
  let journalEntryRepository: jest.Mocked<Repository<JournalEntry>>;
  let journalLineRepository: jest.Mocked<Repository<JournalLine>>;
  let rateEngine: jest.Mocked<RateEngine>;

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
          provide: RateEngine,
          useValue: {
            getRate: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<QueryService>(QueryService);
    accountRepository = module.get(getRepositoryToken(Account));
    journalEntryRepository = module.get(getRepositoryToken(JournalEntry));
    journalLineRepository = module.get(getRepositoryToken(JournalLine));
    rateEngine = module.get(RateEngine);
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

       const result = await service.getBalances('tenant-1', {});

       expect(result.balances).toBeDefined();
       expect(result.pagination).toBeDefined();
       expect(result.meta.cache_hit).toBe(false);
     });

     it('should use cache when available', async () => {
       const cachedResult = {
         balances: [],
         pagination: { offset: 0, limit: 50, total: 0, has_more: false },
         meta: { cache_hit: false, calculated_at: new Date().toISOString() },
       };

       jest.spyOn(service as any, 'getFromCache').mockReturnValue(cachedResult);

       accountRepository.find.mockResolvedValue([]);

       const result = await service.getBalances('tenant-1', { use_cache: true });

       expect(result.meta.cache_hit).toBe(true);
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

       rateEngine.getRate.mockResolvedValue({
         from: 'USD',
         to: 'EUR',
         rate: 0.85,
         timestamp: new Date(),
         source: 'test',
       });

       const result = await service.getBalances('tenant-1', {
         convert_to: 'EUR',
         exchange_rate_date: 'latest',
       });

       expect(rateEngine.getRate).toHaveBeenCalled();
     });

     it('should include subtree balances when include_subtree is true', async () => {
       const accountWithChildren = { ...mockAccount, id: 'parent-1', path: 'assets:checking' };
       accountRepository.find.mockResolvedValue([accountWithChildren]);
       accountRepository.findOne.mockResolvedValue(accountWithChildren);
       accountRepository.createQueryBuilder.mockReturnValue({
         where: jest.fn().mockReturnThis(),
         getMany: jest.fn().mockResolvedValue([
           { ...mockAccount, id: 'child-1', path: 'assets:checking:savings' },
         ]),
       } as any);

       const mockQueryBuilder = {
         select: jest.fn().mockReturnThis(),
         where: jest.fn().mockReturnThis(),
         innerJoin: jest.fn().mockReturnThis(),
         andWhere: jest.fn().mockReturnThis(),
         groupBy: jest.fn().mockReturnThis(),
         getRawMany: jest.fn().mockResolvedValue([
           { line_currency: 'USD', total: '100.00' },
         ]),
       };
       journalLineRepository.createQueryBuilder.mockImplementation(() => mockQueryBuilder as any);

       const result = await service.getBalances('tenant-1', {
         include_subtree: true,
       });

       expect(result.balances).toBeDefined();
       expect(result.balances[0]).toHaveProperty('subtree_currencies');
       expect(Array.isArray(result.balances[0].subtree_currencies)).toBe(true);
     });

     it('should calculate subtree balances for specific accounts when subtree_account_ids provided', async () => {
       const accountWithChildren = { ...mockAccount, id: 'parent-1', path: 'assets:checking' };
       accountRepository.find.mockResolvedValue([accountWithChildren]);
       accountRepository.findOne.mockResolvedValue(accountWithChildren);
       accountRepository.createQueryBuilder.mockReturnValue({
         where: jest.fn().mockReturnThis(),
         getMany: jest.fn().mockResolvedValue([
           { ...mockAccount, id: 'child-1', path: 'assets:checking:savings' },
         ]),
       } as any);

       const mockQueryBuilder = {
         select: jest.fn().mockReturnThis(),
         where: jest.fn().mockReturnThis(),
         innerJoin: jest.fn().mockReturnThis(),
         andWhere: jest.fn().mockReturnThis(),
         groupBy: jest.fn().mockReturnThis(),
         getRawMany: jest.fn().mockResolvedValue([
           { line_currency: 'USD', total: '100.00' },
         ]),
       };
       journalLineRepository.createQueryBuilder.mockImplementation(() => mockQueryBuilder as any);

       const result = await service.getBalances('tenant-1', {
         include_subtree: true,
         subtree_account_ids: ['parent-1'],
       });

       expect(result.balances).toBeDefined();
       // Only the parent account should have subtree_currencies if it's in subtree_account_ids
       const targetAccount = result.balances.find(b => b.account.id === 'parent-1');
       expect(targetAccount).toHaveProperty('subtree_currencies');
     });

     it('should convert subtree balances when convert_to is specified', async () => {
       const accountWithChildren = { ...mockAccount, id: 'parent-1', path: 'assets:checking' };
       accountRepository.find.mockResolvedValue([accountWithChildren]);
       accountRepository.findOne.mockResolvedValue(accountWithChildren);
       accountRepository.createQueryBuilder.mockReturnValue({
         where: jest.fn().mockReturnThis(),
         getMany: jest.fn().mockResolvedValue([
           { ...mockAccount, id: 'child-1', path: 'assets:checking:savings' },
         ]),
       } as any);

       const mockQueryBuilder = {
         select: jest.fn().mockReturnThis(),
         where: jest.fn().mockReturnThis(),
         innerJoin: jest.fn().mockReturnThis(),
         andWhere: jest.fn().mockReturnThis(),
         groupBy: jest.fn().mockReturnThis(),
         getRawMany: jest.fn().mockResolvedValue([
           { line_currency: 'USD', total: '100.00' },
         ]),
       };
       journalLineRepository.createQueryBuilder.mockImplementation(() => mockQueryBuilder as any);

       rateEngine.getRate.mockResolvedValue({
         from: 'USD',
         to: 'EUR',
         rate: 0.85,
         timestamp: new Date(),
         source: 'test',
       });

       const result = await service.getBalances('tenant-1', {
         include_subtree: true,
         convert_to: 'EUR',
       });

       expect(result.balances).toBeDefined();
       expect(result.balances[0]).toHaveProperty('converted_subtree_total');
       expect(result.balances[0]).toHaveProperty('converted_subtree_currency');
       expect(typeof result.balances[0].converted_subtree_total).toBe('number');
       expect(result.balances[0].converted_subtree_currency).toBe('EUR');
     });
   });

  describe('calculateSubtreeBalance', () => {
    it('should return subtree balance for single account with no children', async () => {
      const singleAccount = { ...mockAccount };
      singleAccount.id = 'acc-single';
      
      accountRepository.findOne.mockResolvedValue(singleAccount);
      accountRepository.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      } as any);

      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          { line_currency: 'USD', total: '100.00' },
        ]),
      };
      journalLineRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service.calculateSubtreeBalance('acc-single');

      expect(result).toEqual([
        { currency: 'USD', amount: 100.00 },
      ]);
    });

    it('should return subtree balance including children accounts', async () => {
      accountRepository.findOne.mockResolvedValue({ ...mockAccount, id: 'parent-1', path: 'assets:checking' });
      accountRepository.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          { ...mockAccount, id: 'child-1', path: 'assets:checking:savings' },
          { ...mockAccount, id: 'child-2', path: 'assets:checking:current' },
        ]),
      } as any);

      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          { line_currency: 'USD', total: '100.00' },
        ]),
      };
      journalLineRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service.calculateSubtreeBalance('parent-1');

      expect(journalLineRepository.createQueryBuilder).toHaveBeenCalledTimes(3);
      expect(result).toBeDefined();
    });

    it('should correctly merge multi-currency balances from all accounts', async () => {
      accountRepository.findOne.mockResolvedValue({ ...mockAccount, id: 'parent-1', path: 'assets:checking' });
      accountRepository.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          { ...mockAccount, id: 'child-1', path: 'assets:checking:savings' },
        ]),
      } as any);

      let callCount = 0;
      const mockQueryBuilderFactory = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return {
            select: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            groupBy: jest.fn().mockReturnThis(),
            getRawMany: jest.fn().mockResolvedValue([
              { line_currency: 'USD', total: '100.00' },
            ]),
          };
        } else {
          return {
            select: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            groupBy: jest.fn().mockReturnThis(),
            getRawMany: jest.fn().mockResolvedValue([
              { line_currency: 'EUR', total: '50.00' },
            ]),
          };
        }
      });
      journalLineRepository.createQueryBuilder.mockImplementation(mockQueryBuilderFactory);

      const result = await service.calculateSubtreeBalance('parent-1');

      expect(result.some(b => b.currency === 'USD')).toBe(true);
      expect(result.some(b => b.currency === 'EUR')).toBe(true);
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

      const result = await service.getJournalEntries('tenant-1', {
        pagination: { offset: 0, limit: 10 },
      });

      expect(result.entries).toEqual(mockEntries);
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.has_more).toBe(false);
    });

    it('should apply date range filter', async () => {
      journalEntryRepository.findAndCount.mockResolvedValue([[], 0]);

      await service.getJournalEntries('tenant-1', {
        date_range: { from: '2025-01-01', to: '2025-12-31' },
      });

      expect(journalEntryRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenant_id: 'tenant-1',
          }),
        }),
      );
    });
  });
});
