import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { CurrenciesService } from './currencies.service';
import { Currency } from './currency.entity';
import { TenantsService } from '../tenants/tenants.service';

describe('CurrenciesService', () => {
  let service: CurrenciesService;
  let repository: jest.Mocked<Repository<Currency>>;

  const mockTenantService = {
    findById: jest.fn(),
    update: jest.fn(),
  };

  beforeEach(async () => {
    const mockRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CurrenciesService,
        { provide: getRepositoryToken(Currency), useValue: mockRepository },
        { provide: TenantsService, useValue: mockTenantService },
      ],
    }).compile();

    service = module.get<CurrenciesService>(CurrenciesService);
    repository = module.get(getRepositoryToken(Currency));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return an array of active currencies', async () => {
      const mockCurrencies = [
        { code: 'USD', name: 'US Dollar', is_active: true },
        { code: 'EUR', name: 'Euro', is_active: true },
      ] as Currency[];

      repository.find.mockResolvedValue(mockCurrencies);

      const result = await service.findAll();

      expect(result).toEqual(mockCurrencies);
      expect(repository.find).toHaveBeenCalledWith({
        where: { is_active: true },
        order: { code: 'ASC' },
      });
    });
  });

  describe('findByCode', () => {
    it('should return a currency when it exists', async () => {
      const mockCurrency = { code: 'USD', name: 'US Dollar', is_active: true } as Currency;

      repository.findOne.mockResolvedValue(mockCurrency);

      const result = await service.findByCode('USD');

      expect(result).toEqual(mockCurrency);
    });

    it('should throw NotFoundException when currency does not exist', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.findByCode('XXX')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create a new currency', async () => {
      const createDto = { code: 'USD', name: 'US Dollar', symbol: '$' };
      const mockCurrency = { ...createDto, is_active: true, decimal_places: 2 } as Currency;

      repository.findOne.mockResolvedValue(null);
      repository.create.mockReturnValue(mockCurrency);
      repository.save.mockResolvedValue(mockCurrency);

      const result = await service.create(createDto);

      expect(result).toEqual(mockCurrency);
      expect(repository.create).toHaveBeenCalledWith({
        ...createDto,
        decimal_places: 2,
      });
    });

    it('should throw ConflictException when currency already exists', async () => {
      const createDto = { code: 'USD', name: 'US Dollar', symbol: '$' };
      const mockCurrency = { code: 'USD', name: 'US Dollar', is_active: true } as Currency;

      repository.findOne.mockResolvedValue(mockCurrency);

      await expect(service.create(createDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    it('should update an existing currency', async () => {
      const updateDto = { name: 'US Dollars' };
      const mockCurrency = { code: 'USD', name: 'US Dollar', is_active: true } as Currency;
      const updatedCurrency = { ...mockCurrency, ...updateDto } as Currency;

      repository.findOne.mockResolvedValue(mockCurrency);
      repository.save.mockResolvedValue(updatedCurrency);

      const result = await service.update('USD', updateDto);

      expect(result).toEqual(updatedCurrency);
    });
  });

  describe('delete', () => {
    it('should soft delete a currency', async () => {
      const mockCurrency = { code: 'USD', name: 'US Dollar', is_active: true } as Currency;

      repository.findOne.mockResolvedValue(mockCurrency);
      repository.save.mockResolvedValue({ ...mockCurrency, is_active: false });

      await service.delete('USD');

      expect(repository.save).toHaveBeenCalledWith({ ...mockCurrency, is_active: false });
    });
  });

  describe('setDefault', () => {
    it('should set the default currency for a tenant', async () => {
      const mockCurrency = { code: 'USD', name: 'US Dollar', is_active: true } as Currency;
      const mockTenant = { id: 'tenant1', settings: {} } as any;

      repository.findOne.mockResolvedValue(mockCurrency);
      mockTenantService.findById.mockResolvedValue(mockTenant);
      mockTenantService.update.mockResolvedValue(mockTenant);

      const result = await service.setDefault('USD', 'tenant1', 'user1');

      expect(result).toEqual(mockCurrency);
    });
  });

  describe('validateCurrencyExists', () => {
    it('should return currency when it exists and is active', async () => {
      const mockCurrency = { code: 'USD', name: 'US Dollar', is_active: true } as Currency;
      repository.findOne.mockResolvedValue(mockCurrency);

      const result = await service.validateCurrencyExists('USD');

      expect(result).toEqual(mockCurrency);
    });

    it('should throw BadRequestException when currency not found', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.validateCurrencyExists('XXX'))
        .rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when currency is inactive', async () => {
      const mockCurrency = { code: 'USD', name: 'US Dollar', is_active: false } as Currency;
      repository.findOne.mockResolvedValue(mockCurrency);

      await expect(service.validateCurrencyExists('USD'))
        .rejects.toThrow(BadRequestException);
    });
  });

  describe('seedDefaultCurrencies', () => {
    it('should create missing currencies and update existing ones', async () => {
      jest.spyOn(service, 'findByCode')
        .mockRejectedValueOnce(new NotFoundException('USD not found')) // USD doesn't exist
        .mockResolvedValueOnce({ code: 'EUR', name: 'Old Euro', symbol: '€', decimal_places: 2 } as Currency) // EUR exists with old name
        .mockResolvedValueOnce({ code: 'GBP', name: 'British Pound', symbol: '£', decimal_places: 2 } as Currency)
        .mockResolvedValueOnce({ code: 'JPY', name: 'Japanese Yen', symbol: '¥', decimal_places: 0 } as Currency)
        .mockResolvedValueOnce({ code: 'CNY', name: 'Chinese Yuan', symbol: '¥', decimal_places: 2 } as Currency)
        .mockResolvedValueOnce({ code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$', decimal_places: 2 } as Currency)
        .mockResolvedValueOnce({ code: 'TWD', name: 'Taiwan Dollar', symbol: 'NT$', decimal_places: 2 } as Currency)
        .mockResolvedValueOnce({ code: 'KRW', name: 'South Korean Won', symbol: '₩', decimal_places: 0 } as Currency)
        .mockResolvedValueOnce({ code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', decimal_places: 2 } as Currency)
        .mockResolvedValueOnce({ code: 'AUD', name: 'Australian Dollar', symbol: 'A$', decimal_places: 2 } as Currency)
        .mockResolvedValueOnce({ code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', decimal_places: 2 } as Currency)
        .mockResolvedValueOnce({ code: 'CHF', name: 'Swiss Franc', symbol: 'Fr', decimal_places: 2 } as Currency)
        .mockResolvedValueOnce({ code: 'BTC', name: 'Bitcoin', symbol: '₿', decimal_places: 8 } as Currency)
        .mockResolvedValueOnce({ code: 'ETH', name: 'Ethereum', symbol: 'Ξ', decimal_places: 18 } as Currency);

      jest.spyOn(service, 'create').mockResolvedValue({} as Currency);
      jest.spyOn(service, 'update').mockResolvedValue({} as Currency);

      const result = await service.seedDefaultCurrencies();

      expect(service.create).toHaveBeenCalledTimes(1); // USD created
      expect(service.update).toHaveBeenCalledTimes(1); // EUR updated (has old name)
      expect(result.added).toBe(1);
      expect(result.skipped).toBe(13);
    });

    it('should not duplicate currencies that already exist with correct data', async () => {
      jest.spyOn(service, 'findByCode')
        .mockResolvedValueOnce({ code: 'USD', name: 'US Dollar', symbol: '$', decimal_places: 2, is_active: true } as Currency)
        .mockResolvedValueOnce({ code: 'EUR', name: 'Euro', symbol: '€', decimal_places: 2, is_active: true } as Currency)
        .mockResolvedValueOnce({ code: 'GBP', name: 'British Pound', symbol: '£', decimal_places: 2, is_active: true } as Currency)
        .mockResolvedValueOnce({ code: 'JPY', name: 'Japanese Yen', symbol: '¥', decimal_places: 0, is_active: true } as Currency)
        .mockResolvedValueOnce({ code: 'CNY', name: 'Chinese Yuan', symbol: '¥', decimal_places: 2, is_active: true } as Currency)
        .mockResolvedValueOnce({ code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$', decimal_places: 2, is_active: true } as Currency)
        .mockResolvedValueOnce({ code: 'TWD', name: 'Taiwan Dollar', symbol: 'NT$', decimal_places: 2, is_active: true } as Currency)
        .mockResolvedValueOnce({ code: 'KRW', name: 'South Korean Won', symbol: '₩', decimal_places: 0, is_active: true } as Currency)
        .mockResolvedValueOnce({ code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', decimal_places: 2, is_active: true } as Currency)
        .mockResolvedValueOnce({ code: 'AUD', name: 'Australian Dollar', symbol: 'A$', decimal_places: 2, is_active: true } as Currency)
        .mockResolvedValueOnce({ code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', decimal_places: 2, is_active: true } as Currency)
        .mockResolvedValueOnce({ code: 'CHF', name: 'Swiss Franc', symbol: 'Fr', decimal_places: 2, is_active: true } as Currency)
        .mockResolvedValueOnce({ code: 'BTC', name: 'Bitcoin', symbol: '₿', decimal_places: 8, is_active: true } as Currency)
        .mockResolvedValueOnce({ code: 'ETH', name: 'Ethereum', symbol: 'Ξ', decimal_places: 18, is_active: true } as Currency);

      jest.spyOn(service, 'create').mockResolvedValue({} as Currency);
      jest.spyOn(service, 'update').mockResolvedValue({} as Currency);

      const result = await service.seedDefaultCurrencies();

      expect(service.create).not.toHaveBeenCalled();
      expect(service.update).not.toHaveBeenCalled();
      expect(result.added).toBe(0);
      expect(result.skipped).toBe(14);
    });

    it('should update currencies that exist but have incorrect data', async () => {
      jest.spyOn(service, 'findByCode')
        .mockResolvedValueOnce({ code: 'USD', name: 'Old USD', symbol: '$', decimal_places: 2 } as Currency)
        .mockResolvedValueOnce({ code: 'EUR', name: 'Euro', symbol: '€', decimal_places: 2 } as Currency)
        .mockResolvedValueOnce({ code: 'GBP', name: 'British Pound', symbol: '£', decimal_places: 2 } as Currency)
        .mockResolvedValueOnce({ code: 'JPY', name: 'Japanese Yen', symbol: '¥', decimal_places: 0 } as Currency)
        .mockResolvedValueOnce({ code: 'CNY', name: 'Chinese Yuan', symbol: '¥', decimal_places: 2 } as Currency)
        .mockResolvedValueOnce({ code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$', decimal_places: 2 } as Currency)
        .mockResolvedValueOnce({ code: 'TWD', name: 'Taiwan Dollar', symbol: 'NT$', decimal_places: 2 } as Currency)
        .mockResolvedValueOnce({ code: 'KRW', name: 'South Korean Won', symbol: '₩', decimal_places: 0 } as Currency)
        .mockResolvedValueOnce({ code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', decimal_places: 2 } as Currency)
        .mockResolvedValueOnce({ code: 'AUD', name: 'Australian Dollar', symbol: 'A$', decimal_places: 2 } as Currency)
        .mockResolvedValueOnce({ code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', decimal_places: 2 } as Currency)
        .mockResolvedValueOnce({ code: 'CHF', name: 'Swiss Franc', symbol: 'Fr', decimal_places: 2 } as Currency)
        .mockResolvedValueOnce({ code: 'BTC', name: 'Bitcoin', symbol: '₿', decimal_places: 8 } as Currency)
        .mockResolvedValueOnce({ code: 'ETH', name: 'Ethereum', symbol: 'Ξ', decimal_places: 18 } as Currency);

      jest.spyOn(service, 'create').mockResolvedValue({} as Currency);
      jest.spyOn(service, 'update').mockResolvedValue({} as Currency);

      const result = await service.seedDefaultCurrencies();

      expect(service.update).toHaveBeenCalledTimes(1); // USD updated
      expect(service.create).not.toHaveBeenCalled();
      expect(result.added).toBe(0);
      expect(result.skipped).toBe(14);
    });
  });
});
