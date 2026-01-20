import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JournalEntry } from './journal-entry.entity';
import { JournalLine } from './journal-line.entity';
import { JournalService } from './journal.service';
import { JournalController } from './journal.controller';
import { QueryModule } from '../query/query.module';
import { CurrenciesModule } from '../currencies/currencies.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([JournalEntry, JournalLine]),
    forwardRef(() => QueryModule),
    CurrenciesModule,
  ],
  controllers: [JournalController],
  providers: [JournalService],
  exports: [JournalService],
})
export class JournalModule {}
