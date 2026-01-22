import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../entities/audit-log.entity';

export interface LogQueryParams {
  offset?: number;
  limit?: number;
  user_id?: string;
  action?: string;
  entity_type?: string;
  date_from?: string;
  date_to?: string;
}

export interface PaginatedAuditLogs {
  logs: AuditLog[];
  total: number;
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
  ) {}

  async getAuditLogs(options: LogQueryParams = {}): Promise<PaginatedAuditLogs> {
    const offset = Number(options.offset) || 0;
    const limit = Number(options.limit) || 50;
    const { user_id, action, entity_type, date_from, date_to } = options;

    const query = this.auditLogRepository.createQueryBuilder('log');

    if (user_id) {
      query.andWhere('log.user_id = :user_id', { user_id });
    }

    if (action) {
      query.andWhere('log.action LIKE :action', { action: `%${action}%` });
    }

    if (entity_type) {
      query.andWhere('log.entity_type = :entity_type', { entity_type });
    }

    if (date_from) {
      query.andWhere('log.created_at >= :date_from', { date_from: new Date(date_from) });
    }

    if (date_to) {
      query.andWhere('log.created_at <= :date_to', { date_to: new Date(date_to) });
    }

    query.orderBy('log.created_at', 'DESC');
    query.skip(offset);
    query.take(limit);

    const [logs, total] = await query.getManyAndCount();

    return { logs, total };
  }

  async exportAuditLogsToCsv(options: LogQueryParams = {}): Promise<string> {
    const { logs } = await this.getAuditLogs({ ...options, limit: 10000 });

    const headers = ['ID', 'User ID', 'Action', 'Entity Type', 'Entity ID', 'IP Address', 'Created At'];
    const rows = logs.map((log) => [
      log.id,
      log.user_id,
      log.action,
      log.entity_type,
      log.entity_id || '',
      log.ip_address || '',
      log.created_at.toISOString(),
    ]);

    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');

    return csv;
  }
}
