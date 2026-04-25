import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ReportsService } from './reports.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@Controller('reports')
export class ReportsController {
  constructor(private readonly svc: ReportsService) {}

  /* ================================================================== */
  /*  Platform / Admin Reports                                          */
  /* ================================================================== */

  @Get('platform/summary')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN', 'FINANCE_ADMIN')
  platformSummary(@Query('period') period: string = '30d') {
    return this.svc.platformSummary(period);
  }

  @Get('platform/revenue')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN', 'FINANCE_ADMIN')
  platformRevenue(
    @Query('period') period: string = '30d',
    @Query('groupBy') groupBy: string = 'day',
  ) {
    return this.svc.platformRevenue(period, groupBy);
  }

  @Get('platform/commissions')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN', 'FINANCE_ADMIN')
  platformCommissions(@Query('period') period: string = '30d') {
    return this.svc.platformCommissions(period);
  }

  @Get('platform/payouts')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN', 'FINANCE_ADMIN')
  platformPayouts(@Query('period') period: string = '30d') {
    return this.svc.platformPayouts(period);
  }

  @Get('platform/subscriptions')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN', 'FINANCE_ADMIN')
  platformSubscriptions() {
    return this.svc.platformSubscriptions();
  }

  @Get('platform/wallet')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN', 'FINANCE_ADMIN')
  platformWallet() {
    return this.svc.platformWallet();
  }

  @Get('platform/money-flow')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN', 'FINANCE_ADMIN')
  platformMoneyFlow() {
    return this.svc.platformMoneyFlow();
  }

  /* ================================================================== */
  /*  Firm / Tenant Reports                                             */
  /* ================================================================== */

  @Get('firm/summary')
  firmSummary(@CurrentUser('id') uid: string) {
    return this.svc.firmSummary(uid);
  }

  @Get('firm/consultants')
  firmConsultants(
    @CurrentUser('id') uid: string,
    @Query('period') period: string = '30d',
  ) {
    return this.svc.firmConsultants(uid, period);
  }

  @Get('firm/departments')
  firmDepartments(
    @CurrentUser('id') uid: string,
    @Query('period') period: string = '30d',
  ) {
    return this.svc.firmDepartments(uid, period);
  }

  /* ================================================================== */
  /*  Individual Reports                                                */
  /* ================================================================== */

  @Get('my/earnings')
  myEarnings(
    @CurrentUser('id') uid: string,
    @Query('period') period: string = '30d',
  ) {
    return this.svc.myEarnings(uid, period);
  }

  @Get('my/spending')
  mySpending(
    @CurrentUser('id') uid: string,
    @Query('period') period: string = '30d',
  ) {
    return this.svc.mySpending(uid, period);
  }

  @Get('my/invoices-summary')
  myInvoicesSummary(@CurrentUser('id') uid: string) {
    return this.svc.myInvoicesSummary(uid);
  }
}
