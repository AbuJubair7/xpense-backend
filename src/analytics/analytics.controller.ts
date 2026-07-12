import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('summary')
  getSummary(@Request() req?) {
    return this.analyticsService.getSummary(req.user.id);
  }

  @Get('activity')
  getActivity(
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Query('fromDate') fromDate: string,
    @Query('toDate') toDate: string,
    @Query('kind') kind: string,
    @Query('assetId') assetId: string,
    @Request() req?,
  ) {
    return this.analyticsService.getActivity(
      { page, limit, fromDate, toDate, kind, assetId },
      req.user.id,
    );
  }

  @Get('history')
  getHistory(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
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
        page,
        limit,
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
