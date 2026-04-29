import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { paginate } from '../../common/dto/pagination.dto';
import { CreatePlanDto, UpdatePlanDto, SubscribeDto, ListSubscriptionsDto, ListPlansQueryDto } from './dto/subscriptions.dto';

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
  ) {}

  /* ─── Plan CRUD ─── */

  async listPlans(query?: ListPlansQueryDto, callerOrgId?: string) {
    const where: any = { isActive: true };

    // Filter by trainerType if specified
    if (query?.trainerType) {
      where.OR = [
        { trainerType: query.trainerType },
        { trainerType: null }, // null means available for all types
      ];
    }

    // Filter by org visibility
    if (query?.orgId) {
      // Show global plans + plans for the specified org
      const orgFilter = [
        { isGlobal: true },
        { orgId: query.orgId },
      ];
      if (where.OR) {
        // Combine with trainerType filter using AND
        where.AND = [{ OR: where.OR }, { OR: orgFilter }];
        delete where.OR;
      } else {
        where.OR = orgFilter;
      }
    } else if (callerOrgId) {
      // No orgId specified but caller has an org — show global + their org plans
      const orgFilter = [
        { isGlobal: true },
        { orgId: callerOrgId },
      ];
      if (where.OR) {
        where.AND = [{ OR: where.OR }, { OR: orgFilter }];
        delete where.OR;
      } else {
        where.OR = orgFilter;
      }
    } else {
      // No org context — only show global plans
      where.isGlobal = true;
    }

    return this.prisma.subscriptionPlan.findMany({ where, orderBy: { sortOrder: 'asc' } });
  }

  async listPlansForOrg(orgId: string) {
    return this.prisma.subscriptionPlan.findMany({
      where: {
        isActive: true,
        OR: [
          { isGlobal: true },
          { orgId },
        ],
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async listAllPlans() {
    return this.prisma.subscriptionPlan.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  async createPlan(dto: CreatePlanDto) {
    return this.prisma.subscriptionPlan.create({
      data: {
        name: dto.name,
        description: dto.description,
        price: dto.price,
        currency: dto.currency || 'KES',
        durationDays: dto.durationDays,
        billingCycle: dto.billingCycle || 'monthly',
        features: dto.features || {},
        maxBookings: dto.maxBookings ?? null,
        maxTeamMembers: dto.maxTeamMembers ?? null,
        commissionRate: dto.commissionRate ?? null,
        trainerType: dto.trainerType ?? null,
        isActive: dto.isActive ?? true,
        isGlobal: dto.isGlobal ?? true,
        orgId: dto.orgId ?? null,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async createOrgPlan(orgId: string, dto: CreatePlanDto) {
    return this.prisma.subscriptionPlan.create({
      data: {
        name: dto.name,
        description: dto.description,
        price: dto.price,
        currency: dto.currency || 'KES',
        durationDays: dto.durationDays,
        billingCycle: dto.billingCycle || 'monthly',
        features: dto.features || {},
        maxBookings: dto.maxBookings ?? null,
        maxTeamMembers: dto.maxTeamMembers ?? null,
        commissionRate: dto.commissionRate ?? null,
        trainerType: dto.trainerType ?? null,
        isActive: dto.isActive ?? true,
        isGlobal: false,
        orgId,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async updatePlan(id: string, dto: UpdatePlanDto) {
    const p = await this.prisma.subscriptionPlan.findUnique({ where: { id } });
    if (!p) throw new NotFoundException('Plan not found');
    return this.prisma.subscriptionPlan.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        price: dto.price,
        currency: dto.currency,
        durationDays: dto.durationDays,
        billingCycle: dto.billingCycle,
        features: dto.features,
        maxBookings: dto.maxBookings,
        maxTeamMembers: dto.maxTeamMembers,
        commissionRate: dto.commissionRate,
        trainerType: dto.trainerType,
        isActive: dto.isActive,
        isGlobal: dto.isGlobal,
        orgId: dto.orgId,
        sortOrder: dto.sortOrder,
      },
    });
  }

  async deletePlan(id: string) {
    await this.prisma.subscriptionPlan.update({ where: { id }, data: { isActive: false } });
    return { message: 'Plan deactivated' };
  }

  async togglePlan(id: string) {
    const p = await this.prisma.subscriptionPlan.findUnique({ where: { id } });
    if (!p) throw new NotFoundException('Plan not found');
    const updated = await this.prisma.subscriptionPlan.update({
      where: { id },
      data: { isActive: !p.isActive },
    });
    return updated;
  }

  async duplicatePlan(id: string, overrides?: { orgId?: string; name?: string }) {
    const source = await this.prisma.subscriptionPlan.findUnique({ where: { id } });
    if (!source) throw new NotFoundException('Plan not found');

    return this.prisma.subscriptionPlan.create({
      data: {
        name: overrides?.name || `${source.name} (Copy)`,
        description: source.description,
        price: source.price,
        currency: source.currency,
        durationDays: source.durationDays,
        billingCycle: source.billingCycle,
        features: source.features ?? undefined,
        maxBookings: source.maxBookings,
        maxTeamMembers: source.maxTeamMembers,
        commissionRate: source.commissionRate,
        trainerType: source.trainerType,
        isActive: true,
        isGlobal: overrides?.orgId ? false : source.isGlobal,
        orgId: overrides?.orgId || source.orgId,
        sortOrder: source.sortOrder,
      },
    });
  }

  /* ─── Subscription Stats (Admin) ─── */

  async getStats() {
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 86400000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalActive,
      revenueByPlan,
      expiringSoon,
      byTrainerType,
      totalPlans,
      activePlans,
      monthRevenue,
    ] = await Promise.all([
      // Total active subscriptions
      this.prisma.subscription.count({ where: { status: 'ACTIVE' } }),

      // Revenue by plan (from invoices tied to subscriptions)
      this.prisma.$queryRaw`
        SELECT sp.name as "planName", sp.id as "planId", sp.price,
               sp."billingCycle", COUNT(s.id)::int as "subscriberCount",
               COALESCE(SUM(sp.price), 0) as "totalRevenue"
        FROM "Subscription" s
        JOIN "SubscriptionPlan" sp ON s."planId" = sp.id
        WHERE s.status = 'ACTIVE'
        GROUP BY sp.id, sp.name, sp.price, sp."billingCycle"
        ORDER BY "subscriberCount" DESC
      `,

      // Expiring within 7 days
      this.prisma.subscription.count({
        where: {
          status: 'ACTIVE',
          endDate: { gte: now, lte: sevenDaysFromNow },
        },
      }),

      // Active subscriptions by trainer type
      this.prisma.$queryRaw`
        SELECT COALESCE(sp."trainerType", 'ALL') as "trainerType",
               COUNT(s.id)::int as "count"
        FROM "Subscription" s
        JOIN "SubscriptionPlan" sp ON s."planId" = sp.id
        WHERE s.status = 'ACTIVE'
        GROUP BY sp."trainerType"
      `,

      // Total plans
      this.prisma.subscriptionPlan.count(),

      // Active plans
      this.prisma.subscriptionPlan.count({ where: { isActive: true } }),

      // Monthly revenue estimate (active subs * plan price for current month)
      this.prisma.$queryRaw`
        SELECT COALESCE(SUM(sp.price), 0) as "mrr"
        FROM "Subscription" s
        JOIN "SubscriptionPlan" sp ON s."planId" = sp.id
        WHERE s.status = 'ACTIVE'
      `,
    ]);

    const mrr = Array.isArray(monthRevenue) && monthRevenue.length > 0
      ? Number((monthRevenue[0] as any).mrr || 0)
      : 0;

    return {
      totalActive,
      totalPlans,
      activePlans,
      mrr,
      expiringSoon,
      revenueByPlan,
      byTrainerType,
    };
  }

  /* ─── Subscribe ─── */

  async subscribe(userId: string, dto: SubscribeDto) {
    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { id: dto.planId } });
    if (!plan) throw new NotFoundException('Plan not found');
    if (!plan.isActive) throw new BadRequestException('Plan not active');

    // Check trainer type compatibility
    if (plan.trainerType) {
      const trainerProfile = await this.prisma.trainerProfile.findUnique({ where: { userId } });
      if (trainerProfile && trainerProfile.trainerType !== plan.trainerType && plan.trainerType !== 'BOTH') {
        throw new BadRequestException(`This plan is only available for ${plan.trainerType} trainers`);
      }
    }

    // Check org exclusivity
    if (plan.orgId && !plan.isGlobal) {
      const membership = await this.prisma.teamMember.findFirst({
        where: { userId, firmId: plan.orgId, isActive: true },
      });
      if (!membership) {
        throw new BadRequestException('This plan is exclusive to a specific organization');
      }
    }

    // Check maxBookings limit (count current month bookings)
    if (plan.maxBookings !== null) {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      const bookingCount = await this.prisma.booking.count({
        where: {
          OR: [{ trainerId: userId }, { clientId: userId }],
          createdAt: { gte: startOfMonth },
          status: { notIn: ['CANCELLED'] },
        },
      });
      if (bookingCount >= plan.maxBookings) {
        throw new BadRequestException(`You have reached the maximum bookings limit (${plan.maxBookings}) for this plan`);
      }
    }

    // Check maxTeamMembers limit
    if (plan.maxTeamMembers !== null) {
      const teamCount = await this.prisma.teamMember.count({
        where: { firmId: userId, isActive: true },
      });
      if (teamCount >= plan.maxTeamMembers) {
        throw new BadRequestException(`You have reached the maximum team members limit (${plan.maxTeamMembers}) for this plan`);
      }
    }

    const existing = await this.prisma.subscription.findFirst({
      where: { userId, status: 'ACTIVE', endDate: { gt: new Date() } },
    });
    if (existing) throw new BadRequestException('Already have active subscription');

    const planPrice = Number(plan.price);
    const start = new Date();
    const end = new Date(start.getTime() + plan.durationDays * 86400000);

    // If plan has a price, debit the user's wallet within a transaction
    if (planPrice > 0) {
      const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
      if (!wallet) throw new BadRequestException('Wallet not found. Please set up your wallet first.');
      if (Number(wallet.balance) < planPrice) throw new BadRequestException('Insufficient wallet balance');

      return this.prisma.$transaction(async (tx) => {
        // Debit user wallet
        await this.walletService.debitWallet(
          wallet.id, planPrice, 'SUBSCRIPTION', dto.planId,
          `Subscription to ${plan.name}`, tx,
        );

        // Credit platform wallet — subscriptions are 100% platform revenue
        const platformWalletId = await this._getPlatformWalletId(tx);
        await this.walletService.creditWallet(
          platformWalletId, planPrice, 'SUBSCRIPTION', dto.planId,
          `Subscription: ${plan.name}`, tx,
        );

        // Create subscription
        const subscription = await tx.subscription.create({
          data: { userId, planId: dto.planId, status: 'ACTIVE', startDate: start, endDate: end, autoRenew: dto.autoRenew ?? false },
          include: { plan: true },
        });

        // Auto-generate invoice
        const invoiceNumber = `INV-SUB-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
        await tx.invoice.create({
          data: {
            invoiceNumber,
            issuerId: userId,         // self-issued for subscription
            recipientId: userId,
            subscriptionId: subscription.id,
            amount: planPrice,
            tax: 0,
            total: planPrice,
            currency: plan.currency,
            status: 'PAID',
            description: `Subscription: ${plan.name} (${plan.durationDays} days)`,
            lineItems: [{ description: plan.name, qty: 1, unitPrice: planPrice, total: planPrice }],
            dueDate: start,
            paidAt: start,
            issuedAt: start,
          },
        });

        return subscription;
      });
    }

    // Free plan - no wallet debit needed
    return this.prisma.subscription.create({
      data: { userId, planId: dto.planId, status: 'ACTIVE', startDate: start, endDate: end, autoRenew: dto.autoRenew ?? false },
      include: { plan: true },
    });
  }

  async renew(userId: string, subscriptionId: string) {
    const subscription = await this.prisma.subscription.findFirst({
      where: { id: subscriptionId, userId },
      include: { plan: true },
    });
    if (!subscription) throw new NotFoundException('Subscription not found');
    if (!subscription.plan.isActive) throw new BadRequestException('Plan is no longer active');

    const plan = subscription.plan;
    const planPrice = Number(plan.price);

    // Calculate new endDate: extend from current endDate or from now (whichever is later)
    const baseDate = subscription.endDate > new Date() ? subscription.endDate : new Date();
    const newEnd = new Date(baseDate.getTime() + plan.durationDays * 86400000);

    if (planPrice > 0) {
      const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
      if (!wallet) throw new BadRequestException('Wallet not found. Please set up your wallet first.');
      if (Number(wallet.balance) < planPrice) throw new BadRequestException('Insufficient wallet balance');

      return this.prisma.$transaction(async (tx) => {
        // Debit user wallet
        await this.walletService.debitWallet(
          wallet.id, planPrice, 'SUBSCRIPTION_RENEWAL', subscription.id,
          `Renewal of ${plan.name}`, tx,
        );

        // Credit platform wallet — subscription renewals are 100% platform revenue
        const platformWalletId = await this._getPlatformWalletId(tx);
        await this.walletService.creditWallet(
          platformWalletId, planPrice, 'SUBSCRIPTION_RENEWAL', subscription.id,
          `Subscription renewal: ${plan.name}`, tx,
        );

        // Update subscription
        const updated = await tx.subscription.update({
          where: { id: subscriptionId },
          data: { status: 'ACTIVE', endDate: newEnd },
          include: { plan: true },
        });

        // Auto-generate invoice
        const invoiceNumber = `INV-REN-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
        await tx.invoice.create({
          data: {
            invoiceNumber,
            issuerId: userId,
            recipientId: userId,
            subscriptionId: subscription.id,
            amount: planPrice,
            tax: 0,
            total: planPrice,
            currency: plan.currency,
            status: 'PAID',
            description: `Renewal: ${plan.name} (${plan.durationDays} days)`,
            lineItems: [{ description: `${plan.name} renewal`, qty: 1, unitPrice: planPrice, total: planPrice }],
            dueDate: new Date(),
            paidAt: new Date(),
            issuedAt: new Date(),
          },
        });

        return updated;
      });
    }

    // Free plan renewal
    return this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: { status: 'ACTIVE', endDate: newEnd },
      include: { plan: true },
    });
  }

  async getMySubscriptions(userId: string) {
    return this.prisma.subscription.findMany({
      where: { userId },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getMySubscription(userId: string) {
    const s = await this.prisma.subscription.findFirst({
      where: { userId, status: 'ACTIVE' },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });
    return s || { subscription: null, message: 'No active subscription' };
  }

  async cancel(userId: string) {
    const s = await this.prisma.subscription.findFirst({
      where: { userId, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    });
    if (!s) throw new NotFoundException('No active subscription');
    return this.prisma.subscription.update({
      where: { id: s.id },
      data: { status: 'CANCELLED', autoRenew: false },
      include: { plan: true },
    });
  }

  async toggleAutoRenew(userId: string) {
    const s = await this.prisma.subscription.findFirst({
      where: { userId, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    });
    if (!s) throw new NotFoundException('No active subscription');
    return this.prisma.subscription.update({
      where: { id: s.id },
      data: { autoRenew: !s.autoRenew },
      include: { plan: true },
    });
  }

  /** Resolve the Uteo platform wallet ID from system settings or SUPER_ADMIN user */
  private async _getPlatformWalletId(tx: any): Promise<string> {
    const setting = await tx.systemSetting.findUnique({ where: { key: 'platform.wallet_id' } });
    if (setting) {
      const wallet = await tx.wallet.findUnique({ where: { id: setting.value as string } });
      if (wallet) return wallet.id;
    }
    const admin = await tx.user.findFirst({ where: { role: 'SUPER_ADMIN' }, orderBy: { createdAt: 'asc' } });
    if (!admin) throw new BadRequestException('No admin user found for platform wallet');
    let wallet = await tx.wallet.findUnique({ where: { userId: admin.id } });
    if (!wallet) {
      wallet = await tx.wallet.create({ data: { userId: admin.id, balance: 0, currency: 'KES' } });
    }
    await tx.systemSetting.upsert({
      where: { key: 'platform.wallet_id' },
      create: { key: 'platform.wallet_id', value: wallet.id as any, category: 'platform' },
      update: { value: wallet.id as any },
    });
    return wallet.id;
  }

  async listAll(dto: ListSubscriptionsDto) {
    const page = Number(dto.page) || 1;
    const limit = Number(dto.limit) || 20;
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.subscription.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
          plan: true,
        },
      }),
      this.prisma.subscription.count(),
    ]);
    return paginate(items, total, page, limit);
  }
}
