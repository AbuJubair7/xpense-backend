import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Income } from './entities/income.entity';
import { CreateIncomeDto } from './dto/create-income.dto';
import { AssetsService } from '../assets/assets.service';

@Injectable()
export class IncomeService {
  constructor(
    @InjectRepository(Income)
    private readonly incomeRepository: Repository<Income>,
    private readonly assetsService: AssetsService,
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

  async remove(id: string, userId: string): Promise<void> {
    const income = await this.findOne(id, userId);
    await this.incomeRepository.remove(income);
  }
}
