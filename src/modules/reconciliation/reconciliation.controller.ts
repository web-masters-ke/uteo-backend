import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ReconciliationService } from './reconciliation.service';
import { ReconciliationQueryDto } from './dto/reconciliation-query.dto';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('admin/reconciliation')
@UseGuards(RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN', 'FINANCE_ADMIN')
export class ReconciliationController {
  constructor(private readonly svc: ReconciliationService) {}

  @Get()
  getReport(@Query() dto: ReconciliationQueryDto) {
    return this.svc.getReport(dto.from, dto.to);
  }
}
