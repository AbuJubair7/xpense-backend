import { IsString, IsNumber, Min, IsOptional, IsUUID } from 'class-validator';

export class CreateExpenseDto {
  @IsString()
  title: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsString()
  category: string;

  @IsString()
  date: string; // YYYY-MM-DD

  @IsOptional()
  @IsString()
  description?: string;

  @IsUUID()
  assetId: string;
}
