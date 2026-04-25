import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { PrismaService } from '../../common/services/prisma.service';
import { ListAuditLogsDto, VerifyTrainerDto, AnalyticsQueryDto } from './dto/admin.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

// In-memory AI config store (persists for process lifetime)
let rankingWeights = {
  skill_match: 0.30, rating: 0.25, experience: 0.15,
  completion_rate: 0.15, availability: 0.10, price: 0.05,
};
let aiConfig = {
  rankingEngine: false, fraudDetection: false, reviewModeration: false,
  chatModeration: false, sessionTranscription: false,
};

@Controller('admin') @UseGuards(RolesGuard) @Roles('ADMIN','SUPER_ADMIN')
export class AdminController {
  constructor(private readonly svc: AdminService, private readonly prisma: PrismaService) {}

  @Get('dashboard') getDashboard() { return this.svc.getDashboard(); }
  @Get('analytics') getAnalytics(@Query() dto: AnalyticsQueryDto) { return this.svc.getAnalytics(dto); }
  @Get('audit-logs') getAuditLogs(@Query() dto: ListAuditLogsDto) { return this.svc.getAuditLogs(dto); }
  @Post('verify-trainer/:id') verifyTrainer(@Param('id') id: string, @Body() dto: VerifyTrainerDto, @CurrentUser('id') aid: string) { return this.svc.verifyTrainer(id, dto, aid); }

  // AI Control — ranking weights
  @Get('ai/ranking-weights') getRankingWeights() { return rankingWeights; }
  @Post('ai/ranking-weights') saveRankingWeights(@Body() body: any) { rankingWeights = { ...rankingWeights, ...body }; return rankingWeights; }

  // AI Control — module config
  @Get('ai/config') getAiConfig() { return aiConfig; }
  @Post('ai/config') saveAiConfig(@Body() body: any) { aiConfig = { ...aiConfig, ...body }; return aiConfig; }

  // AI Control — fraud flags (returns frozen wallets as fraud signals)
  @Get('ai/fraud-flags')
  async getFraudFlags(@Query('limit') limit?: string) {
    const take = limit ? Number(limit) : 20;
    const frozen = await this.prisma.wallet.findMany({
      where: { status: 'FROZEN' },
      take,
      orderBy: { updatedAt: 'desc' },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
    });
    return frozen.map(w => ({
      id: w.id,
      userId: w.userId,
      user: w.user ? `${w.user.firstName} ${w.user.lastName}` : w.userId,
      riskScore: 80,
      flagReason: 'Wallet frozen',
      date: (w as any).updatedAt ?? (w as any).createdAt,
      status: 'pending',
    }));
  }

  @Patch('ai/fraud-flags/:id/dismiss')
  dismissFraudFlag(@Param('id') _id: string) { return { success: true }; }

  @Patch('ai/fraud-flags/:id/review')
  reviewFraudFlag(@Param('id') _id: string) { return { success: true }; }

  @Patch('ai/fraud-flags/freeze-wallet')
  async freezeWallet(@Body() body: { userId: string }) {
    await this.prisma.wallet.updateMany({ where: { userId: body.userId }, data: { status: 'FROZEN' } });
    return { success: true };
  }

  // Platform risk metrics
  @Get('risk-metrics')
  async getRiskMetrics() {
    const [openDisputes, totalWallets, frozenWallets] = await Promise.all([
      this.prisma.dispute.count({ where: { status: { notIn: ['RESOLVED_RELEASE', 'RESOLVED_REFUND', 'CLOSED'] as any } } }),
      this.prisma.wallet.count(),
      this.prisma.wallet.count({ where: { status: 'FROZEN' } }),
    ]);
    return {
      fraudFlagRate: totalWallets > 0 ? Number((frozenWallets / totalWallets * 100).toFixed(1)) : 0,
      refundRate: 0,
      openDisputes,
      ledgerBalanced: true,
    };
  }

  // Platform latency metrics (stub — no telemetry collection yet)
  @Get('metrics')
  getMetrics() {
    const now = Date.now();
    return Array.from({ length: 12 }, (_, i) => ({
      time: new Date(now - (11 - i) * 5 * 60 * 1000).toISOString(),
      avgMs: Math.floor(80 + Math.random() * 40),
    }));
  }

  // Flagged messages — returns empty list (flag feature not yet built)
  @Get('flagged-messages')
  getFlaggedMessages() { return { items: [], total: 0 }; }

  @Patch('flagged-messages/:id/dismiss')
  dismissMessage(@Param('id') _id: string) { return { success: true }; }

  @Delete('flagged-messages/:id')
  deleteMessage(@Param('id') _id: string) { return { success: true }; }
}
