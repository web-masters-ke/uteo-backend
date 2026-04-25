import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { paginate } from '../../common/dto/pagination.dto';
import { CreateCommissionRuleDto, UpdateCommissionRuleDto, ListCommissionRecordsDto, SetTrainerRateDto, WaiveTrainerCommissionDto, CreateCommissionOverrideDto, UpdateCommissionOverrideDto, CreateOrgCommissionOverrideDto } from './dto/commissions.dto';

@Injectable()
export class CommissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async listRules() {
    return this.prisma.commissionRule.findMany({ orderBy: { minAmount: 'asc' } });
  }

  async createRule(dto: CreateCommissionRuleDto) {
    return this.prisma.commissionRule.create({
      data: {
        name: dto.name,
        minAmount: dto.minAmount,
        maxAmount: dto.maxAmount,
        commissionRate: dto.commissionRate,
        subscriptionTier: dto.subscriptionTier,
        trainerType: dto.trainerType ?? null,
        orgId: dto.orgId ?? null,
        isGlobal: dto.isGlobal ?? true,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async createOrgRule(orgId: string, dto: CreateCommissionRuleDto) {
    return this.prisma.commissionRule.create({
      data: {
        name: dto.name,
        minAmount: dto.minAmount,
        maxAmount: dto.maxAmount,
        commissionRate: dto.commissionRate,
        subscriptionTier: dto.subscriptionTier,
        trainerType: dto.trainerType ?? null,
        orgId,
        isGlobal: false,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async updateRule(id: string, dto: UpdateCommissionRuleDto) {
    const r = await this.prisma.commissionRule.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('Rule not found');
    return this.prisma.commissionRule.update({
      where: { id },
      data: {
        name: dto.name,
        minAmount: dto.minAmount,
        maxAmount: dto.maxAmount,
        commissionRate: dto.commissionRate,
        subscriptionTier: dto.subscriptionTier,
        trainerType: dto.trainerType,
        orgId: dto.orgId,
        isGlobal: dto.isGlobal,
        isActive: dto.isActive,
      },
    });
  }

  async listRulesForOrg(orgId: string) {
    return this.prisma.commissionRule.findMany({
      where: {
        isActive: true,
        OR: [
          { isGlobal: true },
          { orgId },
        ],
      },
      orderBy: { minAmount: 'asc' },
    });
  }

  /**
   * Find active CommissionOverride for a trainer (trainer-specific first, then org-level).
   */
  private async findActiveOverride(trainerId: string, orgId?: string | null) {
    const now = new Date();
    // Trainer-specific override
    const trainerOverride = await this.prisma.commissionOverride.findFirst({
      where: {
        trainerId,
        orgId: null,
        isActive: true,
        validFrom: { lte: now },
        OR: [{ validUntil: null }, { validUntil: { gt: now } }],
      },
      orderBy: { createdAt: 'desc' },
    });
    if (trainerOverride) return trainerOverride;

    // Org-level override
    if (orgId) {
      const orgOverride = await this.prisma.commissionOverride.findFirst({
        where: {
          orgId,
          trainerId: '',
          isActive: true,
          validFrom: { lte: now },
          OR: [{ validUntil: null }, { validUntil: { gt: now } }],
        },
        orderBy: { createdAt: 'desc' },
      });
      // Also check for org-level overrides stored with a sentinel trainerId
      if (orgOverride) return orgOverride;

      // Check org overrides that use orgId field
      const orgOverride2 = await this.prisma.commissionOverride.findFirst({
        where: {
          orgId,
          isActive: true,
          validFrom: { lte: now },
          OR: [{ validUntil: null }, { validUntil: { gt: now } }],
        },
        orderBy: { createdAt: 'desc' },
      });
      if (orgOverride2) return orgOverride2;
    }

    return null;
  }

  /**
   * Determine the effective commission rate for a specific trainer.
   * Priority:
   *   1. Trainer-specific CommissionOverride (if active and within validFrom-validUntil)
   *   2. Org-specific CommissionOverride
   *   3. Trainer custom rate on profile (legacy, if set and not waived)
   *   4. Org-specific rule
   *   5. Subscription plan rate
   *   6. Global rule
   *   7. Default 10%
   *
   * If commissionWaivedUntil > now, rate = 0 (waived).
   */
  async getEffectiveCommission(trainerId: string) {
    // Get trainer info
    const trainer = await this.prisma.trainerProfile.findUnique({
      where: { userId: trainerId },
    });

    // Get trainer's org membership
    const membership = await this.prisma.teamMember.findFirst({
      where: { userId: trainerId, isActive: true },
    });

    // Get trainer's active subscription
    const subscription = await this.prisma.subscription.findFirst({
      where: { userId: trainerId, status: 'ACTIVE', endDate: { gt: new Date() } },
      include: { plan: true },
    });

    // Check if commission is waived
    const isWaived = trainer?.commissionWaivedUntil && trainer.commissionWaivedUntil > new Date();
    if (isWaived) {
      return {
        trainerId,
        trainerType: trainer?.trainerType || null,
        orgId: membership?.firmId || null,
        subscriptionPlan: subscription?.plan?.name || null,
        effectiveRate: 0,
        source: 'waived',
        ruleId: null,
        overrideId: null,
        customRate: trainer?.customCommissionRate != null ? Number(trainer.customCommissionRate) : null,
        commissionWaivedUntil: trainer.commissionWaivedUntil,
      };
    }

    let effectiveRate = 0.1; // Default 10%
    let source = 'default';
    let ruleId: string | null = null;
    let overrideId: string | null = null;

    // Priority 1: CommissionOverride (trainer-specific, then org-level)
    const override = await this.findActiveOverride(trainerId, membership?.firmId);
    if (override) {
      effectiveRate = Number(override.customRate);
      source = override.orgId && override.trainerId === '' ? 'org_override' : 'override';
      overrideId = override.id;
    }

    // Priority 2: Trainer custom rate on profile (legacy admin override)
    if (source === 'default' && trainer?.customCommissionRate != null) {
      effectiveRate = Number(trainer.customCommissionRate);
      source = 'custom';
    }

    // Priority 3: Org-specific rule
    if (source === 'default' && membership?.firmId) {
      const orgRule = await this.prisma.commissionRule.findFirst({
        where: {
          isActive: true,
          orgId: membership.firmId,
          isGlobal: false,
        },
        orderBy: { commissionRate: 'asc' },
      });
      if (orgRule) {
        effectiveRate = Number(orgRule.commissionRate);
        source = 'org_rule';
        ruleId = orgRule.id;
      }
    }

    // Priority 4: Subscription plan rate (only if no org rule found)
    if (source === 'default' && subscription?.plan?.commissionRate != null) {
      effectiveRate = Number(subscription.plan.commissionRate);
      source = 'subscription_plan';
    }

    // Priority 5: Global rule (only if nothing else found)
    if (source === 'default') {
      const globalRule = await this.prisma.commissionRule.findFirst({
        where: {
          isActive: true,
          isGlobal: true,
          orgId: null,
        },
        orderBy: { commissionRate: 'asc' },
      });
      if (globalRule) {
        effectiveRate = Number(globalRule.commissionRate);
        source = 'global_rule';
        ruleId = globalRule.id;
      }
    }

    return {
      trainerId,
      trainerType: trainer?.trainerType || null,
      orgId: membership?.firmId || null,
      subscriptionPlan: subscription?.plan?.name || null,
      effectiveRate,
      source,
      ruleId,
      overrideId,
      customRate: trainer?.customCommissionRate != null ? Number(trainer.customCommissionRate) : null,
      commissionWaivedUntil: trainer?.commissionWaivedUntil || null,
    };
  }

  /**
   * Find the best commission rule for a specific amount and trainer.
   * Used by escrow release. Returns { rate, ruleId, source }.
   *
   * Priority:
   *   1. Waived commission (rate = 0)
   *   2. Trainer-specific CommissionOverride
   *   3. Org-level CommissionOverride
   *   4. Trainer custom rate on profile (legacy admin override)
   *   5. Org-specific rule matching the amount
   *   6. Subscription plan rate
   *   7. Global rule matching the amount
   *   8. Default 10%
   */
  async findCommissionForBooking(trainerId: string, amount: number): Promise<{ rate: number; ruleId: string | null; source: string }> {
    // Get trainer profile for custom rate / waiver
    const trainer = await this.prisma.trainerProfile.findUnique({
      where: { userId: trainerId },
    });

    // Priority 0: Check if commission is waived
    if (trainer?.commissionWaivedUntil && trainer.commissionWaivedUntil > new Date()) {
      return { rate: 0, ruleId: null, source: 'waived' };
    }

    // Get trainer's org membership
    const membership = await this.prisma.teamMember.findFirst({
      where: { userId: trainerId, isActive: true },
    });

    // Priority 1: CommissionOverride (trainer-specific, then org-level)
    const override = await this.findActiveOverride(trainerId, membership?.firmId);
    if (override) {
      const src = override.orgId && override.trainerId === '' ? 'org_override' : 'override';
      return { rate: Number(override.customRate), ruleId: null, source: src };
    }

    // Priority 2: Trainer custom rate on profile (legacy admin override)
    if (trainer?.customCommissionRate != null) {
      return { rate: Number(trainer.customCommissionRate), ruleId: null, source: 'custom' };
    }

    // Get trainer's active subscription
    const subscription = await this.prisma.subscription.findFirst({
      where: { userId: trainerId, status: 'ACTIVE', endDate: { gt: new Date() } },
      include: { plan: true },
    });

    // Priority 3: Org-specific rule matching the amount
    if (membership?.firmId) {
      const orgRule = await this.prisma.commissionRule.findFirst({
        where: {
          isActive: true,
          orgId: membership.firmId,
          isGlobal: false,
          minAmount: { lte: amount },
          maxAmount: { gte: amount },
        },
        orderBy: { commissionRate: 'asc' },
      });
      if (orgRule) {
        return { rate: Number(orgRule.commissionRate), ruleId: orgRule.id, source: 'org_rule' };
      }
    }

    // Priority 4: Plan-specific commission rate
    if (subscription?.plan?.commissionRate != null) {
      return { rate: Number(subscription.plan.commissionRate), ruleId: null, source: 'subscription_plan' };
    }

    // Priority 5: Global rule matching the amount
    const globalRule = await this.prisma.commissionRule.findFirst({
      where: {
        isActive: true,
        isGlobal: true,
        orgId: null,
        minAmount: { lte: amount },
        maxAmount: { gte: amount },
      },
      orderBy: { commissionRate: 'asc' },
    });
    if (globalRule) {
      return { rate: Number(globalRule.commissionRate), ruleId: globalRule.id, source: 'global_rule' };
    }

    // Priority 6: Default 10%
    return { rate: 0.1, ruleId: null, source: 'default' };
  }

  async toggleRule(id: string) {
    const r = await this.prisma.commissionRule.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('Rule not found');
    return this.prisma.commissionRule.update({ where: { id }, data: { isActive: !r.isActive } });
  }

  async deleteRule(id: string) {
    const r = await this.prisma.commissionRule.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('Rule not found');
    await this.prisma.commissionRule.delete({ where: { id } });
    return { message: 'Rule deleted' };
  }

  async getAnalytics() {
    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const [records, rules] = await Promise.all([
      this.prisma.commissionRecord.findMany({
        where: { createdAt: { gte: sixMonthsAgo } },
        include: { booking: { include: { trainer: { select: { id: true, firstName: true, lastName: true, trainerProfile: { select: { trainerType: true, firmName: true } } } } } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.commissionRule.findMany({ where: { isActive: true } }),
    ]);

    // Revenue trend by month
    const monthMap: Record<string, number> = {};
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthMap[`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`] = 0;
    }
    for (const r of records) {
      const key = `${r.createdAt.getFullYear()}-${String(r.createdAt.getMonth() + 1).padStart(2, '0')}`;
      if (key in monthMap) monthMap[key] += Number(r.commissionAmount);
    }
    const revenueTrend = Object.entries(monthMap).sort().map(([month, amount]) => ({ month, amount }));

    // By trainer type
    const typeMap: Record<string, { amount: number; count: number }> = { PROFESSIONAL: { amount: 0, count: 0 }, VOCATIONAL: { amount: 0, count: 0 } };
    for (const r of records) {
      const type = (r.booking?.trainer as any)?.trainerProfile?.trainerType || 'PROFESSIONAL';
      if (!typeMap[type]) typeMap[type] = { amount: 0, count: 0 };
      typeMap[type].amount += Number(r.commissionAmount);
      typeMap[type].count++;
    }
    const byType = Object.entries(typeMap).map(([name, data]) => ({ name, ...data }));

    // Top earners for platform
    const trainerMap: Record<string, { name: string; org: string; amount: number; count: number }> = {};
    for (const r of records) {
      const t = r.booking?.trainer;
      if (!t) continue;
      const tid = t.id;
      if (!trainerMap[tid]) trainerMap[tid] = { name: `${t.firstName} ${t.lastName}`, org: (t as any).trainerProfile?.firmName || '', amount: 0, count: 0 };
      trainerMap[tid].amount += Number(r.commissionAmount);
      trainerMap[tid].count++;
    }
    const topEarners = Object.values(trainerMap).sort((a, b) => b.amount - a.amount).slice(0, 10);

    // Effective rate trend
    const rateByMonth: Record<string, { total: number; count: number }> = {};
    for (const r of records) {
      const key = `${r.createdAt.getFullYear()}-${String(r.createdAt.getMonth() + 1).padStart(2, '0')}`;
      if (!rateByMonth[key]) rateByMonth[key] = { total: 0, count: 0 };
      rateByMonth[key].total += Number(r.commissionRate);
      rateByMonth[key].count++;
    }
    const effectiveRateTrend = Object.entries(rateByMonth).sort().map(([month, d]) => ({ month, rate: d.count > 0 ? d.total / d.count : 0 }));

    return { revenueTrend, byTrainerType: byType, topEarners, effectiveRateTrend, activeRules: rules.length };
  }

  async listRecords(dto: ListCommissionRecordsDto) {
    const page = Number(dto.page) || 1;
    const limit = Number(dto.limit) || 20;
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.commissionRecord.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          booking: {
            include: {
              trainer: { select: { id: true, firstName: true, lastName: true } },
              client: { select: { id: true, firstName: true, lastName: true } },
            },
          },
          rule: true,
        },
      }),
      this.prisma.commissionRecord.count(),
    ]);
    return paginate(items, total, page, limit);
  }

  async getStats() {
    const [tc, cnt, m] = await Promise.all([
      this.prisma.commissionRecord.aggregate({ _sum: { commissionAmount: true } }),
      this.prisma.commissionRecord.count(),
      this.prisma.commissionRecord.aggregate({
        _sum: { commissionAmount: true },
        _count: true,
        where: { createdAt: { gte: new Date(Date.now() - 30 * 86400000) } },
      }),
    ]);
    return {
      totalCommission: tc._sum.commissionAmount || 0,
      totalRecords: cnt,
      last30Days: { commission: m._sum.commissionAmount || 0, count: m._count },
    };
  }

  /* ─── Trainer-level commission management ──────────────────────────────── */

  /**
   * Set a custom commission rate for a specific trainer.
   */
  async setTrainerRate(trainerId: string, dto: SetTrainerRateDto) {
    const profile = await this.prisma.trainerProfile.findUnique({ where: { userId: trainerId } });
    if (!profile) throw new NotFoundException('Trainer profile not found');

    return this.prisma.trainerProfile.update({
      where: { userId: trainerId },
      data: { customCommissionRate: dto.rate },
      select: { userId: true, customCommissionRate: true, commissionWaivedUntil: true },
    });
  }

  /**
   * Waive commission for a trainer until a specific date.
   */
  async waiveTrainerCommission(trainerId: string, dto: WaiveTrainerCommissionDto) {
    const profile = await this.prisma.trainerProfile.findUnique({ where: { userId: trainerId } });
    if (!profile) throw new NotFoundException('Trainer profile not found');

    return this.prisma.trainerProfile.update({
      where: { userId: trainerId },
      data: { commissionWaivedUntil: new Date(dto.until) },
      select: { userId: true, customCommissionRate: true, commissionWaivedUntil: true },
    });
  }

  /**
   * Remove the custom commission rate for a trainer (revert to automatic rules).
   */
  async removeTrainerRate(trainerId: string) {
    const profile = await this.prisma.trainerProfile.findUnique({ where: { userId: trainerId } });
    if (!profile) throw new NotFoundException('Trainer profile not found');

    return this.prisma.trainerProfile.update({
      where: { userId: trainerId },
      data: { customCommissionRate: null, commissionWaivedUntil: null },
      select: { userId: true, customCommissionRate: true, commissionWaivedUntil: true },
    });
  }

  /**
   * Get detailed commission info for a specific trainer.
   */
  async getTrainerCommission(trainerId: string) {
    const effective = await this.getEffectiveCommission(trainerId);

    // Get the trainer profile + user info
    const profile = await this.prisma.trainerProfile.findUnique({
      where: { userId: trainerId },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
    });
    if (!profile) throw new NotFoundException('Trainer profile not found');

    // Get org name if in an org
    const membership = await this.prisma.teamMember.findFirst({
      where: { userId: trainerId, isActive: true },
      include: { firm: { select: { id: true, firstName: true, lastName: true } } },
    });

    // Get recent commission records for this trainer
    const recentRecords = await this.prisma.commissionRecord.findMany({
      where: { booking: { trainerId } },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { rule: { select: { id: true, name: true } } },
    });

    return {
      trainerId,
      trainerName: `${profile.user.firstName} ${profile.user.lastName}`,
      trainerEmail: profile.user.email,
      trainerType: profile.trainerType,
      orgId: membership?.firmId || null,
      orgName: membership ? `${membership.firm.firstName} ${membership.firm.lastName}` : null,
      customRate: profile.customCommissionRate != null ? Number(profile.customCommissionRate) : null,
      commissionWaivedUntil: profile.commissionWaivedUntil,
      isWaived: profile.commissionWaivedUntil ? profile.commissionWaivedUntil > new Date() : false,
      effectiveRate: effective.effectiveRate,
      rateSource: effective.source,
      ruleId: effective.ruleId,
      subscriptionPlan: effective.subscriptionPlan,
      recentRecords: recentRecords.map((r) => ({
        id: r.id,
        bookingAmount: Number(r.bookingAmount),
        commissionRate: Number(r.commissionRate),
        commissionAmount: Number(r.commissionAmount),
        trainerPayoutAmount: Number(r.trainerPayoutAmount),
        ruleName: r.rule?.name || null,
        createdAt: r.createdAt,
      })),
    };
  }

  /**
   * List all trainers with their effective commission info.
   * Used by the admin "Trainer Rates" tab.
   */
  async listTrainersWithCommission(query?: { search?: string; page?: number; limit?: number }) {
    const page = Number(query?.page) || 1;
    const limit = Number(query?.limit) || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query?.search) {
      where.user = {
        OR: [
          { firstName: { contains: query.search, mode: 'insensitive' } },
          { lastName: { contains: query.search, mode: 'insensitive' } },
          { email: { contains: query.search, mode: 'insensitive' } },
        ],
      };
    }

    const [profiles, total] = await Promise.all([
      this.prisma.trainerProfile.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true } },
        },
        orderBy: { user: { firstName: 'asc' } },
      }),
      this.prisma.trainerProfile.count({ where }),
    ]);

    // Get org memberships in bulk
    const userIds = profiles.map((p) => p.userId);
    const memberships = await this.prisma.teamMember.findMany({
      where: { userId: { in: userIds }, isActive: true },
      include: { firm: { select: { id: true, firstName: true, lastName: true } } },
    });
    const membershipMap = new Map(memberships.map((m) => [m.userId, m]));

    // Get active subscriptions in bulk
    const subscriptions = await this.prisma.subscription.findMany({
      where: { userId: { in: userIds }, status: 'ACTIVE', endDate: { gt: new Date() } },
      include: { plan: true },
    });
    const subMap = new Map(subscriptions.map((s) => [s.userId, s]));

    // Get active overrides in bulk
    const now = new Date();
    const overrides = await this.prisma.commissionOverride.findMany({
      where: {
        isActive: true,
        validFrom: { lte: now },
        OR: [{ validUntil: null }, { validUntil: { gt: now } }],
      },
    });
    const trainerOverrideMap = new Map<string, typeof overrides[0]>();
    const orgOverrideMap = new Map<string, typeof overrides[0]>();
    for (const o of overrides) {
      if (o.trainerId && o.trainerId !== '' && !o.orgId) {
        // Trainer-specific override
        if (!trainerOverrideMap.has(o.trainerId)) trainerOverrideMap.set(o.trainerId, o);
      } else if (o.orgId) {
        // Org-level override
        if (!orgOverrideMap.has(o.orgId)) orgOverrideMap.set(o.orgId, o);
      }
    }

    // Build the result with effective rates
    const items = await Promise.all(
      profiles.map(async (p) => {
        const membership = membershipMap.get(p.userId);
        const sub = subMap.get(p.userId);
        const isWaived = p.commissionWaivedUntil ? p.commissionWaivedUntil > new Date() : false;

        let effectiveRate = 0.1;
        let source = 'default';
        let hasOverride = false;
        let overrideData: any = null;

        if (isWaived) {
          effectiveRate = 0;
          source = 'waived';
        } else {
          // Check CommissionOverride first (trainer-specific, then org)
          const trainerOvr = trainerOverrideMap.get(p.userId);
          const orgOvr = membership?.firmId ? orgOverrideMap.get(membership.firmId) : undefined;
          if (trainerOvr) {
            effectiveRate = Number(trainerOvr.customRate);
            source = 'override';
            hasOverride = true;
            overrideData = {
              id: trainerOvr.id,
              customRate: Number(trainerOvr.customRate),
              reason: trainerOvr.reason,
              validUntil: trainerOvr.validUntil,
              createdAt: trainerOvr.createdAt,
            };
          } else if (orgOvr) {
            effectiveRate = Number(orgOvr.customRate);
            source = 'org_override';
            hasOverride = true;
            overrideData = {
              id: orgOvr.id,
              customRate: Number(orgOvr.customRate),
              reason: orgOvr.reason,
              validUntil: orgOvr.validUntil,
              createdAt: orgOvr.createdAt,
            };
          } else if (p.customCommissionRate != null) {
            effectiveRate = Number(p.customCommissionRate);
            source = 'custom';
          } else if (membership?.firmId) {
            const orgRule = await this.prisma.commissionRule.findFirst({
              where: { isActive: true, orgId: membership.firmId, isGlobal: false },
              orderBy: { commissionRate: 'asc' },
            });
            if (orgRule) {
              effectiveRate = Number(orgRule.commissionRate);
              source = 'org_rule';
            }
          }

          if (source === 'default' && sub?.plan?.commissionRate != null) {
            effectiveRate = Number(sub.plan.commissionRate);
            source = 'subscription_plan';
          }

          if (source === 'default') {
            const globalRule = await this.prisma.commissionRule.findFirst({
              where: { isActive: true, isGlobal: true, orgId: null },
              orderBy: { commissionRate: 'asc' },
            });
            if (globalRule) {
              effectiveRate = Number(globalRule.commissionRate);
              source = 'global_rule';
            }
          }
        }

        return {
          trainerId: p.userId,
          trainerName: `${p.user.firstName} ${p.user.lastName}`,
          trainerEmail: p.user.email,
          trainerType: p.trainerType,
          orgId: membership?.firmId || null,
          orgName: membership ? `${membership.firm.firstName} ${membership.firm.lastName}` : null,
          customRate: p.customCommissionRate != null ? Number(p.customCommissionRate) : null,
          commissionWaivedUntil: p.commissionWaivedUntil,
          isWaived,
          effectiveRate,
          rateSource: source,
          subscriptionPlan: sub?.plan?.name || null,
          hasOverride,
          override: overrideData,
        };
      }),
    );

    return paginate(items, total, page, limit);
  }

  /* ─── Commission Override CRUD ─────────────────────────────────────────── */

  /**
   * Create a per-trainer commission override.
   */
  async createOverride(dto: CreateCommissionOverrideDto, createdBy?: string) {
    return this.prisma.commissionOverride.create({
      data: {
        trainerId: dto.trainerId,
        customRate: dto.customRate,
        reason: dto.reason ?? null,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
        createdBy: createdBy ?? null,
      },
    });
  }

  /**
   * Create an org-wide commission override.
   */
  async createOrgOverride(orgId: string, dto: CreateOrgCommissionOverrideDto, createdBy?: string) {
    return this.prisma.commissionOverride.create({
      data: {
        trainerId: '',
        orgId,
        customRate: dto.customRate,
        reason: dto.reason ?? null,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
        createdBy: createdBy ?? null,
      },
    });
  }

  /**
   * List all active overrides with trainer info.
   */
  async listOverrides() {
    const overrides = await this.prisma.commissionOverride.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    // Enrich with trainer info
    const trainerIds = overrides.filter((o) => o.trainerId && o.trainerId !== '').map((o) => o.trainerId);
    const trainers = trainerIds.length > 0
      ? await this.prisma.user.findMany({
          where: { id: { in: trainerIds } },
          select: { id: true, firstName: true, lastName: true, email: true },
        })
      : [];
    const trainerMap = new Map(trainers.map((t) => [t.id, t]));

    return overrides.map((o) => {
      const trainer = trainerMap.get(o.trainerId);
      return {
        ...o,
        customRate: Number(o.customRate),
        trainerName: trainer ? `${trainer.firstName} ${trainer.lastName}` : null,
        trainerEmail: trainer?.email || null,
      };
    });
  }

  /**
   * Get override for a specific trainer.
   */
  async getOverrideForTrainer(trainerId: string) {
    const now = new Date();
    const override = await this.prisma.commissionOverride.findFirst({
      where: {
        trainerId,
        orgId: null,
        isActive: true,
        validFrom: { lte: now },
        OR: [{ validUntil: null }, { validUntil: { gt: now } }],
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!override) return null;
    return { ...override, customRate: Number(override.customRate) };
  }

  /**
   * Get org-wide override.
   */
  async getOrgOverride(orgId: string) {
    const now = new Date();
    const override = await this.prisma.commissionOverride.findFirst({
      where: {
        orgId,
        isActive: true,
        validFrom: { lte: now },
        OR: [{ validUntil: null }, { validUntil: { gt: now } }],
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!override) return null;
    return { ...override, customRate: Number(override.customRate) };
  }

  /**
   * Update an override.
   */
  async updateOverride(id: string, dto: UpdateCommissionOverrideDto) {
    const existing = await this.prisma.commissionOverride.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Override not found');
    return this.prisma.commissionOverride.update({
      where: { id },
      data: {
        customRate: dto.customRate ?? undefined,
        reason: dto.reason ?? undefined,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
        isActive: dto.isActive ?? undefined,
      },
    });
  }

  /**
   * Deactivate (soft-delete) an override.
   */
  async deactivateOverride(id: string) {
    const existing = await this.prisma.commissionOverride.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Override not found');
    return this.prisma.commissionOverride.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * Get all trainers with their effective commission rates in one call.
   * Used by the admin "Trainer Rates" tab for a quick overview.
   */
  async getTrainerRates() {
    const trainers = await this.prisma.trainerProfile.findMany({
      where: { user: { status: 'ACTIVE', deletedAt: null } },
      include: { user: { select: { id: true, firstName: true, lastName: true, avatar: true } } },
      orderBy: { rating: 'desc' },
    });

    const now = new Date();
    const overrides = await this.prisma.commissionOverride.findMany({
      where: {
        isActive: true,
        validFrom: { lte: now },
        OR: [{ validUntil: null }, { validUntil: { gt: now } }],
      },
    });

    const results = await Promise.all(
      trainers.map(async (t) => {
        const effective = await this.getEffectiveCommission(t.userId);
        const override = overrides.find(
          (o) => o.trainerId === t.userId && o.isActive && !o.orgId,
        );
        return {
          trainerId: t.userId,
          trainerName: `${t.user.firstName} ${t.user.lastName}`,
          avatar: t.user.avatar,
          trainerType: t.trainerType,
          rating: Number(t.rating),
          effectiveRate: effective.effectiveRate,
          rateSource: effective.source,
          hasOverride: !!override,
          override: override
            ? {
                id: override.id,
                customRate: Number(override.customRate),
                reason: override.reason,
                validUntil: override.validUntil,
                createdAt: override.createdAt,
              }
            : null,
        };
      }),
    );

    return results;
  }
}
