import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Loan } from './entities/loan.entity';
import { CreateLoanDto } from './dto/create-loan.dto';
import { UpdateLoanDto } from './dto/update-loan.dto';

@Injectable()
export class LoansService {
  constructor(
    @InjectRepository(Loan)
    private readonly loanRepository: Repository<Loan>,
  ) {}

  async create(createLoanDto: CreateLoanDto, userId: string): Promise<Loan> {
    const loan = this.loanRepository.create({
      ...createLoanDto,
      isSettled: false,
      user: { id: userId },
    });
    return this.loanRepository.save(loan);
  }

  async findAll(
    userId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<{ data: Loan[]; pagination: any }> {
    const skip = (page - 1) * limit;
    const [data, total] = await this.loanRepository.findAndCount({
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

  async findOne(id: string, userId: string): Promise<Loan> {
    const loan = await this.loanRepository.findOne({
      where: { id, user: { id: userId } },
    });
    if (!loan) {
      throw new NotFoundException(`Loan with ID ${id} not found`);
    }
    return loan;
  }

  async update(
    id: string,
    updateLoanDto: UpdateLoanDto,
    userId: string,
  ): Promise<Loan> {
    const loan = await this.findOne(id, userId);
    Object.assign(loan, updateLoanDto);
    return this.loanRepository.save(loan);
  }

  async settle(id: string, userId: string): Promise<Loan> {
    const loan = await this.findOne(id, userId);
    loan.isSettled = !loan.isSettled;
    return this.loanRepository.save(loan);
  }

  async remove(id: string, userId: string): Promise<void> {
    const loan = await this.findOne(id, userId);
    await this.loanRepository.remove(loan);
  }
}
