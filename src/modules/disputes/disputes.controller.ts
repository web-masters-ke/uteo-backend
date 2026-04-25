import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { DisputesService } from './disputes.service';
import { CreateDisputeDto, ResolveDisputeDto, ListDisputesDto, EscalateDisputeDto } from './dto/disputes.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
@Controller('disputes')
export class DisputesController {
  constructor(private readonly svc: DisputesService) {}
  @Post() create(@CurrentUser('id') uid: string, @CurrentUser('role') role: string, @Body() dto: CreateDisputeDto) { return this.svc.create(uid, dto, role); }

  /** Admin-only: list all disputes with optional filters */
  @Get() @UseGuards(RolesGuard) @Roles('ADMIN','SUPER_ADMIN','SUPPORT') findAll(@Query() dto: ListDisputesDto) { return this.svc.findAll(dto); }

  /** Any authenticated user: list disputes they are involved in (as raiser or against) */
  @Get('my') findMy(@CurrentUser('id') uid: string, @Query() dto: ListDisputesDto) { return this.svc.findMyDisputes(uid, dto); }

  @Get(':id') findOne(@Param('id') id: string) { return this.svc.findOne(id); }
  @Patch(':id/resolve') @UseGuards(RolesGuard) @Roles('ADMIN','SUPER_ADMIN') resolve(@Param('id') id: string, @Body() dto: ResolveDisputeDto, @CurrentUser('id') aid: string) { return this.svc.resolve(id, dto, aid); }

  /** Escalate a dispute up the support chain (parties, assignee, or admins). */
  @Patch(':id/escalate') escalate(@Param('id') id: string, @CurrentUser('id') uid: string, @CurrentUser('role') role: string, @Body() dto: EscalateDisputeDto) {
    return this.svc.escalate(id, uid, role, dto);
  }

  /** Assign dispute to a team member (admin → back-office; org owner → their team) */
  @Patch(':id/assign') assign(@Param('id') id: string, @Body() body: { assigneeId: string }, @CurrentUser('id') uid: string, @CurrentUser('role') role: string) {
    return this.svc.assign(id, body.assigneeId, uid, role);
  }

  /** Unassign dispute */
  @Patch(':id/unassign') unassign(@Param('id') id: string, @CurrentUser('id') uid: string, @CurrentUser('role') role: string) {
    return this.svc.unassign(id, uid, role);
  }

  /** List comments on a dispute (visible to user) */
  @Get(':id/comments') listComments(@Param('id') id: string, @CurrentUser('id') uid: string, @CurrentUser('role') role: string) {
    return this.svc.listComments(id, uid, role);
  }

  /** Post a comment on a dispute (with optional file attachments) */
  @Post(':id/comments') addComment(@Param('id') id: string, @Body() body: { content: string; attachments?: any[]; isInternal?: boolean }, @CurrentUser('id') uid: string) {
    return this.svc.addComment(id, uid, body.content, body.attachments, body.isInternal);
  }

  /** Filer withdraws their own OPEN dispute */
  @Patch(':id/withdraw') withdraw(@Param('id') id: string, @CurrentUser('id') uid: string) {
    return this.svc.withdraw(id, uid);
  }

  /** List team members I can assign disputes to */
  @Get('team/assignable') assignableTeam(@CurrentUser('id') uid: string, @CurrentUser('role') role: string) {
    return this.svc.assignableTeam(uid, role);
  }
}
