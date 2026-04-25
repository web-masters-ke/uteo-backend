import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';

type Period = '7d' | '30d' | '90d' | '1y' | 'all';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /* ------------------------------------------------------------------ */
  /*  Helpers                                                            */
  /* ------------------------------------------------------------------ */

  private periodToDate(period: string): Date | null {
    const now = new Date();
    switch (period) {
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case '30d':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case '90d':
        return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      case '1y':
        return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      case 'all':
        return null;
      default:
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
  }

  private groupByLabel(groupBy: string): string {
    switch (groupBy) {
      case 'day':
        return 'day';
      case 'week':
        return 'week';
      case 'month':
        return 'month';
      default:
        return 'day';
    }
  }

  /* ================================================================== */
  /*  PLATFORM / ADMIN REPORTS                                          */
  /* ================================================================== */

  async platformSummary(period: string) {
    const since = this.periodToDate(period);
    const dateFilter = since ? { gte: since } : undefined;

    const [
      completedBookings,
      commissions,
      payoutsCompleted,
      payoutsPending,
      activeSubscriptions,
    ] = await Promise.all([
      this.prisma.booking.aggregate({
        where: {
          status: 'COMPLETED',
          ...(dateFilter && { completedAt: dateFilter }),
        },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.commissionRecord.aggregate({
        where: dateFilter ? { createdAt: dateFilter } : {},
        _sum: { commissionAmount: true },
        _count: true,
      }),
      this.prisma.payout.aggregate({
        where: {
          status: 'COMPLETED',
          ...(dateFilter && { processedAt: dateFilter }),
        },
        _sum: { netAmount: true, fee: true },
        _count: true,
      }),
      this.prisma.payout.aggregate({
        where: {
          status: { in: ['REQUESTED', 'APPROVED', 'PROCESSING'] },
        },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.subscription.aggregate({
        where: { status: 'ACTIVE' },
        _count: true,
      }),
    ]);

    // Calculate active subscription monthly value
    const activeSubs = await this.prisma.subscription.findMany({
      where: { status: 'ACTIVE' },
      include: { plan: { select: { price: true, durationDays: true } } },
    });
    const subscriptionMRR = activeSubs.reduce((sum, sub) => {
      const monthlyPrice =
        (Number(sub.plan.price) * 30) / (sub.plan.durationDays || 30);
      return sum + monthlyPrice;
    }, 0);

    const totalRevenue = Number(completedBookings._sum.amount || 0);
    const totalCommissions = Number(commissions._sum.commissionAmount || 0);
    const totalPayoutFees = Number(payoutsCompleted._sum.fee || 0);

    return {
      totalRevenue,
      totalBookings: completedBookings._count,
      totalCommissionsEarned: totalCommissions,
      totalPayoutsProcessed: Number(payoutsCompleted._sum.netAmount || 0),
      totalPayoutsCount: payoutsCompleted._count,
      pendingPayoutsAmount: Number(payoutsPending._sum.amount || 0),
      pendingPayoutsCount: payoutsPending._count,
      platformNetRevenue: totalCommissions + totalPayoutFees,
      activeSubscriptionsCount: activeSubscriptions._count,
      subscriptionMRR,
    };
  }

  async platformRevenue(period: string, groupBy: string) {
    const since = this.periodToDate(period);
    const truncFn = this.groupByLabel(groupBy);

    const dateFilter = since
      ? `AND b."completedAt" >= '${since.toISOString()}'`
      : '';

    const rows: any[] = await this.prisma.$queryRawUnsafe(`
      SELECT
        date_trunc('${truncFn}', b."completedAt") AS period,
        COUNT(*)::int AS bookings,
        COALESCE(SUM(b.amount), 0)::float AS revenue
      FROM "Booking" b
      WHERE b.status = 'COMPLETED'
        AND b."completedAt" IS NOT NULL
        ${dateFilter}
      GROUP BY period
      ORDER BY period ASC
    `);

    return rows.map((r) => ({
      period: r.period,
      bookings: Number(r.bookings),
      revenue: Number(r.revenue),
    }));
  }

  async platformCommissions(period: string) {
    const since = this.periodToDate(period);
    const dateFilter = since ? { createdAt: { gte: since } } : {};

    const [total, byRule, byTrainer, trend] = await Promise.all([
      this.prisma.commissionRecord.aggregate({
        where: dateFilter,
        _sum: { commissionAmount: true, bookingAmount: true, trainerPayoutAmount: true },
        _count: true,
      }),
      this.prisma.commissionRecord.groupBy({
        by: ['ruleId'],
        where: dateFilter,
        _sum: { commissionAmount: true },
        _count: true,
      }),
      this.prisma.$queryRawUnsafe(`
        SELECT
          b."trainerId",
          u."firstName",
          u."lastName",
          COUNT(*)::int AS count,
          COALESCE(SUM(cr."commissionAmount"), 0)::float AS total
        FROM "CommissionRecord" cr
        JOIN "Booking" b ON cr."bookingId" = b.id
        JOIN "User" u ON b."trainerId" = u.id
        ${since ? `WHERE cr."createdAt" >= '${since.toISOString()}'` : ''}
        GROUP BY b."trainerId", u."firstName", u."lastName"
        ORDER BY total DESC
        LIMIT 20
      `),
      this.prisma.$queryRawUnsafe(`
        SELECT
          date_trunc('day', cr."createdAt") AS period,
          COALESCE(SUM(cr."commissionAmount"), 0)::float AS total
        FROM "CommissionRecord" cr
        ${since ? `WHERE cr."createdAt" >= '${since.toISOString()}'` : ''}
        GROUP BY period
        ORDER BY period ASC
      `),
    ]);

    return {
      totalEarned: Number(total._sum.commissionAmount || 0),
      totalBookingAmount: Number(total._sum.bookingAmount || 0),
      totalTrainerPayouts: Number(total._sum.trainerPayoutAmount || 0),
      count: total._count,
      byRule: byRule.map((r) => ({
        ruleId: r.ruleId,
        total: Number(r._sum.commissionAmount || 0),
        count: r._count,
      })),
      byTrainer: (byTrainer as any[]).map((r) => ({
        trainerId: r.trainerId,
        name: `${r.firstName} ${r.lastName}`,
        count: Number(r.count),
        total: Number(r.total),
      })),
      trend: (trend as any[]).map((r) => ({
        period: r.period,
        total: Number(r.total),
      })),
    };
  }

  async platformPayouts(period: string) {
    const since = this.periodToDate(period);
    const dateFilter = since ? { createdAt: { gte: since } } : {};

    const [totalProcessed, pending, byMethod, byStatus] = await Promise.all([
      this.prisma.payout.aggregate({
        where: { status: 'COMPLETED', ...dateFilter },
        _sum: { netAmount: true, fee: true },
        _count: true,
      }),
      this.prisma.payout.aggregate({
        where: {
          status: { in: ['REQUESTED', 'APPROVED', 'PROCESSING'] },
          ...dateFilter,
        },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.payout.groupBy({
        by: ['method'],
        where: dateFilter,
        _sum: { netAmount: true },
        _count: true,
      }),
      this.prisma.payout.groupBy({
        by: ['status'],
        where: dateFilter,
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    return {
      totalProcessed: Number(totalProcessed._sum.netAmount || 0),
      totalFees: Number(totalProcessed._sum.fee || 0),
      processedCount: totalProcessed._count,
      pendingAmount: Number(pending._sum.amount || 0),
      pendingCount: pending._count,
      byMethod: byMethod.reduce(
        (acc, m) => ({
          ...acc,
          [m.method]: {
            total: Number(m._sum.netAmount || 0),
            count: m._count,
          },
        }),
        {},
      ),
      byStatus: byStatus.reduce(
        (acc, s) => ({
          ...acc,
          [s.status]: {
            total: Number(s._sum.amount || 0),
            count: s._count,
          },
        }),
        {},
      ),
    };
  }

  async platformSubscriptions() {
    const [activeCount, allSubs, byPlan] = await Promise.all([
      this.prisma.subscription.count({ where: { status: 'ACTIVE' } }),
      this.prisma.subscription.findMany({
        where: { status: 'ACTIVE' },
        include: { plan: { select: { price: true, durationDays: true, name: true } } },
      }),
      this.prisma.subscription.groupBy({
        by: ['planId'],
        where: { status: 'ACTIVE' },
        _count: true,
      }),
    ]);

    // MRR
    const mrr = allSubs.reduce((sum, sub) => {
      return (
        sum + (Number(sub.plan.price) * 30) / (sub.plan.durationDays || 30)
      );
    }, 0);

    // Churn: subscriptions that expired or cancelled in the last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [churned, totalAtStart] = await Promise.all([
      this.prisma.subscription.count({
        where: {
          status: { in: ['EXPIRED', 'CANCELLED'] },
          updatedAt: { gte: thirtyDaysAgo },
        },
      }),
      this.prisma.subscription.count({
        where: {
          createdAt: { lte: thirtyDaysAgo },
        },
      }),
    ]);
    const churnRate = totalAtStart > 0 ? churned / totalAtStart : 0;

    // Resolve plan names for byPlan
    const planIds = byPlan.map((p) => p.planId);
    const plans = await this.prisma.subscriptionPlan.findMany({
      where: { id: { in: planIds } },
      select: { id: true, name: true, price: true },
    });
    const planMap = new Map(plans.map((p) => [p.id, p]));

    return {
      activeCount,
      mrr,
      churnRate,
      byPlan: byPlan.map((p) => ({
        planId: p.planId,
        planName: planMap.get(p.planId)?.name || 'Unknown',
        price: Number(planMap.get(p.planId)?.price || 0),
        count: p._count,
      })),
    };
  }

  /* ================================================================== */
  /*  PLATFORM WALLET / REVENUE DASHBOARD                               */
  /* ================================================================== */

  /** Resolve platform wallet ID from system settings or SUPER_ADMIN user */
  private async _getPlatformWalletId(): Promise<string | null> {
    const setting = await this.prisma.systemSetting.findUnique({ where: { key: 'platform.wallet_id' } });
    if (setting) {
      const wallet = await this.prisma.wallet.findUnique({ where: { id: setting.value as string } });
      if (wallet) return wallet.id;
    }
    const admin = await this.prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' }, orderBy: { createdAt: 'asc' } });
    if (!admin) return null;
    const wallet = await this.prisma.wallet.findUnique({ where: { userId: admin.id } });
    return wallet?.id || null;
  }

  async platformWallet() {
    const platformWalletId = await this._getPlatformWalletId();
    if (!platformWalletId) {
      return {
        platformWalletBalance: 0,
        revenueBreakdown: {
          commissions: { total: 0, count: 0, thisMonth: 0 },
          subscriptions: { total: 0, count: 0, thisMonth: 0 },
          courseFees: { total: 0, count: 0, thisMonth: 0 },
          payoutFees: { total: 0, count: 0, thisMonth: 0 },
        },
        totalRevenue: 0,
        thisMonthRevenue: 0,
        lastMonthRevenue: 0,
        growthPercentage: 0,
        revenueByMonth: [],
      };
    }

    const wallet = await this.prisma.wallet.findUnique({ where: { id: platformWalletId } });
    const platformBalance = Number(wallet?.balance || 0);

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    // Revenue breakdown by referenceType from CREDIT ledger entries on the platform wallet
    const breakdownRows: any[] = await this.prisma.$queryRawUnsafe(`
      SELECT
        wt."referenceType",
        COUNT(*)::int AS count,
        COALESCE(SUM(le.amount), 0)::float AS total,
        COALESCE(SUM(CASE WHEN le."createdAt" >= $1::timestamp THEN le.amount ELSE 0 END), 0)::float AS "thisMonth"
      FROM "LedgerEntry" le
      JOIN "WalletTransaction" wt ON le."transactionId" = wt.id
      WHERE le."walletId" = $2
        AND le."entryType" = 'CREDIT'
      GROUP BY wt."referenceType"
    `, startOfMonth.toISOString(), platformWalletId);

    const breakdown: Record<string, { total: number; count: number; thisMonth: number }> = {};
    for (const row of breakdownRows) {
      breakdown[row.referenceType] = {
        total: Number(row.total),
        count: Number(row.count),
        thisMonth: Number(row.thisMonth),
      };
    }

    const commissions = breakdown['COMMISSION'] || { total: 0, count: 0, thisMonth: 0 };
    const subscriptions = {
      total: (breakdown['SUBSCRIPTION']?.total || 0) + (breakdown['SUBSCRIPTION_RENEWAL']?.total || 0),
      count: (breakdown['SUBSCRIPTION']?.count || 0) + (breakdown['SUBSCRIPTION_RENEWAL']?.count || 0),
      thisMonth: (breakdown['SUBSCRIPTION']?.thisMonth || 0) + (breakdown['SUBSCRIPTION_RENEWAL']?.thisMonth || 0),
    };
    const courseFees = breakdown['COURSE_COMMISSION'] || { total: 0, count: 0, thisMonth: 0 };
    const payoutFees = breakdown['PAYOUT_FEE'] || { total: 0, count: 0, thisMonth: 0 };

    const totalRevenue = commissions.total + subscriptions.total + courseFees.total + payoutFees.total;
    const thisMonthRevenue = commissions.thisMonth + subscriptions.thisMonth + courseFees.thisMonth + payoutFees.thisMonth;

    // Last month revenue
    const lastMonthRows: any[] = await this.prisma.$queryRawUnsafe(`
      SELECT COALESCE(SUM(le.amount), 0)::float AS total
      FROM "LedgerEntry" le
      JOIN "WalletTransaction" wt ON le."transactionId" = wt.id
      WHERE le."walletId" = $1
        AND le."entryType" = 'CREDIT'
        AND le."createdAt" >= $2::timestamp
        AND le."createdAt" < $3::timestamp
    `, platformWalletId, startOfLastMonth.toISOString(), startOfMonth.toISOString());
    const lastMonthRevenue = Number(lastMonthRows[0]?.total || 0);

    const growthPercentage = lastMonthRevenue > 0
      ? Math.round(((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100)
      : thisMonthRevenue > 0 ? 100 : 0;

    // Revenue by month (last 6 months)
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const monthlyRows: any[] = await this.prisma.$queryRawUnsafe(`
      SELECT
        to_char(date_trunc('month', le."createdAt"), 'YYYY-MM') AS month,
        COALESCE(SUM(CASE WHEN wt."referenceType" = 'COMMISSION' THEN le.amount ELSE 0 END), 0)::float AS commissions,
        COALESCE(SUM(CASE WHEN wt."referenceType" IN ('SUBSCRIPTION', 'SUBSCRIPTION_RENEWAL') THEN le.amount ELSE 0 END), 0)::float AS subscriptions,
        COALESCE(SUM(CASE WHEN wt."referenceType" = 'COURSE_COMMISSION' THEN le.amount ELSE 0 END), 0)::float AS "courseFees",
        COALESCE(SUM(CASE WHEN wt."referenceType" = 'PAYOUT_FEE' THEN le.amount ELSE 0 END), 0)::float AS "payoutFees",
        COALESCE(SUM(le.amount), 0)::float AS total
      FROM "LedgerEntry" le
      JOIN "WalletTransaction" wt ON le."transactionId" = wt.id
      WHERE le."walletId" = $1
        AND le."entryType" = 'CREDIT'
        AND le."createdAt" >= $2::timestamp
      GROUP BY month
      ORDER BY month ASC
    `, platformWalletId, sixMonthsAgo.toISOString());

    return {
      platformWalletBalance: platformBalance,
      revenueBreakdown: {
        commissions,
        subscriptions,
        courseFees,
        payoutFees,
      },
      totalRevenue,
      thisMonthRevenue,
      lastMonthRevenue,
      growthPercentage,
      revenueByMonth: monthlyRows.map((r) => ({
        month: r.month,
        commissions: Number(r.commissions),
        subscriptions: Number(r.subscriptions),
        courseFees: Number(r.courseFees),
        payoutFees: Number(r.payoutFees),
        total: Number(r.total),
      })),
    };
  }

  async platformMoneyFlow() {
    const platformWalletId = await this._getPlatformWalletId();

    const [
      totalDeposits,
      totalWithdrawals,
      totalPayoutsCompleted,
      escrowFunded,
      escrowReleased,
      escrowRefunded,
      trainerCredits,
      platformBalance,
    ] = await Promise.all([
      // Total money in: all DEPOSIT credits across all wallets
      this.prisma.$queryRawUnsafe(`
        SELECT COALESCE(SUM(le.amount), 0)::float AS total
        FROM "LedgerEntry" le
        JOIN "WalletTransaction" wt ON le."transactionId" = wt.id
        WHERE wt."referenceType" = 'DEPOSIT'
          AND le."entryType" = 'CREDIT'
      `),
      // Total money out: all withdrawals
      this.prisma.$queryRawUnsafe(`
        SELECT COALESCE(SUM(le.amount), 0)::float AS total
        FROM "LedgerEntry" le
        JOIN "WalletTransaction" wt ON le."transactionId" = wt.id
        WHERE wt."referenceType" = 'WITHDRAWAL'
          AND le."entryType" = 'DEBIT'
      `),
      // Total payouts completed
      this.prisma.payout.aggregate({
        where: { status: 'COMPLETED' },
        _sum: { netAmount: true },
      }),
      // Escrow currently held (FUNDED or HELD)
      this.prisma.escrowAccount.aggregate({
        where: { status: { in: ['FUNDED', 'HELD'] } },
        _sum: { amount: true },
      }),
      // Escrow released
      this.prisma.escrowAccount.aggregate({
        where: { status: 'RELEASED' },
        _sum: { amount: true },
      }),
      // Escrow refunded
      this.prisma.escrowAccount.aggregate({
        where: { status: 'REFUNDED' },
        _sum: { amount: true },
      }),
      // Trainer earnings: total ESCROW credits to non-platform wallets (trainer payouts from escrow release)
      this.prisma.$queryRawUnsafe(`
        SELECT COALESCE(SUM(le.amount), 0)::float AS total
        FROM "LedgerEntry" le
        JOIN "WalletTransaction" wt ON le."transactionId" = wt.id
        WHERE wt."referenceType" = 'ESCROW'
          AND le."entryType" = 'CREDIT'
          ${platformWalletId ? `AND le."walletId" != '${platformWalletId}'` : ''}
      `),
      // Platform wallet balance
      platformWalletId
        ? this.prisma.wallet.findUnique({ where: { id: platformWalletId }, select: { balance: true } })
        : null,
    ]);

    const totalMoneyIn = Number((totalDeposits as any[])[0]?.total || 0);
    const totalMoneyOut = Number((totalWithdrawals as any[])[0]?.total || 0) + Number(totalPayoutsCompleted._sum.netAmount || 0);

    return {
      totalMoneyIn,
      totalMoneyOut,
      platformCut: Number(platformBalance?.balance || 0),
      trainerEarnings: Number((trainerCredits as any[])[0]?.total || 0),
      escrowHeld: Number(escrowFunded._sum.amount || 0),
      escrowReleased: Number(escrowReleased._sum.amount || 0),
      escrowRefunded: Number(escrowRefunded._sum.amount || 0),
    };
  }

  /* ================================================================== */
  /*  FIRM / TENANT REPORTS                                             */
  /* ================================================================== */

  async firmSummary(firmOwnerId: string) {
    // Get firm members
    const members = await this.prisma.teamMember.findMany({
      where: { firmId: firmOwnerId, isActive: true },
      select: { userId: true },
    });
    const memberIds = members.map((m) => m.userId);
    const allIds = [firmOwnerId, ...memberIds];

    const [firmRevenue, outstandingInvoices] = await Promise.all([
      this.prisma.booking.aggregate({
        where: { trainerId: { in: allIds }, status: 'COMPLETED' },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.invoice.aggregate({
        where: {
          issuerId: { in: allIds },
          status: { in: ['SENT', 'OVERDUE'] },
        },
        _sum: { total: true },
        _count: true,
      }),
    ]);

    // Per-consultant earnings
    const consultantEarnings: any[] = await this.prisma.$queryRawUnsafe(`
      SELECT
        b."trainerId",
        u."firstName",
        u."lastName",
        COUNT(*)::int AS bookings,
        COALESCE(SUM(b.amount), 0)::float AS revenue
      FROM "Booking" b
      JOIN "User" u ON b."trainerId" = u.id
      WHERE b."trainerId" = ANY(ARRAY[${allIds.map((id) => `'${id}'`).join(',')}]::text[])
        AND b.status = 'COMPLETED'
      GROUP BY b."trainerId", u."firstName", u."lastName"
      ORDER BY revenue DESC
    `);

    // Per-department revenue
    const deptRevenue: any[] = await this.prisma.$queryRawUnsafe(`
      SELECT
        d.id AS "departmentId",
        d.name AS "departmentName",
        COUNT(b.id)::int AS bookings,
        COALESCE(SUM(b.amount), 0)::float AS revenue
      FROM "Department" d
      LEFT JOIN "TeamMember" tm ON tm."departmentId" = d.id AND tm."isActive" = true
      LEFT JOIN "Booking" b ON b."trainerId" = tm."userId" AND b.status = 'COMPLETED'
      WHERE d."firmId" = '${firmOwnerId}'
      GROUP BY d.id, d.name
      ORDER BY revenue DESC
    `);

    return {
      totalFirmRevenue: Number(firmRevenue._sum.amount || 0),
      totalBookings: firmRevenue._count,
      outstandingInvoicesCount: outstandingInvoices._count,
      outstandingInvoicesAmount: Number(outstandingInvoices._sum.total || 0),
      consultantEarnings: consultantEarnings.map((c) => ({
        trainerId: c.trainerId,
        name: `${c.firstName} ${c.lastName}`,
        bookings: Number(c.bookings),
        revenue: Number(c.revenue),
      })),
      departmentRevenue: deptRevenue.map((d) => ({
        departmentId: d.departmentId,
        departmentName: d.departmentName,
        bookings: Number(d.bookings),
        revenue: Number(d.revenue),
      })),
    };
  }

  async firmConsultants(firmOwnerId: string, period: string) {
    const since = this.periodToDate(period);
    const members = await this.prisma.teamMember.findMany({
      where: { firmId: firmOwnerId, isActive: true },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true, avatar: true },
        },
      },
    });

    const results = await Promise.all(
      members.map(async (member) => {
        const uid = member.userId;
        const dateFilter = since
          ? { completedAt: { gte: since } }
          : {};

        const [bookings, commissions, reviews] = await Promise.all([
          this.prisma.booking.aggregate({
            where: { trainerId: uid, status: 'COMPLETED', ...dateFilter },
            _sum: { amount: true },
            _count: true,
          }),
          this.prisma.commissionRecord.aggregate({
            where: {
              booking: { trainerId: uid },
              ...(since ? { createdAt: { gte: since } } : {}),
            },
            _sum: { commissionAmount: true, trainerPayoutAmount: true },
          }),
          this.prisma.review.aggregate({
            where: { trainerId: uid },
            _avg: { rating: true },
          }),
        ]);

        return {
          consultant: member.user,
          role: member.role,
          title: member.title,
          bookingsCount: bookings._count,
          revenue: Number(bookings._sum.amount || 0),
          commissionsPaid: Number(commissions._sum.commissionAmount || 0),
          netEarned: Number(commissions._sum.trainerPayoutAmount || 0),
          averageRating: Number(reviews._avg.rating || 0),
        };
      }),
    );

    return results;
  }

  async firmDepartments(firmOwnerId: string, period: string) {
    const since = this.periodToDate(period);
    const dateFilterSql = since
      ? `AND b."completedAt" >= '${since.toISOString()}'`
      : '';

    const rows: any[] = await this.prisma.$queryRawUnsafe(`
      SELECT
        d.id AS "departmentId",
        d.name AS "departmentName",
        COUNT(DISTINCT tm."userId")::int AS "memberCount",
        COUNT(b.id)::int AS bookings,
        COALESCE(SUM(b.amount), 0)::float AS revenue,
        CASE WHEN COUNT(b.id) > 0
          THEN (COALESCE(SUM(b.amount), 0) / COUNT(b.id))::float
          ELSE 0
        END AS "averageTicket"
      FROM "Department" d
      LEFT JOIN "TeamMember" tm ON tm."departmentId" = d.id AND tm."isActive" = true
      LEFT JOIN "Booking" b ON b."trainerId" = tm."userId" AND b.status = 'COMPLETED' ${dateFilterSql}
      WHERE d."firmId" = '${firmOwnerId}'
      GROUP BY d.id, d.name
      ORDER BY revenue DESC
    `);

    return rows.map((r) => ({
      departmentId: r.departmentId,
      departmentName: r.departmentName,
      memberCount: Number(r.memberCount),
      bookings: Number(r.bookings),
      revenue: Number(r.revenue),
      averageTicket: Number(r.averageTicket),
    }));
  }

  /* ================================================================== */
  /*  INDIVIDUAL REPORTS                                                */
  /* ================================================================== */

  async myEarnings(userId: string, period: string) {
    const since = this.periodToDate(period);
    const dateFilter = since ? { completedAt: { gte: since } } : {};

    const [gross, commissions, pendingPayouts, trend] = await Promise.all([
      this.prisma.booking.aggregate({
        where: { trainerId: userId, status: 'COMPLETED', ...dateFilter },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.commissionRecord.aggregate({
        where: {
          booking: { trainerId: userId },
          ...(since ? { createdAt: { gte: since } } : {}),
        },
        _sum: { commissionAmount: true, trainerPayoutAmount: true },
      }),
      this.prisma.payout.aggregate({
        where: {
          userId,
          status: { in: ['REQUESTED', 'APPROVED', 'PROCESSING'] },
        },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.$queryRawUnsafe(`
        SELECT
          date_trunc('day', b."completedAt") AS period,
          COALESCE(SUM(b.amount), 0)::float AS gross
        FROM "Booking" b
        WHERE b."trainerId" = '${userId}'
          AND b.status = 'COMPLETED'
          AND b."completedAt" IS NOT NULL
          ${since ? `AND b."completedAt" >= '${since.toISOString()}'` : ''}
        GROUP BY period
        ORDER BY period ASC
      `),
    ]);

    return {
      grossEarnings: Number(gross._sum.amount || 0),
      completedBookings: gross._count,
      commissionsDeducted: Number(commissions._sum.commissionAmount || 0),
      netEarnings: Number(commissions._sum.trainerPayoutAmount || 0),
      pendingPayoutsAmount: Number(pendingPayouts._sum.amount || 0),
      pendingPayoutsCount: pendingPayouts._count,
      trend: (trend as any[]).map((r) => ({
        period: r.period,
        gross: Number(r.gross),
      })),
    };
  }

  async mySpending(userId: string, period: string) {
    const since = this.periodToDate(period);
    const dateFilter = since ? { completedAt: { gte: since } } : {};

    const [totalSpent, byTrainer, bySessionType, byMonth] = await Promise.all([
      this.prisma.booking.aggregate({
        where: { clientId: userId, status: 'COMPLETED', ...dateFilter },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.$queryRawUnsafe(`
        SELECT
          b."trainerId",
          u."firstName",
          u."lastName",
          COUNT(*)::int AS bookings,
          COALESCE(SUM(b.amount), 0)::float AS total
        FROM "Booking" b
        JOIN "User" u ON b."trainerId" = u.id
        WHERE b."clientId" = '${userId}'
          AND b.status = 'COMPLETED'
          ${since ? `AND b."completedAt" >= '${since.toISOString()}'` : ''}
        GROUP BY b."trainerId", u."firstName", u."lastName"
        ORDER BY total DESC
      `),
      this.prisma.booking.groupBy({
        by: ['sessionType'],
        where: { clientId: userId, status: 'COMPLETED', ...dateFilter },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.$queryRawUnsafe(`
        SELECT
          date_trunc('month', b."completedAt") AS period,
          COALESCE(SUM(b.amount), 0)::float AS total
        FROM "Booking" b
        WHERE b."clientId" = '${userId}'
          AND b.status = 'COMPLETED'
          AND b."completedAt" IS NOT NULL
          ${since ? `AND b."completedAt" >= '${since.toISOString()}'` : ''}
        GROUP BY period
        ORDER BY period ASC
      `),
    ]);

    return {
      totalSpent: Number(totalSpent._sum.amount || 0),
      totalBookings: totalSpent._count,
      byTrainer: (byTrainer as any[]).map((r) => ({
        trainerId: r.trainerId,
        name: `${r.firstName} ${r.lastName}`,
        bookings: Number(r.bookings),
        total: Number(r.total),
      })),
      bySessionType: bySessionType.map((s) => ({
        sessionType: s.sessionType,
        total: Number(s._sum.amount || 0),
        count: s._count,
      })),
      byMonth: (byMonth as any[]).map((r) => ({
        period: r.period,
        total: Number(r.total),
      })),
    };
  }

  async myInvoicesSummary(userId: string) {
    const [byStatus, outstanding, totalPaid] = await Promise.all([
      this.prisma.invoice.groupBy({
        by: ['status'],
        where: {
          OR: [{ issuerId: userId }, { recipientId: userId }],
        },
        _count: true,
      }),
      this.prisma.invoice.aggregate({
        where: {
          issuerId: userId,
          status: { in: ['SENT', 'OVERDUE'] },
        },
        _sum: { total: true },
        _count: true,
      }),
      this.prisma.invoice.aggregate({
        where: {
          OR: [{ issuerId: userId }, { recipientId: userId }],
          status: 'PAID',
        },
        _sum: { total: true },
        _count: true,
      }),
    ]);

    return {
      byStatus: byStatus.reduce(
        (acc, s) => ({ ...acc, [s.status]: s._count }),
        {},
      ),
      outstandingCount: outstanding._count,
      outstandingAmount: Number(outstanding._sum.total || 0),
      totalPaidCount: totalPaid._count,
      totalPaidAmount: Number(totalPaid._sum.total || 0),
    };
  }
}
