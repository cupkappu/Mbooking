import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../../auth/user.entity';

@Injectable()
export class AdminUserSeedService implements OnModuleInit {
  private readonly logger = new Logger(AdminUserSeedService.name);
  private readonly ADMIN_EMAIL = 'admin@example.com';
  private readonly ADMIN_NAME = 'Administrator';

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async onModuleInit() {
    // Skip auto-seeding if INIT_SECRET is set (setup feature enabled)
    if (process.env.INIT_SECRET) {
      this.logger.log('INIT_SECRET set - setup feature enabled, skipping auto seed');
      return;
    }
    await this.seedAdminUser();
  }

  async seedAdminUser() {
    try {
      // Check if any users exist
      const userCount = await this.userRepository.count();
      if (userCount > 0) {
        this.logger.log('Users already exist, skipping admin user seed');
        return;
      }

      this.logger.log('No users found, creating admin user...');

      // Generate random 8-character password
      const password = this.generateRandomPassword(8);
      this.logger.log('Generated random password for admin user');

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create admin user with 'admin' role
      const adminUser = this.userRepository.create({
        email: this.ADMIN_EMAIL,
        name: this.ADMIN_NAME,
        password: hashedPassword,
        role: 'admin',
        provider: 'credentials',
        is_active: true,
      });

      await this.userRepository.save(adminUser);
      this.logger.log(`Created admin user with ID: ${adminUser.id}`);

      // Log the generated password (only once at startup)
      this.logger.warn('============================================================');
      this.logger.warn('ADMIN USER CREATED');
      this.logger.warn('============================================================');
      this.logger.warn(`Email: ${this.ADMIN_EMAIL}`);
      this.logger.warn(`Password: ${password}`);
      this.logger.warn('Role: admin (includes user permissions)');
      this.logger.warn('============================================================');
      this.logger.warn('Please save this password and change it after first login!');
      this.logger.warn('============================================================');
    } catch (error) {
      this.logger.error('Failed to seed admin user:', error);
    }
  }

  private generateRandomPassword(length: number): string {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const special = '!@#$%^&*';

    const allChars = uppercase + lowercase + numbers + special;
    let password = '';

    // Ensure at least one of each type
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += special[Math.floor(Math.random() * special.length)];

    // Fill remaining characters
    for (let i = 4; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }

    // Shuffle the password
    return password
      .split('')
      .sort(() => Math.random() - 0.5)
      .join('');
  }
}
