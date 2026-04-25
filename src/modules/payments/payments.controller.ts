import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { InitiateMpesaDto, MpesaWebhookDto, ListPaymentsDto } from './dto/payments.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
@Controller('payments')
export class PaymentsController {
  constructor(private readonly svc: PaymentsService) {}
  @Post('mpesa/initiate') initiate(@CurrentUser('id') uid: string, @Body() dto: InitiateMpesaDto) { return this.svc.initiateMpesa(uid, dto); }
  @Public() @Post('webhook/mpesa') webhook(@Body() dto: MpesaWebhookDto) { return this.svc.handleMpesaWebhook(dto); }
  @Get() findAll(@CurrentUser('id') uid: string, @CurrentUser('role') role: string, @Query() dto: ListPaymentsDto) { return this.svc.findAll(uid, dto, ['ADMIN','SUPER_ADMIN','FINANCE_ADMIN'].includes(role)); }
  @Get('stats') @UseGuards(RolesGuard) @Roles('ADMIN','SUPER_ADMIN','FINANCE_ADMIN') getStats() { return this.svc.getStats(); }
  @Get(':id') findOne(@Param('id') id: string) { return this.svc.findOne(id); }
  @Patch(':id') @UseGuards(RolesGuard) @Roles('ADMIN','SUPER_ADMIN','FINANCE_ADMIN') updatePayment(@Param('id') id: string, @Body() body: { status: string }) { return this.svc.updatePayment(id, body.status); }
}
