export type AdminAction = 
  | 'admin.user.create'
  | 'admin.user.update'
  | 'admin.user.disable'
  | 'admin.user.reset_password'
  | 'admin.user.bulk_action'
  | 'admin.provider.create'
  | 'admin.provider.update'
  | 'admin.provider.delete'
  | 'admin.provider.toggle'
  | 'admin.provider.test'
  | 'admin.currency.create'
  | 'admin.currency.update'
  | 'admin.currency.delete'
  | 'admin.currency.seed'
  | 'admin.scheduler.config'
  | 'admin.scheduler.manual_fetch'
  | 'admin.plugin.upload'
  | 'admin.plugin.reload'
  | 'admin.config.update';

export interface AdminAuditEvent {
  id?: string;
  action: AdminAction;
  entityType: string;
  entityId?: string;
  userId: string;
  oldValue?: any;
  newValue?: any;
  ipAddress?: string;
  userAgent?: string;
  tenantId?: string;
  timestamp?: Date;
}
