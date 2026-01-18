import { Test, TestingModule } from '@nestjs/testing';
import {getRepositoryToken} from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantsService } from './tenants.service';
import { Tenant } from './tenant.entity';
import { NotFoundException } from '@nestjs/common';

describe('TenantsService', () => {
  let service: TenantsService;
  let repository: Repository<Tenant>;

  const mockTenant = {
    id: 'test-id',
    user_id: 'user-123',
    name: 'Test Tenant',
    settings: {
      default_currency: 'USD',
      timezone: 'UTC',
    },
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockTenantRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantsService,
        {
          provide: getRepositoryToken(Tenant),
          useValue: mockTenantRepository,
        },
      ],
    }).compile();

    service = module.get<TenantsService>(TenantsService);
    repository = module.get<Repository<Tenant>>(getRepositoryToken(Tenant));
  });

  describe('findByUserId', () => {
    it('should return a tenant when found', async () => {
      mockTenantRepository.findOne.mockResolvedValue(mockTenant);

      const result = await service.findByUserId('user-123');
      
      expect(result).toEqual(mockTenant);
      expect(repository.findOne).toHaveBeenCalledWith({ where: { user_id: 'user-123' } });
    });

    it('should throw NotFoundException when tenant not found', async () => {
      mockTenantRepository.findOne.mockResolvedValue(null);

      await expect(service.findByUserId('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findById', () => {
    it('should return a tenant when found', async () => {
      mockTenantRepository.findOne.mockResolvedValue(mockTenant);

      const result = await service.findById('test-id');
      
      expect(result).toEqual(mockTenant);
      expect(repository.findOne).toHaveBeenCalledWith({ where: { id: 'test-id' } });
    });

    it('should throw NotFoundException when tenant not found', async () => {
      mockTenantRepository.findOne.mockResolvedValue(null);

      await expect(service.findById('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update tenant without modifying settings when no settings provided', async () => {
      mockTenantRepository.findOne.mockResolvedValue(mockTenant);
      mockTenantRepository.update.mockResolvedValue(undefined);

      const updateData = { name: 'Updated Name' };
      await service.update('test-id', updateData);

      expect(repository.update).toHaveBeenCalledWith('test-id', updateData);
    });

    it('should merge settings when updating settings partially', async () => {
      const existingTenant = { ...mockTenant, settings: { default_currency: 'USD', timezone: 'UTC', other_setting: 'value' } };
      mockTenantRepository.findOne.mockResolvedValue(existingTenant);
      mockTenantRepository.update.mockResolvedValue(undefined);

      const updateData = { settings: { default_currency: 'EUR' } };
      await service.update('test-id', updateData);

      expect(repository.update).toHaveBeenCalledWith('test-id', {
        settings: {
          default_currency: 'EUR', 
          timezone: 'UTC',
          other_setting: 'value'
        }
      });
    });

    it('should handle settings update when no existing settings exist', async () => {
      const existingTenantWithoutSettings = { ...mockTenant, settings: null };
      mockTenantRepository.findOne.mockResolvedValue(existingTenantWithoutSettings);
      mockTenantRepository.update.mockResolvedValue(undefined);

      const updateData = { settings: { default_currency: 'EUR', timezone: 'GMT' } };
      await service.update('test-id', updateData);

      expect(repository.update).toHaveBeenCalledWith('test-id', {
        settings: {
          default_currency: 'EUR', 
          timezone: 'GMT'
        }
      });
    });
  });

  describe('create', () => {
    it('should create a new tenant', async () => {
      const createData = { user_id: 'user-456', name: 'New Tenant' };
      const createdTenant = { ...createData, id: 'new-id', is_active: true, settings: null, created_at: new Date(), updated_at: new Date() };
      
      mockTenantRepository.create.mockReturnValue(createdTenant);
      mockTenantRepository.save.mockResolvedValue(createdTenant);

      const result = await service.create(createData);

      expect(repository.create).toHaveBeenCalledWith(createData);
      expect(repository.save).toHaveBeenCalledWith(createdTenant);
      expect(result).toEqual(createdTenant);
    });
  });
});