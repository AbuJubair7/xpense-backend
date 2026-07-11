import { IsString, IsEnum, IsNumber, Min, IsOptional } from 'class-validator';
import { AssetType } from '../entities/asset.entity';

export class UpdateAssetDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(AssetType)
  type?: AssetType;

  @IsOptional()
  @IsNumber()
  @Min(0)
  balance?: number;
}
