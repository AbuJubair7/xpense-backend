import { IsString, IsNumber, Min, IsOptional } from 'class-validator';

export class CreateBorrowingDto {
  @IsString()
  lenderName: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  date: string; // YYYY-MM-DD
}
