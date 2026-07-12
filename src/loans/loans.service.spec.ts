import { Test, TestingModule } from '@nestjs/testing';
import { LoansService } from './loans.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Loan } from './entities/loan.entity';
import { NotFoundException } from '@nestjs/common';

describe('LoansService', () => {
  let service: LoansService;

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findAndCount: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoansService,
        { provide: getRepositoryToken(Loan), useValue: mockRepository },
      ],
    }).compile();

    service = module.get<LoansService>(LoansService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should successfully create a loan', async () => {
      const dto = { debtorName: 'Friend', amount: 1000, date: '2026-07-01' };
      mockRepository.create.mockReturnValue({ ...dto, user: { id: 'user-1' }, isSettled: false });
      mockRepository.save.mockResolvedValue({ id: '1', ...dto, user: { id: 'user-1' }, isSettled: false });

      const result = await service.create(dto, 'user-1');
      expect(result.isSettled).toBe(false);
      expect(mockRepository.create).toHaveBeenCalledWith({ ...dto, user: { id: 'user-1' }, isSettled: false });
    });
  });

  describe('findAll', () => {
    it('should return paginated loans', async () => {
      mockRepository.findAndCount.mockResolvedValue([[{ id: '1', debtorName: 'Friend' }], 1]);
      const result = await service.findAll('user-1', 1, 10);
      expect(result.data).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.totalPages).toBe(1);
    });
  });

  describe('settle', () => {
    it('should toggle isSettled status', async () => {
      const loan = { id: '1', isSettled: false };
      mockRepository.findOne.mockResolvedValue(loan);
      mockRepository.save.mockImplementation(async (l) => l);

      const result = await service.settle('1', 'user-1');
      expect(result.isSettled).toBe(true);

      const revertResult = await service.settle('1', 'user-1');
      expect(revertResult.isSettled).toBe(false);
    });
  });

  describe('findOne', () => {
    it('should throw NotFoundException if loan is not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      await expect(service.findOne('1', 'user-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should remove a loan', async () => {
      const loan = { id: '1' };
      mockRepository.findOne.mockResolvedValue(loan);
      mockRepository.remove.mockResolvedValue(loan);

      await service.remove('1', 'user-1');
      expect(mockRepository.remove).toHaveBeenCalledWith(loan);
    });
  });
});
