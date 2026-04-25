import {
  Controller,
  ForbiddenException,
  Get,
  Param,
  Query,
} from '@nestjs/common';
import { PerformanceService } from './performance.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

const PRIVILEGED_ROLES = new Set(['ADMIN', 'SUPER_ADMIN', 'SUPPORT']);

@Controller()
export class PerformanceController {
  constructor(private readonly svc: PerformanceService) {}

  @Get('me/performance')
  getMine(
    @CurrentUser('id') userId: string,
    @Query('periodDays') periodDays?: string,
  ) {
    return this.svc.getUserPerformance(userId, {
      periodDays: parsePeriod(periodDays),
    });
  }

  @Get('users/:id/performance')
  getOne(
    @Param('id') id: string,
    @CurrentUser('id') callerId: string,
    @CurrentUser('role') callerRole: string,
    @Query('periodDays') periodDays?: string,
  ) {
    const isSelf = callerId === id;
    const isPrivileged = PRIVILEGED_ROLES.has(callerRole);
    if (!isSelf && !isPrivileged) {
      throw new ForbiddenException(
        'You can only view your own performance report',
      );
    }
    return this.svc.getUserPerformance(id, {
      periodDays: parsePeriod(periodDays),
    });
  }
}

function parsePeriod(raw?: string): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.floor(n);
}
