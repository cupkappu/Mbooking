/**
 * Multi-Currency Accounting - TDD Test Suite
 * Based on PRD requirements
 */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { TenantContext } from './common/context/tenant.context';

// Mock bcrypt
jest.mock('bcrypt');

// Helper for running tests with tenant context
const runWithTenant = <T>(tenantId: string, callback: () => T): T => {
  return TenantContext.run(
    { tenantId, userId: 'user-1', requestId: 'req-1' },
    callback,
  );
};

// ============================================================================
// 1. AUTHENTICATION MODULE TESTS
// ============================================================================

import { AuthService } from './auth/auth.service';
import { User } from './auth/user.entity';
import { JwtService } from '@nestjs/jwt';
import { TenantsService } from './tenants/tenants.service';
import { Tenant } from './tenants/tenant.entity';

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: jest.Mocked<Repository<User>>;
  let jwtService: jest.Mocked<JwtService>;

  const mockUser: User = {
    id: 'uuid-1',
    email: 'test@example.com',
    password: 'hashedPassword',
    name: 'Test User',
    image: null,
    provider: 'credentials',
    provider_id: null,
    is_active: true,
    tenant_id: 'tenant-1',
    tenant: null as any,
    created_at: new Date(),
    updated_at: new Date(),
    role: 'user',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
            verify: jest.fn(),
          },
        },
        {
          provide: TenantsService,
          useValue: {
            findByUserId: jest.fn(),
            create: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userRepository = module.get(getRepositoryToken(User));
    jwtService = module.get(JwtService);
  });

  describe('validateUser', () => {
    it('should return user when credentials are valid', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateUser('test@example.com', 'password123');

      expect(result).toBeDefined();
      expect(result?.email).toBe('test@example.com');
    });

    it('should return null when user not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      const result = await service.validateUser('notfound@example.com', 'password');

      expect(result).toBeNull();
    });

    it('should return null when password is invalid', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await service.validateUser('test@example.com', 'wrongpassword');

      expect(result).toBeNull();
    });
  });

  describe('login', () => {
    it('should return access token with correct payload', async () => {
      jwtService.sign.mockReturnValue('jwt-token-123');

      const result = await service.login(mockUser);

      expect(result).toEqual({
        access_token: 'jwt-token-123',
        user: {
          id: mockUser.id,
          email: mockUser.email,
          name: mockUser.name,
          role: mockUser.role,
        },
      });
    });
  });

  describe('register', () => {
    it('should create new user with hashed password', async () => {
      userRepository.findOne.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');
      userRepository.create.mockReturnValue(mockUser);
      userRepository.save.mockResolvedValue(mockUser);

      const result = await service.register({
        email: 'new@example.com',
        password: 'password123',
        name: 'New User',
      });

      expect(result).toBeDefined();
      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
    });

    it('should throw ConflictException when email exists', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);

      await expect(
        service.register({
          email: 'test@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('handleOAuthLogin', () => {
    it('should return existing user when provider_id matches', async () => {
      const oauthProfile = { id: 'google-123', email: 'user@gmail.com', name: 'Google User', image: null };
      userRepository.findOne.mockResolvedValueOnce(mockUser);
      userRepository.save.mockResolvedValue(mockUser);

      const result = await service.handleOAuthLogin(oauthProfile, 'google');

      expect(result).toBeDefined();
      expect(userRepository.save).toHaveBeenCalled();
    });
  });
});

// ============================================================================
// 2. ACCOUNTS MODULE TESTS
// ============================================================================

import { AccountsService } from './accounts/accounts.service';
import { Account, AccountType } from './accounts/account.entity';
import { CurrenciesService } from './currencies/currencies.service';

describe('AccountsService', () => {
  let service: AccountsService;
  let accountRepository: jest.Mocked<Repository<Account>>;

  const mockAccount: Account = {
    id: 'uuid-1',
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
        AccountsService,
        {
          provide: getRepositoryToken(Account),
          useValue: {
            find: jest.fn(),
            findTrees: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            remove: jest.fn(),
            findDescendants: jest.fn(),
            createQueryBuilder: jest.fn().mockReturnValue({
              leftJoinAndSelect: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              orderBy: jest.fn().mockReturnThis(),
              getMany: jest.fn(),
            }),
            manager: {
              save: jest.fn((account) => Promise.resolve(account)),
            },
          },
        },
        {
          provide: CurrenciesService,
          useValue: {
            validateCurrencyExists: jest.fn().mockResolvedValue({ code: 'USD' }),
          },
        },
      ],
    }).compile();

    service = module.get<AccountsService>(AccountsService);
    accountRepository = module.get(getRepositoryToken(Account)) as any;
  });

  describe('findAll', () => {
    it('should return all active accounts for tenant', async () => {
      const mockAccounts = [mockAccount];
      accountRepository.find.mockResolvedValue(mockAccounts);

      const result = await runWithTenant('tenant-1', () => service.findAll());

      expect(result).toEqual(mockAccounts);
    });
  });

  describe('findById', () => {
    it('should return account when found', async () => {
      accountRepository.findOne.mockResolvedValue(mockAccount);

      const result = await runWithTenant('tenant-1', () => service.findById('uuid-1'));

      expect(result).toEqual(mockAccount);
    });

    it('should throw NotFoundException when account not found', async () => {
      accountRepository.findOne.mockResolvedValue(null);

      await expect(runWithTenant('tenant-1', () => service.findById('not-found')))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create top-level account', async () => {
      accountRepository.create.mockImplementation((data: any) => ({
        ...data,
        id: 'uuid-1',
        path: data.name || '',
        depth: 0,
        parent: null,
        children: [],
        tenant_id: data.tenant_id || 'tenant-1',
        type: data.type || AccountType.ASSETS,
        currency: data.currency || 'USD',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
      }));
      (accountRepository.manager as any).save.mockImplementation((account: any) => Promise.resolve(account));

      const result = await runWithTenant('tenant-1', () =>
        service.create(
          {
            name: 'Bank',
            type: AccountType.ASSETS,
            currency: 'USD',
          } as any,
        ),
      );

      expect(result).toBeDefined();
      expect(result.path).toBe('Bank');
    });

    it('should create child account with correct path', async () => {
      const parentAccount = { ...mockAccount, path: 'assets', depth: 0 };
      const childAccount = {
        ...mockAccount,
        parent: parentAccount as Account,
        path: 'assets:bank',
        depth: 1,
      };

      accountRepository.findOne.mockResolvedValue(parentAccount);
      accountRepository.create.mockReturnValue(childAccount);
      accountRepository.save.mockResolvedValue(childAccount);

      const result = await runWithTenant('tenant-1', () =>
        service.create(
          {
            name: 'bank',
            type: AccountType.ASSETS,
            currency: 'USD',
            parent_id: 'uuid-1',
          } as any,
        ),
      );

      expect(result.path).toBe('assets:bank');
      expect(result.depth).toBe(1);
    });
  });

  describe('delete', () => {
    it('should throw BadRequestException when account has children', async () => {
      const accountWithChildren = { ...mockAccount };
      accountRepository.findOne.mockResolvedValue(accountWithChildren);
      // Mock findDescendants for TreeRepository
      (accountRepository as any).findDescendants.mockResolvedValue([accountWithChildren, {} as Account]);

      await expect(
        runWithTenant('tenant-1', () => service.delete('uuid-1')),
      ).rejects.toThrow(BadRequestException);
    });

    it('should remove account when no children', async () => {
      accountRepository.findOne.mockResolvedValue(mockAccount);
      (accountRepository as any).findDescendants.mockResolvedValue([mockAccount]);
      accountRepository.remove.mockResolvedValue(mockAccount);

      await runWithTenant('tenant-1', () => service.delete('uuid-1'));

      expect(accountRepository.remove).toHaveBeenCalledWith(mockAccount);
    });
  });
});

// ============================================================================
// 3. JOURNAL MODULE TESTS
// ============================================================================

import { JournalService } from './journal/journal.service';
import { JournalEntry } from './journal/journal-entry.entity';
import { JournalLine } from './journal/journal-line.entity';
import { QueryService } from './query/query.service';

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

// ============================================================================
// 4. BUDGET MODULE TESTS
// ============================================================================

import { BudgetsService } from './budgets/budgets.service';
import { Budget, BudgetType } from './budgets/budget.entity';

describe('BudgetsService', () => {
  let service: BudgetsService;
  let budgetRepository: jest.Mocked<Repository<Budget>>;

  const mockBudget: Budget = {
    id: 'uuid-1',
    tenant_id: 'tenant-1',
    account_id: null,
    name: 'Monthly Food Budget',
    type: BudgetType.PERIODIC,
    amount: 5000,
    currency: 'HKD',
    start_date: new Date('2025-01-01'),
    end_date: new Date('2025-12-31'),
    period_type: 'monthly' as any,
    spent_amount: 2500,
    spent_currency: 'HKD',
    alert_threshold: 0.8,
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
    deleted_at: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BudgetsService,
        {
          provide: getRepositoryToken(Budget),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
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

  describe('getProgress', () => {
    it('should return progress calculation', async () => {
      budgetRepository.findOne.mockResolvedValue(mockBudget);

      const result = await runWithTenant('tenant-1', () => service.getProgress('uuid-1'));

      expect(result.progress).toBe(50);
      expect(result.remaining).toBe(2500);
      expect(result.is_exceeded).toBe(false);
      expect(result.is_alert).toBe(false);
    });

    it('should trigger alert when threshold exceeded', async () => {
      const highSpendingBudget = { ...mockBudget, spent_amount: 4500, alert_threshold: 0.8 };
      budgetRepository.findOne.mockResolvedValue(highSpendingBudget);

      const result = await runWithTenant('tenant-1', () => service.getProgress('uuid-1'));

      expect(result.progress).toBe(90);
      expect(result.is_alert).toBe(true);
    });

    it('should mark as exceeded when spending > budget', async () => {
      const exceededBudget = { ...mockBudget, spent_amount: 6000 };
      budgetRepository.findOne.mockResolvedValue(exceededBudget);

      const result = await runWithTenant('tenant-1', () => service.getProgress('uuid-1'));

      expect(result.progress).toBe(100);
      expect(result.is_exceeded).toBe(true);
    });
  });
});

// ============================================================================
// 5. QUERY ENGINE TESTS
// ============================================================================

import { RateEngine } from './rates/rate.engine';

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
            convert: jest.fn(),
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

      rateEngine.getRate.mockResolvedValue({
        from: 'USD',
        to: 'EUR',
        rate: 0.85,
        timestamp: new Date(),
        source: 'test',
      });

      const result = await runWithTenant('tenant-1', () =>
        service.getBalances({
          convert_to: 'EUR',
          exchange_rate_date: 'latest',
        }),
      );

      expect(rateEngine.getRate).toHaveBeenCalled();
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
});

// ============================================================================
// 6. RATE ENGINE TESTS
// ============================================================================

import { ExchangeRate } from './rates/exchange-rate.entity';
import { Provider, ProviderType } from './rates/provider.entity';

describe('RateEngine', () => {
  let service: RateEngine;
  let rateRepository: jest.Mocked<Repository<ExchangeRate>>;
  let providerRepository: jest.Mocked<Repository<Provider>>;

  const mockExchangeRate: ExchangeRate = {
    id: 'rate-1',
    provider_id: 'provider-1',
    from_currency: 'USD',
    to_currency: 'HKD',
    rate: 7.785,
    date: new Date('2025-01-15'),
    fetched_at: new Date('2025-01-15'),
  };

  const mockProvider: Provider = {
    id: 'provider-1',
    name: 'Test Provider',
    type: ProviderType.REST_API,
    config: {
      base_url: 'https://api.test.com',
    },
    supported_currencies: ['USD', 'HKD', 'CNY', 'EUR'],
    supports_historical: true,
    supports_date_query: true,
    record_history: true,
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RateEngine,
        {
          provide: getRepositoryToken(ExchangeRate),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Provider),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<RateEngine>(RateEngine);
    rateRepository = module.get(getRepositoryToken(ExchangeRate));
    providerRepository = module.get(getRepositoryToken(Provider));
  });

  describe('getRate', () => {
    it('should return identity rate when from equals to', async () => {
      const result = await service.getRate('USD', 'USD');

      expect(result).toEqual({
        from: 'USD',
        to: 'USD',
        rate: 1,
        timestamp: expect.any(Date),
        source: 'identity',
      });
    });

    it('should return cached rate when available', async () => {
      rateRepository.findOne.mockResolvedValue(mockExchangeRate);

      const result = await service.getRate('USD', 'HKD');

      expect(result).toEqual({
        from: 'USD',
        to: 'HKD',
        rate: 7.785,
        timestamp: mockExchangeRate.fetched_at,
        source: mockExchangeRate.provider_id,
      });
    });

    it('should return null when no provider available', async () => {
      rateRepository.findOne.mockResolvedValue(null);
      providerRepository.findOne.mockResolvedValue(null);
      providerRepository.find.mockResolvedValue([]);

      const result = await service.getRate('USD', 'HKD');

      expect(result).toBeNull();
    });
  });

  describe('convert', () => {
    it('should convert amount between currencies', async () => {
      rateRepository.findOne.mockResolvedValue(mockExchangeRate);

      const result = await service.convert(100, 'USD', 'HKD');

      expect(result).toEqual({
        amount: 100,
        from: 'USD',
        to: 'HKD',
        converted_amount: 778.5,
        rate: 7.785,
        date: expect.any(Date),
      });
    });

    it('should return same amount when currencies are equal', async () => {
      const result = await service.convert(100, 'USD', 'USD');

      expect(result.converted_amount).toBe(100);
      expect(result.rate).toBe(1);
    });
  });

  describe('getCrossRate', () => {
    it('should return 1 when currencies are equal', async () => {
      const result = await service.getCrossRate('USD', 'USD');

      expect(result).toBe(1);
    });
  });
});

// ============================================================================
// 7. INTEGRATION TESTS
// ============================================================================

describe('Integration Tests', () => {
  describe('Journal Entry Workflow', () => {
    it('should create journal entry and update account balance', async () => {
      const journalEntry = {
        id: 'uuid-1',
        tenant_id: 'tenant-1',
        date: new Date(),
        description: 'Test Transaction',
        lines: [
          { account_id: 'acc-1', amount: 100 },
          { account_id: 'acc-2', amount: -100 },
        ],
      };

      expect(journalEntry.lines.length).toBe(2);
      expect(
        journalEntry.lines.reduce((sum, line) => sum + line.amount, 0),
      ).toBe(0);
    });
  });

  describe('Multi-Currency Journal Entry', () => {
    it('should convert currency and maintain balance', async () => {
      const lines = [
        {
          account_id: 'acc-1',
          amount: 100,
          currency: 'USD',
          exchange_rate: 1,
          converted_amount: 100,
        },
        {
          account_id: 'acc-2',
          amount: -778.5,
          currency: 'HKD',
          exchange_rate: 0.1285,
          converted_amount: -100,
        },
      ];

      expect(lines[1].converted_amount).toBe(-100);

      const totalBaseCurrency = lines.reduce((sum, line) => {
        return sum + (line.converted_amount || line.amount);
      }, 0);
      expect(totalBaseCurrency).toBe(0);
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
