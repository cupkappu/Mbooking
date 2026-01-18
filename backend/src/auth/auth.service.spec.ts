import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { User } from './user.entity';
import { TenantsService } from '../tenants/tenants.service';
import { Tenant } from '../tenants/tenant.entity';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: jest.Mocked<Repository<User>>;
  let jwtService: jest.Mocked<JwtService>;
  let tenantsService: jest.Mocked<TenantsService>;

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

  const mockTenant: Tenant = {
    id: 'tenant-1',
    user_id: 'uuid-1',
    name: 'Test User Tenant',
    settings: { default_currency: 'USD', timezone: 'UTC' },
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
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
    tenantsService = module.get(TenantsService);
  });

  describe('validateUser', () => {
    it('should return user when credentials are valid', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateUser('test@example.com', 'password123');

      expect(result).toBeDefined();
      expect(result?.email).toBe('test@example.com');
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { email: 'test@example.com', is_active: true },
      });
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

    it('should return null when user has no password', async () => {
      const userWithoutPassword = { ...mockUser, password: null };
      userRepository.findOne.mockResolvedValue(userWithoutPassword as User);

      const result = await service.validateUser('oauth@example.com', 'password');

      expect(result).toBeNull();
    });
  });

  describe('login', () => {
    it('should return access token when user is valid', async () => {
      jwtService.sign.mockReturnValue('jwt-token-123');

      const result = await service.login(mockUser);

      expect(result).toEqual({
        access_token: 'jwt-token-123',
        user: {
          id: mockUser.id,
          email: mockUser.email,
          name: mockUser.name,
        },
      });
      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: mockUser.id,
        email: mockUser.email,
        tenant_id: mockUser.tenant_id,
      });
    });
  });

  describe('register', () => {
    it('should create new user when email does not exist', async () => {
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
      expect(result.email).toBe('test@example.com');
      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
    });

    it('should throw ConflictException when email already exists', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);

      await expect(
        service.register({
          email: 'test@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow('User with this email already exists');
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

    it('should create new user when not found', async () => {
      const oauthProfile = { id: 'new-google-123', email: 'new@gmail.com', name: 'New User', image: null };
      userRepository.findOne.mockResolvedValueOnce(null);
      userRepository.findOne.mockResolvedValueOnce(null);
      userRepository.create.mockReturnValue(mockUser);
      userRepository.save.mockResolvedValue(mockUser);

      const result = await service.handleOAuthLogin(oauthProfile, 'google');

      expect(result).toBeDefined();
      expect(userRepository.create).toHaveBeenCalled();
    });
  });

  describe('ensureTenantExists', () => {
    it('should create a tenant for a user if it does not exist', async () => {
      (tenantsService.findByUserId as jest.Mock).mockRejectedValue(new Error('Tenant not found'));
      (tenantsService.create as jest.Mock).mockResolvedValue(mockTenant);
      const userWithoutTenant = { ...mockUser, tenant_id: null };
      
      await expect((service as any).ensureTenantExists(userWithoutTenant)).resolves.not.toThrow();
      
      expect(tenantsService.create).toHaveBeenCalledWith({
        user_id: userWithoutTenant.id,
        name: userWithoutTenant.name || `${userWithoutTenant.email} Tenant`,
        settings: { default_currency: 'USD', timezone: 'UTC' },
        is_active: true,
      });
    });

    it('should not create a tenant if it already exists', async () => {
      (tenantsService.findByUserId as jest.Mock).mockResolvedValue(mockTenant);
      
      await expect((service as any).ensureTenantExists(mockUser)).resolves.not.toThrow();
      
      expect(tenantsService.create).not.toHaveBeenCalled();
    });
  });
});
