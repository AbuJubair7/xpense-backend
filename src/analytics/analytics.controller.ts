import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('history')
  getHistory(
    @Query('fromDay') fromDay?: string,
    @Query('toDay') toDay?: string,
    @Query('fromMonth') fromMonth?: string,
    @Query('toMonth') toMonth?: string,
    @Query('fromYear') fromYear?: string,
    @Query('toYear') toYear?: string,
    @Request() req?,
  ) {
    return this.analyticsService.getHistory(
      {
        fromDay,
        toDay,
        fromMonth,
        toMonth,
        fromYear,
        toYear,
      },
      req.user.id,
    );
  }

  @Get('averages')
  getAverages(
    @Query('type') type: 'day' | 'month' | 'year',
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Request() req?,
  ) {
    return this.analyticsService.getAverages(
      {
        type: type || 'day',
        fromDate,
        toDate,
      },
      req.user.id,
    );
  }
}
