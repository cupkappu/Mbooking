import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { User } from '../../auth/user.entity';
import { AuditEventPublisher } from '../events/audit-event-publisher.service';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { AuditLog } from '../decorators/audit-log.decorator';

export interface PaginationParams {
  offset?: number;
  limit?: number;
}

export interface BulkUserAction {
  action: 'enable' | 'disable' | 'role_change';
  user_ids: string[];
  parameters?: {
    new_role?: string;
  };
}

@Injectable()
export class UserManagementService {
  private readonly logger = new Logger(UserManagementService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private eventPublisher: AuditEventPublisher,
  ) {}

  async listUsers(
    tenantId: string,
    options?: PaginationParams,
  ): Promise<{ users: User[]; total: number }> {
    const { offset = 0, limit = 50 } = options || {};

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

  @AuditLog({
    action: 'admin.user.create',
    entityType: 'user',
    getEntityId: (args, result) => result?.id,
    getNewValue: (args, result) => ({
      email: result?.email,
      name: result?.name,
      role: result?.role,
    }),
    extractIpFromArgs: true,
    extractTenantIdFromArgs: true,
  })
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
    return user;
  }

  @AuditLog({
    action: 'admin.user.update',
    entityType: 'user',
    getEntityId: (args) => args[0],
    getOldValue: async (args: any[], _result: any, instance?: any): Promise<Record<string, unknown>> => {
      const userId = args[0] as string;
      // @ts-ignore - Repository.findOne type issue inside decorator context
      const repo = instance?.userRepository as Repository<User> | undefined;
      if (!repo) {
        return {};
      }
      // @ts-ignore - findOne can return undefined
      const foundUser: User | null = await repo.findOne({ where: { id: userId } });
      if (!foundUser) {
        return {};
      }
      return { email: foundUser.email, name: foundUser.name, role: foundUser.role, is_active: foundUser.is_active };
    },
    getNewValue: (args, result) => ({
      email: result?.email,
      name: result?.name,
      role: result?.role,
      is_active: result?.is_active,
    }),
    extractIpFromArgs: true,
  })
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

    return user;
  }

  @AuditLog({
    action: 'admin.user.disable',
    entityType: 'user',
    getEntityId: (args) => args[0],
    getOldValue: async (args: any[], _result: any, instance?: any): Promise<Record<string, unknown>> => {
      const userId = args[0] as string;
      // @ts-ignore - Repository.findOne type issue inside decorator context
      const repo = instance?.userRepository as Repository<User> | undefined;
      if (!repo) {
        return {};
      }
      // @ts-ignore - findOne can return undefined
      const foundUser: User | null = await repo.findOne({ where: { id: userId } });
      if (!foundUser) {
        return {};
      }
      return { is_active: foundUser.is_active };
    },
    getNewValue: () => ({ is_active: false }),
    extractIpFromArgs: true,
  })
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

    return user;
  }

  @AuditLog({
    action: 'admin.user.reset_password',
    entityType: 'user',
    getEntityId: (args) => args[0],
    getNewValue: () => ({ password_reset: true }),
    extractIpFromArgs: true,
  })
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
  }

  @AuditLog({
    action: 'admin.user.bulk_action',
    entityType: 'user',
    getNewValue: (args, result) => ({
      action: args[1]?.action,
      user_ids: args[1]?.user_ids,
      affected: result?.affected,
    }),
    extractTenantIdFromArgs: true,
    extractIpFromArgs: true,
  })
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
        if (user.id === adminId) continue;
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

    return { affected };
  }
}
