import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Expense } from './entities/expense.entity';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { AssetsService } from '../assets/assets.service';

@Injectable()
export class ExpensesService {
  constructor(
    @InjectRepository(Expense)
    private readonly expenseRepository: Repository<Expense>,
    private readonly assetsService: AssetsService,
  ) {}

  async create(
    createExpenseDto: CreateExpenseDto,
    userId: string,
  ): Promise<Expense> {
    const { assetId, ...expenseData } = createExpenseDto;

    // Verify that the asset exists and belongs to the user
    const asset = await this.assetsService.findOne(assetId, userId);

    // Create expense record mapped to current user and source asset
    const expense = this.expenseRepository.create({
      ...expenseData,
      user: { id: userId },
      asset: { id: assetId },
    });
    const savedExpense = await this.expenseRepository.save(expense);

    // Deduct from the asset balance
    await this.assetsService.update(
      assetId,
      {
        balance: Number(asset.balance) - Number(createExpenseDto.amount),
      },
      userId,
    );

    return savedExpense;
  }

  async findAll(userId: string): Promise<Expense[]> {
    return this.expenseRepository.find({
      where: { user: { id: userId } },
      relations: { asset: true },
      order: { date: 'DESC', createdAt: 'DESC' },
    });
  }

  async findOne(id: string, userId: string): Promise<Expense> {
    const expense = await this.expenseRepository.findOne({
      where: { id, user: { id: userId } },
      relations: { asset: true },
    });
    if (!expense) {
      throw new NotFoundException(`Expense log with ID ${id} not found`);
    }
    return expense;
  }

  async remove(id: string, userId: string): Promise<void> {
    const expense = await this.findOne(id, userId);
    await this.expenseRepository.remove(expense);
  }
}
