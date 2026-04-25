import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { Period } from './dto/analytics.dto';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private periodToMs(period: Period): number {
    const map: Record<Period, number> = {
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
      '90d': 90 * 24 * 60 * 60 * 1000,
      '1y': 365 * 24 * 60 * 60 * 1000,
    };
    return map[period] || map['30d'];
  }

  private periodDates(period: Period) {
    const ms = this.periodToMs(period);
    const now = new Date();
    const currentStart = new Date(now.getTime() - ms);
    const previousStart = new Date(currentStart.getTime() - ms);
    return { now, currentStart, previousStart };
  }

  /**
   * Returns the appropriate SQL date_trunc bucket for a given period.
   * 7d -> day, 30d -> day, 90d -> week, 1y -> month
   */
  private truncBucket(period: Period): string {
    if (period === '7d' || period === '30d') return 'day';
    if (period === '90d') return 'week';
    return 'month';
  }

  // ---------------------------------------------------------------------------
  // GET /analytics/overview
  // ---------------------------------------------------------------------------

  async getOverview() {
    const [
      totalUsers,
      totalTrainers,
      totalClients,
      totalBookings,
      revenueAgg,
      activeDisputes,
      pendingVerifications,
    ] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.user.count({ where: { role: 'TRAINER', deletedAt: null } }),
      this.prisma.user.count({ where: { role: 'CLIENT', deletedAt: null } }),
      this.prisma.booking.count(),
      this.prisma.booking.aggregate({
        _sum: { amount: true },
        where: { status: 'COMPLETED' },
      }),
      this.prisma.dispute.count({
        where: { status: { in: ['OPEN', 'UNDER_REVIEW'] } },
      }),
      this.prisma.verificationRequest.count({
        where: { status: 'PENDING' },
      }),
    ]);

    return {
      totalUsers,
      totalTrainers,
      totalClients,
      totalBookings,
      totalRevenue: revenueAgg._sum.amount || 0,
      activeDisputes,
      pendingVerifications,
    };
  }

  // ---------------------------------------------------------------------------
  // GET /analytics/revenue?period=
  // ---------------------------------------------------------------------------

  async getRevenue(period: Period = '30d') {
    const { now, currentStart, previousStart } = this.periodDates(period);
    const bucket = this.truncBucket(period);

    const [currentRevenue, previousRevenue, trend] = await Promise.all([
      this.prisma.booking.aggregate({
        _sum: { amount: true },
        where: {
          status: 'COMPLETED',
          completedAt: { gte: currentStart, lte: now },
        },
      }),
      this.prisma.booking.aggregate({
        _sum: { amount: true },
        where: {
          status: 'COMPLETED',
          completedAt: { gte: previousStart, lt: currentStart },
        },
      }),
      this.prisma.$queryRawUnsafe<
        { bucket: Date; revenue: number; count: bigint }[]
      >(
        `SELECT date_trunc($1, "completedAt") AS bucket,
                COALESCE(SUM(amount), 0)        AS revenue,
                COUNT(*)                         AS count
         FROM "Booking"
         WHERE status = 'COMPLETED'
           AND "completedAt" >= $2
           AND "completedAt" <= $3
         GROUP BY bucket
         ORDER BY bucket`,
        bucket,
        currentStart,
        now,
      ),
    ]);

    const current = Number(currentRevenue._sum.amount || 0);
    const previous = Number(previousRevenue._sum.amount || 0);
    const growthPercent =
      previous === 0
        ? current > 0
          ? 100
          : 0
        : Number((((current - previous) / previous) * 100).toFixed(2));

    return {
      period,
      totalRevenue: current,
      previousRevenue: previous,
      growthPercent,
      trend: trend.map((r) => ({
        date: r.bucket,
        revenue: Number(r.revenue),
        count: Number(r.count),
      })),
    };
  }

  // ---------------------------------------------------------------------------
  // GET /analytics/bookings?period=
  // ---------------------------------------------------------------------------

  async getBookings(period: Period = '30d') {
    const { now, currentStart, previousStart } = this.periodDates(period);
    const bucket = this.truncBucket(period);

    const [byStatus, currentCount, previousCount, trend] = await Promise.all([
      this.prisma.booking.groupBy({
        by: ['status'],
        _count: true,
        where: { createdAt: { gte: currentStart, lte: now } },
      }),
      this.prisma.booking.count({
        where: { createdAt: { gte: currentStart, lte: now } },
      }),
      this.prisma.booking.count({
        where: { createdAt: { gte: previousStart, lt: currentStart } },
      }),
      this.prisma.$queryRawUnsafe<
        { bucket: Date; count: bigint }[]
      >(
        `SELECT date_trunc($1, "createdAt") AS bucket,
                COUNT(*)                     AS count
         FROM "Booking"
         WHERE "createdAt" >= $2
           AND "createdAt" <= $3
         GROUP BY bucket
         ORDER BY bucket`,
        bucket,
        currentStart,
        now,
      ),
    ]);

    const growthPercent =
      previousCount === 0
        ? currentCount > 0
          ? 100
          : 0
        : Number(
            (((currentCount - previousCount) / previousCount) * 100).toFixed(2),
          );

    return {
      period,
      total: currentCount,
      previousTotal: previousCount,
      growthPercent,
      byStatus: byStatus.reduce(
        (acc, item) => ({ ...acc, [item.status]: item._count }),
        {} as Record<string, number>,
      ),
      trend: trend.map((r) => ({
        date: r.bucket,
        count: Number(r.count),
      })),
    };
  }

  // ---------------------------------------------------------------------------
  // GET /analytics/users?period=
  // ---------------------------------------------------------------------------

  async getUsers(period: Period = '30d') {
    const { now, currentStart, previousStart } = this.periodDates(period);
    const bucket = this.truncBucket(period);

    const [byRole, currentCount, previousCount, trend] = await Promise.all([
      this.prisma.user.groupBy({
        by: ['role'],
        _count: true,
        where: {
          createdAt: { gte: currentStart, lte: now },
          deletedAt: null,
        },
      }),
      this.prisma.user.count({
        where: {
          createdAt: { gte: currentStart, lte: now },
          deletedAt: null,
        },
      }),
      this.prisma.user.count({
        where: {
          createdAt: { gte: previousStart, lt: currentStart },
          deletedAt: null,
        },
      }),
      this.prisma.$queryRawUnsafe<
        { bucket: Date; role: string; count: bigint }[]
      >(
        `SELECT date_trunc($1, "createdAt") AS bucket,
                role,
                COUNT(*)                     AS count
         FROM "User"
         WHERE "deletedAt" IS NULL
           AND "createdAt" >= $2
           AND "createdAt" <= $3
         GROUP BY bucket, role
         ORDER BY bucket`,
        bucket,
        currentStart,
        now,
      ),
    ]);

    const growthPercent =
      previousCount === 0
        ? currentCount > 0
          ? 100
          : 0
        : Number(
            (((currentCount - previousCount) / previousCount) * 100).toFixed(2),
          );

    return {
      period,
      newUsers: currentCount,
      previousNewUsers: previousCount,
      growthPercent,
      byRole: byRole.reduce(
        (acc, item) => ({ ...acc, [item.role]: item._count }),
        {} as Record<string, number>,
      ),
      trend: trend.map((r) => ({
        date: r.bucket,
        role: r.role,
        count: Number(r.count),
      })),
    };
  }

  // ---------------------------------------------------------------------------
  // GET /analytics/top-trainers?limit=
  // ---------------------------------------------------------------------------

  async getTopTrainers(limit = 10) {
    const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 50);

    const [byRevenue, byRating] = await Promise.all([
      this.prisma.$queryRawUnsafe<
        {
          trainerId: string;
          firstName: string;
          lastName: string;
          avatar: string | null;
          totalRevenue: number;
          completedBookings: bigint;
        }[]
      >(
        `SELECT b."trainerId",
                u."firstName",
                u."lastName",
                u.avatar,
                COALESCE(SUM(b.amount), 0) AS "totalRevenue",
                COUNT(*)                   AS "completedBookings"
         FROM "Booking" b
         JOIN "User" u ON u.id = b."trainerId"
         WHERE b.status = 'COMPLETED'
         GROUP BY b."trainerId", u."firstName", u."lastName", u.avatar
         ORDER BY "totalRevenue" DESC
         LIMIT $1`,
        safeLimit,
      ),
      this.prisma.trainerProfile.findMany({
        where: { totalReviews: { gt: 0 } },
        orderBy: [{ rating: 'desc' }, { totalReviews: 'desc' }],
        take: safeLimit,
        select: {
          userId: true,
          rating: true,
          totalReviews: true,
          specialization: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
        },
      }),
    ]);

    return {
      byRevenue: byRevenue.map((r) => ({
        trainerId: r.trainerId,
        firstName: r.firstName,
        lastName: r.lastName,
        avatar: r.avatar,
        totalRevenue: Number(r.totalRevenue),
        completedBookings: Number(r.completedBookings),
      })),
      byRating: byRating.map((r) => ({
        trainerId: r.userId,
        firstName: r.user.firstName,
        lastName: r.user.lastName,
        avatar: r.user.avatar,
        rating: Number(r.rating),
        totalReviews: r.totalReviews,
        specialization: r.specialization,
      })),
    };
  }

  // ---------------------------------------------------------------------------
  // GET /analytics/categories
  // ---------------------------------------------------------------------------

  async getCategories() {
    // Bookings per trainer specialization (the closest to "category" in the schema)
    const bySpecialization = await this.prisma.$queryRawUnsafe<
      { specialization: string | null; bookings: bigint; revenue: number }[]
    >(
      `SELECT tp.specialization,
              COUNT(b.id)              AS bookings,
              COALESCE(SUM(b.amount), 0) AS revenue
       FROM "Booking" b
       JOIN "TrainerProfile" tp ON tp."userId" = b."trainerId"
       GROUP BY tp.specialization
       ORDER BY bookings DESC`,
    );

    // Also pull from Skill -> TrainerSkill -> Booking if trainers have tagged skills
    const bySkill = await this.prisma.$queryRawUnsafe<
      { skillName: string; trainers: bigint; bookings: bigint }[]
    >(
      `SELECT s.name       AS "skillName",
              COUNT(DISTINCT ts."trainerId") AS trainers,
              COUNT(DISTINCT b.id)           AS bookings
       FROM "Skill" s
       JOIN "TrainerSkill" ts ON ts."skillId" = s.id
       JOIN "TrainerProfile" tp ON tp.id = ts."trainerId"
       LEFT JOIN "Booking" b ON b."trainerId" = tp."userId"
       GROUP BY s.name
       ORDER BY bookings DESC
       LIMIT 20`,
    );

    return {
      bySpecialization: bySpecialization.map((r) => ({
        specialization: r.specialization || 'Unspecified',
        bookings: Number(r.bookings),
        revenue: Number(r.revenue),
      })),
      bySkill: bySkill.map((r) => ({
        skill: r.skillName,
        trainers: Number(r.trainers),
        bookings: Number(r.bookings),
      })),
    };
  }
}
