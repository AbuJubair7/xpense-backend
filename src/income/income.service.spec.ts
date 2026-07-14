import { Test, TestingModule } from '@nestjs/testing';
import { IncomeService } from './income.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Income } from './entities/income.entity';
import { AssetsService } from '../assets/assets.service';
import { NotFoundException } from '@nestjs/common';

describe('IncomeService', () => {
  let service: IncomeService;
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
        IncomeService,
        { provide: getRepositoryToken(Income), useValue: mockRepository },
        { provide: AssetsService, useValue: mockAssetsService },
      ],
    }).compile();

    service = module.get<IncomeService>(IncomeService);
    assetsService = module.get<AssetsService>(AssetsService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should successfully create income and update asset balance', async () => {
      const dto = {
        title: 'Salary',
        amount: 1000,
        date: '2026-07-01',
        assetId: 'asset-1',
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
        { balance: 1500 },
        'user-1',
      );
    });
  });

  describe('findAll', () => {
    it('should return incomes', async () => {
      mockRepository.find.mockResolvedValue([{ id: '1', title: 'Salary' }]);
      const result = await service.findAll('user-1');
      expect(result).toHaveLength(1);
    });
  });

  describe('findOne', () => {
    it('should throw NotFoundException if income is not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      await expect(service.findOne('1', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('should remove income', async () => {
      const income = { id: '1' };
      mockRepository.findOne.mockResolvedValue(income);
      mockRepository.remove.mockResolvedValue(income);

      await service.remove('1', 'user-1');
      expect(mockRepository.remove).toHaveBeenCalledWith(income);
    });
  });
});
