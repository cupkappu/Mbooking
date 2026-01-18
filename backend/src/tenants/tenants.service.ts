import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from './tenant.entity';

@Injectable()
export class TenantsService {
  constructor(
    @InjectRepository(Tenant)
    private tenantRepository: Repository<Tenant>,
  ) {}

  async findByUserId(userId: string): Promise<Tenant> {
    const tenant = await this.tenantRepository.findOne({ where: { user_id: userId } });
    if (!tenant) {
      throw new NotFoundException(`Tenant for user ${userId} not found`);
    }
    return tenant;
  }

  async create(data: Partial<Tenant>): Promise<Tenant> {
    const tenant = this.tenantRepository.create(data);
    return this.tenantRepository.save(tenant);
  }

  async update(id: string, data: Partial<Tenant>): Promise<Tenant> {
    if (data.settings) {
      const existingTenant = await this.findById(id);
      const existingSettings = existingTenant.settings || {};
      data.settings = { ...existingSettings, ...data.settings };
    }
    
    await this.tenantRepository.update(id, data);
    return this.findById(id);
  }

  async findById(id: string): Promise<Tenant> {
    const tenant = await this.tenantRepository.findOne({ where: { id } });
    if (!tenant) {
      throw new NotFoundException(`Tenant ${id} not found`);
    }
    return tenant;
  }
}
