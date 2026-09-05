import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, DataSource } from 'typeorm';
import { Income } from './entities/income.entity';
import { CreateIncomeDto } from './dto/create-income.dto';
import { UpdateIncomeDto } from './dto/update-income.dto';
import { AssetsService } from '../assets/assets.service';
import { Asset } from '../assets/entities/asset.entity';

@Injectable()
export class IncomeService {
  constructor(
    @InjectRepository(Income)
    private readonly incomeRepository: Repository<Income>,
    private readonly assetsService: AssetsService,
    private readonly dataSource: DataSource,
  ) {}

  async create(
    createIncomeDto: CreateIncomeDto,
    userId: string,
  ): Promise<Income> {
    const { assetId, ...incomeData } = createIncomeDto;

    // Verify that the asset exists and belongs to the user
    const asset = await this.assetsService.findOne(assetId, userId);

    // Create income record mapped to current user and target asset
    const income = this.incomeRepository.create({
      ...incomeData,
      user: { id: userId },
      asset: { id: assetId },
    });
    const savedIncome = await this.incomeRepository.save(income);

    // Credit the asset balance
    await this.assetsService.update(
      assetId,
      {
        balance: Number(asset.balance) + Number(createIncomeDto.amount),
      },
      userId,
    );

    return savedIncome;
  }

  async findAll(
    userId: string,
    limit?: number,
    source?: string,
    startDate?: string,
    endDate?: string,
  ): Promise<Income[]> {
    const where: any = { user: { id: userId } };

    if (source) {
      where.source = source;
    }

    if (startDate && endDate) {
      where.date = Between(startDate, endDate);
    }

    return this.incomeRepository.find({
      where,
      relations: { asset: true },
      order: { date: 'DESC', createdAt: 'DESC' },
      take: limit,
    });
  }

  async findOne(id: string, userId: string): Promise<Income> {
    const income = await this.incomeRepository.findOne({
      where: { id, user: { id: userId } },
      relations: { asset: true },
    });
    if (!income) {
      throw new NotFoundException(`Income log with ID ${id} not found`);
    }
    return income;
  }

  async update(
    id: string,
    updateIncomeDto: UpdateIncomeDto,
    userId: string,
  ): Promise<Income> {
    return this.dataSource.transaction(async (manager) => {
      const income = await manager.findOne(Income, {
        where: { id, user: { id: userId } },
        relations: { asset: true },
      });

      if (!income) {
        throw new NotFoundException(`Income with ID ${id} not found`);
      }

      const oldAmount = Number(income.amount);
      const newAmount = updateIncomeDto.amount ?? oldAmount;
      const oldAssetId = income.asset.id;
      const newAssetId = updateIncomeDto.assetId ?? oldAssetId;

      if (newAssetId !== oldAssetId) {
        const oldAsset = await manager.findOne(Asset, { where: { id: oldAssetId } });
        if (oldAsset) {
          await manager.save(Asset, {
            id: oldAssetId,
            balance: Number(oldAsset.balance) - oldAmount,
          });
        }

        const newAsset = await manager.findOne(Asset, { where: { id: newAssetId } });
        if (!newAsset) {
          throw new NotFoundException(`Asset with ID ${newAssetId} not found`);
        }
        await manager.save(Asset, {
          id: newAssetId,
          balance: Number(newAsset.balance) + newAmount,
        });
      } else {
        const asset = await manager.findOne(Asset, { where: { id: oldAssetId } });
        if (asset) {
          const balanceDiff = newAmount - oldAmount;
          await manager.save(Asset, {
            id: oldAssetId,
            balance: Number(asset.balance) + balanceDiff,
          });
        }
      }

      Object.assign(income, updateIncomeDto);
      if (updateIncomeDto.assetId) {
        income.asset = manager.create(Asset, { id: newAssetId });
      }

      return manager.save(Income, income);
    });
  }

  async remove(id: string, userId: string): Promise<void> {
    const income = await this.findOne(id, userId);
    if (income.asset) {
      await this.assetsService.update(
        income.asset.id,
        {
          balance: Number(income.asset.balance) - Number(income.amount),
        },
        userId,
      );
    }
    await this.incomeRepository.remove(income);
  }
}
