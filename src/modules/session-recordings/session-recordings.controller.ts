import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { SessionRecordingsService } from './session-recordings.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller()
export class SessionRecordingsController {
  constructor(private readonly svc: SessionRecordingsService) {}

  @Post('bookings/:bookingId/recordings')
  save(@Param('bookingId') bookingId: string, @CurrentUser('id') uid: string, @Body() dto: any) {
    return this.svc.save(bookingId, uid, dto);
  }

  @Get('bookings/:bookingId/recordings')
  list(@Param('bookingId') bookingId: string, @CurrentUser('id') uid: string) {
    return this.svc.listForBooking(bookingId, uid);
  }

  @Get('me/recordings')
  listMy(@CurrentUser('id') uid: string, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.svc.listMy(uid, Number(page) || 1, Number(limit) || 20);
  }

  @Delete('recordings/:id')
  remove(@Param('id') id: string, @CurrentUser('id') uid: string) {
    return this.svc.remove(id, uid);
  }
}
