import { AdminAction } from '../events/admin-events.types';
import { AuditEventPublisher } from '../events/audit-event-publisher.service';

export interface AuditLogOptions {
  action: AdminAction;
  entityType: string;
  getEntityId?: (args: any[], result: any) => string | undefined;
  getOldValue?: (args: any[], result: any, instance: any) => any;
  getNewValue?: (args: any[], result: any) => any;
  extractIpFromArgs?: boolean;
  extractUserAgentFromArgs?: boolean;
  extractAdminIdFromArgs?: boolean;
  extractTenantIdFromArgs?: boolean;
}

export function AuditLog(options: AuditLogOptions) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const instance = this as any;
      
      // 获取事件发布器
      const eventPublisher = instance.eventPublisher as AuditEventPublisher | undefined;
      
      // 如果没有事件发布器，降级为同步日志（向后兼容）
      if (!eventPublisher) {
        console.warn(`[AuditLog] No eventPublisher found for ${options.action}`);
        return originalMethod.apply(this, args);
      }

      // 提取参数
      const adminId = options.extractAdminIdFromArgs !== false
        ? args.find((arg: any) => 
            typeof arg === 'string' && 
            arg.length === 36 && 
            /^[0-9a-f-]+$/.test(arg)
          ) || 'system'
        : 'system';

      const tenantId = options.extractTenantIdFromArgs !== false
        ? args.find((arg: any) => 
            typeof arg === 'string' && 
            arg.length === 36 && 
            /^[0-9a-f-]+$/.test(arg) &&
            arg !== adminId
          ) || undefined
        : undefined;

      const ipAddress = options.extractIpFromArgs
        ? args.find((arg: any) => 
            typeof arg === 'string' && 
            /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(arg)
          ) || undefined
        : undefined;

      const userAgent = options.extractUserAgentFromArgs
        ? args.find((arg: any) => 
            typeof arg === 'string' && 
            arg.length > 20 && 
            /^[a-zA-Z0-9\s\/\.\-\(\)]+$/.test(arg)
          ) || undefined
        : undefined;

      // 调用原始方法
      const result = await originalMethod.apply(this, args);

      // 发布审计事件（非阻塞）
      const event = {
        action: options.action,
        entityType: options.entityType,
        entityId: options.getEntityId?.(args, result),
        userId: adminId,
        tenantId,
        oldValue: options.getOldValue?.(args, result, instance),
        newValue: options.getNewValue?.(args, result),
        ipAddress,
        userAgent,
      };

      eventPublisher.publish(event);

      return result;
    };

    return descriptor;
  };
}
