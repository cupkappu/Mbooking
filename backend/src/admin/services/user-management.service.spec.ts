import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UserManagementService } from './user-management.service';
import { User } from '../../auth/user.entity';
import { AuditEventPublisher } from '../events/audit-event-publisher.service';
import { AdminAuditEvent } from '../events/admin-events.types';

describe('UserManagementService', () => {
  let service: UserManagementService;
  let userRepository: jest.Mocked<Repository<User>>;
  let eventPublisher: jest.Mocked<AuditEventPublisher>;

  const mockUser: User = {
    id: 'user-uuid-1',
    email: 'test@example.com',
    password: 'hashed_password',
    name: 'Test User',
    image: null,
    provider: 'credentials',
    provider_id: null,
    is_active: true,
    role: 'user',
    tenant: null as any,
    tenant_id: 'tenant-uuid',
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-01'),
  };

  beforeEach(async () => {
    const mockUserRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      findAndCount: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    const mockEventPublisher = {
      publish: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserManagementService,
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: AuditEventPublisher, useValue: mockEventPublisher },
      ],
    }).compile();

    service = module.get<UserManagementService>(UserManagementService);
    userRepository = module.get(getRepositoryToken(User));
    eventPublisher = module.get(AuditEventPublisher);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('listUsers', () => {
    it('should return paginated users for tenant', async () => {
      const mockUsers = [mockUser];
      userRepository.findAndCount.mockResolvedValue([mockUsers, 1]);

      const result = await service.listUsers('tenant-uuid', { offset: 0, limit: 10 });

      expect(result.users).toEqual(mockUsers);
      expect(result.total).toBe(1);
      expect(userRepository.findAndCount).toHaveBeenCalledWith({
        where: { tenant_id: 'tenant-uuid' },
        skip: 0,
        take: 10,
        order: { created_at: 'DESC' },
      });
    });

    it('should use default pagination when options not provided', async () => {
      userRepository.findAndCount.mockResolvedValue([[], 0]);

      await service.listUsers('tenant-uuid');

      expect(userRepository.findAndCount).toHaveBeenCalledWith({
        where: { tenant_id: 'tenant-uuid' },
        skip: 0,
        take: 50,
        order: { created_at: 'DESC' },
      });
    });
  });

  describe('getUser', () => {
    it('should return user by ID', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.getUser('user-uuid-1');

      expect(result).toEqual(mockUser);
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'user-uuid-1' },
      });
    });

    it('should throw NotFoundException if user not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.getUser('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createUser', () => {
    it('should create user, publish audit event, and throw BadRequestException if email exists', async () => {
      const createData = {
        email: 'new@example.com',
        name: 'New User',
        password: 'password123',
        role: 'user',
      };

      userRepository.findOne.mockResolvedValue(null);
      userRepository.create.mockReturnValue(mockUser);
      userRepository.save.mockResolvedValue(mockUser);

      const result = await service.createUser('tenant-uuid', createData, 'admin-uuid', '127.0.0.1');

      expect(result).toEqual(mockUser);
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { email: 'new@example.com' },
      });
      expect(userRepository.create).toHaveBeenCalled();
      expect(userRepository.save).toHaveBeenCalled();
      expect(eventPublisher.publish).toHaveBeenCalled();
    });

    it('should throw BadRequestException if email already exists', async () => {
      const createData = {
        email: 'existing@example.com',
        name: 'New User',
        password: 'password123',
        role: 'user',
      };

      userRepository.findOne.mockResolvedValue(mockUser);

      await expect(
        service.createUser('tenant-uuid', createData, 'admin-uuid', '127.0.0.1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateUser', () => {
    it('should update user and publish audit event', async () => {
      const updateData = { name: 'Updated Name' };
      const updatedUser = { ...mockUser, name: 'Updated Name' };

      userRepository.findOne.mockResolvedValue(mockUser);
      userRepository.save.mockResolvedValue(updatedUser);

      const result = await service.updateUser('user-uuid-1', updateData, 'admin-uuid', '127.0.0.1');

      expect(result.name).toBe('Updated Name');
      expect(userRepository.save).toHaveBeenCalled();
      expect(eventPublisher.publish).toHaveBeenCalled();
    });
  });

  describe('disableUser', () => {
    it('should disable user and publish audit event', async () => {
      const disabledUser = { ...mockUser, is_active: false };

      userRepository.findOne.mockResolvedValue(mockUser);
      userRepository.save.mockResolvedValue(disabledUser);

      const result = await service.disableUser('user-uuid-1', 'admin-uuid', '127.0.0.1');

      expect(result.is_active).toBe(false);
      expect(userRepository.save).toHaveBeenCalled();
      expect(eventPublisher.publish).toHaveBeenCalled();
    });

    it('should throw error if trying to disable self', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);

      await expect(
        service.disableUser('user-uuid-1', 'user-uuid-1', '127.0.0.1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('resetPassword', () => {
    it('should reset password and publish audit event', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);
      userRepository.save.mockResolvedValue(mockUser);

      await service.resetPassword('user-uuid-1', 'newPassword123', 'admin-uuid', '127.0.0.1');

      expect(userRepository.save).toHaveBeenCalled();
      expect(eventPublisher.publish).toHaveBeenCalled();
    });
  });

  describe('bulkUserAction', () => {
    it('should handle enable action and publish audit event', async () => {
      const enableAction = {
        action: 'enable' as const,
        user_ids: ['user-uuid-1'],
      };
      const enabledUser = { ...mockUser, is_active: true };

      userRepository.find.mockResolvedValue([mockUser]);
      userRepository.save.mockResolvedValue(enabledUser);

      const result = await service.bulkUserAction('tenant-uuid', enableAction, 'admin-uuid', '127.0.0.1');

      expect(result.affected).toBe(1);
      expect(eventPublisher.publish).toHaveBeenCalled();
    });

    it('should handle disable action and skip self', async () => {
      const disableAction = {
        action: 'disable' as const,
        user_ids: ['user-uuid-1', 'user-uuid-2'],
      };

      userRepository.find.mockResolvedValue([mockUser, { ...mockUser, id: 'user-uuid-2' } as User]);

      const result = await service.bulkUserAction('tenant-uuid', disableAction, 'user-uuid-1', '127.0.0.1');

      expect(result.affected).toBe(1);
    });

    it('should handle role_change action and publish audit event', async () => {
      const roleChangeAction = {
        action: 'role_change' as const,
        user_ids: ['user-uuid-1'],
        parameters: { new_role: 'admin' },
      };
      const roleChangedUser = { ...mockUser, role: 'admin' };

      userRepository.find.mockResolvedValue([mockUser]);
      userRepository.save.mockResolvedValue(roleChangedUser);

      const result = await service.bulkUserAction('tenant-uuid', roleChangeAction, 'admin-uuid', '127.0.0.1');

      expect(result.affected).toBe(1);
      expect(eventPublisher.publish).toHaveBeenCalled();
    });

    it('should throw NotFoundException if no users found', async () => {
      const action = {
        action: 'enable' as const,
        user_ids: ['non-existent-id'],
      };

      userRepository.find.mockResolvedValue([]);

      await expect(
        service.bulkUserAction('tenant-uuid', action, 'admin-uuid', '127.0.0.1'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
