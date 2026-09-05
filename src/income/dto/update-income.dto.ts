import { IsString, IsNumber, Min, IsOptional, IsUUID } from 'class-validator';

export class UpdateIncomeDto {
  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  amount?: number;

  @IsOptional()
  @IsString()
  date?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  assetId?: string;
}
