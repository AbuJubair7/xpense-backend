import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Borrowing } from './entities/borrowing.entity';
import { CreateBorrowingDto } from './dto/create-borrowing.dto';
import { UpdateBorrowingDto } from './dto/update-borrowing.dto';

@Injectable()
export class BorrowingsService {
  constructor(
    @InjectRepository(Borrowing)
    private readonly borrowingRepository: Repository<Borrowing>,
  ) {}

  async create(
    createBorrowingDto: CreateBorrowingDto,
    userId: string,
  ): Promise<Borrowing> {
    const borrowing = this.borrowingRepository.create({
      ...createBorrowingDto,
      isSettled: false,
      user: { id: userId } as any,
    });
    return this.borrowingRepository.save(borrowing);
  }

  async findAll(userId: string, page: number = 1, limit: number = 10): Promise<{ data: Borrowing[]; pagination: any }> {
    const skip = (page - 1) * limit;
    const [data, total] = await this.borrowingRepository.findAndCount({
      where: { user: { id: userId } },
      order: { date: 'DESC', createdAt: 'DESC' },
      skip,
      take: limit,
    });
    return {
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, userId: string): Promise<Borrowing> {
    const borrowing = await this.borrowingRepository.findOne({
      where: { id, user: { id: userId } },
    });
    if (!borrowing) {
      throw new NotFoundException(`Borrowing log with ID ${id} not found`);
    }
    return borrowing;
  }

  async update(
    id: string,
    updateBorrowingDto: UpdateBorrowingDto,
    userId: string,
  ): Promise<Borrowing> {
    const borrowing = await this.findOne(id, userId);
    Object.assign(borrowing, updateBorrowingDto);
    return this.borrowingRepository.save(borrowing);
  }

  async settle(id: string, userId: string): Promise<Borrowing> {
    const borrowing = await this.findOne(id, userId);
    borrowing.isSettled = !borrowing.isSettled;
    return this.borrowingRepository.save(borrowing);
  }

  async remove(id: string, userId: string): Promise<void> {
    const borrowing = await this.findOne(id, userId);
    await this.borrowingRepository.remove(borrowing);
  }
}
