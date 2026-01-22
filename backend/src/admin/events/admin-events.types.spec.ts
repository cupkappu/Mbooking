import { AdminAction, AdminAuditEvent } from './admin-events.types';

describe('AdminEventsTypes', () => {
  describe('AdminAction type', () => {
    it('should include all user management actions', () => {
      const userActions: AdminAction[] = [
        'admin.user.create',
        'admin.user.update',
        'admin.user.disable',
        'admin.user.reset_password',
        'admin.user.bulk_action',
      ];

      userActions.forEach((action) => {
        expect(action).toBeDefined();
      });
    });

    it('should include all provider management actions', () => {
      const providerActions: AdminAction[] = [
        'admin.provider.create',
        'admin.provider.update',
        'admin.provider.delete',
        'admin.provider.toggle',
        'admin.provider.test',
      ];

      providerActions.forEach((action) => {
        expect(action).toBeDefined();
      });
    });

    it('should include all currency management actions', () => {
      const currencyActions: AdminAction[] = [
        'admin.currency.create',
        'admin.currency.update',
        'admin.currency.delete',
        'admin.currency.seed',
      ];

      currencyActions.forEach((action) => {
        expect(action).toBeDefined();
      });
    });

    it('should include all scheduler management actions', () => {
      const schedulerActions: AdminAction[] = [
        'admin.scheduler.config',
        'admin.scheduler.manual_fetch',
      ];

      schedulerActions.forEach((action) => {
        expect(action).toBeDefined();
      });
    });

    it('should include all plugin management actions', () => {
      const pluginActions: AdminAction[] = [
        'admin.plugin.upload',
        'admin.plugin.reload',
      ];

      pluginActions.forEach((action) => {
        expect(action).toBeDefined();
      });
    });

    it('should include system config action', () => {
      const configAction: AdminAction = 'admin.config.update';
      expect(configAction).toBeDefined();
    });
  });

  describe('AdminAuditEvent interface', () => {
    it('should require id, action, entityType, userId, and timestamp', () => {
      const event: AdminAuditEvent = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        action: 'admin.user.create',
        entityType: 'user',
        userId: '123e4567-e89b-12d3-a456-426614174001',
        timestamp: new Date(),
      };

      expect(event.id).toBeDefined();
      expect(event.action).toBeDefined();
      expect(event.entityType).toBeDefined();
      expect(event.userId).toBeDefined();
      expect(event.timestamp).toBeDefined();
    });

    it('should allow optional fields', () => {
      const event: AdminAuditEvent = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        action: 'admin.user.update',
        entityType: 'user',
        entityId: '123e4567-e89b-12d3-a456-426614174002',
        userId: '123e4567-e89b-12d3-a456-426614174001',
        oldValue: { name: 'Old Name' },
        newValue: { name: 'New Name' },
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        tenantId: '123e4567-e89b-12d3-a456-426614174003',
        timestamp: new Date(),
      };

      expect(event.entityId).toBeDefined();
      expect(event.oldValue).toBeDefined();
      expect(event.newValue).toBeDefined();
      expect(event.ipAddress).toBeDefined();
      expect(event.userAgent).toBeDefined();
      expect(event.tenantId).toBeDefined();
    });

    it('should work with partial events for logging', () => {
      const event: AdminAuditEvent = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        action: 'admin.provider.test',
        entityType: 'provider',
        userId: '123e4567-e89b-12d3-a456-426614174001',
        newValue: { success: true, latency: 150 },
        timestamp: new Date(),
      };

      expect(event.action).toBe('admin.provider.test');
      expect(event.newValue).toEqual({ success: true, latency: 150 });
    });
  });
});
