import { Module } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { ExpensesModule } from '../expenses/expenses.module';
import { IncomeModule } from '../income/income.module';
import { LoansModule } from '../loans/loans.module';
import { BorrowingsModule } from '../borrowings/borrowings.module';

@Module({
  imports: [ExpensesModule, IncomeModule, LoansModule, BorrowingsModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
