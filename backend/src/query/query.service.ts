import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In, Like } from 'typeorm';
import { Account, AccountType } from '../accounts/account.entity';
import { JournalEntry } from '../journal/journal-entry.entity';
import { JournalLine } from '../journal/journal-line.entity';
import { RateGraphEngine } from '../rates/services/rate-graph.engine';
import { TenantContext } from '../common/context/tenant.context';
import { TenantsService } from '../tenants/tenants.service';

export interface BalanceQuery {
  date_range?: { from: string; to: string };
  depth?: number;
  account_filter?: {
    types?: AccountType[];
    paths?: string[];
  };
  convert_to?: string;
  exchange_rate_date?: 'latest' | 'query_date' | 'specific_date';
  specific_date?: string;
  pagination?: { offset?: number; limit?: number };
  use_cache?: boolean;
  include_subtree?: boolean;
  subtree_account_ids?: string[];
}

export interface JournalQuery {
  date_range?: { from: string; to: string };
  account_filter?: {
    paths?: string[];
    types?: AccountType[];
    include_children?: boolean;
  };
  tags?: string[];
  search?: string;
  sort?: { field: string; order: 'asc' | 'desc' };
  pagination?: { offset?: number; limit?: number };
}

export interface CurrencyBalance {
  currency: string;
  amount: number;
}

export interface AccountBalance {
  account: Account;
  currencies: CurrencyBalance[];
  converted_amount?: number;
  converted_total?: number; // 所有货币转换成 default currency 后加总
  subtree_currencies?: CurrencyBalance[];
  converted_subtree_total?: number;
  converted_subtree_currency?: string;
}

export interface JournalLineData {
  id: string;
  account_id: string;
  amount: number;
  currency: string;
  exchange_rate?: number;
  converted_amount?: number;
  tags: string[];
}

export interface DashboardSummary {
  /** 按货币分别显示的资产余额，如 "1000 HKD + 50 USD" */
  assets: { [currency: string]: number };
  /** 换算为默认货币后的资产总额 */
  converted_assets: number;
  /** 按货币分别显示的负债余额 */
  liabilities: { [currency: string]: number };
  /** 换算为默认货币后的负债总额 */
  converted_liabilities: number;
  /** 换算为单一货币后的净资产（使用系统默认货币） */
  netWorth: number;
  recentTransactions: {
    id: string;
    date: string;
    description: string;
    amount: number;
    currency: string;
    lines?: JournalLineData[];
  }[];
}

@Injectable()
export class QueryService {
  private readonly logger = new Logger(QueryService.name);
  private cache: Map<string, { data: any; expiresAt: number }> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000;

  constructor(
    @InjectRepository(Account)
    private accountRepository: Repository<Account>,
    @InjectRepository(JournalEntry)
    private journalEntryRepository: Repository<JournalEntry>,
    @InjectRepository(JournalLine)
    private journalLineRepository: Repository<JournalLine>,
    private rateGraphEngine: RateGraphEngine,
    private tenantsService: TenantsService,
  ) {}

  private async getDefaultCurrency(): Promise<string> {
    const tenantId = TenantContext.requireTenantId();
    try {
      const tenant = await this.tenantsService.findById(tenantId);
      return tenant.settings?.default_currency || 'USD';
    } catch {
      return 'USD';
    }
  }

  async getBalances(query: BalanceQuery): Promise<{
    balances: AccountBalance[];
    pagination: { offset: number; limit: number; total: number; has_more: boolean };
    meta: { cache_hit: boolean; calculated_at: string };
  }> {
    const tenantId = TenantContext.requireTenantId();
    const cacheKey = this.generateCacheKey('balances', tenantId, query);
    const cached = this.getFromCache(cacheKey);
    if (cached && query.use_cache !== false) {
      return { ...cached, meta: { ...cached.meta, cache_hit: true } };
    }

    const depth = query.depth || 1;
    
    let accounts = await this.accountRepository.find({
      where: { tenant_id: tenantId, is_active: true },
      order: { path: 'ASC' },
    });

    if (query.account_filter?.types?.length) {
      accounts = accounts.filter((a) => query.account_filter!.types!.includes(a.type));
    }

    const balances = await Promise.all(
      accounts.map(async (account) => {
        const currencyBalances = await this.calculateAccountBalance(
          account.id,
          tenantId,
          query.date_range,
        );

        let result: AccountBalance = { account, currencies: currencyBalances };

        if (query.include_subtree) {
          const shouldCalculateSubtree = !query.subtree_account_ids || 
                                        query.subtree_account_ids.includes(account.id);
          
            if (shouldCalculateSubtree) {
            const subtreeBalances = await this.calculateSubtreeBalance(
              account.id,
              query.date_range,
            );
            
            result.subtree_currencies = subtreeBalances;
            
            // Calculate converted total from original currencies (NOT from already-converted values)
            if (query.convert_to) {
              let totalConverted = 0;
              for (const balance of subtreeBalances) {
                if (balance.currency === query.convert_to) {
                  totalConverted += balance.amount;
                } else {
                  // Get rate from original currency to target currency
                  const rate = await this.rateGraphEngine.getRate(
                    balance.currency,
                    query.convert_to,
                    { date: query.specific_date ? new Date(query.specific_date) : undefined }
                  );
                  if (rate) {
                    totalConverted += balance.amount * rate.rate;
                  }
                }
              }
              result.converted_subtree_total = totalConverted;
              result.converted_subtree_currency = query.convert_to;
            }
          }
        }

        if (query.convert_to) {
          // Keep original currencies, add converted_amount
          result.currencies = currencyBalances;
          const converted = await this.convertBalances(
            currencyBalances,
            query.convert_to,
            query.exchange_rate_date,
            query.specific_date,
          );
          result.converted_amount = converted[0]?.amount || 0;
        } else {
          result.currencies = currencyBalances;
        }

        // Calculate converted_total: all currencies converted to default currency and summed
        const defaultCurrency = await this.getDefaultCurrency();
        let convertedTotal = 0;
        for (const balance of currencyBalances) {
          if (balance.currency === defaultCurrency) {
            convertedTotal += balance.amount;
          } else {
            const rate = await this.rateGraphEngine.getRate(balance.currency, defaultCurrency, {
              date: query.specific_date ? new Date(query.specific_date) : undefined,
            });
            if (rate) {
              convertedTotal += balance.amount * rate.rate;
            } else {
              convertedTotal += balance.amount;
            }
          }
        }
        result.converted_total = convertedTotal;

        return result;
      }),
    );

    const merged = this.mergeByDepth(balances, query.depth);
    const total = merged.length;
    const offset = query.pagination?.offset || 0;
    const limit = query.pagination?.limit || 50;
    const paginated = merged.slice(offset, offset + limit);

    const result = {
      balances: paginated,
      pagination: {
        offset,
        limit,
        total,
        has_more: offset + limit < total,
      },
      meta: {
        cache_hit: false,
        calculated_at: new Date().toISOString(),
      },
    };

    this.setCache(cacheKey, result);
    return result;
  }

  async getJournalEntries(query: JournalQuery): Promise<{
    entries: JournalEntry[];
    pagination: { offset: number; limit: number; total: number; has_more: boolean };
    meta: { cache_hit: boolean };
  }> {
    const tenantId = TenantContext.requireTenantId();
    const offset = query.pagination?.offset || 0;
    const limit = query.pagination?.limit || 50;

    const whereClause: any = { tenant_id: tenantId };

    if (query.date_range) {
      whereClause.date = Between(new Date(query.date_range.from), new Date(query.date_range.to));
    }

    const [entries, total] = await this.journalEntryRepository.findAndCount({
      where: whereClause,
      relations: ['lines'],
      order: { date: query.sort?.order === 'asc' ? 'ASC' : 'DESC' },
      skip: offset,
      take: limit,
    });

    return {
      entries,
      pagination: {
        offset,
        limit,
        total,
        has_more: offset + limit < total,
      },
      meta: { cache_hit: false },
    };
  }

  async getSummary(): Promise<DashboardSummary> {
    const tenantId = TenantContext.requireTenantId();
    const defaultCurrency = await this.getDefaultCurrency();

    // Get all accounts
    const accounts = await this.accountRepository.find({
      where: { tenant_id: tenantId, is_active: true },
    });

    // Calculate total assets per currency (NOT mixing currencies)
    const assetAccounts = accounts.filter(a => a.type === 'assets');
    const assetsByCurrency: { [currency: string]: number } = {};
    for (const account of assetAccounts) {
      const balances = await this.calculateAccountBalance(account.id, tenantId);
      for (const balance of balances) {
        assetsByCurrency[balance.currency] = (assetsByCurrency[balance.currency] || 0) + balance.amount;
      }
    }

    // Calculate total liabilities per currency (NOT mixing currencies)
    const liabilityAccounts = accounts.filter(a => a.type === 'liabilities');
    const liabilitiesByCurrency: { [currency: string]: number } = {};
    for (const account of liabilityAccounts) {
      const balances = await this.calculateAccountBalance(account.id, tenantId);
      for (const balance of balances) {
        liabilitiesByCurrency[balance.currency] = (liabilitiesByCurrency[balance.currency] || 0) + balance.amount;
      }
    }

    // Calculate converted totals in default currency
    const allCurrencies = Object.keys({ ...assetsByCurrency, ...liabilitiesByCurrency });
    let convertedAssets = 0;
    let convertedLiabilities = 0;
    let netWorth = 0;

    for (const currency of allCurrencies) {
      const assets = assetsByCurrency[currency] || 0;
      const liabilities = liabilitiesByCurrency[currency] || 0;
      const balance = assets - liabilities;

      if (currency === defaultCurrency) {
        convertedAssets += assets;
        convertedLiabilities += liabilities;
        netWorth += balance;
      } else {
        const rate = await this.rateGraphEngine.getRate(currency, defaultCurrency, {});
        if (rate) {
          convertedAssets += assets * rate.rate;
          convertedLiabilities += liabilities * rate.rate;
          netWorth += balance * rate.rate;
        }
      }
    }

    // Get recent transactions
    const recentEntries = await this.journalEntryRepository.find({
      where: { tenant_id: tenantId },
      relations: ['lines'],
      order: { date: 'DESC', created_at: 'DESC' },
      take: 10,
    });

    const recentTransactions = await Promise.all(recentEntries.map(async (entry) => {
      // Calculate net amount for the entry using converted values
      let netAmount = 0;
      for (const line of entry.lines) {
        if (line.amount > 0) {
          // Calculate converted amount on the fly
          const rate = await this.rateGraphEngine.getRate(line.currency, defaultCurrency, {});
          if (rate) {
            netAmount += line.amount * rate.rate;
          } else {
            netAmount += line.amount;
          }
        }
      }
      // Get the primary currency of this entry (use first line's currency)
      const primaryCurrency = entry.lines?.[0]?.currency || defaultCurrency;
      return {
        id: entry.id,
        date: typeof entry.date === 'string' ? entry.date : entry.date.toISOString().split('T')[0],
        description: entry.description,
        amount: Math.round(netAmount * 100) / 100,
        currency: primaryCurrency,
        lines: entry.lines.map((line: any) => ({
          id: line.id,
          account_id: line.account_id,
          amount: line.amount,
          currency: line.currency,
          exchange_rate: line.exchange_rate,
          converted_amount: line.converted_amount,
          tags: line.tags || [],
        })),
      };
    }));

    return {
      assets: assetsByCurrency,
      converted_assets: Math.round(convertedAssets * 100) / 100,
      liabilities: liabilitiesByCurrency,
      converted_liabilities: Math.round(convertedLiabilities * 100) / 100,
      netWorth: Math.round(netWorth * 100) / 100,
      recentTransactions,
    };
  }

  async calculateSubtreeBalance(accountId: string, dateRange?: { from: string; to: string }): Promise<CurrencyBalance[]> {
    const tenantId = TenantContext.requireTenantId();
    const accountIds = await this.getDescendantIds(accountId);
    // accountIds already includes the accountId itself (see getDescendantIds implementation)

    const allBalances: CurrencyBalance[] = [];

    for (const id of accountIds) {
      const accountBalance = await this.calculateAccountBalance(id, tenantId, dateRange);
      allBalances.push(...accountBalance);
    }

    return this.mergeCurrencies(allBalances);
  }

  private async calculateAccountBalance(accountId: string, tenantId: string, dateRange?: { from: string; to: string }): Promise<CurrencyBalance[]> {
    const query = this.journalLineRepository
      .createQueryBuilder('line')
      .select(['line.currency', 'SUM(line.amount) as total'])
      .where('line.account_id = :accountId', { accountId })
      .andWhere('line.tenant_id = :tenantId', { tenantId })
      .groupBy('line.currency');

    if (dateRange) {
      query
        .innerJoin('line.journal_entry', 'entry')
        .andWhere('entry.date >= :fromDate', { fromDate: dateRange.from })
        .andWhere('entry.date <= :toDate', { toDate: dateRange.to });
    }

    const results = await query.getRawMany();

    return results.map((r) => ({
      currency: r.line_currency,
      amount: parseFloat(r.total) || 0,
    }));
  }

  private async getDescendantIds(accountId: string): Promise<string[]> {
    const tenantId = TenantContext.requireTenantId();
    const account = await this.accountRepository.findOne({ where: { id: accountId, tenant_id: tenantId } });
    if (!account) return [accountId];

    // IMPORTANT: Use exact path prefix with colon to avoid matching similar names
    // e.g., 'test' should only match 'test:child', NOT 'test3' or 'testAccount'
    const pathPrefix = account.path.endsWith(':') ? account.path : account.path + ':';

    const descendants = await this.accountRepository
      .createQueryBuilder('account')
      .where('account.path LIKE :pathPrefix', { pathPrefix: pathPrefix + '%' })
      .andWhere('account.id != :accountId', { accountId })
      .andWhere('account.tenant_id = :tenantId', { tenantId })
      .getMany();

    return [accountId, ...descendants.map((d) => d.id)];
  }

  private async convertBalances(
    balances: CurrencyBalance[],
    targetCurrency: string,
    rateDate?: string,
    specificDate?: string,
  ): Promise<CurrencyBalance[]> {
    const converted: CurrencyBalance[] = [];

    for (const balance of balances) {
      if (balance.currency === targetCurrency) {
        converted.push(balance);
        continue;
      }

      const date = specificDate ? new Date(specificDate) : undefined;
      const rate = await this.rateGraphEngine.getRate(balance.currency, targetCurrency, { date });

      if (rate) {
        converted.push({
          currency: targetCurrency,
          amount: balance.amount * rate.rate,
        });
      }
    }

    return converted;
  }

  private mergeByDepth(balances: AccountBalance[], depth: number | undefined): AccountBalance[] {
    if (!depth || depth <= 0) return balances;

    const grouped = new Map<string, AccountBalance[]>();

    for (const balance of balances) {
      const pathParts = balance.account.path.split(':');
      // Use full path if account depth equals or exceeds requested depth (show separately)
      // Otherwise, group by path prefix (merge into parent)
      const groupKey = balance.account.depth >= depth 
        ? balance.account.path 
        : pathParts.slice(0, Math.min(depth, pathParts.length)).join(':');

      if (!grouped.has(groupKey)) {
        grouped.set(groupKey, []);
      }
      grouped.get(groupKey)!.push(balance);
    }

    return Array.from(grouped.entries()).map(([key, group]) => {
      // For the parent account (path exactly matches groupKey), keep its own currencies
      // For child accounts, only include their balances in subtree_currencies
      const parentBalance = group.find((b) => b.account.path === key);

      // Use parent's own currencies, NOT merged from all children
      const mergedCurrencies = parentBalance?.currencies || [];

      // Merge subtree_currencies: parent owns + all children's subtree (total of all descendants)
      const allSubtreeCurrencies: CurrencyBalance[] = [];

      // Add parent's own currencies to subtree
      if (parentBalance?.currencies) {
        allSubtreeCurrencies.push(...parentBalance.currencies);
      }

      // Add all children's subtree_currencies (which already includes their descendants)
      for (const b of group) {
        if (b.subtree_currencies && b.account.path !== key) {
          allSubtreeCurrencies.push(...b.subtree_currencies);
        }
      }

      const mergedSubtreeCurrencies = allSubtreeCurrencies.length > 0
        ? this.mergeCurrencies(allSubtreeCurrencies)
        : undefined;

      // Calculate total converted subtree if any account has it
      const convertedSubtreeTotals = group
        .filter((b) => b.converted_subtree_total !== undefined)
        .map((b) => b.converted_subtree_total!);
      const convertedSubtreeTotal = convertedSubtreeTotals.length > 0
        ? convertedSubtreeTotals.reduce((sum, t) => sum + t, 0)
        : undefined;
      const convertedSubtreeCurrency = group.find((b) => b.converted_subtree_currency)?.converted_subtree_currency;

      const pathParts = key.split(':');

      const mergedAccount: Account = {
        id: group[0].account.id,
        parent: group[0].account.parent,
        children: [],
        path: key,
        name: pathParts[pathParts.length - 1] || key,
        type: group[0].account.type,
        depth: pathParts.length,
        tenant_id: group[0].account.tenant_id,
        currency: group[0].account.currency,
        is_active: true,
        created_at: group[0].account.created_at,
        updated_at: group[0].account.updated_at,
        deleted_at: null,
      };

      return {
        account: mergedAccount,
        currencies: mergedCurrencies,
        // Use parent's subtree_currencies if available, otherwise use merged
        subtree_currencies: parentBalance?.subtree_currencies || mergedSubtreeCurrencies,
        converted_subtree_total: parentBalance?.converted_subtree_total || convertedSubtreeTotal,
        converted_subtree_currency: parentBalance?.converted_subtree_currency || convertedSubtreeCurrency,
      };
    });
  }

  private mergeCurrencies(balances: CurrencyBalance[]): CurrencyBalance[] {
    const merged = new Map<string, number>();

    for (const balance of balances) {
      const current = merged.get(balance.currency) || 0;
      merged.set(balance.currency, current + balance.amount);
    }

    return Array.from(merged.entries()).map(([currency, amount]) => ({
      currency,
      amount: Math.round(amount * 10000) / 10000,
    }));
  }

  private generateCacheKey(type: string, tenantId: string, query: any): string {
    return `${type}:${tenantId}:${JSON.stringify(query)}`;
  }

  private getFromCache(key: string): any | null {
    const item = this.cache.get(key);
    if (item && Date.now() < item.expiresAt) {
      return item.data;
    }
    this.cache.delete(key);
    return null;
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + this.CACHE_TTL,
    });
  }

  invalidateCache(pattern: string): void {
    const regex = new RegExp(pattern.replace('*', '.*'));
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }
}
