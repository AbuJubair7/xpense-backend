import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Income } from './entities/income.entity';
import { IncomeService } from './income.service';
import { IncomeController } from './income.controller';
import { AssetsModule } from '../assets/assets.module';

@Module({
  imports: [TypeOrmModule.forFeature([Income]), AssetsModule],
  controllers: [IncomeController],
  providers: [IncomeService],
  exports: [TypeOrmModule],
})
export class IncomeModule {}
