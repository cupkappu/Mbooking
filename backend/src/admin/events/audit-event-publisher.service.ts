import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subject, bufferTime, filter, Observable, Subscription } from 'rxjs';
import { AuditLog } from '../entities/audit-log.entity';
import { AdminAuditEvent } from './admin-events.types';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AuditEventPublisher {
  private readonly logger = new Logger(AuditEventPublisher.name);
  private eventSubject = new Subject<AdminAuditEvent>();
  private subscription: Subscription | undefined;

  constructor(
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
  ) {
    this.initializeSubscription();
  }

  private initializeSubscription(): void {
    // 每秒批量写入，减少数据库压力
    this.subscription = this.eventSubject.pipe(
      bufferTime(1000), // 1 秒批量
      filter(events => events.length > 0),
    ).subscribe({
      next: async (events) => {
        await this.batchSave(events);
      },
      error: (error) => {
        this.logger.error('Audit event subscription error', error);
      },
    });
  }

  publish(event: AdminAuditEvent): void {
    // 添加元数据
    const enrichedEvent: AdminAuditEvent = {
      ...event,
      id: event.id || uuidv4(),
      timestamp: event.timestamp || new Date(),
    };

    this.eventSubject.next(enrichedEvent);
  }

  private async batchSave(events: AdminAuditEvent[]): Promise<void> {
    try {
      const logs = events.map(event => 
        this.auditLogRepository.create({
          id: event.id,
          tenant_id: event.tenantId,
          user_id: event.userId,
          action: event.action,
          entity_type: event.entityType,
          entity_id: event.entityId,
          old_value: event.oldValue ? JSON.parse(JSON.stringify(event.oldValue)) : undefined,
          new_value: event.newValue ? JSON.parse(JSON.stringify(event.newValue)) : undefined,
          ip_address: event.ipAddress,
          user_agent: event.userAgent,
          created_at: event.timestamp,
        })
      );

      await this.auditLogRepository.save(logs);
      this.logger.debug(`Batch saved ${logs.length} audit logs`);
    } catch (error) {
      this.logger.error('Failed to batch save audit logs', error);
      // TODO: 考虑写入死信队列
    }
  }

  /**
   * 手动刷新未保存的事件（用于测试或优雅关闭）
   */
  async flush(): Promise<void> {
    // 触发一次批量保存
    this.subscription?.unsubscribe();
    this.initializeSubscription();
  }

  /**
   * 关闭发布器（用于应用关闭时）
   */
  async close(): Promise<void> {
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = undefined;
    }
  }
}
