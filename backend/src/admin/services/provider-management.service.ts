import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Provider, ProviderType } from '../../rates/provider.entity';
import { CurrencyProviderService } from '../../currencies/currency-provider.service';
import { ProvidersService } from '../../providers/providers.service';
import { AuditEventPublisher } from '../events/audit-event-publisher.service';
import { AuditLog } from '../decorators/audit-log.decorator';

export interface PaginationParams {
  offset?: number;
  limit?: number;
}

@Injectable()
export class ProviderManagementService {
  private readonly logger = new Logger(ProviderManagementService.name);

  constructor(
    @InjectRepository(Provider)
    private providerRepository: Repository<Provider>,
    private currencyProviderService: CurrencyProviderService,
    private providersService: ProvidersService,
    private eventPublisher: AuditEventPublisher,
  ) {}

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

  @AuditLog({
    action: 'admin.provider.create',
    entityType: 'provider',
    getEntityId: (args, result) => result?.id,
    getNewValue: (args, result) => ({
      name: result?.name,
      type: result?.type,
      is_active: result?.is_active,
    }),
  })
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
      id: crypto.randomUUID(),
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

    await this.currencyProviderService.autoAssociateCurrencies(provider.id);

    return provider;
  }

  @AuditLog({
    action: 'admin.provider.update',
    entityType: 'provider',
    getEntityId: (args) => args[0],
    getOldValue: async (args, result, instance) => {
      const prov = await instance.providerRepository.findOne({ where: { id: args[0] } });
      return prov ? { name: prov.name, type: prov.type, is_active: prov.is_active, config: prov.config } : undefined;
    },
    getNewValue: (args, result) => ({
      name: result?.name,
      type: result?.type,
      is_active: result?.is_active,
      config: result?.config,
    }),
  })
  async updateProvider(
    providerId: string,
    data: Partial<Provider>,
    adminId: string,
    ipAddress?: string,
  ): Promise<Provider> {
    const provider = await this.getProvider(providerId);

    Object.assign(provider, data);
    provider.updated_at = new Date();

    await this.providerRepository.save(provider);

    return provider;
  }

  @AuditLog({
    action: 'admin.provider.delete',
    entityType: 'provider',
    getEntityId: (args) => args[0],
    getOldValue: async (args, result, instance) => {
      const prov = await instance.providerRepository.findOne({ where: { id: args[0] } });
      return prov ? { id: prov.id, name: prov.name, type: prov.type } : undefined;
    },
  })
  async deleteProvider(
    providerId: string,
    adminId: string,
    ipAddress?: string,
  ): Promise<void> {
    const provider = await this.getProvider(providerId);

    await this.currencyProviderService.removeProviderAssociations(providerId);

    await this.providerRepository.remove(provider);
  }

  @AuditLog({
    action: 'admin.provider.toggle',
    entityType: 'provider',
    getEntityId: (args) => args[0],
    getOldValue: async (args, result, instance) => {
      const prov = await instance.providerRepository.findOne({ where: { id: args[0] } });
      return prov ? { is_active: prov.is_active } : undefined;
    },
    getNewValue: (args, result) => ({ is_active: result?.is_active }),
  })
  async toggleProvider(
    providerId: string,
    adminId: string,
    ipAddress?: string,
  ): Promise<Provider> {
    const provider = await this.getProvider(providerId);

    provider.is_active = !provider.is_active;
    provider.updated_at = new Date();

    await this.providerRepository.save(provider);

    return provider;
  }

  @AuditLog({
    action: 'admin.provider.test',
    entityType: 'provider',
    getEntityId: (args) => args[0],
    getNewValue: (args, result) => ({ success: result?.success, latency: result?.latency }),
  })
  async testProvider(
    providerId: string,
    adminId: string,
    ipAddress?: string,
  ): Promise<{ success: boolean; message: string; latency?: number }> {
    const provider = await this.getProvider(providerId);
    const startTime = Date.now();

    try {
      const result = await this.providersService.testConnection(providerId);
      const latency = Date.now() - startTime;

      return { success: result.success, message: result.message, latency };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }
}
