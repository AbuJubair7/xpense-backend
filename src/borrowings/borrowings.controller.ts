import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Patch,
  Param,
  Delete,
  ParseUUIDPipe,
  UseGuards,
  Request,
} from '@nestjs/common';
import { BorrowingsService } from './borrowings.service';
import { CreateBorrowingDto } from './dto/create-borrowing.dto';
import { UpdateBorrowingDto } from './dto/update-borrowing.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('borrowings')
export class BorrowingsController {
  constructor(private readonly borrowingsService: BorrowingsService) {}

  @Post()
  create(@Body() createBorrowingDto: CreateBorrowingDto, @Request() req) {
    return this.borrowingsService.create(createBorrowingDto, req.user.id);
  }

  @Get()
  findAll(@Request() req) {
    return this.borrowingsService.findAll(req.user.id);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.borrowingsService.findOne(id, req.user.id);
  }

  @Put(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateBorrowingDto: UpdateBorrowingDto,
    @Request() req,
  ) {
    return this.borrowingsService.update(id, updateBorrowingDto, req.user.id);
  }

  @Patch(':id/settle')
  settle(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.borrowingsService.settle(id, req.user.id);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.borrowingsService.remove(id, req.user.id);
  }
}
