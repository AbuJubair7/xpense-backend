import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Asset } from './entities/asset.entity';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';

@Injectable()
export class AssetsService {
  constructor(
    @InjectRepository(Asset)
    private readonly assetRepository: Repository<Asset>,
  ) {}

  async create(createAssetDto: CreateAssetDto, userId: string): Promise<Asset> {
    const asset = this.assetRepository.create({
      ...createAssetDto,
      user: { id: userId } as any,
    });
    return this.assetRepository.save(asset);
  }

  async findAll(userId: string): Promise<Asset[]> {
    return this.assetRepository.find({
      where: { user: { id: userId } },
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string, userId: string): Promise<Asset> {
    const asset = await this.assetRepository.findOne({
      where: { id, user: { id: userId } },
    });
    if (!asset) {
      throw new NotFoundException(`Asset with ID ${id} not found`);
    }
    return asset;
  }

  async update(
    id: string,
    updateAssetDto: UpdateAssetDto,
    userId: string,
  ): Promise<Asset> {
    const asset = await this.findOne(id, userId);
    Object.assign(asset, updateAssetDto);
    return this.assetRepository.save(asset);
  }

  async remove(id: string, userId: string): Promise<void> {
    const asset = await this.findOne(id, userId);
    await this.assetRepository.remove(asset);
  }
}
