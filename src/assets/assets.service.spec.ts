import { Test, TestingModule } from '@nestjs/testing';
import { AssetsService } from './assets.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Asset } from './entities/asset.entity';
import { NotFoundException } from '@nestjs/common';

describe('AssetsService', () => {
  let service: AssetsService;

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssetsService,
        { provide: getRepositoryToken(Asset), useValue: mockRepository },
      ],
    }).compile();

    service = module.get<AssetsService>(AssetsService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should successfully insert a asset', async () => {
      const dto = { name: 'Test Bank', type: 'bank', balance: 1000 };
      mockRepository.create.mockReturnValue({ ...dto, user: { id: 'user-1' } });
      mockRepository.save.mockResolvedValue({
        id: '1',
        ...dto,
        user: { id: 'user-1' },
      });

      const result = await service.create(dto, 'user-1');
      expect(result.id).toBe('1');
      expect(mockRepository.create).toHaveBeenCalledWith({
        ...dto,
        user: { id: 'user-1' },
      });
    });
  });

  describe('findAll', () => {
    it('should return an array of assets', async () => {
      mockRepository.find.mockResolvedValue([{ id: '1', name: 'Test Bank' }]);
      const result = await service.findAll('user-1');
      expect(result).toHaveLength(1);
    });
  });

  describe('findOne', () => {
    it('should return a asset if found', async () => {
      const asset = { id: '1', name: 'Test Bank' };
      mockRepository.findOne.mockResolvedValue(asset);
      const result = await service.findOne('1', 'user-1');
      expect(result).toEqual(asset);
    });

    it('should throw NotFoundException if asset is not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      await expect(service.findOne('1', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update a asset', async () => {
      const asset = { id: '1', name: 'Old', balance: 100 };
      mockRepository.findOne.mockResolvedValue(asset);
      mockRepository.save.mockResolvedValue({ ...asset, name: 'New' });

      const result = await service.update('1', { name: 'New' }, 'user-1');
      expect(result.name).toBe('New');
    });
  });

  describe('remove', () => {
    it('should remove a asset', async () => {
      const asset = { id: '1', name: 'Old' };
      mockRepository.findOne.mockResolvedValue(asset);
      mockRepository.remove.mockResolvedValue(asset);

      await service.remove('1', 'user-1');
      expect(mockRepository.remove).toHaveBeenCalledWith(asset);
    });
  });
});
