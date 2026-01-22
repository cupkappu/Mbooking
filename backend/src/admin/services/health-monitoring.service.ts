import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../auth/user.entity';
import { Provider } from '../../rates/provider.entity';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'fail';
  timestamp: string;
  components: {
    database: { status: string; message?: string; details?: any };
    cache: { status: string; message?: string; details?: any };
    providers: { status: string; message?: string; details?: any };
    storage: { status: string; message?: string; details?: any };
  };
  metrics: {
    uptime: number;
    memory_usage: number;
    active_users: number;
    requests_per_minute: number;
  };
}

@Injectable()
export class HealthMonitoringService {
  private readonly logger = new Logger(HealthMonitoringService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Provider)
    private providerRepository: Repository<Provider>,
  ) {}

  async getHealthStatus(): Promise<HealthStatus> {

    let dbStatus: 'healthy' | 'degraded' | 'fail' = 'healthy';
    let dbMessage: string | undefined;
    let dbDetails: any;
    try {
      const dbStart = Date.now();
      await this.userRepository.query('SELECT 1');
      dbDetails = { latency: Date.now() - dbStart };
    } catch (error: any) {
      dbStatus = 'fail';
      dbMessage = error.message;
      this.logger.error(`Database health check failed: ${error.message}`);
    }

    const cacheStatus: 'healthy' | 'degraded' | 'fail' = 'healthy';

    const providers = await this.providerRepository.find({ where: { is_active: true } });
    const providerStatus: 'healthy' | 'degraded' | 'fail' = providers.length > 0 ? 'healthy' : 'degraded';

    const storageStatus: 'healthy' | 'degraded' | 'fail' = 'healthy';

    let overallStatus: 'healthy' | 'degraded' | 'fail' = 'healthy';
    const dbStatusStr = dbStatus as string;
    const cacheStatusStr = cacheStatus as string;
    const providerStatusStr = providerStatus as string;
    const storageStatusStr = storageStatus as string;
    const hasFailure = dbStatusStr === 'fail' || storageStatusStr === 'fail';
    const hasDegradation =
      dbStatusStr === 'degraded' ||
      cacheStatusStr === 'degraded' ||
      providerStatusStr === 'degraded';

    if (hasFailure) {
      overallStatus = 'fail';
    } else if (hasDegradation) {
      overallStatus = 'degraded';
    }

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      components: {
        database: { status: dbStatus, message: dbMessage, details: dbDetails },
        cache: { status: cacheStatus },
        providers: { status: providerStatus, details: { active_count: providers.length } },
        storage: { status: storageStatus },
      },
      metrics: {
        uptime: process.uptime(),
        memory_usage: process.memoryUsage().heapUsed / 1024 / 1024,
        active_users: 1,
        requests_per_minute: 10,
      },
    };
  }
}
