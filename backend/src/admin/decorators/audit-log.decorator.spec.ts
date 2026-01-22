import { AuditLog, AuditLogOptions } from './audit-log.decorator';
import { AdminAction } from '../events/admin-events.types';
import { AuditEventPublisher } from '../events/audit-event-publisher.service';

describe('AuditLog Decorator', () => {
  let mockEventPublisher: jest.Mocked<AuditEventPublisher>;
  let mockPublish: jest.Mock;

  beforeEach(() => {
    mockPublish = jest.fn();
    mockEventPublisher = {
      publish: mockPublish,
    } as unknown as jest.Mocked<AuditEventPublisher>;
  });

  describe('AuditLog', () => {
    it('should publish audit event with correct action and entity type', async () => {
      class TestService {
        eventPublisher = mockEventPublisher;

        @AuditLog({
          action: 'admin.user.create' as AdminAction,
          entityType: 'User',
        })
        async createUser(id: string, data: any) {
          return { id, ...data };
        }
      }

      const service = new TestService();
      const result = await service.createUser('user-123', { name: 'John' });

      expect(result).toEqual({ id: 'user-123', name: 'John' });
      expect(mockPublish).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'admin.user.create',
          entityType: 'User',
          userId: 'system',
        }),
      );
    });

    it('should extract admin ID from UUID argument', async () => {
      class TestService {
        eventPublisher = mockEventPublisher;

        @AuditLog({
          action: 'admin.user.update' as AdminAction,
          entityType: 'User',
        })
        async updateUser(adminId: string, userId: string, data: any) {
          return { userId, ...data };
        }
      }

      const service = new TestService();
      await service.updateUser('550e8400-e29b-41d4-a716-446655440000', 'user-123', { name: 'Jane' });

      expect(mockPublish).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: '550e8400-e29b-41d4-a716-446655440000',
        }),
      );
    });

    it('should extract tenant ID from UUID argument', async () => {
      class TestService {
        eventPublisher = mockEventPublisher;

        @AuditLog({
          action: 'admin.user.update' as AdminAction,
          entityType: 'User',
        })
        async updateUser(adminId: string, tenantId: string, userId: string, data: any) {
          return { userId, ...data };
        }
      }

      const service = new TestService();
      await service.updateUser(
        '550e8400-e29b-41d4-a716-446655440000',
        '660e8400-e29b-41d4-a716-446655440001',
        'user-123',
        { name: 'Jane' },
      );

      expect(mockPublish).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: '660e8400-e29b-41d4-a716-446655440001',
        }),
      );
    });

    it('should extract IP address when configured', async () => {
      class TestService {
        eventPublisher = mockEventPublisher;

        @AuditLog({
          action: 'admin.user.create' as AdminAction,
          entityType: 'User',
          extractIpFromArgs: true,
        })
        async createUser(adminId: string, ipAddress: string, data: any) {
          return { id: 'user-123', ...data };
        }
      }

      const service = new TestService();
      await service.createUser('admin-id', '192.168.1.100', { name: 'John' });

      expect(mockPublish).toHaveBeenCalledWith(
        expect.objectContaining({
          ipAddress: '192.168.1.100',
        }),
      );
    });

    it('should extract user agent when configured', async () => {
      class TestService {
        eventPublisher = mockEventPublisher;

        @AuditLog({
          action: 'admin.user.create' as AdminAction,
          entityType: 'User',
          extractUserAgentFromArgs: true,
        })
        async createUser(adminId: string, userAgent: string, data: any) {
          return { id: 'user-123', ...data };
        }
      }

      const service = new TestService();
      await service.createUser('admin-id', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', { name: 'John' });

      expect(mockPublish).toHaveBeenCalledWith(
        expect.objectContaining({
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        }),
      );
    });

    it('should use custom getEntityId function', async () => {
      class TestService {
        eventPublisher = mockEventPublisher;

        @AuditLog({
          action: 'admin.user.update' as AdminAction,
          entityType: 'User',
          getEntityId: (args, result) => result.id,
        })
        async updateUser(adminId: string, data: any) {
          return { id: 'custom-id', ...data };
        }
      }

      const service = new TestService();
      await service.updateUser('admin-id', { name: 'Jane' });

      expect(mockPublish).toHaveBeenCalledWith(
        expect.objectContaining({
          entityId: 'custom-id',
        }),
      );
    });

    it('should use custom getOldValue and getNewValue functions', async () => {
      class TestService {
        eventPublisher = mockEventPublisher;

        @AuditLog({
          action: 'admin.user.update' as AdminAction,
          entityType: 'User',
          getOldValue: () => ({ name: 'John' }),
          getNewValue: (args, result) => result,
        })
        async updateUser(adminId: string, data: any) {
          return { id: 'user-123', ...data, name: 'Jane' };
        }
      }

      const service = new TestService();
      await service.updateUser('admin-id', { name: 'Jane' });

      expect(mockPublish).toHaveBeenCalledWith(
        expect.objectContaining({
          oldValue: { name: 'John' },
          newValue: { id: 'user-123', name: 'Jane' },
        }),
      );
    });

    it('should fall back to synchronous console warning when no eventPublisher exists', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      class TestServiceWithoutPublisher {
        @AuditLog({
          action: 'admin.user.create' as AdminAction,
          entityType: 'User',
        })
        async createUser(data: any) {
          return { id: 'user-123', ...data };
        }
      }

      const service = new TestServiceWithoutPublisher();
      const result = await service.createUser({ name: 'John' });

      expect(result).toEqual({ id: 'user-123', name: 'John' });
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[AuditLog]'),
      );

      consoleWarnSpy.mockRestore();
    });

    it('should handle disabled extraction options', async () => {
      class TestService {
        eventPublisher = mockEventPublisher;

        @AuditLog({
          action: 'admin.user.create' as AdminAction,
          entityType: 'User',
          extractAdminIdFromArgs: false,
          extractTenantIdFromArgs: false,
        })
        async createUser(adminId: string, tenantId: string, ipAddress: string, data: any) {
          return { id: 'user-123', ...data };
        }
      }

      const service = new TestService();
      await service.createUser(
        '550e8400-e29b-41d4-a716-446655440000',
        '660e8400-e29b-41d4-a716-446655440001',
        '192.168.1.100',
        { name: 'John' },
      );

      expect(mockPublish).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'system',
          tenantId: undefined,
        }),
      );
    });

    it('should pass through method return value', async () => {
      class TestService {
        eventPublisher = mockEventPublisher;

        @AuditLog({
          action: 'admin.user.create' as AdminAction,
          entityType: 'User',
        })
        async createUser(data: any) {
          return { created: true, id: 'user-123', ...data };
        }
      }

      const service = new TestService();
      const result = await service.createUser({ name: 'John' });

      expect(result).toHaveProperty('created', true);
      expect(result.id).toBe('user-123');
    });

    it('should handle async methods correctly', async () => {
      class TestService {
        eventPublisher = mockEventPublisher;

        @AuditLog({
          action: 'admin.user.delete' as AdminAction,
          entityType: 'User',
        })
        async deleteUser(id: string): Promise<boolean> {
          await new Promise(resolve => setTimeout(resolve, 10));
          return true;
        }
      }

      const service = new TestService();
      const result = await service.deleteUser('user-123');

      expect(result).toBe(true);
      expect(mockPublish).toHaveBeenCalledTimes(1);
    });

    it('should handle errors in decorated methods', async () => {
      class TestService {
        eventPublisher = mockEventPublisher;

        @AuditLog({
          action: 'admin.user.update' as AdminAction,
          entityType: 'User',
        })
        async updateUser(adminId: string, data: any) {
          throw new Error('Update failed');
        }
      }

      const service = new TestService();

      await expect(service.updateUser('admin-id', { name: 'John' })).rejects.toThrow('Update failed');
      expect(mockPublish).not.toHaveBeenCalled();
    });
  });
});
