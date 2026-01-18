import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, TreeRepository } from 'typeorm';
import { Account, AccountType } from './account.entity';

@Injectable()
export class AccountsService {
  constructor(
    @InjectRepository(Account)
    private accountRepository: TreeRepository<Account>,
  ) {}

  async findAll(tenantId: string): Promise<Account[]> {
    return this.accountRepository.find({
      where: { tenant_id: tenantId, is_active: true },
      order: { path: 'ASC' },
    });
  }

  async findTree(tenantId: string): Promise<Account[]> {
    // Use QueryBuilder to load parent relation with tenant filter
    const accounts = await this.accountRepository
      .createQueryBuilder('account')
      .leftJoinAndSelect('account.parent', 'parent')
      .where('account.tenant_id = :tenantId', { tenantId })
      .andWhere('account.is_active = true')
      .orderBy('account.path', 'ASC')
      .getMany();
    
    // Convert to plain objects with parent_id
    return accounts.map(account => ({
      id: account.id,
      tenant_id: account.tenant_id,
      parent_id: account.parent?.id || null,
      name: account.name,
      type: account.type,
      currency: account.currency,
      path: account.path,
      depth: account.depth,
      is_active: account.is_active,
      created_at: account.created_at,
      updated_at: account.updated_at,
      deleted_at: account.deleted_at,
    })) as unknown as Account[];
  }

  async findById(id: string, tenantId: string): Promise<Account> {
    const account = await this.accountRepository.findOne({
      where: { id, tenant_id: tenantId },
    });
    if (!account) {
      throw new NotFoundException(`Account ${id} not found`);
    }
    return account;
  }

  async create(data: Partial<Account>, tenantId: string): Promise<Account> {
    // Handle empty string parent_id as null
    const parentId = (data as any).parent_id === '' ? null : (data as any).parent_id;

    let path = data.name || '';
    let depth = 0;
    let parent: Account | null = null;

    if (parentId) {
      parent = await this.findById(parentId, tenantId);
      path = `${parent.path}:${data.name}`;
      depth = parent.depth + 1;
    }

    // Create account
    const account = this.accountRepository.create({
      ...data,
      tenant_id: tenantId,
      path,
      depth,
    });

    // Set parent relation if exists
    if (parent) {
      (account as any).parent = parent;
    }

    // Use manager to ensure parent relation is properly saved
    const saved = await this.accountRepository.manager.save(account);
    return saved as Account;
  }

  async update(id: string, data: Partial<Account>, tenantId: string): Promise<Account> {
    const account = await this.findById(id, tenantId);
    
    if (data.name && data.name !== account.name) {
      const parentId = (account as any).parentIdId;
      if (parentId) {
        const parent = await this.findById(parentId, tenantId);
        data.path = `${parent.path}:${data.name}`;
      } else {
        data.path = data.name;
      }
    }

    Object.assign(account, data);
    return this.accountRepository.save(account);
  }

  async delete(id: string, tenantId: string): Promise<void> {
    const account = await this.findById(id, tenantId);
    
    const children = await this.accountRepository.findDescendants(account);
    if (children.length > 1) {
      throw new BadRequestException('Cannot delete account with children');
    }

    await this.accountRepository.remove(account);
  }

  async moveAccount(
    id: string,
    newParentId: string | null,
    tenantId: string,
  ): Promise<Account> {
    const account = await this.findById(id, tenantId);

    if (newParentId === id) {
      throw new BadRequestException('Cannot move account to itself');
    }

    let newParent: Account | null = null;
    if (newParentId) {
      newParent = await this.findById(newParentId, tenantId);

      const descendants = await this.accountRepository.findDescendants(account);
      const descendantIds = descendants.map(d => d.id);
      if (descendantIds.includes(newParentId)) {
        throw new BadRequestException('Cannot move account under its own descendant');
      }
    }

    const oldPath = account.path;

    if (newParent) {
      account.path = `${newParent.path}:${account.name}`;
      account.depth = newParent.depth + 1;
      account.parent = newParent;
    } else {
      account.path = account.name;
      account.depth = 0;
      account.parent = null as any;
    }

    await this.accountRepository.save(account);

    if (oldPath !== account.path) {
      const descendants = await this.accountRepository.findDescendants(account);
      for (const descendant of descendants) {
        if (descendant.id !== account.id) {
          const relativePath = descendant.path.substring(oldPath.length + 1);
          descendant.path = `${account.path}:${relativePath}`;
          descendant.depth = descendant.path.split(':').length - 1;
        }
      }
      await this.accountRepository.save(descendants);
    }

    return this.findById(id, tenantId);
  }

  async getBalance(accountId: string, tenantId: string): Promise<any[]> {
    // TODO: Implement balance calculation with journal entries
    return [];
  }
}
