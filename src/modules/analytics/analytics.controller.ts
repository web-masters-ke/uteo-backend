import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PeriodQueryDto, TopTrainersQueryDto } from './dto/analytics.dto';

@Controller('analytics')
@UseGuards(RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
export class AnalyticsController {
  constructor(private readonly svc: AnalyticsService) {}

  @Get('overview')
  getOverview() {
    return this.svc.getOverview();
  }

  @Get('revenue')
  getRevenue(@Query() dto: PeriodQueryDto) {
    return this.svc.getRevenue(dto.period);
  }

  @Get('bookings')
  getBookings(@Query() dto: PeriodQueryDto) {
    return this.svc.getBookings(dto.period);
  }

  @Get('users')
  getUsers(@Query() dto: PeriodQueryDto) {
    return this.svc.getUsers(dto.period);
  }

  @Get('top-trainers')
  getTopTrainers(@Query() dto: TopTrainersQueryDto) {
    return this.svc.getTopTrainers(dto.limit);
  }

  @Get('categories')
  getCategories() {
    return this.svc.getCategories();
  }
}
