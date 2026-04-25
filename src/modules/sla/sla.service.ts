import { Injectable, NotFoundException, BadRequestException, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateSlaPolicyDto, UpdateSlaPolicyDto, AssignSlaDto } from './dto/sla.dto';
import { SlaStatus } from '@prisma/client';

@Injectable()
export class SlaService implements OnModuleInit {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async onModuleInit() {
    const count = await this.prisma.slaPolicy.count({ where: { isActive: true } });
    if (count > 0) return;
    const admin = await this.prisma.user.findFirst({
      where: { role: 'SUPER_ADMIN', status: 'ACTIVE' },
      select: { id: true },
    });
    if (!admin) return;

    const defaults = [
      { name: 'Critical — Fraud & Misconduct', priority: 'CRITICAL', firstResponseHours: 4,  resolutionHours: 24,  description: 'Fraud, misconduct, serious violations — fastest response', warningPercent: 75, firstResponseEscalateTo: 'ADMIN', resolutionEscalateTo: 'SUPER_ADMIN' },
      { name: 'High — Payment & No-Show',      priority: 'HIGH',     firstResponseHours: 24, resolutionHours: 72,  description: 'Payment disputes and no-show complaints',               warningPercent: 80, firstResponseEscalateTo: 'SUPPORT', resolutionEscalateTo: 'FINANCE_ADMIN' },
      { name: 'Medium — Quality & Service',    priority: 'MEDIUM',   firstResponseHours: 48, resolutionHours: 120, description: 'Service quality and delivery issues',                   warningPercent: 80, firstResponseEscalateTo: 'SUPPORT', resolutionEscalateTo: 'ADMIN' },
      { name: 'Low — General',                 priority: 'LOW',      firstResponseHours: 72, resolutionHours: 168, description: 'General and technical complaints',                       warningPercent: 80, firstResponseEscalateTo: 'SUPPORT', resolutionEscalateTo: 'SUPPORT' },
    ] as const;

    await Promise.all(
      defaults.map((d) =>
        this.prisma.slaPolicy.create({
          data: { ...d, autoEscalate: true, warningNotifyRole: 'SUPPORT', createdById: admin.id },
        }).catch(() => {}),
      ),
    );
  }

  // ─── Policies ────────────────────────────────────────────────────────────

  async createPolicy(dto: CreateSlaPolicyDto, createdById: string) {
    return this.prisma.slaPolicy.create({
      data: {
        name: dto.name,
        description: dto.description,
        priority: dto.priority,
        firstResponseHours: dto.firstResponseHours,
        resolutionHours: dto.resolutionHours,
        warningPercent: dto.warningPercent ?? 80,
        autoEscalate: dto.autoEscalate ?? true,
        warningNotifyRole: dto.warningNotifyRole ?? 'SUPPORT',
        firstResponseEscalateTo: dto.firstResponseEscalateTo ?? 'SUPPORT',
        resolutionEscalateTo: dto.resolutionEscalateTo ?? 'FINANCE_ADMIN',
        createdById,
      },
      include: { createdBy: { select: { id: true, firstName: true, lastName: true } } },
    });
  }

  async getPolicies() {
    return this.prisma.slaPolicy.findMany({
      orderBy: [{ isActive: 'desc' }, { priority: 'asc' }, { createdAt: 'desc' }],
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { assignments: true } },
      },
    });
  }

  async getPolicy(id: string) {
    const policy = await this.prisma.slaPolicy.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        assignments: {
          include: {
            dispute: { select: { id: true, reason: true, status: true, createdAt: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        _count: { select: { assignments: true } },
      },
    });
    if (!policy) throw new NotFoundException('SLA policy not found');
    return policy;
  }

  async updatePolicy(id: string, dto: UpdateSlaPolicyDto) {
    await this.prisma.slaPolicy.findUniqueOrThrow({ where: { id } }).catch(() => {
      throw new NotFoundException('SLA policy not found');
    });
    return this.prisma.slaPolicy.update({ where: { id }, data: dto as any });
  }

  async deletePolicy(id: string) {
    const policy = await this.prisma.slaPolicy.findUnique({
      where: { id },
      include: { _count: { select: { assignments: true } } },
    });
    if (!policy) throw new NotFoundException('SLA policy not found');
    if (policy._count.assignments > 0) {
      return this.prisma.slaPolicy.update({ where: { id }, data: { isActive: false } });
    }
    return this.prisma.slaPolicy.delete({ where: { id } });
  }

  // ─── Assignments ──────────────────────────────────────────────────────────

  async assignToDispute(dto: AssignSlaDto, assignedById: string) {
    const [dispute, policy] = await Promise.all([
      this.prisma.dispute.findUnique({ where: { id: dto.disputeId } }),
      this.prisma.slaPolicy.findUnique({ where: { id: dto.policyId } }),
    ]);
    if (!dispute) throw new NotFoundException('Dispute not found');
    if (!policy || !policy.isActive) throw new NotFoundException('SLA policy not found or inactive');

    await this.prisma.slaAssignment.deleteMany({ where: { disputeId: dto.disputeId } });

    const now = new Date();
    return this.prisma.slaAssignment.create({
      data: {
        disputeId: dto.disputeId,
        policyId: dto.policyId,
        firstResponseDue: new Date(now.getTime() + policy.firstResponseHours * 3_600_000),
        resolutionDue: new Date(now.getTime() + policy.resolutionHours * 3_600_000),
        assignedById,
      },
      include: { policy: true, escalations: true },
    });
  }

  async getForDispute(disputeId: string) {
    const assignment = await this.prisma.slaAssignment.findUnique({
      where: { disputeId },
      include: {
        policy: true,
        escalations: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!assignment) return null;
    return { ...assignment, statusSnapshot: this.computeStatus(assignment) };
  }

  async getAssignments(page = 1, limit = 20, status?: string) {
    const where: any = {};
    if (status) where.status = status as SlaStatus;

    const [items, total] = await Promise.all([
      this.prisma.slaAssignment.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { resolutionDue: 'asc' },
        include: {
          policy: true,
          dispute: {
            select: {
              id: true, reason: true, status: true, createdAt: true,
              raisedBy: { select: { id: true, firstName: true, lastName: true } },
              against: { select: { id: true, firstName: true, lastName: true } },
            },
          },
          escalations: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      }),
      this.prisma.slaAssignment.count({ where }),
    ]);

    return {
      items: items.map(a => ({ ...a, statusSnapshot: this.computeStatus(a) })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async pauseAssignment(id: string) {
    const a = await this.prisma.slaAssignment.findUnique({ where: { id } });
    if (!a) throw new NotFoundException('SLA assignment not found');
    if (a.status === 'PAUSED') throw new BadRequestException('SLA already paused');
    if (a.status === 'MET' || a.status === 'BREACHED') throw new BadRequestException('Cannot pause completed SLA');
    return this.prisma.slaAssignment.update({
      where: { id },
      data: { status: 'PAUSED', pausedAt: new Date() },
    });
  }

  async resumeAssignment(id: string) {
    const a = await this.prisma.slaAssignment.findUnique({ where: { id } });
    if (!a) throw new NotFoundException('SLA assignment not found');
    if (a.status !== 'PAUSED') throw new BadRequestException('SLA is not paused');

    const pausedMins = a.pausedAt
      ? Math.round((Date.now() - a.pausedAt.getTime()) / 60_000)
      : 0;
    const extMs = pausedMins * 60_000;

    return this.prisma.slaAssignment.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        pausedAt: null,
        pausedDurationMins: { increment: pausedMins },
        firstResponseDue: a.firstResponseAt
          ? a.firstResponseDue
          : new Date(a.firstResponseDue.getTime() + extMs),
        resolutionDue: new Date(a.resolutionDue.getTime() + extMs),
      },
    });
  }

  async recordFirstResponse(disputeId: string) {
    const a = await this.prisma.slaAssignment.findUnique({ where: { disputeId } });
    if (!a || a.firstResponseAt) return;
    await this.prisma.slaAssignment.update({
      where: { disputeId },
      data: { firstResponseAt: new Date() },
    });
  }

  async markResolved(disputeId: string) {
    const a = await this.prisma.slaAssignment.findUnique({ where: { disputeId } });
    if (!a || a.resolvedAt) return;
    const now = new Date();
    await this.prisma.slaAssignment.update({
      where: { disputeId },
      data: {
        status: now > a.resolutionDue ? 'BREACHED' : 'MET',
        resolvedAt: now,
        resolutionBreached: now > a.resolutionDue,
      },
    });
  }

  // ─── Reports & Dashboard ──────────────────────────────────────────────────

  async getDashboardStats() {
    const now = new Date();
    const warningCutoff = new Date(now.getTime() + 2 * 3_600_000);

    const [active, breached, met, warning, paused] = await Promise.all([
      this.prisma.slaAssignment.count({ where: { status: 'ACTIVE' } }),
      this.prisma.slaAssignment.count({ where: { status: 'BREACHED' } }),
      this.prisma.slaAssignment.count({ where: { status: 'MET' } }),
      this.prisma.slaAssignment.count({
        where: { status: 'ACTIVE', resolutionDue: { lte: warningCutoff } },
      }),
      this.prisma.slaAssignment.count({ where: { status: 'PAUSED' } }),
    ]);

    const total = active + breached + met + paused;
    const resolved = met + breached;

    return {
      active, breached, met, warning, paused, total,
      complianceRate: resolved > 0 ? Math.round((met / resolved) * 100) : null,
    };
  }

  async getReport(from?: string, to?: string) {
    const createdAt: any = {};
    if (from) createdAt.gte = new Date(from);
    if (to) { const d = new Date(to); d.setHours(23, 59, 59, 999); createdAt.lte = d; }
    const where: any = Object.keys(createdAt).length ? { createdAt } : {};

    const [total, met, breached, active, paused] = await Promise.all([
      this.prisma.slaAssignment.count({ where }),
      this.prisma.slaAssignment.count({ where: { ...where, status: 'MET' } }),
      this.prisma.slaAssignment.count({ where: { ...where, status: 'BREACHED' } }),
      this.prisma.slaAssignment.count({ where: { ...where, status: 'ACTIVE' } }),
      this.prisma.slaAssignment.count({ where: { ...where, status: 'PAUSED' } }),
    ]);

    const byPolicyRaw = await this.prisma.slaAssignment.groupBy({
      by: ['policyId'],
      where,
      _count: { id: true },
    });

    const policies = await this.prisma.slaPolicy.findMany({
      where: { id: { in: byPolicyRaw.map(b => b.policyId) } },
      select: { id: true, name: true, priority: true },
    });

    return {
      summary: {
        total, met, breached, active, paused,
        complianceRate: (met + breached) > 0 ? Math.round((met / (met + breached)) * 100) : null,
      },
      byPolicy: byPolicyRaw.map(b => ({
        ...policies.find(p => p.id === b.policyId),
        count: b._count.id,
      })),
      from: from ?? null,
      to: to ?? null,
    };
  }

  // ─── Auto-assign on dispute creation ─────────────────────────────────────

  // Category → SLA priority mapping
  private categoryPriority(category?: string | null): string {
    switch (category) {
      case 'FRAUD':
      case 'MISCONDUCT':  return 'CRITICAL';
      case 'PAYMENT':
      case 'NO_SHOW':     return 'HIGH';
      case 'QUALITY':     return 'MEDIUM';
      default:            return 'LOW';
    }
  }

  async autoAssignOnDisputeCreate(disputeId: string, category?: string | null) {
    const targetPriority = this.categoryPriority(category);

    // Try the exact priority match first, then walk down the priority ladder
    const priorityLadder: string[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
    const startIdx = priorityLadder.indexOf(targetPriority);
    let defaultPolicy: any = null;
    for (let i = startIdx; i < priorityLadder.length; i++) {
      defaultPolicy = await this.prisma.slaPolicy.findFirst({
        where: { isActive: true, priority: priorityLadder[i] as any },
        orderBy: { createdAt: 'asc' },
      });
      if (defaultPolicy) break;
    }
    if (!defaultPolicy) defaultPolicy = await this.prisma.slaPolicy.findFirst({ where: { isActive: true }, orderBy: { createdAt: 'asc' } });
    if (!defaultPolicy) return null;

    const now = new Date();
    return this.prisma.slaAssignment.upsert({
      where: { disputeId },
      create: {
        disputeId,
        policyId: defaultPolicy.id,
        firstResponseDue: new Date(now.getTime() + defaultPolicy.firstResponseHours * 3_600_000),
        resolutionDue: new Date(now.getTime() + defaultPolicy.resolutionHours * 3_600_000),
      },
      update: {},
    });
  }

  // ─── Scheduled breach checker (every 30 min) ─────────────────────────────

  @Cron('0 */30 * * * *')
  async checkBreaches() {
    const now = new Date();

    // First-response breaches
    const frBreached = await this.prisma.slaAssignment.findMany({
      where: {
        status: 'ACTIVE',
        firstResponseAt: null,
        firstResponseDue: { lt: now },
        firstResponseBreached: false,
      },
      include: {
        dispute: { select: { id: true, assignedToId: true, raisedById: true } },
        policy: true,
      },
    });

    for (const a of frBreached) {
      await this.prisma.slaAssignment.update({
        where: { id: a.id },
        data: { firstResponseBreached: true },
      });
      await this.prisma.slaEscalation.create({
        data: { assignmentId: a.id, reason: 'FIRST_RESPONSE_BREACH', escalatedTo: a.policy.firstResponseEscalateTo },
      });
      const frMsg = `Dispute #${a.dispute.id.slice(0, 8)} has breached its ${a.policy.firstResponseHours}h first response SLA. Escalating to ${a.policy.firstResponseEscalateTo.replace(/_/g, ' ')}.`;
      // Notify assigned agent
      if (a.dispute.assignedToId) {
        await this.notifications.send({ userId: a.dispute.assignedToId, type: 'SLA_BREACH', channel: 'IN_APP', title: 'SLA First Response Breach', message: frMsg } as any);
      }
      // Notify the configured escalation role
      const frRoleUsers = await this.prisma.user.findMany({ where: { role: a.policy.firstResponseEscalateTo as any, status: 'ACTIVE' }, select: { id: true } });
      for (const u of frRoleUsers) {
        if (u.id === a.dispute.assignedToId) continue;
        await this.notifications.send({ userId: u.id, type: 'SLA_BREACH', channel: 'IN_APP', title: `SLA Breach — ${a.policy.name}`, message: frMsg } as any);
      }
    }

    // Resolution breaches
    const resolBreached = await this.prisma.slaAssignment.findMany({
      where: {
        status: 'ACTIVE',
        resolvedAt: null,
        resolutionDue: { lt: now },
        resolutionBreached: false,
      },
      include: {
        dispute: { select: { id: true, assignedToId: true, raisedById: true } },
        policy: true,
      },
    });

    for (const a of resolBreached) {
      await this.prisma.slaAssignment.update({
        where: { id: a.id },
        data: { status: 'BREACHED', resolutionBreached: true },
      });
      await this.prisma.slaEscalation.create({
        data: { assignmentId: a.id, reason: 'RESOLUTION_BREACH', escalatedTo: a.policy.resolutionEscalateTo },
      });
      const resolMsg = `Dispute #${a.dispute.id.slice(0, 8)} has breached its ${a.policy.resolutionHours}h resolution SLA. Escalating to ${a.policy.resolutionEscalateTo.replace(/_/g, ' ')}.`;
      // Notify assignee + dispute raiser
      const notifyIds = [a.dispute.assignedToId, a.dispute.raisedById].filter(Boolean) as string[];
      for (const uid of notifyIds) {
        await this.notifications.send({ userId: uid, type: 'SLA_BREACH', channel: 'IN_APP', title: 'SLA Resolution Breach', message: resolMsg } as any);
      }
      // Notify the configured escalation role
      const resolRoleUsers = await this.prisma.user.findMany({ where: { role: a.policy.resolutionEscalateTo as any, status: 'ACTIVE' }, select: { id: true } });
      for (const u of resolRoleUsers) {
        if (notifyIds.includes(u.id)) continue;
        await this.notifications.send({ userId: u.id, type: 'SLA_BREACH', channel: 'IN_APP', title: `SLA Resolution Breach — ${a.policy.name}`, message: resolMsg } as any);
      }
    }

    // Warnings — within 2 hours of breach
    const warnCutoff = new Date(now.getTime() + 2 * 3_600_000);
    const aboutToBrech = await this.prisma.slaAssignment.findMany({
      where: {
        status: 'ACTIVE',
        resolvedAt: null,
        resolutionDue: { lte: warnCutoff, gte: now },
        warningSentAt: null,
      },
      include: { dispute: { select: { id: true, assignedToId: true } }, policy: true },
    });

    for (const a of aboutToBrech) {
      await this.prisma.slaAssignment.update({ where: { id: a.id }, data: { warningSentAt: now, status: 'WARNING' } });
      const mins = Math.round((a.resolutionDue.getTime() - now.getTime()) / 60_000);
      const warnMsg = `Dispute #${a.dispute.id.slice(0, 8)} will breach its SLA in ${mins} minutes. Please act now.`;

      // Notify the assigned agent
      if (a.dispute.assignedToId) {
        await this.notifications.send({
          userId: a.dispute.assignedToId,
          type: 'SLA_WARNING',
          channel: 'IN_APP',
          title: 'SLA Breach Warning',
          message: warnMsg,
        } as any);
      }

      // Also notify all users with the policy's warningNotifyRole
      const warnRole = a.policy.warningNotifyRole;
      const roleUsers = await this.prisma.user.findMany({
        where: { role: warnRole as any, status: 'ACTIVE' },
        select: { id: true },
      });
      for (const u of roleUsers) {
        if (u.id === a.dispute.assignedToId) continue;
        await this.notifications.send({
          userId: u.id,
          type: 'SLA_WARNING',
          channel: 'IN_APP',
          title: `SLA Warning — ${a.policy.name}`,
          message: warnMsg,
        } as any);
      }
    }
  }

  // ─── Helper ───────────────────────────────────────────────────────────────

  computeStatus(assignment: any) {
    const now = Date.now();
    const created = new Date(assignment.createdAt).getTime();
    const firstDue = new Date(assignment.firstResponseDue).getTime();
    const resolDue = new Date(assignment.resolutionDue).getTime();

    const firstPct = Math.min(100, Math.round(((now - created) / (firstDue - created)) * 100));
    const resolPct = Math.min(100, Math.round(((now - created) / (resolDue - created)) * 100));

    return {
      status: assignment.status as SlaStatus,
      firstResponsePercent: firstPct,
      resolutionPercent: resolPct,
      firstResponseOverdueByMins: assignment.firstResponseBreached
        ? Math.round((now - firstDue) / 60_000) : null,
      resolutionOverdueByMins: assignment.resolutionBreached
        ? Math.round((now - resolDue) / 60_000) : null,
      minutesRemaining: !['MET', 'BREACHED'].includes(assignment.status) && !assignment.resolvedAt
        ? Math.max(0, Math.round((resolDue - now) / 60_000)) : null,
      isBreached: assignment.resolutionBreached || assignment.firstResponseBreached,
    };
  }
}
