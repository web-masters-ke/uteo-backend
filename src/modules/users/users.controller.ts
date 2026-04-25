import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { UsersService } from './users.service';
import {
  ListUsersDto,
  UpdateUserDto,
  UpdateUserStatusDto,
  UpdateUserRoleDto,
} from './dto/users.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('invite-learner')
  inviteLearner(@CurrentUser('id') trainerId: string, @Body() body: {
    firstName: string; lastName?: string; email: string; phone?: string; password: string;
  }) {
    return this.usersService.inviteLearner(trainerId, body);
  }

  @Get('notification-preferences')
  getNotificationPreferences(@CurrentUser('id') userId: string) {
    return this.usersService.getNotificationPreferences(userId);
  }

  @Patch('notification-preferences')
  updateNotificationPreferences(@CurrentUser('id') userId: string, @Body() body: Record<string, any>) {
    return this.usersService.updateNotificationPreferences(userId, body);
  }

  @Post('fcm-token')
  saveFcmToken(@CurrentUser('id') userId: string, @Body() body: { token: string }) {
    return this.usersService.saveFcmToken(userId, body.token);
  }

  @Delete('fcm-token')
  removeFcmToken(@CurrentUser('id') userId: string, @Body() body: { token: string }) {
    return this.usersService.removeFcmToken(userId, body.token);
  }

  @Get()
  findAll(@Query() dto: ListUsersDto) {
    return this.usersService.findAll(dto);
  }

  @Get('stats')
  @Roles('ADMIN', 'SUPER_ADMIN')
  getStats() {
    return this.usersService.getStats();
  }

  @Get('me')
  getMe(@CurrentUser('id') userId: string) {
    return this.usersService.findOne(userId);
  }

  @Delete('me')
  deleteSelf(@CurrentUser('id') userId: string) {
    return this.usersService.deleteSelf(userId);
  }

  @Patch('me/deactivate')
  deactivateSelf(@CurrentUser('id') userId: string) {
    return this.usersService.deactivateSelf(userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Patch(':id/status')
  @Roles('ADMIN', 'SUPER_ADMIN')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateUserStatusDto) {
    return this.usersService.updateStatus(id, dto);
  }

  @Patch(':id/role')
  @Roles('ADMIN', 'SUPER_ADMIN')
  updateRole(@Param('id') id: string, @Body() dto: UpdateUserRoleDto) {
    return this.usersService.updateRole(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  softDelete(@Param('id') id: string) {
    return this.usersService.softDelete(id);
  }
}
