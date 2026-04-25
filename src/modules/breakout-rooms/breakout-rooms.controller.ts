import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { BreakoutRoomsService } from './breakout-rooms.service';
import {
  AssignHostDto,
  CreateBreakoutRoomDto,
  MoveParticipantDto,
  ProvisionRoomsDto,
  UpdateBreakoutParticipantsDto,
} from './dto/breakout-rooms.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller()
export class BreakoutRoomsController {
  constructor(private readonly svc: BreakoutRoomsService) {}

  @Get('bookings/:bookingId/breakout-rooms')
  async list(
    @Param('bookingId') bookingId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
  ) {
    const parentRooms = await this.svc.listForBooking(bookingId, userId, role);
    return { parentRooms };
  }

  @Post('bookings/:bookingId/breakout-rooms')
  create(
    @Param('bookingId') bookingId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
    @Body() dto: CreateBreakoutRoomDto,
  ) {
    return this.svc.createBreakout(bookingId, userId, role, dto);
  }

  @Patch('breakout-rooms/:id/participants')
  updateParticipants(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
    @Body() dto: UpdateBreakoutParticipantsDto,
  ) {
    return this.svc.updateParticipants(id, userId, role, dto);
  }

  @Post('breakout-rooms/:id/close')
  close(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
  ) {
    return this.svc.closeBreakout(id, userId, role);
  }

  @Post('breakout-rooms/:id/reopen')
  reopen(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
  ) {
    return this.svc.reopenBreakout(id, userId, role);
  }

  @Post('breakout-rooms/:id/host')
  assignHost(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
    @Body() dto: AssignHostDto,
  ) {
    return this.svc.assignHost(id, userId, role, dto.hostUserId);
  }

  /** Move a participant from one breakout to another atomically. */
  @Patch('breakout-rooms/:id/move-participant')
  moveParticipant(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
    @Body() dto: MoveParticipantDto,
  ) {
    return this.svc.moveParticipant(id, userId, role, dto);
  }

  /** Provision N named breakout rooms for a booking (creates main room if absent). */
  @Post('bookings/:bookingId/provision-rooms')
  provisionRooms(
    @Param('bookingId') bookingId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') role: string,
    @Body() dto: ProvisionRoomsDto,
  ) {
    return this.svc.provisionRooms(bookingId, userId, role, dto);
  }
}
