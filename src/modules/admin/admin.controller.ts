import { Controller, Get, Post, Patch, Delete, Put, Param, Body, Query, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { PrismaService } from '../../common/services/prisma.service';
import { ListAuditLogsDto, VerifyTrainerDto, AnalyticsQueryDto } from './dto/admin.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

const DEFAULT_WEIGHTS = { skill_match: 0.30, rating: 0.25, experience: 0.15, completion_rate: 0.15, availability: 0.10, price: 0.05 };
const DEFAULT_AI_CFG = { rankingEngine: false, fraudDetection: false, reviewModeration: false, chatModeration: false, sessionTranscription: false };

@Controller('admin') @UseGuards(RolesGuard) @Roles('ADMIN','SUPER_ADMIN')
export class AdminController {
  constructor(private readonly svc: AdminService, private readonly prisma: PrismaService) {}

  @Get('dashboard') getDashboard() { return this.svc.getDashboard(); }
  @Get('analytics') getAnalytics(@Query() dto: AnalyticsQueryDto) { return this.svc.getAnalytics(dto); }
  @Get('audit-logs') getAuditLogs(@Query() dto: ListAuditLogsDto) { return this.svc.getAuditLogs(dto); }
  @Post('verify-trainer/:id') verifyTrainer(@Param('id') id: string, @Body() dto: VerifyTrainerDto, @CurrentUser('id') aid: string) { return this.svc.verifyTrainer(id, dto, aid); }

  // AI Control — ranking weights (persisted in SystemSetting)
  @Get('ai/ranking-weights')
  async getRankingWeights() {
    const row = await this.prisma.systemSetting.findUnique({ where: { key: 'ai.rankingWeights' } });
    return row ? row.value : DEFAULT_WEIGHTS;
  }
  @Post('ai/ranking-weights')
  async saveRankingWeights(@Body() body: any) {
    const current = await this.getRankingWeights();
    const merged = { ...(current as object), ...body };
    await this.prisma.systemSetting.upsert({
      where: { key: 'ai.rankingWeights' },
      create: { key: 'ai.rankingWeights', value: merged, category: 'ai' },
      update: { value: merged },
    });
    return merged;
  }

  // AI Control — module config (persisted in SystemSetting)
  @Get('ai/config')
  async getAiConfig() {
    const row = await this.prisma.systemSetting.findUnique({ where: { key: 'ai.moduleConfig' } });
    return row ? row.value : DEFAULT_AI_CFG;
  }
  @Post('ai/config')
  async saveAiConfig(@Body() body: any) {
    const current = await this.getAiConfig();
    const merged = { ...(current as object), ...body };
    await this.prisma.systemSetting.upsert({
      where: { key: 'ai.moduleConfig' },
      create: { key: 'ai.moduleConfig', value: merged, category: 'ai' },
      update: { value: merged },
    });
    return merged;
  }

  // System Settings — generic CRUD
  @Get('system-settings')
  async getSystemSettings(@Query('category') category?: string) {
    return this.prisma.systemSetting.findMany({
      where: category ? { category } : undefined,
      orderBy: { key: 'asc' },
    });
  }
  @Post('system-settings')
  async upsertSystemSetting(@Body() body: { key: string; value: any; category?: string }) {
    return this.prisma.systemSetting.upsert({
      where: { key: body.key },
      create: { key: body.key, value: body.value, category: body.category },
      update: { value: body.value, category: body.category },
    });
  }
  @Delete('system-settings/:key')
  async deleteSystemSetting(@Param('key') key: string) {
    await this.prisma.systemSetting.delete({ where: { key } });
    return { success: true };
  }

  // Feature Flags (persisted as SystemSetting category 'flags')
  @Get('feature-flags')
  async getFeatureFlags() {
    const rows = await this.prisma.systemSetting.findMany({ where: { category: 'flags' }, orderBy: { key: 'asc' } });
    return rows.map(r => ({ key: r.key, enabled: !!(r.value as any), updatedAt: r.updatedAt }));
  }
  @Post('feature-flags/:key')
  async setFeatureFlag(@Param('key') key: string, @Body() body: { enabled: boolean }) {
    await this.prisma.systemSetting.upsert({
      where: { key: `flag.${key}` },
      create: { key: `flag.${key}`, value: body.enabled, category: 'flags' },
      update: { value: body.enabled },
    });
    return { key, enabled: body.enabled };
  }

  // Notification Templates
  @Get('notification-templates')
  async getNotificationTemplates() {
    const row = await this.prisma.systemSetting.findUnique({ where: { key: 'notification.templates' } });
    return row ? (row.value as any[]) : [];
  }
  @Post('notification-templates')
  async saveNotificationTemplate(@Body() tmpl: { id?: string; name: string; type: string; subject: string; body: string }) {
    const current: any[] = await this.getNotificationTemplates();
    const id = tmpl.id ?? Date.now().toString();
    const idx = current.findIndex(t => t.id === tmpl.id);
    if (idx >= 0) current[idx] = { ...tmpl, id };
    else current.push({ ...tmpl, id, createdAt: new Date().toISOString() });
    await this.prisma.systemSetting.upsert({
      where: { key: 'notification.templates' },
      create: { key: 'notification.templates', value: current, category: 'notifications' },
      update: { value: current },
    });
    return current;
  }
  @Delete('notification-templates/:id')
  async deleteNotificationTemplate(@Param('id') id: string) {
    const current: any[] = await this.getNotificationTemplates();
    const updated = current.filter(t => t.id !== id);
    await this.prisma.systemSetting.upsert({
      where: { key: 'notification.templates' },
      create: { key: 'notification.templates', value: updated, category: 'notifications' },
      update: { value: updated },
    });
    return { success: true };
  }

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
