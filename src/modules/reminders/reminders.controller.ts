import { Controller, Get, Post, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { RemindersService } from './reminders.service';
import { CreateReminderDto, ListRemindersDto } from './dto/reminders.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@Controller('reminders')
export class RemindersController {
  constructor(private readonly svc: RemindersService) {}

  @Post()
  create(@CurrentUser('id') uid: string, @Body() dto: CreateReminderDto) {
    return this.svc.create(uid, dto);
  }

  @Get()
  findAll(@CurrentUser('id') uid: string, @Query() dto: ListRemindersDto) {
    return this.svc.findAll(uid, dto);
  }

  @Delete(':id')
  cancel(@Param('id') id: string, @CurrentUser('id') uid: string) {
    return this.svc.cancel(id, uid);
  }

  @Post('booking/:bookingId')
  createBookingReminders(@CurrentUser('id') uid: string, @Param('bookingId') bookingId: string) {
    return this.svc.createBookingReminders(uid, bookingId);
  }

  @Get('admin/pending')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  adminPending(@Query() dto: ListRemindersDto) {
    return this.svc.adminPending(dto);
  }
}
