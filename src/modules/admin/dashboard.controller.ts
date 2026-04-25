import { Controller, Get, Param, Query, NotFoundException, ForbiddenException } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../common/services/prisma.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('trainer/stats')
  async trainerStats(@CurrentUser('id') uid: string) {
    const [upcoming, completed, walletRow, totalEarned, rating, totalReviews] = await Promise.all([
      this.prisma.booking.count({ where: { trainerId: uid, status: { in: ['CONFIRMED', 'PENDING_PAYMENT'] } } }),
      this.prisma.booking.count({ where: { trainerId: uid, status: 'COMPLETED' } }),
      this.prisma.wallet.findFirst({ where: { userId: uid } }),
      this.prisma.booking.aggregate({ where: { trainerId: uid, status: 'COMPLETED' }, _sum: { amount: true } }),
      this.prisma.review.aggregate({ where: { trainerId: uid, isVisible: true }, _avg: { rating: true } }),
      this.prisma.review.count({ where: { trainerId: uid, isVisible: true } }),
    ]);
    return {
      upcomingSessions: upcoming,
      completedSessions: completed,
      walletBalance: Number(walletRow?.balance ?? 0),
      totalEarned: Number(totalEarned._sum.amount ?? 0),
      averageRating: Number(rating._avg.rating ?? 0),
      totalReviews,
    };
  }

  @Get('client/stats')
  async clientStats(@CurrentUser('id') uid: string) {
    const [upcoming, completed, walletRow, totalSpent] = await Promise.all([
      this.prisma.booking.count({ where: { clientId: uid, status: { in: ['CONFIRMED', 'PENDING_PAYMENT'] } } }),
      this.prisma.booking.count({ where: { clientId: uid, status: 'COMPLETED' } }),
      this.prisma.wallet.findFirst({ where: { userId: uid } }),
      this.prisma.booking.aggregate({ where: { clientId: uid, status: 'COMPLETED' }, _sum: { amount: true } }),
    ]);
    return {
      upcomingBookings: upcoming,
      completedBookings: completed,
      walletBalance: Number(walletRow?.balance ?? 0),
      totalSpent: Number(totalSpent._sum.amount ?? 0),
    };
  }

  @Get('upcoming-bookings')
  async upcomingBookings(@CurrentUser('id') uid: string, @CurrentUser('role') role: string, @Query('limit') limit?: string) {
    const take = Math.min(Number(limit) || 5, 20);
    const where = role === 'TRAINER'
      ? { trainerId: uid, status: { in: ['CONFIRMED', 'PENDING_PAYMENT', 'IN_PROGRESS'] as any } }
      : { clientId: uid, status: { in: ['CONFIRMED', 'PENDING_PAYMENT', 'IN_PROGRESS'] as any } };
    return this.prisma.booking.findMany({
      where,
      orderBy: { scheduledAt: 'asc' },
      take,
      include: {
        trainer: { select: { id: true, firstName: true, lastName: true, avatar: true } },
        client: { select: { id: true, firstName: true, lastName: true, avatar: true } },
      },
    });
  }

  @Get('earnings-chart')
  async earningsChart(@CurrentUser('id') uid: string, @CurrentUser('role') role: string, @Query('days') days?: string) {
    const numDays = Math.min(Number(days) || 30, 365);
    const since = new Date();
    since.setDate(since.getDate() - numDays);

    const where = role === 'TRAINER'
      ? { trainerId: uid, status: 'COMPLETED' as any, completedAt: { gte: since } }
      : { clientId: uid, status: 'COMPLETED' as any, completedAt: { gte: since } };

    const bookings = await this.prisma.booking.findMany({ where, select: { amount: true, completedAt: true, createdAt: true } });

    // Group by date
    const map: Record<string, number> = {};
    for (let i = 0; i < numDays; i++) {
      const d = new Date(since);
      d.setDate(d.getDate() + i);
      map[d.toISOString().slice(0, 10)] = 0;
    }
    for (const b of bookings) {
      const key = (b.completedAt ?? b.createdAt).toISOString().slice(0, 10);
      if (map[key] !== undefined) map[key] += Number(b.amount);
    }
    return Object.entries(map).map(([date, amount]) => ({ date, amount }));
  }

  @Get('recent-activity')
  async recentActivity(@CurrentUser('id') uid: string, @Query('limit') limit?: string) {
    const take = Math.min(Number(limit) || 10, 50);
    const [bookings, reviews, notifications] = await Promise.all([
      this.prisma.booking.findMany({
        where: { OR: [{ trainerId: uid }, { clientId: uid }] },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { trainer: { select: { firstName: true, lastName: true } }, client: { select: { firstName: true, lastName: true } } },
      }),
      this.prisma.review.findMany({
        where: { OR: [{ trainerId: uid }, { reviewerId: uid }] },
        orderBy: { createdAt: 'desc' },
        take: 3,
      }),
      this.prisma.notification.findMany({
        where: { userId: uid },
        orderBy: { createdAt: 'desc' },
        take: 3,
      }),
    ]);

    const items: { id: string; type: string; message: string; createdAt: string }[] = [];
    for (const b of bookings) {
      items.push({ id: b.id, type: 'BOOKING', message: `Booking with ${b.trainer.firstName} ${b.trainer.lastName} — ${b.status}`, createdAt: b.createdAt.toISOString() });
    }
    for (const r of reviews) {
      items.push({ id: r.id, type: 'REVIEW', message: `New ${r.rating}-star review`, createdAt: r.createdAt.toISOString() });
    }
    for (const n of notifications) {
      items.push({ id: n.id, type: 'NOTIFICATION', message: n.title, createdAt: n.createdAt.toISOString() });
    }
    return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, take);
  }

  @Get('recent-reviews')
  async recentReviews(@CurrentUser('id') uid: string, @Query('limit') limit?: string) {
    const take = Math.min(Number(limit) || 5, 20);
    return this.prisma.review.findMany({
      where: { trainerId: uid, isVisible: true },
      orderBy: { createdAt: 'desc' },
      take,
      include: { reviewer: { select: { id: true, firstName: true, lastName: true, avatar: true } } },
    });
  }

  // ---------------------------------------------------------------------------
  // Firm Financial Dashboard
  // ---------------------------------------------------------------------------

  @Get('firm/financial')
  async firmFinancial(@CurrentUser('id') uid: string) {
    // Get all firm members (consultants) where the current user is the firm owner
    const firmMembers = await this.prisma.teamMember.findMany({
      where: { firmId: uid, isActive: true },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true } },
        department: { select: { id: true, name: true } },
      },
    });

    // All user IDs in the firm: owner + all consultants
    const memberUserIds = firmMembers.map((m) => m.userId);
    const allFirmUserIds = [uid, ...memberUserIds];

    // Parallel queries for firm-wide aggregations
    const [
      firmRevenueAgg,
      firmBookingsCount,
      outstandingInvoicesAgg,
      outstandingInvoicesCount,
      memberBookings,
      departmentBookings,
      monthlyBookings,
    ] = await Promise.all([
      // Total firm revenue from completed bookings
      this.prisma.booking.aggregate({
        where: { trainerId: { in: allFirmUserIds }, status: 'COMPLETED' },
        _sum: { amount: true },
      }),
      // Total firm bookings count
      this.prisma.booking.count({
        where: { trainerId: { in: allFirmUserIds }, status: 'COMPLETED' },
      }),
      // Outstanding invoices — unpaid invoices issued by firm members
      this.prisma.invoice.aggregate({
        where: { issuerId: { in: allFirmUserIds }, status: { in: ['SENT', 'OVERDUE', 'DRAFT'] } },
        _sum: { total: true },
      }),
      this.prisma.invoice.count({
        where: { issuerId: { in: allFirmUserIds }, status: { in: ['SENT', 'OVERDUE', 'DRAFT'] } },
      }),
      // Per-member booking stats (for consultantEarnings)
      this.prisma.booking.groupBy({
        by: ['trainerId'],
        where: { trainerId: { in: allFirmUserIds }, status: 'COMPLETED' },
        _sum: { amount: true },
        _count: true,
      }),
      // Department-level grouping — get bookings per consultant, then map to departments
      this.prisma.booking.findMany({
        where: { trainerId: { in: allFirmUserIds }, status: 'COMPLETED' },
        select: { trainerId: true, amount: true },
      }),
      // Monthly trend — last 6 months
      this.prisma.booking.findMany({
        where: {
          trainerId: { in: allFirmUserIds },
          status: 'COMPLETED',
          completedAt: { gte: new Date(Date.now() - 180 * 86400000) },
        },
        select: { amount: true, completedAt: true, createdAt: true },
      }),
    ]);

    // Build consultant earnings array
    const memberBookingsMap = new Map(memberBookings.map((m) => [m.trainerId, m]));
    const commissionRate = 0.10; // 10% platform commission

    const consultantEarnings = allFirmUserIds.map((userId) => {
      const member = firmMembers.find((m) => m.userId === userId);
      const stats = memberBookingsMap.get(userId);
      const revenue = Number(stats?._sum?.amount ?? 0);
      const bookings = stats?._count ?? 0;
      const commissions = Math.round(revenue * commissionRate * 100) / 100;
      const net = revenue - commissions;

      // For the owner, use their own name
      let name = 'Owner';
      if (member) {
        name = `${member.user.firstName ?? ''} ${member.user.lastName ?? ''}`.trim() || member.user.email;
      }

      return { userId, name, bookings, revenue, commissions, net };
    });

    // Build department revenue
    const deptMap = new Map<string, { departmentId: string; name: string; bookings: number; revenue: number; members: number }>();
    // Map consultant userId to departmentId
    const userDeptMap = new Map<string, { departmentId: string; name: string }>();
    for (const m of firmMembers) {
      if (m.departmentId && m.department) {
        userDeptMap.set(m.userId, { departmentId: m.departmentId, name: m.department.name });
      }
    }

    for (const b of departmentBookings) {
      const dept = userDeptMap.get(b.trainerId);
      if (!dept) continue;
      const existing = deptMap.get(dept.departmentId) || { departmentId: dept.departmentId, name: dept.name, bookings: 0, revenue: 0, members: 0 };
      existing.bookings += 1;
      existing.revenue += Number(b.amount);
      deptMap.set(dept.departmentId, existing);
    }
    // Count members per department
    for (const m of firmMembers) {
      if (m.departmentId) {
        const existing = deptMap.get(m.departmentId);
        if (existing) existing.members += 1;
      }
    }
    const departmentRevenue = Array.from(deptMap.values());

    // Build monthly trend (last 6 months)
    const monthlyTrend: { month: string; revenue: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyTrend.push({ month: key, revenue: 0 });
    }
    for (const b of monthlyBookings) {
      const dt = b.completedAt ?? b.createdAt;
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
      const entry = monthlyTrend.find((m) => m.month === key);
      if (entry) entry.revenue += Number(b.amount);
    }

    return {
      firmRevenue: Number(firmRevenueAgg._sum.amount ?? 0),
      totalBookings: firmBookingsCount,
      consultantEarnings,
      departmentRevenue,
      outstandingInvoices: {
        count: outstandingInvoicesCount,
        amount: Number(outstandingInvoicesAgg._sum.total ?? 0),
      },
      monthlyTrend,
    };
  }

  @Get('firm/consultant/:consultantId')
  async firmConsultantDetail(
    @CurrentUser('id') uid: string,
    @Param('consultantId') consultantId: string,
  ) {
    // Verify the current user is the firm owner of this consultant
    const membership = await this.prisma.teamMember.findFirst({
      where: { firmId: uid, userId: consultantId, isActive: true },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true } } },
    });
    if (!membership) throw new ForbiddenException('Consultant is not in your firm');

    const [
      bookingsByStatus,
      revenueAgg,
      ratingAgg,
      recentBookings,
      payoutHistory,
      monthlyBookings,
    ] = await Promise.all([
      // Bookings count grouped by status
      this.prisma.booking.groupBy({
        by: ['status'],
        where: { trainerId: consultantId },
        _count: true,
      }),
      // Total revenue
      this.prisma.booking.aggregate({
        where: { trainerId: consultantId, status: 'COMPLETED' },
        _sum: { amount: true },
      }),
      // Average rating
      this.prisma.review.aggregate({
        where: { trainerId: consultantId, isVisible: true },
        _avg: { rating: true },
        _count: true,
      }),
      // Recent bookings
      this.prisma.booking.findMany({
        where: { trainerId: consultantId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          client: { select: { id: true, firstName: true, lastName: true, avatar: true } },
        },
      }),
      // Payout history
      this.prisma.payout.findMany({
        where: { userId: consultantId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      // Revenue trend (last 6 months)
      this.prisma.booking.findMany({
        where: {
          trainerId: consultantId,
          status: 'COMPLETED',
          completedAt: { gte: new Date(Date.now() - 180 * 86400000) },
        },
        select: { amount: true, completedAt: true, createdAt: true },
      }),
    ]);

    // Format bookings by status
    const statusCounts: Record<string, number> = {};
    for (const g of bookingsByStatus) {
      statusCounts[g.status] = g._count;
    }

    // Build revenue trend
    const revenueTrend: { month: string; revenue: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      revenueTrend.push({ month: key, revenue: 0 });
    }
    for (const b of monthlyBookings) {
      const dt = b.completedAt ?? b.createdAt;
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
      const entry = revenueTrend.find((m) => m.month === key);
      if (entry) entry.revenue += Number(b.amount);
    }

    return {
      consultant: membership.user,
      role: membership.role,
      title: membership.title,
      bookingsByStatus: statusCounts,
      totalRevenue: Number(revenueAgg._sum.amount ?? 0),
      averageRating: Number(ratingAgg._avg.rating ?? 0),
      totalReviews: ratingAgg._count,
      revenueTrend,
      recentBookings: recentBookings.map((b) => ({
        id: b.id,
        clientName: `${b.client.firstName ?? ''} ${b.client.lastName ?? ''}`.trim(),
        amount: Number(b.amount),
        status: b.status,
        scheduledAt: b.scheduledAt,
        createdAt: b.createdAt,
      })),
      payoutHistory: payoutHistory.map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        fee: Number(p.fee),
        netAmount: Number(p.netAmount),
        method: p.method,
        status: p.status,
        createdAt: p.createdAt,
        processedAt: p.processedAt,
      })),
    };
  }
}
