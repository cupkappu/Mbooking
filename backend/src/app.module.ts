import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

import { AuthModule } from './auth/auth.module';
import { TenantsModule } from './tenants/tenants.module';
import { AccountsModule } from './accounts/accounts.module';
import { JournalModule } from './journal/journal.module';
import { QueryModule } from './query/query.module';
import { RatesModule } from './rates/rates.module';
import { ProvidersModule } from './providers/providers.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { BudgetsModule } from './budgets/budgets.module';
import { ReportsModule } from './reports/reports.module';
import { CurrenciesModule } from './currencies/currencies.module';
import { AdminModule } from './admin/admin.module';
// SchemaInitModule removed - use TypeORM synchronize for tests instead
import { SeedsModule } from './common/seeds/seeds.module';
import { SetupModule } from './setup/setup.module';
import { TenantMiddleware } from './common/middleware/tenant.middleware';
import { ExportModule } from './export/export.module';

const isTest = process.env.NODE_ENV === 'test';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT || '5432'),
      username: process.env.DATABASE_USER || 'accounting',
      password: process.env.DATABASE_PASSWORD || 'secret',
      database: process.env.DATABASE_NAME || 'accounting',
      autoLoadEntities: true,
      synchronize: isTest, // Use TypeORM synchronize for tests; migrations for production
      namingStrategy: new SnakeNamingStrategy(),
      logging: process.env.NODE_ENV === 'development',
    }),
    ScheduleModule.forRoot(),
    AuthModule,
    TenantsModule,
    AccountsModule,
    JournalModule,
    QueryModule,
    RatesModule,
    ProvidersModule,
    SchedulerModule,
    BudgetsModule,
    ReportsModule,
    CurrenciesModule,
    AdminModule,
    SeedsModule,
    SetupModule,
    ExportModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantMiddleware)
      .forRoutes('*');
  }
}
