import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { CurrencyManagementService } from './currency-management.service';
import { Currency } from '../../currencies/currency.entity';
import { CurrenciesService } from '../../currencies/currencies.service';
import { AuditEventPublisher } from '../events/audit-event-publisher.service';

describe('CurrencyManagementService', () => {
  let service: CurrencyManagementService;
  let currencyRepository: jest.Mocked<Repository<Currency>>;
  let currenciesService: jest.Mocked<CurrenciesService>;
  let eventPublisher: jest.Mocked<AuditEventPublisher>;

  const mockCurrency: Currency = {
    code: 'USD',
    name: 'US Dollar',
    symbol: '$',
    decimal_places: 2,
    is_active: true,
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-01'),
    deleted_at: null,
  };

  beforeEach(async () => {
    const mockCurrencyRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      findAndCount: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    const mockCurrenciesService = {
      findByCode: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      seedDefaultCurrencies: jest.fn(),
    };

    const mockEventPublisher = {
      publish: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CurrencyManagementService,
        { provide: getRepositoryToken(Currency), useValue: mockCurrencyRepo },
        { provide: CurrenciesService, useValue: mockCurrenciesService },
        { provide: AuditEventPublisher, useValue: mockEventPublisher },
      ],
    }).compile();

    service = module.get<CurrencyManagementService>(CurrencyManagementService);
    currencyRepository = module.get(getRepositoryToken(Currency));
    currenciesService = module.get(CurrenciesService);
    eventPublisher = module.get(AuditEventPublisher);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('listCurrencies', () => {
    it('should return paginated currencies', async () => {
      const mockCurrencies = [mockCurrency];
      currencyRepository.findAndCount.mockResolvedValue([mockCurrencies, 1]);

      const result = await service.listCurrencies({ offset: 0, limit: 50 });

      expect(result.currencies).toEqual(mockCurrencies);
      expect(result.total).toBe(1);
      expect(currencyRepository.findAndCount).toHaveBeenCalledWith({
        skip: 0,
        take: 50,
        order: { code: 'ASC' },
      });
    });

    it('should use default pagination when options not provided', async () => {
      currencyRepository.findAndCount.mockResolvedValue([[], 0]);

      await service.listCurrencies();

      expect(currencyRepository.findAndCount).toHaveBeenCalledWith({
        skip: 0,
        take: 50,
        order: { code: 'ASC' },
      });
    });
  });

  describe('getAllCurrencies', () => {
    it('should return all currencies ordered by code', async () => {
      const mockCurrencies = [mockCurrency];
      currencyRepository.find.mockResolvedValue(mockCurrencies);

      const result = await service.getAllCurrencies();

      expect(result).toEqual(mockCurrencies);
      expect(currencyRepository.find).toHaveBeenCalledWith({
        order: { code: 'ASC' },
      });
    });
  });

  describe('getCurrency', () => {
    it('should return currency by code', async () => {
      currenciesService.findByCode.mockResolvedValue(mockCurrency);

      const result = await service.getCurrency('USD', 'admin-uuid', '127.0.0.1');

      expect(result).toEqual(mockCurrency);
      expect(currenciesService.findByCode).toHaveBeenCalledWith('USD');
    });

    it('should throw NotFoundException if currency not found', async () => {
      currenciesService.findByCode.mockRejectedValue(new NotFoundException('Currency not found'));

      await expect(service.getCurrency('XXX', 'admin-uuid')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createCurrency', () => {
    it('should create currency', async () => {
      const createData = { code: 'EUR', name: 'Euro', symbol: '€', decimal_places: 2 };
      currenciesService.findByCode.mockRejectedValue(new NotFoundException('Currency not found'));
      currenciesService.create.mockResolvedValue({ ...mockCurrency, code: 'EUR', name: 'Euro', symbol: '€' });

      const result = await service.createCurrency(createData, 'admin-uuid', '127.0.0.1');

      expect(result.code).toBe('EUR');
      expect(currenciesService.create).toHaveBeenCalledWith(createData);
    });

    it('should throw ConflictException if currency already exists', async () => {
      const createData = { code: 'USD', name: 'US Dollar', symbol: '$' };
      currenciesService.findByCode.mockResolvedValue(mockCurrency);

      await expect(
        service.createCurrency(createData, 'admin-uuid', '127.0.0.1'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('updateCurrency', () => {
    it('should update currency', async () => {
      const updateData = { name: 'US Dollars' };
      const updatedCurrency = { ...mockCurrency, name: 'US Dollars' };
      currenciesService.update.mockResolvedValue(updatedCurrency);

      const result = await service.updateCurrency('USD', updateData, 'admin-uuid', '127.0.0.1');

      expect(result.name).toBe('US Dollars');
      expect(currenciesService.update).toHaveBeenCalledWith('USD', updateData);
    });
  });

  describe('deleteCurrency', () => {
    it('should delete currency', async () => {
      currenciesService.delete.mockResolvedValue(undefined);

      await service.deleteCurrency('USD', 'admin-uuid', '127.0.0.1');

      expect(currenciesService.delete).toHaveBeenCalledWith('USD');
    });
  });

  describe('seedCurrencies', () => {
    it('should seed default currencies', async () => {
      const seedResult = { added: 5, skipped: 10 };
      currenciesService.seedDefaultCurrencies.mockResolvedValue(seedResult);

      const result = await service.seedCurrencies('admin-uuid', '127.0.0.1');

      expect(result).toEqual(seedResult);
      expect(currenciesService.seedDefaultCurrencies).toHaveBeenCalled();
    });
  });
});
