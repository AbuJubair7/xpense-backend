import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Delete,
  ParseUUIDPipe,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Post()
  create(@Body() createExpenseDto: CreateExpenseDto, @Request() req) {
    return this.expensesService.create(createExpenseDto, req.user.id);
  }

  @Get()
  findAll(
    @Request() req,
    @Query('limit') limit?: string,
    @Query('category') category?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.expensesService.findAll(
      req.user.id,
      limit ? parseInt(limit, 10) : undefined,
      category,
      startDate,
      endDate,
    );
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.expensesService.findOne(id, req.user.id);
  }

  @Put(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateExpenseDto: UpdateExpenseDto,
    @Request() req,
  ) {
    return this.expensesService.update(id, updateExpenseDto, req.user.id);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    return this.expensesService.remove(id, req.user.id);
  }
}
