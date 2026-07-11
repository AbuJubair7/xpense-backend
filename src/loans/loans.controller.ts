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
  Query,
} from '@nestjs/common';
import { LoansService } from './loans.service';
import { CreateLoanDto } from './dto/create-loan.dto';
import { UpdateLoanDto } from './dto/update-loan.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('loans')
export class LoansController {
  constructor(private readonly loansService: LoansService) {}

  @Post()
  create(@Body() createLoanDto: CreateLoanDto, @Request() req) {
    return this.loansService.create(createLoanDto, req.user.id);
  }

  @Get()
  findAll(@Query('page') page: string, @Query('limit') limit: string, @Request() req) {
    return this.loansService.findAll(
      req.user.id,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 10
    );
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.loansService.findOne(id, req.user.id);
  }

  @Put(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateLoanDto: UpdateLoanDto,
    @Request() req,
  ) {
    return this.loansService.update(id, updateLoanDto, req.user.id);
  }

  @Patch(':id/settle')
  settle(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.loansService.settle(id, req.user.id);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.loansService.remove(id, req.user.id);
  }
}
