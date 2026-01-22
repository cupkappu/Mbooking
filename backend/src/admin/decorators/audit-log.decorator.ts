import { AdminAction } from '../events/admin-events.types';
import { AuditEventPublisher } from '../events/audit-event-publisher.service';
import { v4 as uuidv4 } from 'uuid';

export interface AuditLogOptions {
  action: AdminAction;
  entityType: string;
  getEntityId?: (args: any[], result: any) => string | undefined;
  getOldValue?: (args: any[], result: any, instance?: any) => any;
  getNewValue?: (args: any[], result: any, instance?: any) => any;
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
      
      const eventPublisher = instance.eventPublisher as AuditEventPublisher | undefined;
      
      if (!eventPublisher) {
        console.warn(`[AuditLog] No eventPublisher found for ${options.action}`);
        return originalMethod.apply(this, args);
      }

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
            /^[a-zA-Z0-9\s\/\.\-\(\);_]+$/.test(arg)
          ) || undefined
        : undefined;

      const result = await originalMethod.apply(this, args);

      const event = {
        id: uuidv4(),
        timestamp: new Date(),
        action: options.action,
        entityType: options.entityType,
        entityId: options.getEntityId?.(args, result),
        userId: adminId,
        tenantId,
        oldValue: options.getOldValue?.(args, result, instance),
        newValue: options.getNewValue?.(args, result, instance),
        ipAddress,
        userAgent,
      };

      eventPublisher.publish(event);

      return result;
    };

    return descriptor;
  };
}
