import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { CurrenciesController } from './currencies.controller';
import { CurrenciesService } from './currencies.service';
import { Currency } from './currency.entity';
import { TenantsService } from '../tenants/tenants.service';

describe('CurrenciesController', () => {
  let controller: CurrenciesController;
  let service: CurrenciesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CurrenciesController],
      providers: [
        CurrenciesService,
        {
          provide: getRepositoryToken(Currency),
          useValue: {},
        },
        {
          provide: TenantsService,
          useValue: {},
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
      const mockCurrencyResult = { code: 'USD', name: 'US Dollar', symbol: '$', decimal_places: 2, is_active: true };
      jest.spyOn(service, 'findByCode').mockResolvedValue(mockCurrencyResult as any);

      const result = await controller.findOne('USD');

      expect(result).toEqual(mockCurrencyResult);
      expect(service.findByCode).toHaveBeenCalledWith('USD');
    });

    it('should throw NotFoundException for non-existent currency', async () => {
      jest.spyOn(service, 'findByCode').mockRejectedValue(new NotFoundException('Currency with code XYZ not found'));

      await expect(controller.findOne('XYZ')).rejects.toThrow(NotFoundException);
    });
  });

  describe('should NOT have methods', () => {
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
});
