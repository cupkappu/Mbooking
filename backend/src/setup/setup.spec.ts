import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { SetupService } from './setup.service';
import { User } from '../auth/user.entity';
import { Tenant } from '../tenants/tenant.entity';
import { CurrenciesService } from '../currencies/currencies.service';

describe('SetupService', () => {
  let service: SetupService;
  let userRepository: jest.Mocked<Repository<User>>;
  let tenantRepository: jest.Mocked<Repository<Tenant>>;
  let currenciesService: jest.Mocked<CurrenciesService>;
  let dataSource: jest.Mocked<DataSource>;

  const mockUserRepository = {
    count: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };

  const mockTenantRepository = {
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockCurrenciesService = {
    findAll: jest.fn(),
    seedDefaultCurrencies: jest.fn(),
  };

  const mockQueryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      save: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockDataSource = {
    createQueryRunner: jest.fn(() => mockQueryRunner),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    
    // Set up INIT_SECRET before module creation (service reads it in constructor)
    process.env.INIT_SECRET = 'test-secret-key';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SetupService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: getRepositoryToken(Tenant),
          useValue: mockTenantRepository,
        },
        {
          provide: CurrenciesService,
          useValue: mockCurrenciesService,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<SetupService>(SetupService);
  });

  afterEach(() => {
    delete process.env.INIT_SECRET;
  });

  describe('getStatus', () => {
    it('should return initialized: false when no users exist', async () => {
      mockUserRepository.count.mockResolvedValue(0);
      mockCurrenciesService.findAll.mockResolvedValue([
        { code: 'USD' },
        { code: 'EUR' },
      ] as any);

      const result = await service.getStatus();

      expect(result).toEqual({
        initialized: false,
        userCount: 0,
        currencyCount: 2,
      });
      expect(mockUserRepository.count).toHaveBeenCalled();
      expect(mockCurrenciesService.findAll).toHaveBeenCalled();
    });

    it('should return initialized: true when users exist', async () => {
      mockUserRepository.count.mockResolvedValue(1);
      mockCurrenciesService.findAll.mockResolvedValue([
        { code: 'USD' },
        { code: 'EUR' },
        { code: 'GBP' },
      ] as any);

      const result = await service.getStatus();

      expect(result).toEqual({
        initialized: true,
        userCount: 1,
        currencyCount: 3,
      });
    });

    it('should return currency count in status', async () => {
      mockUserRepository.count.mockResolvedValue(0);
      mockCurrenciesService.findAll.mockResolvedValue([
        { code: 'USD' },
        { code: 'EUR' },
        { code: 'GBP' },
        { code: 'JPY' },
        { code: 'CNY' },
      ] as any);

      const result = await service.getStatus();

      expect(result.currencyCount).toBe(5);
    });
  });

  describe('initialize', () => {
    const validDto = {
      email: 'admin@example.com',
      password: 'SecureP@ss123!',
      name: 'Administrator',
      organizationName: 'Test Org',
    };

    beforeEach(() => {
      mockUserRepository.count.mockResolvedValue(0);
      mockUserRepository.create.mockImplementation((data) => ({
        ...data,
        id: 'test-uuid',
        tenant_id: null,
        created_at: new Date(),
        updated_at: new Date(),
      }));
      mockUserRepository.save.mockImplementation(async (user) => user);
      mockUserRepository.update.mockResolvedValue({ affected: 1 } as any);

      mockTenantRepository.create.mockImplementation((data) => ({
        ...data,
        id: 'tenant-uuid',
        created_at: new Date(),
        updated_at: new Date(),
      }));
      mockTenantRepository.save.mockImplementation(async (tenant) => tenant);

      mockCurrenciesService.seedDefaultCurrencies.mockResolvedValue({
        added: 5,
        skipped: 0,
      });

      mockQueryRunner.connect.mockResolvedValue(undefined);
      mockQueryRunner.startTransaction.mockResolvedValue(undefined);
      mockQueryRunner.commitTransaction.mockResolvedValue(undefined);
      mockQueryRunner.rollbackTransaction.mockResolvedValue(undefined);
      mockQueryRunner.release.mockResolvedValue(undefined);
    });

    it('should throw ConflictException when system already initialized', async () => {
      mockUserRepository.count.mockResolvedValue(1);

      await expect(service.initialize(validDto)).rejects.toThrow(ConflictException);
      expect(mockUserRepository.count).toHaveBeenCalled();
    });

    it('should throw ConflictException for missing uppercase in password', async () => {
      const weakDto = { ...validDto, password: 'lowercase123!' };

      await expect(service.initialize(weakDto)).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException for missing lowercase in password', async () => {
      const weakDto = { ...validDto, password: 'UPPERCASE123!' };

      await expect(service.initialize(weakDto)).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException for missing number in password', async () => {
      const weakDto = { ...validDto, password: 'NoNumbersHere!' };

      await expect(service.initialize(weakDto)).rejects.toThrow(ConflictException);
    });

    it('should successfully initialize system with valid data', async () => {
      const result = await service.initialize(validDto);

      expect(result.success).toBe(true);
      expect(result.user.email).toBe(validDto.email);
      expect(result.user.name).toBe(validDto.name);
      expect(result.user.role).toBe('admin');

      expect(mockUserRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: validDto.email,
          name: validDto.name,
          role: 'admin',
          provider: 'credentials',
          is_active: true,
        })
      );

      expect(mockTenantRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: validDto.organizationName,
          user_id: expect.any(String),
        })
      );

      expect(mockCurrenciesService.seedDefaultCurrencies).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should seed currencies during initialization', async () => {
      mockCurrenciesService.seedDefaultCurrencies.mockResolvedValue({
        added: 5,
        skipped: 10,
      });

      const result = await service.initialize(validDto);

      expect(mockCurrenciesService.seedDefaultCurrencies).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should handle currency seeding errors gracefully', async () => {
      mockCurrenciesService.seedDefaultCurrencies.mockRejectedValue(
        new Error('Currency seeding failed')
      );

      await expect(service.initialize(validDto)).rejects.toThrow('Currency seeding failed');
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('should rollback transaction on error', async () => {
      mockQueryRunner.manager.save.mockRejectedValue(new Error('DB error'));

      await expect(service.initialize(validDto)).rejects.toThrow();
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });
  });
});
