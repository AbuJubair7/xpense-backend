import { IsString, IsNumber, Min, IsOptional, IsUUID } from 'class-validator';

export class CreateIncomeDto {
  @IsString()
  source: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsString()
  date: string; // YYYY-MM-DD

  @IsOptional()
  @IsString()
  description?: string;

  @IsUUID()
  assetId: string;
}
