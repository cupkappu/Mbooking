import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';
import { Tenant } from './tenant.entity';
import { UpdateTenantSettingsDto } from './dto/tenant-settings.dto';

describe('Tenant Settings Update - Controller', () => {
  let controller: TenantsController;
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

  const mockTenantsService = {
    findByUserId: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TenantsController],
      providers: [
        {
          provide: TenantsService,
          useValue: mockTenantsService,
        },
        {
          provide: getRepositoryToken(Tenant),
          useValue: mockTenantRepository,
        },
      ],
    }).compile();

    controller = module.get<TenantsController>(TenantsController);
    service = module.get<TenantsService>(TenantsService);
    repository = module.get<Repository<Tenant>>(getRepositoryToken(Tenant));
  });

  describe('updateSettings', () => {
    it('should update tenant settings with partial data', async () => {
      const req = { user: { userId: 'user-123' } };
      const updateSettingsDto: UpdateTenantSettingsDto = {
        default_currency: 'EUR',
      };

      mockTenantsService.findByUserId.mockResolvedValue(mockTenant);
      mockTenantsService.update.mockResolvedValue({
        ...mockTenant,
        settings: {
          ...mockTenant.settings,
          default_currency: 'EUR',
        },
      });

      const result = await controller.updateSettings(req, updateSettingsDto);

      expect(mockTenantsService.findByUserId).toHaveBeenCalledWith('user-123');
      expect(mockTenantsService.update).toHaveBeenCalledWith(mockTenant.id, {
        settings: { default_currency: 'EUR' },
      });
      expect(result.settings.default_currency).toBe('EUR');
    });

    it('should update tenant settings with both properties', async () => {
      const req = { user: { userId: 'user-123' } };
      const updateSettingsDto: UpdateTenantSettingsDto = {
        default_currency: 'GBP',
        timezone: 'Europe/London',
      };

      mockTenantsService.findByUserId.mockResolvedValue(mockTenant);
      mockTenantsService.update.mockResolvedValue({
        ...mockTenant,
        settings: {
          default_currency: 'GBP',
          timezone: 'Europe/London',
        },
      });

      const result = await controller.updateSettings(req, updateSettingsDto);

      expect(mockTenantsService.update).toHaveBeenCalledWith(mockTenant.id, {
        settings: { default_currency: 'GBP', timezone: 'Europe/London' },
      });
      expect(result.settings.default_currency).toBe('GBP');
      expect(result.settings.timezone).toBe('Europe/London');
    });

    it('should update tenant settings with only timezone', async () => {
      const req = { user: { userId: 'user-123' } };
      const updateSettingsDto: UpdateTenantSettingsDto = {
        timezone: 'Asia/Tokyo',
      };

      mockTenantsService.findByUserId.mockResolvedValue(mockTenant);
      mockTenantsService.update.mockResolvedValue({
        ...mockTenant,
        settings: {
          ...mockTenant.settings,
          timezone: 'Asia/Tokyo',
        },
      });

      const result = await controller.updateSettings(req, updateSettingsDto);

      expect(mockTenantsService.update).toHaveBeenCalledWith(mockTenant.id, {
        settings: { timezone: 'Asia/Tokyo' },
      });
      expect(result.settings.timezone).toBe('Asia/Tokyo');
      expect(result.settings.default_currency).toBe('USD');
    });
  });
});