import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Currency } from './currency.entity';
import { CreateCurrencyDto, UpdateCurrencyDto } from './dto/currency.dto';
import { TenantsService } from '../tenants/tenants.service';

@Injectable()
export class CurrenciesService {
  constructor(
    @InjectRepository(Currency)
    private currencyRepository: Repository<Currency>,
    private tenantsService: TenantsService,
  ) {}

  async findAll(): Promise<Currency[]> {
    return this.currencyRepository.find({
      where: { is_active: true },
      order: { code: 'ASC' },
    });
  }

  async findByCode(code: string): Promise<Currency | null> {
    const currency = await this.currencyRepository.findOne({
      where: { code },
    });
    if (!currency) {
      throw new NotFoundException(`Currency with code ${code} not found`);
    }
    return currency;
  }

  async create(data: CreateCurrencyDto): Promise<Currency> {
    const existing = await this.findByCode(data.code).catch(() => null);
    if (existing) {
      throw new ConflictException(`Currency with code ${data.code} already exists`);
    }

    const currency = this.currencyRepository.create({
      ...data,
      decimal_places: data.decimal_places ?? 2,
    });
    return this.currencyRepository.save(currency);
  }

  async update(code: string, data: UpdateCurrencyDto): Promise<Currency> {
    const currency = await this.findByCode(code);
    Object.assign(currency, data);
    return this.currencyRepository.save(currency);
  }

  async delete(code: string): Promise<void> {
    const currency = await this.findByCode(code);
    currency.is_active = false;
    await this.currencyRepository.save(currency);
  }

  async setDefault(code: string, tenantId: string, userId: string): Promise<Currency> {
    await this.findByCode(code);

    const tenant = await this.tenantsService.findById(tenantId);
    
    tenant.settings = {
      ...tenant.settings,
      default_currency: code,
    };
    
    await this.tenantsService.update(tenantId, { settings: tenant.settings });

    return this.findByCode(code);
  }

  async seedDefaultCurrencies(): Promise<{ added: number; skipped: number }> {
    const defaultCurrencies = [
      { code: 'USD', name: 'US Dollar', symbol: '$', decimal_places: 2 },
      { code: 'EUR', name: 'Euro', symbol: '€', decimal_places: 2 },
      { code: 'GBP', name: 'British Pound', symbol: '£', decimal_places: 2 },
      { code: 'JPY', name: 'Japanese Yen', symbol: '¥', decimal_places: 0 },
      { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', decimal_places: 2 },
      { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$', decimal_places: 2 },
      { code: 'TWD', name: 'Taiwan Dollar', symbol: 'NT$', decimal_places: 2 },
      { code: 'KRW', name: 'South Korean Won', symbol: '₩', decimal_places: 0 },
      { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', decimal_places: 2 },
      { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', decimal_places: 2 },
      { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', decimal_places: 2 },
      { code: 'CHF', name: 'Swiss Franc', symbol: 'Fr', decimal_places: 2 },
      { code: 'BTC', name: 'Bitcoin', symbol: '₿', decimal_places: 8 },
      { code: 'ETH', name: 'Ethereum', symbol: 'Ξ', decimal_places: 18 },
    ];

    let added = 0;
    let skipped = 0;

    for (const currency of defaultCurrencies) {
      try {
        const existing = await this.findByCode(currency.code);

        const needsUpdate =
          existing.name !== currency.name ||
          (existing.symbol || '') !== (currency.symbol || '') ||
          existing.decimal_places !== currency.decimal_places;

        if (needsUpdate) {
          await this.update(currency.code, {
            name: currency.name,
            symbol: currency.symbol,
            decimal_places: currency.decimal_places,
          });
          skipped++;
        } else {
          skipped++;
        }
      } catch (error) {
        if (error instanceof NotFoundException) {
          await this.create(currency);
          added++;
        } else {
          throw error;
        }
      }
    }

    return { added, skipped };
  }

  async validateCurrencyExists(code: string): Promise<Currency> {
    const currency = await this.currencyRepository.findOne({
      where: { code },
    });
    if (!currency || !currency.is_active) {
      throw new BadRequestException(
        `Currency '${code}' is not available. Contact your administrator.`
      );
    }
    return currency;
  }
}
