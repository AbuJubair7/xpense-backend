import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Expense } from '../expenses/entities/expense.entity';
import { Income } from '../income/entities/income.entity';
import { Loan } from '../loans/entities/loan.entity';
import { Borrowing } from '../borrowings/entities/borrowing.entity';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Expense)
    private readonly expenseRepository: Repository<Expense>,
    @InjectRepository(Income)
    private readonly incomeRepository: Repository<Income>,
    @InjectRepository(Loan)
    private readonly loanRepository: Repository<Loan>,
    @InjectRepository(Borrowing)
    private readonly borrowingRepository: Repository<Borrowing>,
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
      page?: string;
      limit?: string;
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
    const page = parseInt(query.page || '1', 10);
    const limit = parseInt(query.limit || '10', 10);
    const offset = (page - 1) * limit;

    // 1. Fetch paginated transactions
    const [transactions, totalCount] =
      await this.expenseRepository.findAndCount({
        where: {
          date: Between(startDate, endDate),
          user: { id: userId },
        },
        order: { date: 'DESC', createdAt: 'DESC' },
        skip: offset,
        take: limit,
        relations: { asset: true },
      });

    // 2. Calculate total spending natively in DB
    const totalSpendingResult = await this.expenseRepository
      .createQueryBuilder('expense')
      .select('SUM(expense.amount)', 'total')
      .where(
        'expense.userId = :userId AND expense.date BETWEEN :startDate AND :endDate',
        { userId, startDate, endDate },
      )
      .getRawOne();
    const totalSpending = Number(totalSpendingResult?.total || 0);

    // 3. Calculate category breakdown natively in DB
    const categoryTotalsRaw = await this.expenseRepository
      .createQueryBuilder('expense')
      .select('expense.category', 'category')
      .addSelect('SUM(expense.amount)', 'amount')
      .where(
        'expense.userId = :userId AND expense.date BETWEEN :startDate AND :endDate',
        { userId, startDate, endDate },
      )
      .groupBy('expense.category')
      .getRawMany();

    const categoryTotals: Record<string, number> = {};
    categoryTotalsRaw.forEach((row) => {
      const cat = row.category || 'Others';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + Number(row.amount);
    });

    const categoryBreakdown = Object.keys(categoryTotals).map((cat) => ({
      category: cat,
      amount: Number(categoryTotals[cat].toFixed(2)),
      percentage:
        totalSpending > 0
          ? Number(((categoryTotals[cat] / totalSpending) * 100).toFixed(2))
          : 0,
    }));

    // 4. Calculate timeline totals natively in DB
    let dateGroupSql = `TO_CHAR(expense.date, 'YYYY-MM-DD')`;
    if (filterType === 'month') {
      dateGroupSql = `TO_CHAR(expense.date, 'YYYY-MM')`;
    } else if (filterType === 'year') {
      dateGroupSql = `TO_CHAR(expense.date, 'YYYY')`;
    }

    const timelineTotalsRaw = await this.expenseRepository
      .createQueryBuilder('expense')
      .select(`${dateGroupSql}`, 'period')
      .addSelect('SUM(expense.amount)', 'amount')
      .where(
        'expense.userId = :userId AND expense.date BETWEEN :startDate AND :endDate',
        { userId, startDate, endDate },
      )
      .groupBy(`${dateGroupSql}`)
      .getRawMany();

    const timelineTotals: { [key: string]: number } = {};
    timelineTotalsRaw.forEach((row) => {
      timelineTotals[row.period] = Number(row.amount);
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
      transactions,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
      },
      totalSpending: Number(totalSpending.toFixed(2)),
      categoryBreakdown,
      timelineData,
    };
  }

  async getSummary(userId: string) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const startOfMonth = `${year}-${month}-01`;
    const lastDay = this.getLastDayOfMonth(year, now.getMonth() + 1);
    const endOfMonth = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

    const { sum: incomeSum } = await this.incomeRepository
      .createQueryBuilder('income')
      .select('SUM(income.amount)', 'sum')
      .where(
        'income.userId = :userId AND income.date BETWEEN :start AND :end',
        { userId, start: startOfMonth, end: endOfMonth },
      )
      .getRawOne();

    const { sum: expenseSum } = await this.expenseRepository
      .createQueryBuilder('expense')
      .select('SUM(expense.amount)', 'sum')
      .where(
        'expense.userId = :userId AND expense.date BETWEEN :start AND :end',
        { userId, start: startOfMonth, end: endOfMonth },
      )
      .getRawOne();

    const { sum: loansSum, count: loansCount } = await this.loanRepository
      .createQueryBuilder('loan')
      .select('SUM(loan.amount)', 'sum')
      .addSelect('COUNT(loan.id)', 'count')
      .where('loan.userId = :userId AND loan.isSettled = false', { userId })
      .getRawOne();

    const { sum: borrowingsSum, count: borrowingsCount } =
      await this.borrowingRepository
        .createQueryBuilder('borrowing')
        .select('SUM(borrowing.amount)', 'sum')
        .addSelect('COUNT(borrowing.id)', 'count')
        .where('borrowing.userId = :userId AND borrowing.isSettled = false', {
          userId,
        })
        .getRawOne();

    return {
      periodIncome: Number(incomeSum || 0),
      periodExpenses: Number(expenseSum || 0),
      outstandingLoans: Number(loansSum || 0),
      outstandingBorrowings: Number(borrowingsSum || 0),
      outstandingLoansCount: Number(loansCount || 0),
      outstandingBorrowingsCount: Number(borrowingsCount || 0),
    };
  }

  async getActivity(
    query: {
      page?: string;
      limit?: string;
      fromDate?: string;
      toDate?: string;
      kind?: string;
      assetId?: string;
    },
    userId: string,
  ) {
    const page = parseInt(query.page || '1', 10);
    const limit = parseInt(query.limit || '10', 10);
    const offset = (page - 1) * limit;

    let dateFilter = '';
    let assetFilter = '';
    const params: any[] = [userId];
    let paramIndex = 2; // $1 is userId

    if (query.fromDate && query.toDate) {
      dateFilter = `AND date >= $${paramIndex++} AND date <= $${paramIndex++}`;
      params.push(query.fromDate, query.toDate);
    }

    if (query.assetId) {
      assetFilter = ` AND "assetId" = $${paramIndex++}`;
      params.push(query.assetId);
    }

    let includeIncome = true;
    let includeExpense = true;
    if (query.kind === 'credit') {
      includeExpense = false;
    } else if (query.kind === 'debit') {
      includeIncome = false;
    }

    const incomeSql = `SELECT id, 'credit' as kind, source as title, description, amount, date, "assetId", "createdAt" FROM income WHERE "userId" = $1 ${dateFilter} ${assetFilter}`;
    const expenseSql = `SELECT id, 'debit' as kind, title, description, amount, date, "assetId", "createdAt" FROM expenses WHERE "userId" = $1 ${dateFilter} ${assetFilter}`;

    let baseSql = '';
    if (includeIncome && includeExpense) {
      baseSql = `${incomeSql} UNION ALL ${expenseSql}`;
    } else if (includeIncome) {
      baseSql = incomeSql;
    } else {
      baseSql = expenseSql;
    }

    const sql = `
      ${baseSql}
      ORDER BY date DESC, "createdAt" DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    const incomeCount = `SELECT COUNT(*) as cnt FROM income WHERE "userId" = $1 ${dateFilter} ${assetFilter}`;
    const expenseCount = `SELECT COUNT(*) as cnt FROM expenses WHERE "userId" = $1 ${dateFilter} ${assetFilter}`;

    let countBase = '';
    if (includeIncome && includeExpense) {
      countBase = `${incomeCount} UNION ALL ${expenseCount}`;
    } else if (includeIncome) {
      countBase = incomeCount;
    } else {
      countBase = expenseCount;
    }

    const countSql = `SELECT SUM(cnt) as total FROM ( ${countBase} ) as counts`;

    const rawData = await this.expenseRepository.query(sql, [
      ...params,
      limit,
      offset,
    ]);
    const countResult = await this.expenseRepository.query(countSql, params);
    const totalCount = parseInt(countResult[0]?.total || '0', 10);

    // Fetch assets to map names and types
    // Optimization: collect unique assetIds
    const assetIds = [...new Set(rawData.map((r: any) => r.assetId))];
    let assetsMap: Record<string, any> = {};
    if (assetIds.length > 0) {
      // we can't easily inject AssetsService here if it causes circular deps,
      // but we can just query the assets table
      const assets = await this.expenseRepository.query(
        `
        SELECT id, name, type FROM assets WHERE id = ANY($1)
      `,
        [assetIds],
      );
      assetsMap = assets.reduce((acc: any, asset: any) => {
        acc[asset.id] = asset;
        return acc;
      }, {});
    }

    const data = rawData.map((item: any) => ({
      id: item.id,
      kind: item.kind,
      title: item.title,
      description: item.description,
      amount: Number(item.amount),
      date: item.date,
      assetId: item.assetId,
      assetName: assetsMap[item.assetId]?.name || 'Unknown account',
      assetType: assetsMap[item.assetId]?.type || 'bank',
      createdAt: item.createdAt,
    }));

    return {
      data,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
      },
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

    // Calculate timeline totals natively in DB
    let dateGroupSql = `TO_CHAR(expense.date, 'YYYY-MM-DD')`;
    if (type === 'month') {
      dateGroupSql = `TO_CHAR(expense.date, 'YYYY-MM')`;
    } else if (type === 'year') {
      dateGroupSql = `TO_CHAR(expense.date, 'YYYY')`;
    }

    const timelineTotalsRaw = await this.expenseRepository
      .createQueryBuilder('expense')
      .select(`${dateGroupSql}`, 'period')
      .addSelect('SUM(expense.amount)', 'amount')
      .where(
        'expense.userId = :userId AND expense.date BETWEEN :startDate AND :endDate',
        { userId, startDate, endDate },
      )
      .groupBy(`${dateGroupSql}`)
      .getRawMany();

    const timelineTotals: { [key: string]: number } = {};
    timelineTotalsRaw.forEach((row) => {
      timelineTotals[row.period] = Number(row.amount);
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

        periodData.push({
          period: key,
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
