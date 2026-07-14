import { Test, TestingModule } from '@nestjs/testing';
import { ExpensesService } from './expenses.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Expense } from './entities/expense.entity';
import { AssetsService } from '../assets/assets.service';
import { NotFoundException } from '@nestjs/common';

describe('ExpensesService', () => {
  let service: ExpensesService;
  let assetsService: AssetsService;

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
  };

  const mockAssetsService = {
    findOne: jest.fn(),
    update: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpensesService,
        { provide: getRepositoryToken(Expense), useValue: mockRepository },
        { provide: AssetsService, useValue: mockAssetsService },
      ],
    }).compile();

    service = module.get<ExpensesService>(ExpensesService);
    assetsService = module.get<AssetsService>(AssetsService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should successfully create expense and deduct asset balance', async () => {
      const dto = {
        title: 'Food',
        amount: 50,
        date: '2026-07-01',
        assetId: 'asset-1',
        category: 'Food',
      };
      mockAssetsService.findOne.mockResolvedValue({
        id: 'asset-1',
        balance: 500,
      });
      mockRepository.create.mockReturnValue({ ...dto, user: { id: 'user-1' } });
      mockRepository.save.mockResolvedValue({
        id: '1',
        ...dto,
        user: { id: 'user-1' },
      });

      const result = await service.create(dto, 'user-1');

      expect(result.id).toBe('1');
      expect(mockAssetsService.update).toHaveBeenCalledWith(
        'asset-1',
        { balance: 450 },
        'user-1',
      );
    });
  });

  describe('findAll', () => {
    it('should return expenses', async () => {
      mockRepository.find.mockResolvedValue([{ id: '1', title: 'Food' }]);
      const result = await service.findAll('user-1');
      expect(result).toHaveLength(1);
    });
  });

  describe('findOne', () => {
    it('should throw NotFoundException if expense is not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      await expect(service.findOne('1', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('should remove expense', async () => {
      const expense = { id: '1' };
      mockRepository.findOne.mockResolvedValue(expense);
      mockRepository.remove.mockResolvedValue(expense);

      await service.remove('1', 'user-1');
      expect(mockRepository.remove).toHaveBeenCalledWith(expense);
    });
  });
});
