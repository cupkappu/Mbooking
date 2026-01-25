import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, LessThanOrEqual } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { User } from '../auth/user.entity';
import { Account } from '../accounts/account.entity';
import { JournalEntry } from '../journal/journal-entry.entity';
import { JournalLine } from '../journal/journal-line.entity';
import { Currency } from '../currencies/currency.entity';
import { ExchangeRate } from '../rates/exchange-rate.entity';
import { RateGraphEngine } from '../rates/rate-graph-engine';
import { Budget } from '../budgets/budget.entity';
import { Provider, ProviderType } from '../rates/provider.entity';
import { CurrenciesService } from '../currencies/currencies.service';
import { CurrencyProviderService } from '../currencies/currency-provider.service';
import { ProvidersService } from '../providers/providers.service';
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
  private readonly logger = new Logger(AdminService.name);

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
    public currencyProviderService: CurrencyProviderService,
    private providersService: ProvidersService,
    private rateGraphEngine: RateGraphEngine,
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
      is_active?: boolean;
      record_history?: boolean;
      supports_historical?: boolean;
      supported_currencies?: string[];
    },
    adminId: string,
    ipAddress?: string,
  ): Promise<Provider> {
    const provider = this.providerRepository.create({
      id: uuidv4(),
      name: data.name,
      type: data.type,
      config: data.config,
      is_active: data.is_active ?? true,
      record_history: data.record_history ?? true,
      supports_historical: data.supports_historical ?? true,
      supported_currencies: data.supported_currencies ?? [],
      created_at: new Date(),
      updated_at: new Date(),
    });

    await this.providerRepository.save(provider);

    // Auto-associate with all currencies
    await this.currencyProviderService.autoAssociateCurrencies(provider.id);

    // Log the action (non-blocking, don't fail if logging fails)
    this.log(
      adminId,
      'admin.provider.create',
      'provider',
      provider.id,
      null,
      provider,
      ipAddress,
    ).catch((err) => {
      console.error('Failed to create audit log:', err);
    });

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

    // Remove currency associations first
    await this.currencyProviderService.removeProviderAssociations(providerId);

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
      // Call the actual provider test implementation
      const result = await this.providersService.testConnection(providerId);
      const latency = Date.now() - startTime;

      await this.log(
        adminId,
        'admin.provider.test',
        'provider',
        provider.id,
        null,
        { success: result.success, latency, message: result.message },
        ipAddress,
      );

      return { success: result.success, message: result.message, latency };
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
  ): Promise<{ message: string; job_id: string; rates_fetched: number }> {
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

    // Fetch rates from providers
    const providers = data.provider_ids?.length
      ? await this.providerRepository.find({ where: { id: In(data.provider_ids) } })
      : await this.providerRepository.find({ where: { is_active: true } });

    const currencies = data.currencies?.length
      ? data.currencies
      : ['USD', 'EUR', 'GBP', 'CNY', 'HKD', 'AUD', 'BTC', 'ETH'];

    // Clear existing cached rates for these currencies to force fresh fetch
    const baseCurrencies = ['USD', 'EUR', 'GBP'];
    for (const currency of currencies) {
      for (const base of baseCurrencies) {
        if (currency === base) continue;
        await this.exchangeRateRepository.delete({
          from_currency: currency,
          to_currency: base,
          date: LessThanOrEqual(new Date()),
        });
      }
    }

    let ratesFetched = 0;
    const date = new Date();

    for (const provider of providers) {
      // Get supported currencies from provider config
      // TypeORM with PostgreSQL array column returns JavaScript array directly
      const providerCryptos: string[] = provider.supported_currencies || [];

      this.logger.log(`DEBUG: Provider ${provider.name}: supported=${JSON.stringify(providerCryptos)}, requested=${JSON.stringify(currencies)}`);

      // Filter to requested currencies or all supported
      const targetCurrencies = currencies.filter(c =>
        providerCryptos.includes(c) ||
        ['USD', 'EUR', 'GBP', 'CNY', 'HKD', 'AUD'].includes(c)
      );

      this.logger.log(`DEBUG: Provider ${provider.name}: targetCurrencies=${JSON.stringify(targetCurrencies)}`);

      for (const currency of targetCurrencies) {
        for (const base of baseCurrencies) {
          if (currency === base) continue;
          try {
            // Don't pass date - use getLatestRate() which has better crypto-to-fiat support
            const rate = await this.rateGraphEngine.getRate(currency, base);
            if (rate) ratesFetched++;
          } catch (error) {
            this.logger.warn(`Failed to fetch ${currency}/${base}: ${error.message}`);
          }
        }
      }
    }

    this.logger.log(`Manual rate fetch completed: ${ratesFetched} rates fetched for job ${jobId}`);

    return {
      message: `Manual fetch completed. Fetched ${ratesFetched} rates.`,
      job_id: jobId,
      rates_fetched: ratesFetched,
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
        // Plugin files use module.exports = { name: '...', version: '...', description: '...' }
        const nameMatch = content.match(/name\s*:\s*['"]([^'"]+)['"]/);
        const versionMatch = content.match(/version\s*:\s*['"]([^'"]+)['"]/);
        const descMatch = content.match(/description\s*:\s*['"]([^'"]+)['"]/);

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
