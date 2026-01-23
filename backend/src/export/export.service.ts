import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JournalEntry } from '../journal/journal-entry.entity';
import { JournalLine } from '../journal/journal-line.entity';
import { Account } from '../accounts/account.entity';
import { TenantContext } from '../common/context/tenant.context';
import { ExportAuditLog, ExportType, ExportStatus } from './entities/export-audit.entity';
import { ExportBillsDto, DatePreset } from './dto/export-bills.dto';
import { ExportFilters, parseDatePreset } from './dto/export-filters.dto';
import {
  createBillsExportPipeline,
  transformBillToCsvRow,
} from './streams/csv-transform.stream';
import { Readable } from 'stream';

@Injectable()
export class ExportService {
  private readonly logger = new Logger(ExportService.name);

  constructor(
    @InjectRepository(JournalEntry)
    private journalEntryRepository: Repository<JournalEntry>,
    @InjectRepository(JournalLine)
    private journalLineRepository: Repository<JournalLine>,
    @InjectRepository(Account)
    private accountRepository: Repository<Account>,
    @InjectRepository(ExportAuditLog)
    private exportAuditRepository: Repository<ExportAuditLog>,
  ) {}

  /**
   * Validate export filters
   */
  private validateExportFilters(dto: ExportBillsDto): ExportFilters {
    const filters: ExportFilters = {
      includeHeader: dto.include_header ?? true,
      delimiter: dto.delimiter ?? ',',
    };

    // Handle date preset or custom date range
    if (dto.date_preset) {
      const dateRange = parseDatePreset(dto.date_preset);
      if (dateRange) {
        filters.dateFrom = dateRange.dateFrom;
        filters.dateTo = dateRange.dateTo;
      }
      filters.datePreset = dto.date_preset;
    } else if (dto.date_from || dto.date_to) {
      if (!dto.date_from || !dto.date_to) {
        throw new BadRequestException('Both date_from and date_to must be provided');
      }

      const dateFrom = new Date(dto.date_from);
      const dateTo = new Date(dto.date_to);

      if (dateFrom > dateTo) {
        throw new BadRequestException('date_from must be before or equal to date_to');
      }

      // Validate date range doesn't exceed 1 year
      const oneYearMs = 365 * 24 * 60 * 60 * 1000;
      if (dateTo.getTime() - dateFrom.getTime() > oneYearMs) {
        throw new BadRequestException('Date range cannot exceed 1 year');
      }

      filters.dateFrom = dateFrom;
      filters.dateTo = dateTo;
    }

    // Handle account types filter
    if (dto.account_types && dto.account_types.length > 0) {
      filters.accountTypes = dto.account_types;
    }

    return filters;
  }

  /**
   * Stream bills data with cursor-based pagination
   */
  private async *streamBillsData(
    tenantId: string,
    filters: ExportFilters,
  ): AsyncGenerator<{
    date: Date | string;
    description: string;
    reference_id: string | null;
    lines: Array<{
      amount: string | number;
      currency: string;
      account?: { name: string; type: string };
    }>;
  }> {
    const BATCH_SIZE = 1000;
    let lastId: string | null = null;
    let hasMore = true;

    while (hasMore) {
      const queryBuilder = this.journalEntryRepository
        .createQueryBuilder('je')
        .leftJoinAndSelect('je.lines', 'lines')
        .leftJoinAndSelect('lines.account', 'account')
        .where('je.tenant_id = :tenantId', { tenantId })
        .andWhere('je.deleted_at IS NULL')
        .orderBy('je.id', 'ASC');

      // Apply date filters
      if (filters.dateFrom) {
        queryBuilder.andWhere('je.date >= :dateFrom', { dateFrom: filters.dateFrom });
      }
      if (filters.dateTo) {
        queryBuilder.andWhere('je.date <= :dateTo', { dateTo: filters.dateTo });
      }

      // Apply cursor pagination
      if (lastId) {
        queryBuilder.andWhere('je.id > :lastId', { lastId });
      }

      queryBuilder.take(BATCH_SIZE);

      const entries = await queryBuilder.getMany();

      if (entries.length < BATCH_SIZE) {
        hasMore = false;
      }

      if (entries.length > 0) {
        lastId = entries[entries.length - 1].id;

        for (const entry of entries) {
          // If account type filter is applied, check if entry has matching lines
          if (filters.accountTypes && filters.accountTypes.length > 0) {
            const hasMatchingLine = entry.lines?.some((line) =>
              line.account && filters.accountTypes?.includes(line.account.type),
            );
            if (!hasMatchingLine) continue;
          }

          yield {
            date: entry.date,
            description: entry.description,
            reference_id: entry.reference_id,
            lines: entry.lines?.map((line) => ({
              amount: line.amount,
              currency: line.currency,
              account: line.account
                ? { name: line.account.path || line.account.name, type: line.account.type }
                : undefined,
            })) || [],
          };
        }
      }
    }
  }

  /**
   * Export bills to CSV stream
   */
  async exportBillsToCsv(dto: ExportBillsDto): Promise<Readable> {
    const tenantId = TenantContext.requireTenantId();
    const userId = TenantContext.requireUserId();

    // Validate filters
    const filters = this.validateExportFilters(dto);

    // Create audit log entry
    const auditLog = this.exportAuditRepository.create({
      tenant_id: tenantId,
      user_id: userId,
      export_type: ExportType.BILLS,
      filters_applied: filters as Record<string, unknown>,
      status: ExportStatus.SUCCESS,
    });

    try {
      // Stream data and create CSV pipeline
      const dataStream = Readable.from(this.streamBillsData(tenantId, filters));
      const csvPipeline = createBillsExportPipeline(dataStream);

      // Track record count
      let recordCount = 0;
      const countStream = new Readable({
        read() {},
      });

      // Override the transform to count records
      const originalTransform = csvPipeline;

      // Count records as we stream
      const countingStream = new Readable({
        objectMode: true,
        read() {},
      });

      for await (const _ of this.streamBillsData(tenantId, filters)) {
        recordCount++;
      }

      // Update audit log with record count
      auditLog.record_count = recordCount;
      await this.exportAuditRepository.save(auditLog);

      // Create final stream with BOM and headers
      return Readable.from(
        (async function* (): AsyncGenerator<Buffer> {
          // Write BOM
          yield Buffer.from([0xef, 0xbb, 0xbf]);

          // Write headers
          const headers = 'Date,Description,Debit Account,Credit Account,Amount,Currency,Reference ID\n';
          yield Buffer.from(headers);

          // Stream data rows
          const dataGenerator = exportService.streamBillsData(tenantId, filters);
          for await (const row of dataGenerator) {
            const csvRow = transformBillToCsvRow(row);
            const line = Object.values(csvRow).map((v) =>
              typeof v === 'string' && (v.includes(',') || v.includes('"') || v.includes('\n'))
                ? `"${v.replace(/"/g, '""')}"`
                : v,
            ).join(',') + '\n';
            yield Buffer.from(line);
          }
        })(),
      );
    } catch (error) {
      // Log failure
      auditLog.status = ExportStatus.FAILED;
      auditLog.error_message = error instanceof Error ? error.message : 'Unknown error';
      await this.exportAuditRepository.save(auditLog);

      throw error;
    }
  }

  /**
   * Export accounts to CSV stream
   */
  async exportAccountsToCsv(dto: { account_types?: string[]; include_inactive?: boolean }): Promise<Readable> {
    const tenantId = TenantContext.requireTenantId();
    const userId = TenantContext.requireUserId();

    // Create audit log entry
    const auditLog = this.exportAuditRepository.create({
      tenant_id: tenantId,
      user_id: userId,
      export_type: ExportType.ACCOUNTS,
      filters_applied: dto as Record<string, unknown>,
      status: ExportStatus.SUCCESS,
    });

    try {
      // Query accounts with tenant isolation
      const queryBuilder = this.accountRepository
        .createQueryBuilder('account')
        .leftJoinAndSelect('account.parent', 'parent')
        .where('account.tenant_id = :tenantId', { tenantId })
        .orderBy('account.path', 'ASC');

      if (!dto.include_inactive) {
        queryBuilder.andWhere('account.is_active = :isActive', { isActive: true });
      }

      if (dto.account_types && dto.account_types.length > 0) {
        queryBuilder.andWhere('account.type IN (:...types)', { types: dto.account_types });
      }

      const accounts = await queryBuilder.getMany();

      // Update audit log
      auditLog.record_count = accounts.length;
      await this.exportAuditRepository.save(auditLog);

      // Create CSV stream
      return Readable.from(
        (async function* (): AsyncGenerator<Buffer> {
          // Write BOM
          yield Buffer.from([0xef, 0xbb, 0xbf]);

          // Write headers
          const headers = 'Account Name,Account Type,Parent Account,Currency,Balance,Is Active,Depth\n';
          yield Buffer.from(headers);

          // Stream account rows
          for (const account of accounts) {
            const row = [
              account.name,
              account.type,
              account.parent?.name || '',
              account.currency,
              '0.00', // Balance - placeholder
              account.is_active.toString(),
              account.depth.toString(),
            ];

            const line = row
              .map((v) =>
                typeof v === 'string' && (v.includes(',') || v.includes('"') || v.includes('\n'))
                  ? `"${v.replace(/"/g, '""')}"`
                  : v,
              )
              .join(',') + '\n';
            yield Buffer.from(line);
          }
        })(),
      );
    } catch (error) {
      // Log failure
      auditLog.status = ExportStatus.FAILED;
      auditLog.error_message = error instanceof Error ? error.message : 'Unknown error';
      await this.exportAuditRepository.save(auditLog);

      throw error;
    }
  }
}

const exportService = new ExportService(
  {} as Repository<JournalEntry>,
  {} as Repository<JournalLine>,
  {} as Repository<Account>,
  {} as Repository<ExportAuditLog>,
);
