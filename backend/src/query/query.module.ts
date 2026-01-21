import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Account } from '../accounts/account.entity';
import { JournalEntry } from '../journal/journal-entry.entity';
import { JournalLine } from '../journal/journal-line.entity';
import { QueryService } from './query.service';
import { QueryController } from './query.controller';
import { RatesModule } from '../rates/rates.module';
import { TenantsModule } from '../tenants/tenants.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Account, JournalEntry, JournalLine]),
    RatesModule,
    TenantsModule,
  ],
  controllers: [QueryController],
  providers: [QueryService],
  exports: [QueryService],
})
export class QueryModule {}
