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
import { ExchangeRate } from '../rates/exchange-rate.entity';
import { Budget } from '../budgets/budget.entity';
import { Provider } from '../rates/provider.entity';
import { CurrenciesModule } from '../currencies/currencies.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AuditLog,
      User,
      Account,
      JournalEntry,
      JournalLine,
      Currency,
      ExchangeRate,
      Budget,
      Provider,
    ]),
    CurrenciesModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
