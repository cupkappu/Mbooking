import { Injectable, UnauthorizedException, ConflictException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User } from './user.entity';
import { TenantsService } from '../tenants/tenants.service';
import { Tenant } from '../tenants/tenant.entity';

@Injectable()
export class AuthService {
  private readonly logger = Logger;

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
    private tenantsService: TenantsService,
  ) {}

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.userRepository.findOne({
      where: { email, is_active: true },
    });

    if (user && user.password) {
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (isPasswordValid) {
        const { password: _, ...result } = user;
        return user;
      }
    }
    return null;
  }

  async login(user: User) {
    await this.ensureTenantExists(user);

    const payload = {
      sub: user.id,
      email: user.email,
      tenant_id: user.tenant_id,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    };
  }

  async register(data: {
    email: string;
    password: string;
    name?: string;
  }): Promise<User> {
    const existingUser = await this.userRepository.findOne({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    const user = this.userRepository.create({
      email: data.email,
      password: hashedPassword,
      name: data.name || data.email.split('@')[0],
      provider: 'credentials',
    });

    const savedUser = await this.userRepository.save(user);
    
    await this.ensureTenantExists(savedUser);
    
    return savedUser;
  }

  async handleOAuthLogin(profile: any, provider: string): Promise<User> {
    let user = await this.userRepository.findOne({
      where: { provider_id: profile.id, provider },
    });

    if (!user) {
      user = await this.userRepository.findOne({
        where: { email: profile.email },
      });

      if (user) {
        user.provider = provider;
        user.provider_id = profile.id;
        if (profile.image) {
          user.image = profile.image;
        }
      } else {
        user = this.userRepository.create({
          email: profile.email,
          name: profile.name || profile.email.split('@')[0],
          image: profile.image,
          provider,
          provider_id: profile.id,
        });
      }
    }

    const savedUser = await this.userRepository.save(user);
    
    await this.ensureTenantExists(savedUser);
    
    return savedUser;
  }

  async ensureTenantExists(user: User): Promise<void> {
    try {
      await this.tenantsService.findByUserId(user.id);
    } catch (error) {
      const tenant = await this.tenantsService.create({
        user_id: user.id,
        name: user.name || `${user.email} Tenant`,
        settings: { default_currency: 'USD', timezone: 'UTC' },
        is_active: true,
      });
      
      this.logger.log(`Created tenant ${tenant.id} for user ${user.id}`);
    }
  }
}
