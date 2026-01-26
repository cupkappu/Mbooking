import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Budget } from './budget.entity';
import { BudgetTemplate } from './entities/budget-template.entity';
import { BudgetAlert } from './entities/budget-alert.entity';
import { JournalLine } from '../journal/journal-line.entity';
import { Account } from '../accounts/account.entity';
import { BudgetsService } from './budgets.service';
import { BudgetAlertService } from './budget-alert.service';
import { BudgetTemplateService } from './budget-template.service';
import { BudgetProgressService } from './services/budget-progress.service';
import { TemplateSeedingService } from './services/template-seeding.service';
import { BudgetsController } from './budgets.controller';
import { QueryModule } from '../query/query.module';
import { BudgetAmountValidator } from './validators/budget-amount.validator';

@Module({
  imports: [
    TypeOrmModule.forFeature([Budget, BudgetTemplate, BudgetAlert, JournalLine, Account]),
    forwardRef(() => QueryModule),
  ],
  controllers: [BudgetsController],
  providers: [BudgetsService, BudgetAlertService, BudgetTemplateService, BudgetProgressService, TemplateSeedingService, BudgetAmountValidator],
  exports: [BudgetsService, BudgetAlertService, BudgetTemplateService, BudgetProgressService, TemplateSeedingService, BudgetAmountValidator],
})
export class BudgetsModule {}
