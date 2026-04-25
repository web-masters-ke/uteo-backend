import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { SlaService } from './sla.service';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateSlaPolicyDto, UpdateSlaPolicyDto, AssignSlaDto } from './dto/sla.dto';

@Controller('sla')
@UseGuards(RolesGuard)
export class SlaController {
  constructor(private readonly sla: SlaService) {}

  // ─── Policies ────────────────────────────────────────────────────────────

  @Get('policies')
  @Roles('ADMIN', 'SUPER_ADMIN', 'SUPPORT', 'FINANCE_ADMIN')
  getPolicies() { return this.sla.getPolicies(); }

  @Post('policies')
  @Roles('ADMIN', 'SUPER_ADMIN')
  createPolicy(@Body() dto: CreateSlaPolicyDto, @Request() req: any) {
    return this.sla.createPolicy(dto, req.user.id);
  }

  @Get('policies/:id')
  @Roles('ADMIN', 'SUPER_ADMIN', 'SUPPORT', 'FINANCE_ADMIN')
  getPolicy(@Param('id') id: string) { return this.sla.getPolicy(id); }

  @Patch('policies/:id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  updatePolicy(@Param('id') id: string, @Body() dto: UpdateSlaPolicyDto) {
    return this.sla.updatePolicy(id, dto);
  }

  @Delete('policies/:id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  deletePolicy(@Param('id') id: string) { return this.sla.deletePolicy(id); }

  // ─── Assignments ──────────────────────────────────────────────────────────

  @Get('assignments')
  @Roles('ADMIN', 'SUPER_ADMIN', 'SUPPORT', 'FINANCE_ADMIN')
  getAssignments(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    return this.sla.getAssignments(Number(page) || 1, Number(limit) || 20, status);
  }

  @Get('assignments/dispute/:disputeId')
  getForDispute(@Param('disputeId') disputeId: string) {
    return this.sla.getForDispute(disputeId);
  }

  @Post('assignments')
  @Roles('ADMIN', 'SUPER_ADMIN', 'SUPPORT', 'FINANCE_ADMIN')
  assign(@Body() dto: AssignSlaDto, @Request() req: any) {
    return this.sla.assignToDispute(dto, req.user.id);
  }

  @Post('assignments/:id/pause')
  @Roles('ADMIN', 'SUPER_ADMIN', 'SUPPORT', 'FINANCE_ADMIN')
  pause(@Param('id') id: string) { return this.sla.pauseAssignment(id); }

  @Post('assignments/:id/resume')
  @Roles('ADMIN', 'SUPER_ADMIN', 'SUPPORT', 'FINANCE_ADMIN')
  resume(@Param('id') id: string) { return this.sla.resumeAssignment(id); }

  // ─── Reports & Dashboard ──────────────────────────────────────────────────

  @Get('dashboard')
  @Roles('ADMIN', 'SUPER_ADMIN', 'SUPPORT', 'FINANCE_ADMIN')
  dashboard() { return this.sla.getDashboardStats(); }

  @Get('reports')
  @Roles('ADMIN', 'SUPER_ADMIN', 'FINANCE_ADMIN')
  report(@Query('from') from?: string, @Query('to') to?: string) {
    return this.sla.getReport(from, to);
  }
}
