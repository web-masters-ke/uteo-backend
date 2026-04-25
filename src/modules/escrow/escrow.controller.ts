import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { EscrowService } from './escrow.service';
import { FundEscrowDto, ReleaseEscrowDto, RefundEscrowDto, FreezeEscrowDto } from './dto/escrow.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
@Controller('escrow')
export class EscrowController {
  constructor(private readonly svc: EscrowService) {}
  @Post('fund') fund(@Body() dto: FundEscrowDto, @CurrentUser('id') uid: string) { return this.svc.fund(dto, uid); }
  @Post('release') release(@Body() dto: ReleaseEscrowDto, @CurrentUser('id') uid: string) { return this.svc.release(dto, uid); }
  @Post('refund') refund(@Body() dto: RefundEscrowDto, @CurrentUser('id') uid: string) { return this.svc.refund(dto, uid); }
  @Post('freeze') @UseGuards(RolesGuard) @Roles('ADMIN','SUPER_ADMIN') freeze(@Body() dto: FreezeEscrowDto, @CurrentUser('id') uid: string) { return this.svc.freeze(dto, uid); }
  @Get(':id') findOne(@Param('id') id: string) { return this.svc.findOne(id); }
  @Get('booking/:bookingId') findByBooking(@Param('bookingId') bid: string) { return this.svc.findByBookingId(bid); }
}
