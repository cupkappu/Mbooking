import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JournalEntry } from './journal-entry.entity';
import { JournalLine } from './journal-line.entity';
import { QueryService } from '../query/query.service';
import { TenantContext } from '../common/context/tenant.context';
import { CurrenciesService } from '../currencies/currencies.service';
import { RateGraphEngine } from '../rates/services/rate-graph.engine';
import { TenantsService } from '../tenants/tenants.service';
import { BudgetProgressService } from '../budgets/services/budget-progress.service';

export type JournalLineWithConverted = JournalLine & {
  exchange_rate: number | null;
  converted_amount: number | null;
};

export interface JournalEntryWithConverted extends JournalEntry {
  lines: JournalLineWithConverted[];
}

@Injectable()
export class JournalService {
  constructor(
    @InjectRepository(JournalEntry)
    private journalEntryRepository: Repository<JournalEntry>,
    @InjectRepository(JournalLine)
    private journalLineRepository: Repository<JournalLine>,
    @Inject(forwardRef(() => QueryService))
    private queryService: QueryService,
    private currenciesService: CurrenciesService,
    private rateGraphEngine: RateGraphEngine,
    private tenantsService: TenantsService,
    @Inject(forwardRef(() => BudgetProgressService))
    private budgetProgressService: BudgetProgressService,
  ) {}

  private getTenantId(): string {
    return TenantContext.requireTenantId();
  }

  private getUserId(): string {
    return TenantContext.requireUserId();
  }

  private async getDefaultCurrency(): Promise<string> {
    const tenantId = TenantContext.requireTenantId();
    try {
      const tenant = await this.tenantsService.findById(tenantId);
      return tenant.settings?.default_currency || 'USD';
    } catch {
      return 'USD';
    }
  }

  private async calculateConvertedAmount(
    amount: number,
    currency: string,
    date: Date,
    defaultCurrency: string,
  ): Promise<{ exchange_rate: number; converted_amount: number } | null> {
    if (currency === defaultCurrency) {
      return { exchange_rate: 1, converted_amount: amount };
    }

    const rate = await this.rateGraphEngine.getRate(currency, defaultCurrency, { date });
    if (rate) {
      return {
        exchange_rate: rate.rate,
        converted_amount: amount * rate.rate,
      };
    }
    
    // Fallback to latest rate if historical rate not available
    const latestRate = await this.rateGraphEngine.getRate(currency, defaultCurrency);
    if (latestRate) {
      return {
        exchange_rate: latestRate.rate,
        converted_amount: amount * latestRate.rate,
      };
    }
    
    return null;
  }

  async findAll(options: any = {}): Promise<JournalEntryWithConverted[]> {
    const tenantId = this.getTenantId();
    const defaultCurrency = await this.getDefaultCurrency();
    
    const entries = await this.journalEntryRepository.find({
      where: { tenant_id: tenantId },
      relations: ['lines'],
      order: { date: 'DESC' },
      skip: options.offset || 0,
      take: options.limit || 50,
    });

    for (const entry of entries) {
      const entryDate = entry.date instanceof Date ? entry.date : new Date(entry.date);
      for (const line of entry.lines) {
        const converted = await this.calculateConvertedAmount(
          Number(line.amount),
          line.currency,
          entryDate,
          defaultCurrency
        );
        const lineWithConverted = line as JournalLineWithConverted;
        if (converted) {
          lineWithConverted.exchange_rate = converted.exchange_rate;
          lineWithConverted.converted_amount = converted.converted_amount;
        } else {
          lineWithConverted.exchange_rate = 1;
          lineWithConverted.converted_amount = Number(line.amount);
        }
      }
    }

    return entries as JournalEntryWithConverted[];
  }

  async findById(id: string): Promise<JournalEntryWithConverted> {
    const tenantId = this.getTenantId();
    const defaultCurrency = await this.getDefaultCurrency();
    
    const entry = await this.journalEntryRepository.findOne({
      where: { id, tenant_id: tenantId },
      relations: ['lines'],
    });
    if (!entry) {
      throw new NotFoundException(`Journal entry ${id} not found`);
    }

    const entryDate = entry.date instanceof Date ? entry.date : new Date(entry.date);
    for (const line of entry.lines) {
      const converted = await this.calculateConvertedAmount(
        Number(line.amount),
        line.currency,
        entryDate,
        defaultCurrency
      );
      const lineWithConverted = line as JournalLineWithConverted;
      if (converted) {
        lineWithConverted.exchange_rate = converted.exchange_rate;
        lineWithConverted.converted_amount = converted.converted_amount;
      } else {
        lineWithConverted.exchange_rate = 1;
        lineWithConverted.converted_amount = Number(line.amount);
      }
    }

    return entry as JournalEntryWithConverted;
  }

  async create(data: {
    date: Date;
    description: string;
    reference_id?: string;
    lines: Array<{
      account_id: string;
      amount: number;
      currency: string;
      tags?: string[];
      remarks?: string;
    }>;
  }): Promise<JournalEntry> {
    const tenantId = this.getTenantId();
    const userId = this.getUserId();
    await this.validateCurrencies(data.lines);
    this.validateBalancedLines(data.lines);

    const entry = this.journalEntryRepository.create({
      tenant_id: tenantId,
      date: data.date,
      description: data.description,
      reference_id: data.reference_id,
      created_by: userId,
    });

    const savedEntry = await this.journalEntryRepository.save(entry);

    // Create lines without storing exchange_rate/converted_amount (calculated on fetch)
    const lines = data.lines.map((line) =>
      this.journalLineRepository.create({
        journal_entry_id: savedEntry.id,
        tenant_id: tenantId,
        account_id: line.account_id,
        amount: line.amount,
        currency: line.currency,
        tags: line.tags || [],
        remarks: line.remarks,
      }),
    );

    await this.journalLineRepository.save(lines);
    savedEntry.lines = lines;

    this.queryService.invalidateCache('balances:*');

    // Trigger budget progress cache update for affected budgets
    await this.budgetProgressService.onJournalEntryCreated(lines);

    return savedEntry;
  }

  private validateBalancedLines(lines: any[]): void {
    const totalByCurrency: Map<string, number> = new Map();

    for (const line of lines) {
      const current = totalByCurrency.get(line.currency) || 0;
      totalByCurrency.set(line.currency, current + line.amount);
    }

    for (const [, total] of totalByCurrency) {
      if (Math.abs(total) > 0.0001) {
        throw new BadRequestException('Journal entry must be balanced');
      }
    }
  }

  private async validateCurrencies(lines: any[]): Promise<void> {
    const uniqueCurrencies = new Set(lines.map((line) => line.currency));
    for (const currency of uniqueCurrencies) {
      await this.currenciesService.validateCurrencyExists(currency);
    }
  }

  async update(id: string, data: any): Promise<JournalEntry> {
    const tenantId = this.getTenantId();
    const userId = this.getUserId();
    const entry = await this.findById(id);

    if (data.lines) {
      await this.validateCurrencies(data.lines);
      this.validateBalancedLines(data.lines);
      await this.journalLineRepository.delete({ journal_entry_id: id });

      const lines = data.lines.map((line: any) =>
        this.journalLineRepository.create({
          journal_entry_id: id,
          tenant_id: tenantId,
          account_id: line.account_id,
          amount: line.amount,
          currency: line.currency,
          tags: line.tags || [],
          remarks: line.remarks,
        }),
      );
      await this.journalLineRepository.save(lines);
    }

    Object.assign(entry, {
      ...data,
      lines: undefined,
      updated_by: userId,
    });

    const savedEntry = await this.journalEntryRepository.save(entry);

    this.queryService.invalidateCache('balances:*');

    return savedEntry;
  }

  async delete(id: string): Promise<void> {
    await this.findById(id);
    await this.journalEntryRepository.delete(id);

    this.queryService.invalidateCache('balances:*');
  }
}
