import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Expense } from '../expenses/entities/expense.entity';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Expense)
    private readonly expenseRepository: Repository<Expense>,
  ) {}

  // Helper to get last day of a month
  private getLastDayOfMonth(year: number, month: number): number {
    return new Date(year, month, 0).getDate();
  }

  // Helper to parse inputs and return start and end date strings (YYYY-MM-DD)
  private parseDateRange(query: {
    fromDay?: string;
    toDay?: string;
    fromMonth?: string;
    toMonth?: string;
    fromYear?: string;
    toYear?: string;
  }): {
    startDate: string;
    endDate: string;
    filterType: 'day' | 'month' | 'year';
  } {
    let startDate: string;
    let endDate: string;
    let filterType: 'day' | 'month' | 'year' = 'day';

    if (query.fromDay && query.toDay) {
      startDate = query.fromDay;
      endDate = query.toDay;
      filterType = 'day';
    } else if (query.fromMonth && query.toMonth) {
      const [startYear, startMonth] = query.fromMonth.split('-').map(Number);
      const [endYear, endMonth] = query.toMonth.split('-').map(Number);

      if (!startYear || !startMonth || !endYear || !endMonth) {
        throw new BadRequestException('Invalid month format. Use YYYY-MM.');
      }

      startDate = `${query.fromMonth}-01`;
      const lastDay = this.getLastDayOfMonth(endYear, endMonth);
      endDate = `${query.toMonth}-${String(lastDay).padStart(2, '0')}`;
      filterType = 'month';
    } else if (query.fromYear && query.toYear) {
      startDate = `${query.fromYear}-01-01`;
      endDate = `${query.toYear}-12-31`;
      filterType = 'year';
    } else {
      const currentYear = new Date().getFullYear();
      startDate = `${currentYear}-01-01`;
      endDate = `${currentYear}-12-31`;
      filterType = 'day';
    }

    return { startDate, endDate, filterType };
  }

  async getHistory(
    query: {
      fromDay?: string;
      toDay?: string;
      fromMonth?: string;
      toMonth?: string;
      fromYear?: string;
      toYear?: string;
    },
    userId: string,
  ) {
    const { startDate, endDate, filterType } = this.parseDateRange(query);

    // Fetch expenses within date range and scoped to user
    const expenses = await this.expenseRepository.find({
      where: {
        date: Between(startDate, endDate),
        user: { id: userId },
      },
      order: { date: 'DESC', createdAt: 'DESC' },
    });

    const totalSpending = expenses.reduce(
      (sum, item) => sum + Number(item.amount),
      0,
    );

    const categoryTotals: { [key: string]: number } = {};
    expenses.forEach((item) => {
      const cat = item.category || 'Others';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + Number(item.amount);
    });

    const categoryBreakdown = Object.keys(categoryTotals).map((cat) => ({
      category: cat,
      amount: Number(categoryTotals[cat].toFixed(2)),
      percentage:
        totalSpending > 0
          ? Number(((categoryTotals[cat] / totalSpending) * 100).toFixed(2))
          : 0,
    }));

    const timelineTotals: { [key: string]: number } = {};
    expenses.forEach((item) => {
      let key = item.date;
      if (filterType === 'month') {
        key = item.date.substring(0, 7);
      } else if (filterType === 'year') {
        key = item.date.substring(0, 4);
      }
      timelineTotals[key] = (timelineTotals[key] || 0) + Number(item.amount);
    });

    const timelineData: { period: string; amount: number }[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (filterType === 'day') {
      const current = new Date(start);
      while (current <= end) {
        const key = current.toISOString().split('T')[0];
        timelineData.push({
          period: key,
          amount: Number((timelineTotals[key] || 0).toFixed(2)),
        });
        current.setDate(current.getDate() + 1);
      }
    } else if (filterType === 'month') {
      const current = new Date(start.getFullYear(), start.getMonth(), 1);
      while (current <= end) {
        const year = current.getFullYear();
        const month = String(current.getMonth() + 1).padStart(2, '0');
        const key = `${year}-${month}`;
        timelineData.push({
          period: key,
          amount: Number((timelineTotals[key] || 0).toFixed(2)),
        });
        current.setMonth(current.getMonth() + 1);
      }
    } else {
      for (let y = start.getFullYear(); y <= end.getFullYear(); y++) {
        const key = String(y);
        timelineData.push({
          period: key,
          amount: Number((timelineTotals[key] || 0).toFixed(2)),
        });
      }
    }

    return {
      transactions: expenses,
      totalSpending: Number(totalSpending.toFixed(2)),
      categoryBreakdown,
      timelineData,
    };
  }

  async getAverages(
    query: {
      type: 'day' | 'month' | 'year';
      fromDate?: string;
      toDate?: string;
    },
    userId: string,
  ) {
    const { type, fromDate, toDate } = query;
    let startDate: string;
    let endDate: string;

    const todayStr = new Date().toISOString().split('T')[0];

    if (type === 'day') {
      const currentYear = new Date().getFullYear();
      startDate = fromDate || `${currentYear}-01-01`;
      endDate = toDate || todayStr;
    } else if (type === 'month') {
      const start = new Date();
      start.setFullYear(start.getFullYear() - 1);
      const startYear = start.getFullYear();
      const startMonth = String(start.getMonth() + 1).padStart(2, '0');

      startDate = fromDate ? `${fromDate}-01` : `${startYear}-${startMonth}-01`;

      if (toDate) {
        const [endYear, endMonth] = toDate.split('-').map(Number);
        const lastDay = this.getLastDayOfMonth(endYear, endMonth);
        endDate = `${toDate}-${String(lastDay).padStart(2, '0')}`;
      } else {
        const now = new Date();
        const lastDay = this.getLastDayOfMonth(
          now.getFullYear(),
          now.getMonth() + 1,
        );
        const endMonth = String(now.getMonth() + 1).padStart(2, '0');
        endDate = `${now.getFullYear()}-${endMonth}-${String(lastDay).padStart(2, '0')}`;
      }
    } else {
      const currentYear = new Date().getFullYear();
      startDate = fromDate ? `${fromDate}-01-01` : `${currentYear - 4}-01-01`;
      endDate = toDate ? `${toDate}-12-31` : `${currentYear}-12-31`;
    }

    // Fetch all expenses in target range scoped to user
    const expenses = await this.expenseRepository.find({
      where: {
        date: Between(startDate, endDate),
        user: { id: userId },
      },
    });

    const timelineTotals: { [key: string]: number } = {};
    expenses.forEach((item) => {
      let key = item.date;
      if (type === 'month') {
        key = item.date.substring(0, 7);
      } else if (type === 'year') {
        key = item.date.substring(0, 4);
      }
      timelineTotals[key] = (timelineTotals[key] || 0) + Number(item.amount);
    });

    const periodData: { period: string; amount: number }[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (type === 'day') {
      const current = new Date(start);
      while (current <= end) {
        const key = current.toISOString().split('T')[0];
        periodData.push({
          period: key,
          amount: Number((timelineTotals[key] || 0).toFixed(2)),
        });
        current.setDate(current.getDate() + 1);
      }
    } else if (type === 'month') {
      const current = new Date(start.getFullYear(), start.getMonth(), 1);
      while (current <= end) {
        const year = current.getFullYear();
        const month = String(current.getMonth() + 1).padStart(2, '0');
        const key = `${year}-${month}`;

        const monthNames = [
          'Jan',
          'Feb',
          'Mar',
          'Apr',
          'May',
          'Jun',
          'Jul',
          'Aug',
          'Sep',
          'Oct',
          'Nov',
          'Dec',
        ];
        const label = `${monthNames[current.getMonth()]} ${year}`;

        periodData.push({
          period: label,
          amount: Number((timelineTotals[key] || 0).toFixed(2)),
        });
        current.setMonth(current.getMonth() + 1);
      }
    } else {
      for (let y = start.getFullYear(); y <= end.getFullYear(); y++) {
        const key = String(y);
        periodData.push({
          period: key,
          amount: Number((timelineTotals[key] || 0).toFixed(2)),
        });
      }
    }

    const totalAmount = periodData.reduce((sum, item) => sum + item.amount, 0);
    const intervalsCount = periodData.length;
    const meanValue =
      intervalsCount > 0
        ? Number((totalAmount / intervalsCount).toFixed(2))
        : 0;

    return {
      meanValue,
      periodData,
    };
  }
}
