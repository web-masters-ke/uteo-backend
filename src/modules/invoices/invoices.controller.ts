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
import { InvoicesService } from './invoices.service';
import {
  CreateInvoiceDto,
  ListInvoicesDto,
  AdminListInvoicesDto,
} from './dto/invoices.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@Controller('invoices')
export class InvoicesController {
  constructor(private readonly svc: InvoicesService) {}

  @Post()
  create(
    @CurrentUser('id') uid: string,
    @Body() dto: CreateInvoiceDto,
  ) {
    return this.svc.create(uid, dto);
  }

  @Post('auto/:bookingId')
  autoGenerate(
    @Param('bookingId') bookingId: string,
    @CurrentUser('id') uid: string,
  ) {
    return this.svc.autoGenerateFromBooking(bookingId, uid);
  }

  @Get()
  findAll(@CurrentUser('id') uid: string, @Query() dto: ListInvoicesDto) {
    return this.svc.findAll(uid, dto);
  }

  @Get('stats')
  getStats(@CurrentUser('id') uid: string) {
    return this.svc.getStats(uid);
  }

  @Get('admin/all')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN', 'FINANCE_ADMIN')
  adminFindAll(@Query() dto: AdminListInvoicesDto) {
    return this.svc.adminFindAll(dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser('id') uid: string) {
    return this.svc.findOne(id, uid);
  }

  @Patch(':id/send')
  send(@Param('id') id: string, @CurrentUser('id') uid: string) {
    return this.svc.send(id, uid);
  }

  @Patch(':id/paid')
  markPaid(@Param('id') id: string, @CurrentUser('id') uid: string) {
    return this.svc.markPaid(id, uid);
  }

  @Patch(':id/void')
  voidInvoice(@Param('id') id: string, @CurrentUser('id') uid: string) {
    return this.svc.void(id, uid);
  }
}
