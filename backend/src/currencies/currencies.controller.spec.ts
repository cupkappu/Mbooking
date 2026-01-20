import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CurrenciesController } from './currencies.controller';
import { CurrenciesService } from './currencies.service';
import { Currency } from './currency.entity';
import { TenantsService } from '../tenants/tenants.service';

describe('CurrenciesController', () => {
  let controller: CurrenciesController;
  let service: CurrenciesService;

  const mockCurrency: Currency = {
    code: 'USD',
    name: 'US Dollar',
    symbol: '$',
    decimal_places: 2,
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
    deleted_at: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CurrenciesController],
      providers: [
        CurrenciesService,
        {
          provide: getRepositoryToken(Currency),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: TenantsService,
          useValue: {
            findById: jest.fn(),
            update: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<CurrenciesController>(CurrenciesController);
    service = module.get<CurrenciesService>(CurrenciesService);
  });

  describe('findAll', () => {
    it('should return active currencies for any authenticated user', async () => {
      const mockCurrencies = [
        { code: 'USD', name: 'US Dollar', symbol: '$', decimal_places: 2, is_active: true },
        { code: 'EUR', name: 'Euro', symbol: '€', decimal_places: 2, is_active: true },
      ];
      jest.spyOn(service, 'findAll').mockResolvedValue(mockCurrencies as any);

      const result = await controller.findAll();

      expect(result).toEqual(mockCurrencies);
      expect(service.findAll).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return currency by code', async () => {
      const mockCurrency = { code: 'USD', name: 'US Dollar', symbol: '$', decimal_places: 2, is_active: true };
      jest.spyOn(service, 'findByCode').mockResolvedValue(mockCurrency as any);

      const result = await controller.findOne('USD');

      expect(result).toEqual(mockCurrency);
      expect(service.findByCode).toHaveBeenCalledWith('USD');
    });
  });

  it('should NOT have create method', () => {
    expect((controller as any).create).toBeUndefined();
  });

  it('should NOT have update method', () => {
    expect((controller as any).update).toBeUndefined();
  });

  it('should NOT have delete method', () => {
    expect((controller as any).delete).toBeUndefined();
  });

  it('should NOT have setDefault method', () => {
    expect((controller as any).setDefault).toBeUndefined();
  });

  it('should NOT have seed method', () => {
    expect((controller as any).seed).toBeUndefined();
  });
});
