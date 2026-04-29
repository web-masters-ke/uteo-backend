import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { TeamService } from './team.service';
import { InviteDto, UpdateMemberDto, AssignBookingDto } from './dto/team.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Public } from '../../common/decorators/public.decorator';

@Controller('team')
export class TeamController {
  constructor(private readonly svc: TeamService) {}

  /** List my firm's team members (trainer/firm owner) */
  @Get('members')
  @UseGuards(RolesGuard)
  @Roles('TRAINER')
  listMembers(@CurrentUser('id') uid: string) {
    return this.svc.listMembers(uid);
  }

  /** List pending invites for my firm */
  @Get('invites')
  @UseGuards(RolesGuard)
  @Roles('TRAINER')
  listInvites(@CurrentUser('id') uid: string) {
    return this.svc.listInvites(uid);
  }

  /** If I'm a consultant, get my firm info */
  @Get('my-firm')
  getMyFirm(@CurrentUser('id') uid: string) {
    return this.svc.getMyFirm(uid);
  }

  /** Get team member details */
  @Get('members/:id')
  @UseGuards(RolesGuard)
  @Roles('TRAINER')
  getMember(@Param('id') id: string) {
    return this.svc.getMember(id);
  }

  /** Invite a consultant (email, role, title) */
  @Post('invite')
  @UseGuards(RolesGuard)
  @Roles('TRAINER')
  invite(
    @CurrentUser('id') uid: string,
    @Body() dto: InviteDto,
  ) {
    return this.svc.invite(uid, uid, dto);
  }

  /** Add an existing Uteo trainer directly (no email invite needed) */
  @Post('add-trainer')
  @UseGuards(RolesGuard)
  @Roles('TRAINER')
  addExistingTrainer(
    @CurrentUser('id') uid: string,
    @Body() body: { trainerUserId: string; role?: string; title?: string; departmentId?: string },
  ) {
    return this.svc.addExistingTrainer(uid, uid, body);
  }

  /** Accept an invite (the invited person calls this) */
  @Post('invite/:token/accept')
  acceptInvite(
    @Param('token') token: string,
    @CurrentUser('id') uid: string,
  ) {
    return this.svc.acceptInvite(token, uid);
  }

  /** Cancel a pending invite */
  @Delete('invite/:id')
  @UseGuards(RolesGuard)
  @Roles('TRAINER')
  cancelInvite(
    @Param('id') id: string,
    @CurrentUser('id') uid: string,
  ) {
    return this.svc.cancelInvite(id, uid, uid);
  }

  /** Update a team member (role, title, isActive) */
  @Patch('members/:id')
  @UseGuards(RolesGuard)
  @Roles('TRAINER')
  updateMember(
    @Param('id') id: string,
    @CurrentUser('id') uid: string,
    @Body() dto: UpdateMemberDto,
  ) {
    return this.svc.updateMember(id, uid, uid, dto);
  }

  /** Remove a member from the firm */
  @Delete('members/:id')
  @UseGuards(RolesGuard)
  @Roles('TRAINER')
  removeMember(
    @Param('id') id: string,
    @CurrentUser('id') uid: string,
  ) {
    return this.svc.removeMember(id, uid, uid);
  }

  /** Assign a booking to this consultant */
  @Post('members/:id/assign-booking')
  @UseGuards(RolesGuard)
  @Roles('TRAINER')
  assignBooking(
    @Param('id') id: string,
    @CurrentUser('id') uid: string,
    @Body() dto: AssignBookingDto,
  ) {
    return this.svc.assignBooking(id, uid, uid, dto);
  }
}
