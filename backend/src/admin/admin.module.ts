import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AuditLog } from './entities/audit-log.entity';
import { User } from '../auth/user.entity';
import { Account } from '../accounts/account.entity';
import { JournalEntry } from '../journal/journal-entry.entity';
import { JournalLine } from '../journal/journal-line.entity';
import { Currency } from '../currencies/currency.entity';
import { CurrencyProvider } from '../currencies/currency-provider.entity';
import { ExchangeRate } from '../rates/exchange-rate.entity';
import { Budget } from '../budgets/budget.entity';
import { Provider } from '../rates/provider.entity';
import { CurrenciesModule } from '../currencies/currencies.module';
import { ProvidersModule } from '../providers/providers.module';
import { RatesModule } from '../rates/rates.module';
import { AuditEventPublisher } from './events/audit-event-publisher.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AuditLog,
      User,
      Account,
      JournalEntry,
      JournalLine,
      Currency,
      CurrencyProvider,
      ExchangeRate,
      Budget,
      Provider,
    ]),
    CurrenciesModule,
    ProvidersModule,
    RatesModule,
  ],
  controllers: [AdminController],
  providers: [AdminService, AuditEventPublisher],
  exports: [AdminService, AuditEventPublisher],
})
export class AdminModule {}
