import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, DataSource } from 'typeorm';
import { Expense } from './entities/expense.entity';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { AssetsService } from '../assets/assets.service';
import { Asset } from '../assets/entities/asset.entity';

@Injectable()
export class ExpensesService {
  constructor(
    @InjectRepository(Expense)
    private readonly expenseRepository: Repository<Expense>,
    private readonly assetsService: AssetsService,
    private readonly dataSource: DataSource,
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

  async findAll(
    userId: string,
    limit?: number,
    category?: string,
    startDate?: string,
    endDate?: string,
  ): Promise<Expense[]> {
    const where: any = { user: { id: userId } };

    if (category) {
      where.category = category;
    }

    if (startDate && endDate) {
      where.date = Between(startDate, endDate);
    }

    return this.expenseRepository.find({
      where,
      relations: { asset: true },
      order: { date: 'DESC', createdAt: 'DESC' },
      take: limit,
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

  async update(
    id: string,
    updateExpenseDto: UpdateExpenseDto,
    userId: string,
  ): Promise<Expense> {
    return this.dataSource.transaction(async (manager) => {
      const expense = await manager.findOne(Expense, {
        where: { id, user: { id: userId } },
        relations: { asset: true },
      });

      if (!expense) {
        throw new NotFoundException(`Expense with ID ${id} not found`);
      }

      const oldAmount = Number(expense.amount);
      const newAmount = updateExpenseDto.amount ?? oldAmount;
      const oldAssetId = expense.asset?.id;
      const newAssetId = updateExpenseDto.assetId ?? oldAssetId;

      if (!oldAssetId) {
        throw new NotFoundException('Expense has no associated asset');
      }

      if (newAssetId !== oldAssetId) {
        const oldAsset = await manager.findOne(Asset, { where: { id: oldAssetId } });
        if (oldAsset) {
          await manager.save(Asset, {
            id: oldAssetId,
            balance: Number(oldAsset.balance) + oldAmount,
          });
        }

        const newAsset = await manager.findOne(Asset, { where: { id: newAssetId } });
        if (!newAsset) {
          throw new NotFoundException(`Asset with ID ${newAssetId} not found`);
        }
        await manager.save(Asset, {
          id: newAssetId,
          balance: Number(newAsset.balance) - newAmount,
        });
      } else {
        const asset = await manager.findOne(Asset, { where: { id: oldAssetId } });
        if (asset) {
          const balanceDiff = oldAmount - newAmount;
          await manager.save(Asset, {
            id: oldAssetId,
            balance: Number(asset.balance) + balanceDiff,
          });
        }
      }

      Object.assign(expense, updateExpenseDto);
      if (updateExpenseDto.assetId) {
        expense.asset = manager.create(Asset, { id: newAssetId });
      }

      return manager.save(Expense, expense);
    });
  }

  async remove(id: string, userId: string): Promise<void> {
    const expense = await this.findOne(id, userId);
    if (expense.asset) {
      await this.assetsService.update(
        expense.asset.id,
        {
          balance: Number(expense.asset.balance) + Number(expense.amount),
        },
        userId,
      );
    }
    await this.expenseRepository.remove(expense);
  }
}
