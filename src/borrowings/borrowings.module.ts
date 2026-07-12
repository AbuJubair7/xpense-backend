import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Borrowing } from './entities/borrowing.entity';
import { BorrowingsService } from './borrowings.service';
import { BorrowingsController } from './borrowings.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Borrowing])],
  controllers: [BorrowingsController],
  providers: [BorrowingsService],
  exports: [BorrowingsService, TypeOrmModule],
})
export class BorrowingsModule {}
