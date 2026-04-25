import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
} from '@nestjs/common';
import { MilestonesService } from './milestones.service';
import {
  CreateMilestoneDto,
  UpdateMilestoneDto,
  DisputeMilestoneDto,
  RecordAttendanceDto,
} from './dto/milestones.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller()
export class MilestonesController {
  constructor(private readonly svc: MilestonesService) {}

  // ---- booking-scoped -------------------------------------------------------
  @Post('bookings/:bookingId/milestones')
  create(
    @Param('bookingId') bookingId: string,
    @CurrentUser('id') uid: string,
    @Body() dto: CreateMilestoneDto,
  ) {
    return this.svc.create(bookingId, uid, dto);
  }

  @Get('bookings/:bookingId/milestones')
  list(
    @Param('bookingId') bookingId: string,
    @CurrentUser('id') uid: string,
    @CurrentUser('role') role: string,
  ) {
    return this.svc.listForBooking(bookingId, uid, role);
  }

  @Post('bookings/:bookingId/attendance')
  recordAttendance(
    @Param('bookingId') bookingId: string,
    @CurrentUser('id') uid: string,
    @Body() dto: RecordAttendanceDto,
  ) {
    return this.svc.recordAttendance(bookingId, uid, dto);
  }

  @Get('bookings/:bookingId/attendance')
  getAttendance(
    @Param('bookingId') bookingId: string,
    @CurrentUser('id') uid: string,
    @CurrentUser('role') role: string,
  ) {
    return this.svc.getAttendance(bookingId, uid, role);
  }

  @Get('bookings/:id/content-access')
  contentAccess(
    @Param('id') id: string,
    @CurrentUser('id') uid: string,
  ) {
    return this.svc.canAccessContent(uid, id);
  }

  // ---- milestone-scoped -----------------------------------------------------
  @Patch('milestones/:id')
  update(
    @Param('id') id: string,
    @CurrentUser('id') uid: string,
    @Body() dto: UpdateMilestoneDto,
  ) {
    return this.svc.update(id, uid, dto);
  }

  @Post('milestones/:id/deliver')
  deliver(@Param('id') id: string, @CurrentUser('id') uid: string) {
    return this.svc.markDelivered(id, uid);
  }

  @Post('milestones/:id/release')
  release(@Param('id') id: string, @CurrentUser('id') uid: string) {
    return this.svc.release(id, uid);
  }

  @Post('milestones/:id/dispute')
  dispute(
    @Param('id') id: string,
    @CurrentUser('id') uid: string,
    @Body() dto: DisputeMilestoneDto,
  ) {
    return this.svc.dispute(id, uid, dto);
  }
}
