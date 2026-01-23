import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExportService } from './export.service';
import { ExportController } from './export.controller';
import { ExportAuditLog } from './entities/export-audit.entity';
import { JournalEntry } from '../journal/journal-entry.entity';
import { JournalLine } from '../journal/journal-line.entity';
import { Account } from '../accounts/account.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ExportAuditLog,
      JournalEntry,
      JournalLine,
      Account,
    ]),
  ],
  controllers: [ExportController],
  providers: [ExportService],
  exports: [ExportService],
})
export class ExportModule {}
