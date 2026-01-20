import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AuditLog } from './entities/audit-log.entity';
import { User } from '../auth/user.entity';
import { Account } from '../accounts/account.entity';
import { JournalEntry } from '../journal/journal-entry.entity';
import { JournalLine } from '../journal/journal-line.entity';
import { Currency } from '../currencies/currency.entity';
import { ExchangeRate } from '../rates/exchange-rate.entity';
import { Budget } from '../budgets/budget.entity';
import { Provider } from '../rates/provider.entity';
import { CurrenciesService } from '../currencies/currencies.service';

describe('AdminService', () => {
  let service: AdminService;
  let auditLogRepository: jest.Mocked<Repository<AuditLog>>;
  let currencyRepository: jest.Mocked<Repository<Currency>>;
  let currenciesService: jest.Mocked<CurrenciesService>;

  beforeEach(async () => {
    const mockAuditLogRepo = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      findAndCount: jest.fn(),
      createQueryBuilder: jest.fn(),
      remove: jest.fn(),
      query: jest.fn(),
    };

    const mockUserRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    const mockAccountRepo = {
      find: jest.fn(),
    };

    const mockJournalEntryRepo = {
      find: jest.fn(),
    };

    const mockJournalLineRepo = {
      find: jest.fn(),
    };

    const mockExchangeRateRepo = {
      find: jest.fn(),
    };

    const mockBudgetRepo = {
      find: jest.fn(),
    };

    const mockProviderRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
    };

    const mockCurrencyRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    currenciesService = {
      findByCode: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      seedDefaultCurrencies: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: getRepositoryToken(AuditLog), useValue: mockAuditLogRepo },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: getRepositoryToken(Account), useValue: mockAccountRepo },
        { provide: getRepositoryToken(JournalEntry), useValue: mockJournalEntryRepo },
        { provide: getRepositoryToken(JournalLine), useValue: mockJournalLineRepo },
        { provide: getRepositoryToken(Currency), useValue: mockCurrencyRepo },
        { provide: getRepositoryToken(ExchangeRate), useValue: mockExchangeRateRepo },
        { provide: getRepositoryToken(Budget), useValue: mockBudgetRepo },
        { provide: getRepositoryToken(Provider), useValue: mockProviderRepo },
        { provide: CurrenciesService, useValue: currenciesService },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
    auditLogRepository = module.get(getRepositoryToken(AuditLog));
    currencyRepository = module.get(getRepositoryToken(Currency));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Currency Management', () => {
    const mockAdminId = 'admin-uuid';
    const mockIp = '127.0.0.1';

    beforeEach(async () => {
      jest.clearAllMocks();
    });

    describe('createCurrency', () => {
      it('should create currency with audit logging', async () => {
        const dto = { code: 'AAPL', name: 'Apple Inc.', symbol: '$', decimal_places: 2 };
        const mockCurrency = {
          code: 'AAPL',
          name: 'Apple Inc.',
          symbol: '$',
          decimal_places: 2,
          is_active: true,
        } as unknown as Currency;

        currenciesService.findByCode.mockRejectedValue(new NotFoundException());
        currenciesService.create.mockResolvedValue(mockCurrency);
        auditLogRepository.create.mockReturnValue({} as AuditLog);
        auditLogRepository.save.mockResolvedValue({} as AuditLog);

        const result = await service.createCurrency(dto, mockAdminId, mockIp);

        expect(result.code).toBe('AAPL');
        expect(currenciesService.create).toHaveBeenCalledWith(dto);
        expect(auditLogRepository.save).toHaveBeenCalled();
      });

      it('should throw ConflictException if currency exists', async () => {
        const dto = { code: 'USD', name: 'US Dollar', symbol: '$', decimal_places: 2 };
        const mockCurrency = { code: 'USD', name: 'US Dollar' } as Currency;

        currenciesService.findByCode.mockResolvedValue(mockCurrency);

        await expect(service.createCurrency(dto, mockAdminId, mockIp))
          .rejects.toThrow(ConflictException);
      });
    });

    describe('updateCurrency', () => {
      it('should update currency with audit logging', async () => {
        const code = 'USD';
        const dto = { name: 'US Dollar Updated' };
        const mockCurrency = { code: 'USD', name: 'US Dollar', symbol: '$' } as Currency;
        const updatedCurrency = { ...mockCurrency, ...dto } as Currency;

        currenciesService.update.mockResolvedValue(updatedCurrency);
        auditLogRepository.create.mockReturnValue({} as AuditLog);
        auditLogRepository.save.mockResolvedValue({} as AuditLog);

        const result = await service.updateCurrency(code, dto, mockAdminId, mockIp);

        expect(result.name).toBe('US Dollar Updated');
        expect(currenciesService.update).toHaveBeenCalledWith(code, dto);
        expect(auditLogRepository.save).toHaveBeenCalled();
      });
    });

    describe('deleteCurrency', () => {
      it('should soft delete currency with audit logging', async () => {
        const code = 'USD';

        currenciesService.delete.mockResolvedValue(undefined);
        auditLogRepository.create.mockReturnValue({} as AuditLog);
        auditLogRepository.save.mockResolvedValue({} as AuditLog);

        await service.deleteCurrency(code, mockAdminId, mockIp);

        expect(currenciesService.delete).toHaveBeenCalledWith(code);
        expect(auditLogRepository.save).toHaveBeenCalled();
      });
    });

    describe('seedCurrencies', () => {
      it('should seed currencies and log action', async () => {
        const seedResult = { added: 14, skipped: 0 };

        currenciesService.seedDefaultCurrencies.mockResolvedValue(seedResult);
        auditLogRepository.create.mockReturnValue({} as AuditLog);
        auditLogRepository.save.mockResolvedValue({} as AuditLog);

        const result = await service.seedCurrencies(mockAdminId, mockIp);

        expect(currenciesService.seedDefaultCurrencies).toHaveBeenCalled();
        expect(auditLogRepository.save).toHaveBeenCalled();
        expect(result).toEqual(seedResult);
      });
    });

    describe('getAllCurrencies', () => {
      it('should return all currencies including inactive', async () => {
        const mockCurrencies = [
          { code: 'USD', name: 'US Dollar', is_active: true },
          { code: 'XXX', name: 'Deleted Currency', is_active: false },
        ] as Currency[];

        currencyRepository.find.mockResolvedValue(mockCurrencies);

        const result = await service.getAllCurrencies();

        expect(result).toEqual(mockCurrencies);
        expect(currencyRepository.find).toHaveBeenCalledWith({
          order: { code: 'ASC' },
        });
      });
    });
  });
});
