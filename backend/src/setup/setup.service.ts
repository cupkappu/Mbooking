import { Injectable, Logger, ConflictException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../auth/user.entity';
import { Tenant } from '../tenants/tenant.entity';
import { CurrenciesService } from '../currencies/currencies.service';
import { InitializeSystemDto, InitializeSystemResponseDto, InitializationStatusDto } from './dto';

@Injectable()
export class SetupService {
  private readonly logger = new Logger(SetupService.name);
  private readonly INIT_SECRET = process.env.INIT_SECRET;

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Tenant)
    private tenantRepository: Repository<Tenant>,
    private currenciesService: CurrenciesService,
    private dataSource: DataSource,
  ) {}

  async getStatus(): Promise<InitializationStatusDto> {
    const userCount = await this.userRepository.count();
    const currencies = await this.currenciesService.findAll();
    return {
      initialized: userCount > 0,
      userCount,
      currencyCount: currencies.length,
    };
  }

  async initialize(dto: InitializeSystemDto): Promise<InitializeSystemResponseDto> {
    // Check if already initialized
    const userCount = await this.userRepository.count();
    if (userCount > 0) {
      throw new ConflictException('System is already initialized');
    }

    // Validate password strength
    this.validatePasswordStrength(dto.password);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Create admin user
      const hashedPassword = await bcrypt.hash(dto.password, 10);
      const adminUser = this.userRepository.create({
        email: dto.email,
        name: dto.name,
        password: hashedPassword,
        role: 'admin',
        provider: 'credentials',
        is_active: true,
      });

      await queryRunner.manager.save(adminUser);
      this.logger.log(`Created admin user with ID: ${adminUser.id}`);

      // Create tenant for the admin
      const tenantName = dto.organizationName || `${dto.name}'s Tenant`;
      const tenant = this.tenantRepository.create({
        user_id: adminUser.id,
        name: tenantName,
        settings: {
          default_currency: 'USD',
          timezone: 'UTC',
        },
        is_active: true,
      });

      await queryRunner.manager.save(tenant);
      this.logger.log(`Created tenant with ID: ${tenant.id}`);

      // Link user to tenant
      await queryRunner.manager.update(User, adminUser.id, { tenant_id: tenant.id });

      // Seed default currencies
      const currencyResult = await this.currenciesService.seedDefaultCurrencies();
      this.logger.log(`Seeded currencies: ${currencyResult.added} added, ${currencyResult.skipped} skipped`);

      await queryRunner.commitTransaction();

      // Audit log: System initialization completed
      this.logger.log({
        event: 'SYSTEM_INITIALIZED',
        timestamp: new Date().toISOString(),
        userId: adminUser.id,
        userEmail: dto.email,
        tenantId: tenant.id,
        tenantName: tenantName,
        currenciesSeeded: currencyResult.added,
      });

      return {
        success: true,
        message: 'System initialized successfully',
        user: {
          id: adminUser.id,
          email: adminUser.email,
          name: adminUser.name,
          role: adminUser.role,
        },
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error('Failed to initialize system:', error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private validatePasswordStrength(password: string): void {
    const minLength = 12;
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);

    const errors: string[] = [];
    if (password.length < minLength) {
      errors.push(`Password must be at least ${minLength} characters`);
    }
    if (!hasUppercase) {
      errors.push('Password must contain at least 1 uppercase letter');
    }
    if (!hasLowercase) {
      errors.push('Password must contain at least 1 lowercase letter');
    }
    if (!hasNumber) {
      errors.push('Password must contain at least 1 number');
    }

    if (errors.length > 0) {
      throw new ConflictException(errors);
    }
  }
}
