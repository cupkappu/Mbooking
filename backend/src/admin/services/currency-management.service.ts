import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Currency } from '../../currencies/currency.entity';
import { CurrenciesService } from '../../currencies/currencies.service';
import { CreateCurrencyDto, UpdateCurrencyDto } from '../../currencies/dto/currency.dto';
import { AuditEventPublisher } from '../events/audit-event-publisher.service';
import { AuditLog } from '../decorators/audit-log.decorator';

export interface PaginationParams {
  offset?: number;
  limit?: number;
}

@Injectable()
export class CurrencyManagementService {

  constructor(
    @InjectRepository(Currency)
    private currencyRepository: Repository<Currency>,
    private currenciesService: CurrenciesService,
    private eventPublisher: AuditEventPublisher,
  ) {}

  async listCurrencies(
    options: PaginationParams = {},
  ): Promise<{ currencies: Currency[]; total: number }> {
    const { offset = 0, limit = 50 } = options;

    const [currencies, total] = await this.currencyRepository.findAndCount({
      skip: offset,
      take: limit,
      order: { code: 'ASC' },
    });

    return { currencies, total };
  }

  async getAllCurrencies(): Promise<Currency[]> {
    return this.currencyRepository.find({
      order: { code: 'ASC' },
    });
  }

  async getCurrency(code: string, _adminId: string, _ipAddress?: string): Promise<Currency> {
    const currency = await this.currenciesService.findByCode(code);
    return currency;
  }

  @AuditLog({
    action: 'admin.currency.create',
    entityType: 'currency',
    getEntityId: (_args, result) => result?.code,
    getNewValue: (_args, result) => ({
      code: result?.code,
      name: result?.name,
      symbol: result?.symbol,
      decimal_places: result?.decimal_places,
    }),
  })
  async createCurrency(
    data: CreateCurrencyDto,
    _adminId: string,
    _ipAddress?: string,
  ): Promise<Currency> {
    const existing = await this.currenciesService.findByCode(data.code).catch(() => null);
    if (existing) {
      throw new ConflictException(`Currency '${data.code}' already exists`);
    }

    const currency = await this.currenciesService.create(data);

    return currency;
  }

  @AuditLog({
    action: 'admin.currency.update',
    entityType: 'currency',
    getEntityId: (args) => args[0],
    getOldValue: async (args, _result, instance) => {
      const code = args[0] as string;
      const currency = await instance.currencyRepository.findOne({ where: { code } });
      return currency ? { name: currency.name, symbol: currency.symbol, decimal_places: currency.decimal_places, is_active: currency.is_active } : undefined;
    },
    getNewValue: (_args, result) => ({
      name: result?.name,
      symbol: result?.symbol,
      decimal_places: result?.decimal_places,
      is_active: result?.is_active,
    }),
  })
  async updateCurrency(
    code: string,
    data: UpdateCurrencyDto,
    _adminId: string,
    _ipAddress?: string,
  ): Promise<Currency> {
    const currency = await this.currenciesService.update(code, data);

    return currency;
  }

  @AuditLog({
    action: 'admin.currency.delete',
    entityType: 'currency',
    getEntityId: (args) => args[0],
    getOldValue: async (args, _result, instance) => {
      const code = args[0] as string;
      const currency = await instance.currencyRepository.findOne({ where: { code } });
      return currency ? { code: currency.code, name: currency.name, symbol: currency.symbol } : undefined;
    },
  })
  async deleteCurrency(
    code: string,
    _adminId: string,
    _ipAddress?: string,
  ): Promise<void> {
    await this.currenciesService.delete(code);
  }

  @AuditLog({
    action: 'admin.currency.seed',
    entityType: 'currency',
    getEntityId: () => 'system',
    getNewValue: (_args, result) => ({
      added: result?.added,
      skipped: result?.skipped,
    }),
  })
  async seedCurrencies(
    _adminId: string,
    _ipAddress?: string,
  ): Promise<{ added: number; skipped: number }> {
    const results = await this.currenciesService.seedDefaultCurrencies();

    return results;
  }
}
