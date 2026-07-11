import { IsString, IsEnum, IsNumber, Min } from 'class-validator';
import { AssetType } from '../entities/asset.entity';

export class CreateAssetDto {
  @IsString()
  name: string;

  @IsEnum(AssetType)
  type: AssetType;

  @IsNumber()
  @Min(0)
  balance: number;
}
