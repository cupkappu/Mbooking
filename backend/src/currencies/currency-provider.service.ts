import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CurrencyProvider } from './currency-provider.entity';
import { Currency } from './currency.entity';
import { Provider } from '../providers/provider.entity';

@Injectable()
export class CurrencyProviderService {
  private readonly logger = new Logger(CurrencyProviderService.name);

  constructor(
    @InjectRepository(CurrencyProvider)
    private currencyProviderRepository: Repository<CurrencyProvider>,
    @InjectRepository(Currency)
    private currencyRepository: Repository<Currency>,
    @InjectRepository(Provider)
    private providerRepository: Repository<Provider>,
  ) {}

  /**
   * Get all currency-provider associations with priority
   */
  async getAll(): Promise<CurrencyProvider[]> {
    return this.currencyProviderRepository.find({
      order: { priority: 'ASC' },
    });
  }

  /**
   * Get providers for a specific currency, ordered by priority
   */
  async getProvidersForCurrency(currencyCode: string): Promise<CurrencyProvider[]> {
    return this.currencyProviderRepository.find({
      where: { currency_code: currencyCode },
      order: { priority: 'ASC' },
    });
  }

  /**
   * Get currencies for a specific provider
   */
  async getCurrenciesForProvider(providerId: string): Promise<CurrencyProvider[]> {
    return this.currencyProviderRepository.find({
      where: { provider_id: providerId },
      order: { priority: 'ASC' },
    });
  }

  /**
   * Auto-associate all currencies with a provider
   * Called when a new provider is created
   */
  async autoAssociateCurrencies(providerId: string): Promise<void> {
    const provider = await this.providerRepository.findOne({
      where: { id: providerId },
    });

    if (!provider) {
      throw new NotFoundException(`Provider ${providerId} not found`);
    }

    // Get all active currencies
    const currencies = await this.currencyRepository.find({
      where: { is_active: true },
    });

    // Get existing associations to avoid duplicates
    const existing = await this.currencyProviderRepository.find({
      where: { provider_id: providerId },
    });
    const existingCurrencyCodes = new Set(existing.map(e => e.currency_code));

    // Calculate priority offset (next available priority for this provider)
    const maxPriority = existing.length > 0 
      ? Math.max(...existing.map(e => e.priority)) 
      : -1;

    // Get all currencies that already have this provider
    const allExisting = await this.currencyProviderRepository.find();
    const providerPriorities = new Map<string, number>();
    for (const cp of allExisting) {
      if (!providerPriorities.has(cp.currency_code)) {
        providerPriorities.set(cp.currency_code, cp.priority);
      }
    }

    let priorityOffset = 0;
    if (providerPriorities.size > 0) {
      // Find the minimum priority used for any currency
      priorityOffset = Math.min(...Array.from(providerPriorities.values()));
    }

    // Create associations for currencies not yet associated with this provider
    for (const currency of currencies) {
      if (!existingCurrencyCodes.has(currency.code)) {
        // Find the next available priority for this currency
        const existingForCurrency = allExisting.filter(cp => cp.currency_code === currency.code);
        let priority = 0;
        if (existingForCurrency.length > 0) {
          priority = Math.max(...existingForCurrency.map(cp => cp.priority)) + 1;
        }

        const cp = this.currencyProviderRepository.create({
          currency_code: currency.code,
          provider_id: providerId,
          priority,
          is_active: true,
        });

        await this.currencyProviderRepository.save(cp);
        this.logger.log(`Associated ${currency.code} with provider ${provider.name} (priority: ${priority})`);
      }
    }
  }

  /**
   * Remove all associations for a provider
   * Called when a provider is deleted
   */
  async removeProviderAssociations(providerId: string): Promise<void> {
    const result = await this.currencyProviderRepository.delete({
      provider_id: providerId,
    });

    this.logger.log(`Removed ${result.affected} currency associations for provider ${providerId}`);
  }

  /**
   * Update priority for a currency-provider association
   */
  async updatePriority(id: string, priority: number): Promise<CurrencyProvider> {
    const cp = await this.currencyProviderRepository.findOne({
      where: { id },
    });

    if (!cp) {
      throw new NotFoundException(`CurrencyProvider ${id} not found`);
    }

    cp.priority = priority;
    return this.currencyProviderRepository.save(cp);
  }

  /**
   * Reorder priorities for all providers of a currency
   */
  async reorderProviders(currencyCode: string, providerIds: string[]): Promise<void> {
    for (let i = 0; i < providerIds.length; i++) {
      await this.currencyProviderRepository.update(
        { currency_code: currencyCode, provider_id: providerIds[i] },
        { priority: i },
      );
    }
  }

  /**
   * Add a single currency-provider association
   */
  async addAssociation(
    currencyCode: string,
    providerId: string,
  ): Promise<CurrencyProvider> {
    // Check if already exists
    const existing = await this.currencyProviderRepository.findOne({
      where: { currency_code: currencyCode, provider_id: providerId },
    });

    if (existing) {
      existing.is_active = true;
      return this.currencyProviderRepository.save(existing);
    }

    // Get current max priority for this currency
    const existingForCurrency = await this.currencyProviderRepository.find({
      where: { currency_code: currencyCode },
    });

    const priority = existingForCurrency.length > 0
      ? Math.max(...existingForCurrency.map(e => e.priority)) + 1
      : 0;

    const cp = this.currencyProviderRepository.create({
      currency_code: currencyCode,
      provider_id: providerId,
      priority,
      is_active: true,
    });

    return this.currencyProviderRepository.save(cp);
  }

  /**
   * Remove a currency-provider association
   */
  async removeAssociation(currencyCode: string, providerId: string): Promise<void> {
    await this.currencyProviderRepository.delete({
      currency_code: currencyCode,
      provider_id: providerId,
    });
  }
}
