import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { SendNotificationDto, BulkNotificationDto, ListNotificationsDto } from './dto/notifications.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly svc: NotificationsService) {}
  @Get() list(@CurrentUser('id') uid: string, @Query() dto: ListNotificationsDto) { return this.svc.listForUser(uid, dto); }
  @Patch(':id/read') markRead(@Param('id') id: string, @CurrentUser('id') uid: string) { return this.svc.markAsRead(id, uid); }
  @Patch('read-all') markAllRead(@CurrentUser('id') uid: string) { return this.svc.markAllAsRead(uid); }
  @Post('send') @UseGuards(RolesGuard) @Roles('ADMIN','SUPER_ADMIN') send(@Body() dto: SendNotificationDto) { return this.svc.send(dto); }
  @Post('send-bulk') @UseGuards(RolesGuard) @Roles('ADMIN','SUPER_ADMIN') sendBulk(@Body() dto: BulkNotificationDto) { return this.svc.sendBulk(dto); }
}
