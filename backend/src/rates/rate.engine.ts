import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import axios from 'axios';
import { ExchangeRate } from './exchange-rate.entity';
import { Provider, ProviderType } from './provider.entity';

// Valid ISO 4217 currency codes (common ones)
const VALID_CURRENCY_CODES = new Set([
  'USD', 'EUR', 'GBP', 'JPY', 'CNY', 'HKD', 'AUD', 'CAD', 'CHF',
  'NZD', 'SGD', 'KRW', 'INR', 'BRL', 'MXN', 'ZAR', 'THB',
  'BTC', 'ETH', 'USDT', 'BNB', 'SOL', 'XRP', 'ADA', 'DOGE',
]);

interface RateResult {
  from: string;
  to: string;
  rate: number;
  timestamp: Date;
  source: string;
}

interface AverageRateResult {
  average_rate: number;
  min_rate: number;
  max_rate: number;
  sample_count: number;
}

@Injectable()
export class RateEngine {
  private readonly logger = new Logger(RateEngine.name);
  private providerCache: Map<string, any> = new Map();

  constructor(
    @InjectRepository(ExchangeRate)
    private rateRepository: Repository<ExchangeRate>,
    @InjectRepository(Provider)
    private providerRepository: Repository<Provider>,
  ) {}

  private validateCurrencyCode(currency: string): void {
    if (!VALID_CURRENCY_CODES.has(currency.toUpperCase())) {
      throw new BadRequestException(`Invalid currency code: ${currency}`);
    }
  }

  async getRate(from: string, to: string, options: {
    date?: Date;
    providerId?: string;
  } = {}): Promise<RateResult | null> {
    const fromUpper = from.toUpperCase();
    const toUpper = to.toUpperCase();

    this.validateCurrencyCode(fromUpper);
    this.validateCurrencyCode(toUpper);

    if (fromUpper === toUpper) {
      return { from: fromUpper, to: toUpper, rate: 1, timestamp: new Date(), source: 'identity' };
    }

    const date = options.date || new Date();

    // Check database cache first
    const cachedRate = await this.rateRepository.findOne({
      where: {
        from_currency: fromUpper,
        to_currency: toUpper,
        date: date,
      },
    });

    if (cachedRate) {
      return {
        from: fromUpper,
        to: toUpper,
        rate: Number(cachedRate.rate),
        timestamp: cachedRate.fetched_at,
        source: cachedRate.provider_id,
      };
    }

    // Try to get a provider - if no specific provider is set, try all active providers
    let providers: Provider[];
    
    if (options.providerId) {
      const provider = await this.providerRepository.findOne({ 
        where: { id: options.providerId } 
      });
      providers = provider ? [provider] : [];
    } else {
      providers = await this.providerRepository.find({
        where: { is_active: true },
        order: { created_at: 'ASC' },
      });
    }

    if (!providers.length) {
      return null;
    }

    // Try each provider in order until one succeeds
    for (const provider of providers) {
      if (!provider) continue;

      const rate = await this.fetchFromProvider(provider, fromUpper, toUpper, date);

      if (rate) {
        if (provider.record_history) {
          await this.saveRate(rate, provider.id, date);
        }
        return rate;
      }
    }

    // Try manual rate as last resort
    const manualRate = await this.rateRepository.findOne({
      where: {
        from_currency: fromUpper,
        to_currency: toUpper,
        date,
      },
      order: { fetched_at: 'DESC' },
    });

    if (manualRate && manualRate.provider_id === 'manual') {
      return {
        from: fromUpper,
        to: toUpper,
        rate: Number(manualRate.rate),
        timestamp: manualRate.fetched_at,
        source: 'manual',
      };
    }

    return null;
  }

  private async fetchFromProvider(
    provider: Provider,
    from: string,
    to: string,
    date: Date,
  ): Promise<RateResult | null> {
    try {
      if (provider.type === ProviderType.REST_API) {
        return await this.fetchFromRestApi(provider, from, to, date);
      } else if (provider.type === ProviderType.JS_PLUGIN) {
        return await this.executeJsPlugin(provider, from, to, date);
      }
      return null;
    } catch (error) {
      this.logger.warn(`Provider ${provider.name} failed: ${error.message}`);
      return null;
    }
  }

  async getAverageRate(
    from: string,
    to: string,
    options: {
      fromDate: Date;
      toDate: Date;
    },
  ): Promise<AverageRateResult> {
    const fromUpper = from.toUpperCase();
    const toUpper = to.toUpperCase();

    this.validateCurrencyCode(fromUpper);
    this.validateCurrencyCode(toUpper);

    const { fromDate, toDate } = options;

    const rates = await this.rateRepository
      .createQueryBuilder('rate')
      .where('rate.from_currency = :from', { from: fromUpper })
      .andWhere('rate.to_currency = :to', { to: toUpper })
      .andWhere('rate.date >= :fromDate', { fromDate })
      .andWhere('rate.date <= :toDate', { toDate })
      .orderBy('rate.date', 'ASC')
      .getMany();

    if (rates.length === 0) {
      return {
        average_rate: 0,
        min_rate: 0,
        max_rate: 0,
        sample_count: 0,
      };
    }

    const rateValues = rates.map(r => Number(r.rate));
    const minRate = Math.min(...rateValues);
    const maxRate = Math.max(...rateValues);
    const avgRate = rateValues.reduce((a, b) => a + b, 0) / rateValues.length;

    return {
      average_rate: parseFloat(avgRate.toFixed(8)),
      min_rate: parseFloat(minRate.toFixed(8)),
      max_rate: parseFloat(maxRate.toFixed(8)),
      sample_count: rates.length,
    };
  }

  async convert(amount: number, from: string, to: string, date?: Date): Promise<{
    amount: number;
    from: string;
    to: string;
    converted_amount: number;
    rate: number;
    date: Date;
  }> {
    const rateResult = await this.getRate(from, to, { date });
    const rate = rateResult?.rate || 1;

    return {
      amount,
      from,
      to,
      converted_amount: amount * rate,
      rate,
      date: date || new Date(),
    };
  }

  async getCrossRate(from: string, to: string, via: string[] = ['USD']): Promise<number> {
    if (from === to) return 1;

    let totalRate = 1;

    for (const currency of via) {
      const rate = await this.getRate(from, currency);
      if (rate) {
        totalRate *= rate.rate;
        from = currency;
      }
    }

    const finalRate = await this.getRate(from, to);
    if (finalRate) {
      totalRate *= finalRate.rate;
    }

    return totalRate;
  }

  private async fetchFromRestApi(provider: Provider, from: string, to: string, date: Date): Promise<RateResult | null> {
    try {
      const baseUrl = provider.config.base_url;
      const url = date
        ? `${baseUrl}/${date.toISOString().split('T')[0]}?base=${from}&symbols=${to}`
        : `${baseUrl}/latest?base=${from}&symbols=${to}`;

      const response = await axios.get(url, {
        headers: provider.config.headers || {},
      });

      const rate = response.data.rates?.[to];
      if (!rate) return null;

      return {
        from,
        to,
        rate,
        timestamp: date,
        source: provider.name,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch rate from ${provider.name}: ${error.message}`);
      return null;
    }
  }

  private async executeJsPlugin(provider: Provider, from: string, to: string, date: Date): Promise<RateResult | null> {
    try {
      const pluginPath = provider.config.file_path;
      if (!pluginPath) return null;

      // Use absolute path - backend directory is where the dist folder is
      const backendDir = __dirname.replace('/dist/rates', '');
      const absolutePath = backendDir + '/' + pluginPath;
      const module = require(absolutePath);
      const plugin = module.default || module;

      // Try getLatestRate first
      try {
        const result = date
          ? await plugin.getRateAtDate(from, to, date)
          : await plugin.getLatestRate(from, to);
        return result;
      } catch (rateError) {
        // If getLatestRate fails, try fetchRates for crypto-to-fiat pairs
        if (!date && plugin.fetchRates) {
          // fetchRates can get rates using a fiat currency as base
          // Try to get the rate with the target currency as base, then invert
          // e.g., for BTC/USD: fetchRates(['BTC'], 'USD') returns { 'USD/BTC': 0.000011 }
          // which means 1 USD = 0.000011 BTC, so BTC/USD = 1/0.000011
          const cryptoCurrencies = [from, to].filter(c => 
            plugin.supported_currencies?.includes?.(c)
          );
          
          if (cryptoCurrencies.length > 0) {
            // Try with the target currency as base (for crypto-to-fiat)
            const rates = await plugin.fetchRates(cryptoCurrencies, to);
            
            // Check if we got the inverted rate (base/crypto format)
            // e.g., 'USD/BTC' -> invert to get BTC/USD
            for (const crypto of cryptoCurrencies) {
              const invertedKey = `${to}/${crypto}`;
              if (rates[invertedKey]) {
                return {
                  from: crypto,
                  to,
                  rate: 1 / rates[invertedKey],
                  timestamp: new Date(),
                  source: provider.name,
                };
              }
            }
            
            // Also check direct rate (crypto/base format)
            // e.g., 'BTC/USD' directly
            for (const crypto of cryptoCurrencies) {
              const rateKey = `${crypto}/${to}`;
              if (rates[rateKey]) {
                return {
                  from: crypto,
                  to,
                  rate: rates[rateKey],
                  timestamp: new Date(),
                  source: provider.name,
                };
              }
            }
          }
        }
        throw rateError;
      }
    } catch (error) {
      this.logger.warn(`Provider ${provider.name} failed: ${error.message}`);
      return null;
    }
  }

  async getRateHistory(
    from: string,
    to: string,
    options: {
      fromDate?: Date;
      toDate?: Date;
      limit?: number;
    } = {},
  ): Promise<{
    rates: Array<{
      from: string;
      to: string;
      rate: number;
      date: Date;
      fetched_at: Date;
      provider_id: string;
    }>;
    total: number;
  }> {
    const { fromDate, toDate, limit = 100 } = options;

    const query = this.rateRepository
      .createQueryBuilder('rate')
      .where('rate.from_currency = :from', { from })
      .andWhere('rate.to_currency = :to', { to });

    if (fromDate) {
      query.andWhere('rate.date >= :fromDate', { fromDate });
    }

    if (toDate) {
      query.andWhere('rate.date <= :toDate', { toDate });
    }

    query.orderBy('rate.date', 'DESC');
    query.take(limit);

    const rates = await query.getMany();

    return {
      rates: rates.map(r => ({
        from: r.from_currency,
        to: r.to_currency,
        rate: Number(r.rate),
        date: r.date,
        fetched_at: r.fetched_at,
        provider_id: r.provider_id,
      })),
      total: rates.length,
    };
  }

  async getRateTrend(
    from: string,
    to: string,
    days: number = 30,
  ): Promise<{
    min_rate: number;
    max_rate: number;
    avg_rate: number;
    trend: 'up' | 'down' | 'stable';
    change_percent: number;
    history: Array<{ date: string; rate: number }>;
  }> {
    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    const { rates } = await this.getRateHistory(from, to, {
      fromDate,
      toDate,
      limit: days,
    });

    if (rates.length === 0) {
      return {
        min_rate: 0,
        max_rate: 0,
        avg_rate: 0,
        trend: 'stable',
        change_percent: 0,
        history: [],
      };
    }

    const rateValues = rates.map(r => r.rate);
    const minRate = Math.min(...rateValues);
    const maxRate = Math.max(...rateValues);
    const avgRate = rateValues.reduce((a, b) => a + b, 0) / rateValues.length;

    const sortedRates = rates.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const firstRate = sortedRates[0]?.rate || 0;
    const lastRate = sortedRates[sortedRates.length - 1]?.rate || 0;
    const changePercent = firstRate !== 0 ? ((lastRate - firstRate) / firstRate) * 100 : 0;

    let trend: 'up' | 'down' | 'stable';
    if (changePercent > 1) trend = 'up';
    else if (changePercent < -1) trend = 'down';
    else trend = 'stable';

    return {
      min_rate: parseFloat(minRate.toFixed(8)),
      max_rate: parseFloat(maxRate.toFixed(8)),
      avg_rate: parseFloat(avgRate.toFixed(8)),
      trend,
      change_percent: parseFloat(changePercent.toFixed(2)),
      history: rates.map(r => ({
        date: r.date.toISOString().split('T')[0],
        rate: Number(r.rate),
      })),
    };
  }

  private async saveRate(rate: RateResult, providerId: string, date: Date): Promise<void> {
    const existing = await this.rateRepository.findOne({
      where: {
        from_currency: rate.from,
        to_currency: rate.to,
        date,
      },
    });

    if (existing) {
      existing.rate = rate.rate;
      existing.fetched_at = new Date();
      await this.rateRepository.save(existing);
    } else {
      const newRate = this.rateRepository.create({
        provider_id: providerId,
        from_currency: rate.from,
        to_currency: rate.to,
        rate: rate.rate,
        date,
        fetched_at: new Date(),
      });
      await this.rateRepository.save(newRate);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async fetchDailyRates(): Promise<void> {
    this.logger.log('Starting daily rate fetch...');

    const providers = await this.providerRepository.find({
      where: { is_active: true, record_history: true },
    });

    const currencies = ['USD', 'EUR', 'GBP', 'JPY', 'CNY', 'HKD', 'AUD', 'CAD', 'CHF'];

    for (const provider of providers) {
      for (const base of currencies.slice(0, 3)) {
        for (const target of currencies) {
          if (base === target) continue;

          await this.getRate(base, target, {
            providerId: provider.id,
            date: new Date(),
          });
        }
      }
    }

    this.logger.log('Daily rate fetch completed');
  }
}
