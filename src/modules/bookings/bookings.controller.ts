import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { CreateBookingDto, UpdateBookingStatusDto, ListBookingsDto } from './dto/bookings.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
@Controller('bookings')
export class BookingsController {
  constructor(private readonly svc: BookingsService) {}
  @Post() create(@CurrentUser('id') uid: string, @Body() dto: CreateBookingDto) { return this.svc.create(uid, dto); }
  @Get() findAll(@Query() dto: ListBookingsDto, @CurrentUser('id') uid: string, @CurrentUser('role') role: string) { return this.svc.findAll(dto, uid, role); }
  @Get('stats') @UseGuards(RolesGuard) @Roles('ADMIN','SUPER_ADMIN','FINANCE_ADMIN') getStats() { return this.svc.getStats(); }
  @Get('my/clients') myClients(@CurrentUser('id') uid: string, @Query() q: { page?: string; limit?: string; search?: string; filter?: string }) { return this.svc.myClients(uid, { page: Number(q.page) || 1, limit: Number(q.limit) || 20, search: q.search, filter: q.filter }); }
  @Get(':id') findOne(@Param('id') id: string) { return this.svc.findOne(id); }
  @Patch(':id/status') updateStatus(@Param('id') id: string, @Body() dto: UpdateBookingStatusDto, @CurrentUser('id') uid: string, @CurrentUser('role') role: string) { return this.svc.updateStatus(id, dto, uid, role); }
  @Patch(':id/reschedule') reschedule(@Param('id') id: string, @Body() body: { scheduledAt: string; reason?: string }, @CurrentUser('id') uid: string, @CurrentUser('role') role: string) { return this.svc.reschedule(id, uid, role, body.scheduledAt, body.reason); }
  @Get(':id/status-logs') getStatusLogs(@Param('id') id: string) { return this.svc.getStatusLogs(id); }
  @Post(':id/confirm-completion') confirmCompletion(@Param('id') id: string, @CurrentUser('id') uid: string) { return this.svc.confirmSessionCompletion(id, uid); }
  @Get(':id/jaas-token') getJaasToken(@Param('id') id: string, @CurrentUser('id') uid: string) { return this.svc.generateJaasToken(id, uid); }
}
