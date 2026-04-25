import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { CreatePlanDto, UpdatePlanDto, SubscribeDto, ListSubscriptionsDto, ListPlansQueryDto } from './dto/subscriptions.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly svc: SubscriptionsService) {}

  /* ─── Public plan listing ─── */

  @Public()
  @Get('plans')
  listPlans(@Query() query: ListPlansQueryDto) {
    return this.svc.listPlans(query);
  }

  /* ─── Admin plan management ─── */

  @Get('plans/all')
  @UseGuards(RolesGuard) @Roles('ADMIN', 'SUPER_ADMIN')
  listAllPlans() {
    return this.svc.listAllPlans();
  }

  @Post('plans')
  @UseGuards(RolesGuard) @Roles('ADMIN', 'SUPER_ADMIN')
  createPlan(@Body() dto: CreatePlanDto) {
    return this.svc.createPlan(dto);
  }

  @Patch('plans/:id')
  @UseGuards(RolesGuard) @Roles('ADMIN', 'SUPER_ADMIN')
  updatePlan(@Param('id') id: string, @Body() dto: UpdatePlanDto) {
    return this.svc.updatePlan(id, dto);
  }

  @Delete('plans/:id')
  @UseGuards(RolesGuard) @Roles('ADMIN', 'SUPER_ADMIN')
  deletePlan(@Param('id') id: string) {
    return this.svc.deletePlan(id);
  }

  @Patch('plans/:id/toggle')
  @UseGuards(RolesGuard) @Roles('ADMIN', 'SUPER_ADMIN')
  togglePlan(@Param('id') id: string) {
    return this.svc.togglePlan(id);
  }

  @Post('plans/:id/duplicate')
  @UseGuards(RolesGuard) @Roles('ADMIN', 'SUPER_ADMIN')
  duplicatePlan(@Param('id') id: string, @Body() body: { orgId?: string; name?: string }) {
    return this.svc.duplicatePlan(id, body);
  }

  /* ─── Org-specific plan endpoints ─── */

  @Post('plans/org/:orgId')
  @UseGuards(RolesGuard) @Roles('ADMIN', 'SUPER_ADMIN')
  createOrgPlan(@Param('orgId') orgId: string, @Body() dto: CreatePlanDto) {
    return this.svc.createOrgPlan(orgId, dto);
  }

  @Get('plans/org/:orgId')
  listOrgPlans(@Param('orgId') orgId: string) {
    return this.svc.listPlansForOrg(orgId);
  }

  /* ─── Stats (admin) ─── */

  @Get('stats')
  @UseGuards(RolesGuard) @Roles('ADMIN', 'SUPER_ADMIN')
  getStats() {
    return this.svc.getStats();
  }

  /* ─── Subscriber actions ─── */

  @Post('subscribe')
  subscribe(@CurrentUser('id') uid: string, @Body() dto: SubscribeDto) {
    return this.svc.subscribe(uid, dto);
  }

  @Post('renew/:id')
  renew(@CurrentUser('id') uid: string, @Param('id') id: string) {
    return this.svc.renew(uid, id);
  }

  @Get('my')
  getMy(@CurrentUser('id') uid: string) {
    return this.svc.getMySubscriptions(uid);
  }

  @Get('me')
  getActive(@CurrentUser('id') uid: string) {
    return this.svc.getMySubscription(uid);
  }

  @Post('cancel')
  cancel(@CurrentUser('id') uid: string) {
    return this.svc.cancel(uid);
  }

  @Patch('me/auto-renew')
  toggleAutoRenew(@CurrentUser('id') uid: string) {
    return this.svc.toggleAutoRenew(uid);
  }

  @Get()
  @UseGuards(RolesGuard) @Roles('ADMIN', 'SUPER_ADMIN')
  listAll(@Query() dto: ListSubscriptionsDto) {
    return this.svc.listAll(dto);
  }
}
