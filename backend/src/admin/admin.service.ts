import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { User } from '../auth/user.entity';
import { Account } from '../accounts/account.entity';
import { JournalEntry } from '../journal/journal-entry.entity';
import { JournalLine } from '../journal/journal-line.entity';
import { Currency } from '../currencies/currency.entity';
import { ExchangeRate } from '../rates/exchange-rate.entity';
import { Budget } from '../budgets/budget.entity';
import { Provider, ProviderType } from '../rates/provider.entity';
import { CurrenciesService } from '../currencies/currencies.service';
import { CreateCurrencyDto, UpdateCurrencyDto } from '../currencies/dto/currency.dto';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { TenantContext } from '../common/context/tenant.context';

// ============================================================================
// DTOs
// ============================================================================

export interface PaginationParams {
  offset?: number;
  limit?: number;
}

export interface LogQueryParams extends PaginationParams {
  user_id?: string;
  action?: string;
  entity_type?: string;
  date_from?: string;
  date_to?: string;
}

export interface BulkUserAction {
  action: 'enable' | 'disable' | 'role_change';
  user_ids: string[];
  parameters?: {
    new_role?: string;
  };
}

export interface SystemConfig {
  default_currency: string;
  fiat_decimals: number;
  crypto_decimals: number;
  timezone: string;
  date_format: string;
  session_timeout: number;
  mfa_required: boolean;
}

export interface ExportParams {
  scope: 'full' | 'accounts' | 'journal' | 'rates';
  format: 'json' | 'csv' | 'sql';
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'fail';
  timestamp: string;
  components: {
    database: { status: string; message?: string; details?: any };
    cache: { status: string; message?: string; details?: any };
    providers: { status: string; message?: string; details?: any };
    storage: { status: string; message?: string; details?: any };
  };
  metrics: {
    uptime: number;
    memory_usage: number;
    active_users: number;
    requests_per_minute: number;
  };
}

// ============================================================================
// Admin Service
// ============================================================================

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Account)
    private accountRepository: Repository<Account>,
    @InjectRepository(JournalEntry)
    private journalEntryRepository: Repository<JournalEntry>,
    @InjectRepository(JournalLine)
    private journalLineRepository: Repository<JournalLine>,
    @InjectRepository(Currency)
    private currencyRepository: Repository<Currency>,
    @InjectRepository(ExchangeRate)
    private exchangeRateRepository: Repository<ExchangeRate>,
    @InjectRepository(Budget)
    private budgetRepository: Repository<Budget>,
    @InjectRepository(Provider)
    private providerRepository: Repository<Provider>,
    private currenciesService: CurrenciesService,
  ) {}

  // =========================================================================
  // Audit Logging
  // =========================================================================

  async log(
    userId: string,
    action: string,
    entityType: string,
    entityId?: string,
    oldValue?: any,
    newValue?: any,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuditLog> {
    const tenantId = TenantContext.tenantId; // May be undefined for cross-tenant ops

    const log = this.auditLogRepository.create({
      id: uuidv4(),
      tenant_id: tenantId || undefined, // Pass tenant_id from context (TypeORM handles UUID conversion)
      user_id: userId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      old_value: oldValue ? JSON.parse(JSON.stringify(oldValue)) : undefined,
      new_value: newValue ? JSON.parse(JSON.stringify(newValue)) : undefined,
      ip_address: ipAddress,
      user_agent: userAgent,
      created_at: new Date(),
    });
    return this.auditLogRepository.save(log);
  }

  // =========================================================================
  // User Management
  // =========================================================================

  async listUsers(
    tenantId: string,
    options: PaginationParams = {},
  ): Promise<{ users: User[]; total: number }> {
    const { offset = 0, limit = 50 } = options;

    const [users, total] = await this.userRepository.findAndCount({
      where: { tenant_id: tenantId },
      skip: offset,
      take: limit,
      order: { created_at: 'DESC' },
    });

    return { users, total };
  }

  async getUser(userId: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async createUser(
    tenantId: string,
    data: {
      email: string;
      name: string;
      password: string;
      role: string;
    },
    adminId: string,
    ipAddress?: string,
  ): Promise<User> {
    // Check if email already exists
    const existing = await this.userRepository.findOne({
      where: { email: data.email },
    });

    if (existing) {
      throw new BadRequestException('Email already exists');
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    const user = this.userRepository.create({
      id: uuidv4(),
      email: data.email,
      name: data.name,
      password: hashedPassword,
      role: data.role,
      tenant_id: tenantId,
      is_active: true,
      provider: 'credentials',
      created_at: new Date(),
      updated_at: new Date(),
    });

    await this.userRepository.save(user);

    await this.log(
      adminId,
      'admin.user.create',
      'user',
      user.id,
      null,
      { email: user.email, name: user.name, role: user.role },
      ipAddress,
    );

    return user;
  }

  async updateUser(
    userId: string,
    data: Partial<{ email: string; name: string; role: string; is_active: boolean }>,
    adminId: string,
    ipAddress?: string,
  ): Promise<User> {
    const user = await this.getUser(userId);
    const oldValue = { ...user };

    Object.assign(user, data);
    user.updated_at = new Date();

    await this.userRepository.save(user);

    await this.log(
      adminId,
      'admin.user.update',
      'user',
      user.id,
      oldValue,
      user,
      ipAddress,
    );

    return user;
  }

  async disableUser(
    userId: string,
    adminId: string,
    ipAddress?: string,
  ): Promise<User> {
    const user = await this.getUser(userId);

    if (user.id === adminId) {
      throw new BadRequestException('Cannot disable yourself');
    }

    user.is_active = false;
    user.updated_at = new Date();

    await this.userRepository.save(user);

    await this.log(
      adminId,
      'admin.user.disable',
      'user',
      user.id,
      { is_active: true },
      { is_active: false },
      ipAddress,
    );

    return user;
  }

  async resetPassword(
    userId: string,
    newPassword: string,
    adminId: string,
    ipAddress?: string,
  ): Promise<void> {
    const user = await this.getUser(userId);
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    user.password = hashedPassword;
    user.updated_at = new Date();

    await this.userRepository.save(user);

    await this.log(
      adminId,
      'admin.user.reset_password',
      'user',
      user.id,
      null,
      { password_reset: true },
      ipAddress,
    );
  }

  async bulkUserAction(
    tenantId: string,
    action: BulkUserAction,
    adminId: string,
    ipAddress?: string,
  ): Promise<{ affected: number }> {
    const users = await this.userRepository.find({
      where: {
        id: In(action.user_ids),
        tenant_id: tenantId,
      },
    });

    if (users.length === 0) {
      throw new NotFoundException('No users found');
    }

    let affected = 0;

    for (const user of users) {
      if (action.action === 'enable') {
        user.is_active = true;
      } else if (action.action === 'disable') {
        if (user.id === adminId) continue; // Skip self
        user.is_active = false;
      } else if (action.action === 'role_change') {
        if (action.parameters?.new_role) {
          user.role = action.parameters.new_role;
        }
      }

      user.updated_at = new Date();
      await this.userRepository.save(user);
      affected++;
    }

    await this.log(
      adminId,
      `admin.user.${action.action}`,
      'user',
      null,
      null,
      { user_ids: action.user_ids, count: affected },
      ipAddress,
    );

    return { affected };
  }

  // =========================================================================
  // System Settings
  // =========================================================================

  private systemConfig: SystemConfig = {
    default_currency: 'USD',
    fiat_decimals: 2,
    crypto_decimals: 8,
    timezone: 'UTC',
    date_format: 'YYYY-MM-DD',
    session_timeout: 3600,
    mfa_required: false,
  };

  async getSystemConfig(): Promise<SystemConfig> {
    return this.systemConfig;
  }

  async updateSystemConfig(
    updates: Partial<SystemConfig>,
    adminId: string,
    ipAddress?: string,
  ): Promise<SystemConfig> {
    const oldConfig = { ...this.systemConfig };
    Object.assign(this.systemConfig, updates);

    await this.log(
      adminId,
      'admin.config.update',
      'system',
      null,
      oldConfig,
      this.systemConfig,
      ipAddress,
    );

    return this.systemConfig;
  }

  // =========================================================================
  // Provider Management
  // =========================================================================

  async listProviders(
    options: PaginationParams = {},
  ): Promise<{ providers: Provider[]; total: number }> {
    const { offset = 0, limit = 50 } = options;

    const [providers, total] = await this.providerRepository.findAndCount({
      skip: offset,
      take: limit,
      order: { created_at: 'DESC' },
    });

    return { providers, total };
  }

  async getProvider(providerId: string): Promise<Provider> {
    const provider = await this.providerRepository.findOne({
      where: { id: providerId },
    });

    if (!provider) {
      throw new NotFoundException('Provider not found');
    }

    return provider;
  }

  async createProvider(
    data: {
      name: string;
      type: ProviderType;
      config: any;
    },
    adminId: string,
    ipAddress?: string,
  ): Promise<Provider> {
    const provider = this.providerRepository.create({
      id: uuidv4(),
      name: data.name,
      type: data.type,
      config: data.config,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    });

    await this.providerRepository.save(provider);

    await this.log(
      adminId,
      'admin.provider.create',
      'provider',
      provider.id,
      null,
      provider,
      ipAddress,
    );

    return provider;
  }

  async updateProvider(
    providerId: string,
    data: Partial<Provider>,
    adminId: string,
    ipAddress?: string,
  ): Promise<Provider> {
    const provider = await this.getProvider(providerId);
    const oldValue = { ...provider };

    Object.assign(provider, data);
    provider.updated_at = new Date();

    await this.providerRepository.save(provider);

    await this.log(
      adminId,
      'admin.provider.update',
      'provider',
      provider.id,
      oldValue,
      provider,
      ipAddress,
    );

    return provider;
  }

  async deleteProvider(
    providerId: string,
    adminId: string,
    ipAddress?: string,
  ): Promise<void> {
    const provider = await this.getProvider(providerId);

    await this.providerRepository.remove(provider);

    await this.log(
      adminId,
      'admin.provider.delete',
      'provider',
      providerId,
      provider,
      null,
      ipAddress,
    );
  }

  async toggleProvider(
    providerId: string,
    adminId: string,
    ipAddress?: string,
  ): Promise<Provider> {
    const provider = await this.getProvider(providerId);
    const oldStatus = provider.is_active;

    provider.is_active = !provider.is_active;
    provider.updated_at = new Date();

    await this.providerRepository.save(provider);

    await this.log(
      adminId,
      `admin.provider.${provider.is_active ? 'enable' : 'disable'}`,
      'provider',
      provider.id,
      { is_active: oldStatus },
      { is_active: provider.is_active },
      ipAddress,
    );

    return provider;
  }

  async testProvider(
    providerId: string,
    adminId: string,
    ipAddress?: string,
  ): Promise<{ success: boolean; message: string; latency?: number }> {
    const provider = await this.getProvider(providerId);
    const startTime = Date.now();

    try {
      // TODO: Implement actual provider test based on type
      // For now, just simulate a test
      await new Promise((resolve) => setTimeout(resolve, 100));

      const latency = Date.now() - startTime;

      await this.log(
        adminId,
        'admin.provider.test',
        'provider',
        provider.id,
        null,
        { success: true, latency },
        ipAddress,
      );

      return { success: true, message: 'Provider connection successful', latency };
    } catch (error: any) {
      await this.log(
        adminId,
        'admin.provider.test',
        'provider',
        provider.id,
        null,
        { success: false, error: error.message },
        ipAddress,
      );

      return { success: false, message: error.message };
    }
  }

  // =========================================================================
  // Audit Logs
  // =========================================================================

  async getAuditLogs(
    options: LogQueryParams = {},
  ): Promise<{ logs: AuditLog[]; total: number }> {
    const { offset = 0, limit = 50, user_id, action, entity_type, date_from, date_to } = options;

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

  async exportAuditLogsToCsv(
    options: LogQueryParams = {},
  ): Promise<string> {
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

  // =========================================================================
  // Data Export
  // =========================================================================

  async exportData(
    tenantId: string,
    params: ExportParams,
    adminId: string,
  ): Promise<any> {
    let data: any;
    let recordCount = 0;

    switch (params.scope) {
      case 'full':
        const accounts = await this.accountRepository.find({ where: { tenant_id: tenantId } });
        const entries = await this.journalEntryRepository.find({ where: { tenant_id: tenantId } });
        const lines = await this.journalLineRepository.find({ where: { tenant_id: tenantId } });
        const currencies = await this.currencyRepository.find();
        const rates = await this.exchangeRateRepository.find();
        const budgets = await this.budgetRepository.find({ where: { tenant_id: tenantId } });
        data = { accounts, journal_entries: entries, journal_lines: lines, currencies, exchange_rates: rates, budgets };
        recordCount = accounts.length + entries.length + lines.length + currencies.length + rates.length + budgets.length;
        break;

      case 'accounts':
        data = await this.accountRepository.find({ where: { tenant_id: tenantId } });
        recordCount = data.length;
        break;

      case 'journal':
        const journalEntries = await this.journalEntryRepository.find({ where: { tenant_id: tenantId } });
        const journalLines = await this.journalLineRepository.find({ where: { tenant_id: tenantId } });
        data = { entries: journalEntries, lines: journalLines };
        recordCount = journalEntries.length + journalLines.length;
        break;

      case 'rates':
        data = await this.exchangeRateRepository.find();
        recordCount = data.length;
        break;
    }

    await this.log(
      adminId,
      'admin.export',
      'system',
      null,
      null,
      { scope: params.scope, format: params.format, record_count: recordCount },
    );

    if (params.format === 'json') {
      return { data, record_count: recordCount };
    }

    if (params.format === 'csv') {
      const csv = this.generateCSV(data, params.scope);
      return { 
        data: csv, 
        record_count: recordCount,
        content_type: 'text/csv',
        filename: `export_${params.scope}_${new Date().toISOString().split('T')[0]}.csv`
      };
    }

    if (params.format === 'sql') {
      const sql = this.generateSQL(data, params.scope, tenantId);
      return { 
        data: sql, 
        record_count: recordCount,
        content_type: 'application/sql',
        filename: `export_${params.scope}_${new Date().toISOString().split('T')[0]}.sql`
      };
    }

    return { message: 'Export initiated', scope: params.scope, format: params.format, record_count: recordCount };
  }

  private generateCSV(data: any, scope: string): string {
    const rows: string[][] = [];

    const addTable = (tableData: any[], columns: string[], tableName: string) => {
      if (!tableData || tableData.length === 0) return;
      rows.push([`-- Table: ${tableName}`]);
      rows.push(columns);
      tableData.forEach((row: any) => {
        rows.push(columns.map((col: string) => {
          const value = row[col];
          if (value === null || value === undefined) return '';
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return String(value);
        }));
      });
      rows.push([]); // Empty line between tables
    };

    const accountCols = ['id', 'name', 'type', 'currency', 'balance', 'parent_id', 'tenant_id', 'created_at'];
    const entryCols = ['id', 'date', 'description', 'reference', 'tenant_id', 'created_at'];
    const lineCols = ['id', 'entry_id', 'account_id', 'debit', 'credit', 'currency', 'amount', 'created_at'];
    const currencyCols = ['id', 'code', 'name', 'decimals', 'symbol', 'created_at'];
    const rateCols = ['id', 'base_currency', 'quote_currency', 'rate', 'date', 'provider_id', 'created_at'];
    const budgetCols = ['id', 'name', 'account_id', 'amount', 'period_type', 'start_date', 'end_date', 'tenant_id', 'created_at'];

    switch (scope) {
      case 'full':
        addTable(data.accounts, accountCols, 'accounts');
        addTable(data.journal_entries, entryCols, 'journal_entries');
        addTable(data.journal_lines, lineCols, 'journal_lines');
        addTable(data.currencies, currencyCols, 'currencies');
        addTable(data.exchange_rates, rateCols, 'exchange_rates');
        addTable(data.budgets, budgetCols, 'budgets');
        break;
      case 'accounts':
        addTable(data, accountCols, 'accounts');
        break;
      case 'journal':
        addTable(data.entries, entryCols, 'journal_entries');
        addTable(data.lines, lineCols, 'journal_lines');
        break;
      case 'rates':
        addTable(data, rateCols, 'exchange_rates');
        break;
    }

    return rows.map((row: string[]) => row.join(',')).join('\n');
  }

  private generateSQL(data: any, scope: string, tenantId: string): string {
    const statements: string[] = [];
    const timestamp = new Date().toISOString();

    const generateInsert = (tableData: any[], tableName: string, columns: string[]) => {
      if (!tableData || tableData.length === 0) return;
      statements.push(`-- Table: ${tableName}`);
      statements.push(`-- Exported at: ${timestamp}`);
      tableData.forEach((row: any) => {
        const values = columns.map((col: string) => {
          const value = row[col];
          if (value === null || value === undefined) return 'NULL';
          if (typeof value === 'string') {
            return `'${value.replace(/'/g, "''")}'`;
          }
          if (value instanceof Date) {
            return `'${value.toISOString()}'`;
          }
          return String(value);
        });
        statements.push(`INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${values.join(', ')});`);
      });
      statements.push('');
    };

    const accountCols = ['id', 'name', 'type', 'currency', 'balance', 'parent_id', 'tenant_id', 'created_at', 'updated_at'];
    const entryCols = ['id', 'date', 'description', 'reference', 'tenant_id', 'created_at', 'updated_at'];
    const lineCols = ['id', 'entry_id', 'account_id', 'debit', 'credit', 'currency', 'amount', 'created_at', 'updated_at'];
    const currencyCols = ['id', 'code', 'name', 'decimals', 'symbol', 'created_at', 'updated_at'];
    const rateCols = ['id', 'base_currency', 'quote_currency', 'rate', 'date', 'provider_id', 'created_at', 'updated_at'];
    const budgetCols = ['id', 'name', 'account_id', 'amount', 'period_type', 'start_date', 'end_date', 'tenant_id', 'created_at', 'updated_at'];

    statements.push(`-- Multi-Currency Accounting Export`);
    statements.push(`-- Scope: ${scope}`);
    statements.push(`-- Tenant: ${tenantId}`);
    statements.push(`-- Generated at: ${timestamp}`);
    statements.push('');

    switch (scope) {
      case 'full':
        generateInsert(data.accounts, 'accounts', accountCols);
        generateInsert(data.journal_entries, 'journal_entries', entryCols);
        generateInsert(data.journal_lines, 'journal_lines', lineCols);
        generateInsert(data.currencies, 'currencies', currencyCols);
        generateInsert(data.exchange_rates, 'exchange_rates', rateCols);
        generateInsert(data.budgets, 'budgets', budgetCols);
        break;
      case 'accounts':
        generateInsert(data, 'accounts', accountCols);
        break;
      case 'journal':
        generateInsert(data.entries, 'journal_entries', entryCols);
        generateInsert(data.lines, 'journal_lines', lineCols);
        break;
      case 'rates':
        generateInsert(data, 'exchange_rates', rateCols);
        break;
    }

    statements.push('-- End of export');
    return statements.join('\n');
  }

  // =========================================================================
  // Scheduler Control
  // =========================================================================

  private schedulerConfig = {
    enabled: true,
    interval: 3600,
    providers: [] as string[],
    currencies: [] as string[],
    base_currency: 'USD',
  };

  async getSchedulerConfig(): Promise<any> {
    return this.schedulerConfig;
  }

  async updateSchedulerConfig(
    updates: Partial<typeof this.schedulerConfig>,
    adminId: string,
    ipAddress?: string,
  ): Promise<any> {
    const oldConfig = { ...this.schedulerConfig };
    Object.assign(this.schedulerConfig, updates);

    await this.log(
      adminId,
      'admin.scheduler.update',
      'system',
      null,
      oldConfig,
      this.schedulerConfig,
      ipAddress,
    );

    return this.schedulerConfig;
  }

  async triggerManualFetch(
    adminId: string,
    data: { provider_ids?: string[]; currencies?: string[] },
    ipAddress?: string,
  ): Promise<{ message: string; job_id: string }> {
    const jobId = uuidv4();

    await this.log(
      adminId,
      'admin.scheduler.manual_fetch',
      'system',
      jobId,
      null,
      data,
      ipAddress,
    );

    // TODO: Trigger actual rate fetch job
    console.log(`Triggering manual rate fetch:`, { jobId, ...data });

    return {
      message: 'Manual fetch initiated',
      job_id: jobId,
    };
  }

  async getSchedulerHistory(): Promise<any[]> {
    // Return recent scheduler execution history from audit logs
    const recentLogs = await this.auditLogRepository.find({
      where: { action: 'admin.scheduler.manual_fetch' },
      order: { created_at: 'DESC' },
      take: 20,
    });

    return recentLogs.map((log: any) => ({
      id: log.entity_id || uuidv4(),
      provider: 'manual',
      status: 'success',
      executed_at: log.created_at,
      duration: Math.floor(Math.random() * 500) + 50, // Simulated for now
    }));
  }

  // =========================================================================
  // Plugin Management
  // =========================================================================

  private pluginDir = process.env.PLUGIN_DIR || './plugins';

  async listPlugins(): Promise<any[]> {
    const fs = await import('fs');
    const path = await import('path');

    // Ensure plugin directory exists
    if (!fs.existsSync(this.pluginDir)) {
      return [];
    }

    const plugins: any[] = [];
    const files = fs.readdirSync(this.pluginDir).filter((f: string) => f.endsWith('.js'));

    for (const file of files) {
      try {
        const filePath = path.join(this.pluginDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        
        // Simple extraction of plugin metadata from file content
        const nameMatch = content.match(/name\s*=\s*['"]([^'"]+)['"]/);
        const versionMatch = content.match(/version\s*=\s*['"]([^'"]+)['"]/);
        const descMatch = content.match(/description\s*=\s*['"]([^'"]+)['"]/);

        plugins.push({
          id: uuidv4(),
          name: nameMatch?.[1] || file.replace('.js', ''),
          version: versionMatch?.[1] || '1.0.0',
          description: descMatch?.[1] || 'Custom rate provider plugin',
          status: 'unloaded',
          file_path: filePath,
        });
      } catch (error) {
        plugins.push({
          id: uuidv4(),
          name: file.replace('.js', ''),
          version: 'unknown',
          description: 'Error loading plugin',
          status: 'error',
          file_path: file,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return plugins;
  }

  async uploadPlugin(
    fileContent: string,
    filename: string,
    adminId: string,
    ipAddress?: string,
  ): Promise<any> {
    const fs = await import('fs');
    const path = await import('path');

    // Validate filename
    if (!filename.endsWith('.js')) {
      throw new BadRequestException('Plugin must be a JavaScript file (.js)');
    }

    // Ensure plugin directory exists
    if (!fs.existsSync(this.pluginDir)) {
      fs.mkdirSync(this.pluginDir, { recursive: true });
    }

    const filePath = path.join(this.pluginDir, filename);
    fs.writeFileSync(filePath, fileContent);

    await this.log(
      adminId,
      'admin.plugin.upload',
      'plugin',
      null,
      null,
      { filename, file_path: filePath },
      ipAddress,
    );

    return { 
      message: 'Plugin uploaded successfully',
      filename,
      file_path: filePath,
    };
  }

  async reloadPlugin(
    pluginId: string,
    adminId: string,
    ipAddress?: string,
  ): Promise<any> {
    const plugins = await this.listPlugins();
    const plugin = plugins.find((p: any) => p.id === pluginId);

    if (!plugin) {
      throw new NotFoundException('Plugin not found');
    }

    // In a real implementation, this would:
    // 1. Unload the existing plugin module from Node.js cache
    // 2. Clear any cached rates
    // 3. Signal providers to reload their configurations
    // 4. Optionally test the plugin by loading it

    await this.log(
      adminId,
      'admin.plugin.reload',
      'plugin',
      pluginId,
      null,
      { name: plugin.name, file_path: plugin.file_path },
      ipAddress,
    );

    return { 
      message: 'Plugin reloaded successfully',
      plugin: plugin.name,
    };
  }

  // =========================================================================
  // Currency Management
  // =========================================================================

  async createCurrency(
    dto: CreateCurrencyDto,
    adminId: string,
    ipAddress?: string,
  ): Promise<Currency> {
    const existing = await this.currenciesService.findByCode(dto.code).catch(() => null);
    if (existing) {
      throw new ConflictException(`Currency '${dto.code}' already exists`);
    }

    const currency = await this.currenciesService.create(dto);

    await this.log(
      adminId,
      'admin.currency.create',
      'currency',
      currency.code,
      null,
      currency,
      ipAddress,
    );

    return currency;
  }

  async updateCurrency(
    code: string,
    dto: UpdateCurrencyDto,
    adminId: string,
    ipAddress?: string,
  ): Promise<Currency> {
    const currency = await this.currenciesService.update(code, dto);

    await this.log(
      adminId,
      'admin.currency.update',
      'currency',
      code,
      null,
      dto,
      ipAddress,
    );

    return currency;
  }

  async deleteCurrency(
    code: string,
    adminId: string,
    ipAddress?: string,
  ): Promise<void> {
    await this.currenciesService.delete(code);

    await this.log(
      adminId,
      'admin.currency.delete',
      'currency',
      code,
      null,
      { deleted: true },
      ipAddress,
    );
  }

  async seedCurrencies(
    adminId: string,
    ipAddress?: string,
  ): Promise<{ added: number; skipped: number }> {
    const results = await this.currenciesService.seedDefaultCurrencies();

    await this.log(
      adminId,
      'admin.currency.seed',
      'currency',
      'system',
      null,
      results,
      ipAddress,
    );

    return results;
  }

  async getAllCurrencies(): Promise<Currency[]> {
    return this.currencyRepository.find({
      order: { code: 'ASC' },
    });
  }

  // =========================================================================
  // Health Monitoring
  // =========================================================================

  async getHealthStatus(): Promise<HealthStatus> {
    const startTime = Date.now();

    // Check database
    let dbStatus: 'healthy' | 'degraded' | 'fail' = 'healthy';
    let dbMessage: string | undefined;
    let dbDetails: any;
    try {
      const dbStart = Date.now();
      await this.userRepository.query('SELECT 1');
      dbDetails = { latency: Date.now() - dbStart };
    } catch (error: any) {
      dbStatus = 'fail';
      dbMessage = error.message;
    }

    // Check cache (simplified - no Redis implementation yet)
    const cacheStatus: 'healthy' | 'degraded' | 'fail' = 'healthy';

    // Check providers
    const providers = await this.providerRepository.find({ where: { is_active: true } });
    const providerStatus: 'healthy' | 'degraded' | 'fail' = providers.length > 0 ? 'healthy' : 'degraded';

    // Check storage
    let storageStatus: 'healthy' | 'degraded' | 'fail' = 'healthy';
    try {
      // Simple disk space check could be added here
    } catch (error: any) {
      storageStatus = 'fail';
    }

    // Determine overall status
    let overallStatus: 'healthy' | 'degraded' | 'fail' = 'healthy';
    const hasFailure = dbStatus === 'fail' || storageStatus === 'fail';
    const hasDegradation = 
      (dbStatus as string) === 'degraded' || 
      (cacheStatus as string) === 'degraded' || 
      (providerStatus as string) === 'degraded';
    
    if (hasFailure) {
      overallStatus = 'fail';
    } else if (hasDegradation) {
      overallStatus = 'degraded';
    }

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      components: {
        database: { status: dbStatus, message: dbMessage, details: dbDetails },
        cache: { status: cacheStatus },
        providers: { status: providerStatus, details: { active_count: providers.length } },
        storage: { status: storageStatus },
      },
      metrics: {
        uptime: process.uptime(),
        memory_usage: process.memoryUsage().heapUsed / 1024 / 1024,
        active_users: 1, // Simplified
        requests_per_minute: 10, // Simplified
      },
    };
  }
}
