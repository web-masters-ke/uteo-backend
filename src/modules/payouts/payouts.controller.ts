import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PayoutsService } from './payouts.service';
import {
  RequestPayoutDto,
  ListPayoutsDto,
  AdminListPayoutsDto,
  RejectPayoutDto,
  CompletePayoutDto,
} from './dto/payouts.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@Controller('payouts')
export class PayoutsController {
  constructor(private readonly svc: PayoutsService) {}

  @Post('request')
  request(
    @CurrentUser('id') uid: string,
    @Body() dto: RequestPayoutDto,
  ) {
    return this.svc.request(uid, dto);
  }

  @Get()
  findAll(@CurrentUser('id') uid: string, @Query() dto: ListPayoutsDto) {
    return this.svc.findAll(uid, dto);
  }

  @Get('admin/queue')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN', 'FINANCE_ADMIN')
  adminQueue(@Query() dto: AdminListPayoutsDto) {
    return this.svc.adminQueue(dto);
  }

  @Get('admin/stats')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN', 'FINANCE_ADMIN')
  adminStats() {
    return this.svc.adminStats();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  @Patch(':id/approve')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN', 'FINANCE_ADMIN')
  approve(@Param('id') id: string, @CurrentUser('id') uid: string) {
    return this.svc.approve(id, uid);
  }

  @Patch(':id/process')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN', 'FINANCE_ADMIN')
  process(@Param('id') id: string) {
    return this.svc.process(id);
  }

  @Patch(':id/complete')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN', 'FINANCE_ADMIN')
  complete(@Param('id') id: string, @Body() dto: CompletePayoutDto) {
    return this.svc.complete(id, dto);
  }

  @Patch(':id/reject')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN', 'FINANCE_ADMIN')
  reject(@Param('id') id: string, @Body() dto: RejectPayoutDto) {
    return this.svc.reject(id, dto.reason);
  }
}
