import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { CommissionsService } from './commissions.service';
import {
  CreateCommissionRuleDto,
  UpdateCommissionRuleDto,
  ListCommissionRecordsDto,
  SetTrainerRateDto,
  WaiveTrainerCommissionDto,
  CreateCommissionOverrideDto,
  UpdateCommissionOverrideDto,
  CreateOrgCommissionOverrideDto,
} from './dto/commissions.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

@Controller('commissions')
@UseGuards(RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN', 'FINANCE_ADMIN')
export class CommissionsController {
  constructor(private readonly svc: CommissionsService) {}

  @Get('rules')
  listRules() { return this.svc.listRules(); }

  @Post('rules')
  createRule(@Body() dto: CreateCommissionRuleDto) { return this.svc.createRule(dto); }

  @Patch('rules/:id')
  updateRule(@Param('id') id: string, @Body() dto: UpdateCommissionRuleDto) { return this.svc.updateRule(id, dto); }

  @Patch('rules/:id/toggle')
  toggleRule(@Param('id') id: string) { return this.svc.toggleRule(id); }

  @Delete('rules/:id')
  deleteRule(@Param('id') id: string) { return this.svc.deleteRule(id); }

  @Post('rules/org/:orgId')
  createOrgRule(@Param('orgId') orgId: string, @Body() dto: CreateCommissionRuleDto) {
    return this.svc.createOrgRule(orgId, dto);
  }

  @Get('rules/org/:orgId')
  listOrgRules(@Param('orgId') orgId: string) {
    return this.svc.listRulesForOrg(orgId);
  }

  @Get('effective/:trainerId')
  getEffectiveCommission(@Param('trainerId') trainerId: string) {
    return this.svc.getEffectiveCommission(trainerId);
  }

  /* ─── Per-trainer and per-org commission overrides ─────────────────────── */

  @Post('override')
  createOverride(@Body() dto: CreateCommissionOverrideDto) {
    return this.svc.createOverride(dto);
  }

  @Get('overrides')
  listOverrides() {
    return this.svc.listOverrides();
  }

  @Get('override/:trainerId')
  getOverrideForTrainer(@Param('trainerId') trainerId: string) {
    return this.svc.getOverrideForTrainer(trainerId);
  }

  @Patch('override/:id')
  updateOverride(@Param('id') id: string, @Body() dto: UpdateCommissionOverrideDto) {
    return this.svc.updateOverride(id, dto);
  }

  @Delete('override/:id')
  deactivateOverride(@Param('id') id: string) {
    return this.svc.deactivateOverride(id);
  }

  @Post('override/org/:orgId')
  createOrgOverride(@Param('orgId') orgId: string, @Body() dto: CreateOrgCommissionOverrideDto) {
    return this.svc.createOrgOverride(orgId, dto);
  }

  @Get('override/org/:orgId')
  getOrgOverride(@Param('orgId') orgId: string) {
    return this.svc.getOrgOverride(orgId);
  }

  /* ─── Bulk trainer rates ───────────────────────────────────────────────── */

  @Get('trainer-rates')
  getTrainerRates() {
    return this.svc.getTrainerRates();
  }

  /* ─── Trainer-level commission management ──────────────────────────────── */

  @Get('trainers')
  listTrainersWithCommission(@Query() query: { search?: string; page?: string; limit?: string }) {
    return this.svc.listTrainersWithCommission({
      search: query.search,
      page: query.page ? Number(query.page) : undefined,
      limit: query.limit ? Number(query.limit) : undefined,
    });
  }

  @Get('trainer/:trainerId')
  getTrainerCommission(@Param('trainerId') trainerId: string) {
    return this.svc.getTrainerCommission(trainerId);
  }

  @Patch('trainer/:trainerId/rate')
  setTrainerRate(@Param('trainerId') trainerId: string, @Body() dto: SetTrainerRateDto) {
    return this.svc.setTrainerRate(trainerId, dto);
  }

  @Patch('trainer/:trainerId/waive')
  waiveTrainerCommission(@Param('trainerId') trainerId: string, @Body() dto: WaiveTrainerCommissionDto) {
    return this.svc.waiveTrainerCommission(trainerId, dto);
  }

  @Delete('trainer/:trainerId/rate')
  removeTrainerRate(@Param('trainerId') trainerId: string) {
    return this.svc.removeTrainerRate(trainerId);
  }

  @Get('records')
  listRecords(@Query() dto: ListCommissionRecordsDto) { return this.svc.listRecords(dto); }

  @Get('stats')
  getStats() { return this.svc.getStats(); }

  @Get('analytics')
  getAnalytics() { return this.svc.getAnalytics(); }
}
