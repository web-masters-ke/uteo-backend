import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';

type Tier = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';

export interface PerformanceOptions {
  periodDays?: number;
}

export interface PerformanceReport {
  userId: string;
  period: { from: string; to: string; days: number };
  summary: {
    totalBookings: number;
    completedBookings: number;
    cancelledBookings: number;
    noShowBookings: number;
    completionRate: number;
    totalRevenue: number;
    avgBookingValue: number;
  };
  reviews: {
    count: number;
    avgRating: number;
    ratingDistribution: Record<string, number>;
  };
  disputes: {
    count: number;
    openCount: number;
    disputeRate: number;
  };
  responsiveness: {
    avgFirstResponseMins: number;
    samplesConsidered: number;
  };
  compositeScore: number;
  scoreBreakdown: {
    completion: number;
    satisfaction: number;
    disputes: number;
    responsiveness: number;
  };
  tier: Tier;
}

@Injectable()
export class PerformanceService {
  constructor(private readonly prisma: PrismaService) {}

  async getUserPerformance(
    userId: string,
    opts: PerformanceOptions = {},
  ): Promise<PerformanceReport> {
    const days =
      opts.periodDays && opts.periodDays > 0 && opts.periodDays <= 3650
        ? Math.floor(opts.periodDays)
        : 90;

    const to = new Date();
    const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);

    // Ensure user exists. Throw 404 so callers can differentiate "no user" from "no data".
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('User not found');

    // ---------------------------------------------------------------------
    // Bookings — count as trainer within window (scheduledAt within period,
    // OR createdAt within period for pending/cancelled that never got a
    // schedule date realised). We use scheduledAt for consistency with
    // dashboard conventions.
    // ---------------------------------------------------------------------
    const bookingWhere = {
      trainerId: userId,
      scheduledAt: { gte: from, lte: to },
    };

    const [byStatusRaw, revenueAgg, totalBookings] = await Promise.all([
      this.prisma.booking.groupBy({
        by: ['status'],
        _count: true,
        where: bookingWhere,
      }),
      this.prisma.booking.aggregate({
        _sum: { amount: true },
        _avg: { amount: true },
        where: { ...bookingWhere, status: 'COMPLETED' },
      }),
      this.prisma.booking.count({ where: bookingWhere }),
    ]);

    const statusMap: Record<string, number> = {};
    for (const row of byStatusRaw) statusMap[row.status] = row._count;

    const completedBookings = statusMap['COMPLETED'] || 0;
    const cancelledBookings = statusMap['CANCELLED'] || 0;
    const noShowBookings = statusMap['NO_SHOW'] || 0;
    const closedOutcomes =
      completedBookings + cancelledBookings + noShowBookings;
    const completionRate =
      closedOutcomes > 0 ? completedBookings / closedOutcomes : 0;
    const totalRevenue = Number(revenueAgg._sum.amount || 0);
    const avgBookingValue = Number(revenueAgg._avg.amount || 0);

    // ---------------------------------------------------------------------
    // Reviews — about this user as trainer within window
    // ---------------------------------------------------------------------
    const reviewWhere = {
      trainerId: userId,
      createdAt: { gte: from, lte: to },
    };

    const [reviewAgg, reviewDist] = await Promise.all([
      this.prisma.review.aggregate({
        _avg: { rating: true },
        _count: true,
        where: reviewWhere,
      }),
      this.prisma.review.groupBy({
        by: ['rating'],
        _count: true,
        where: reviewWhere,
      }),
    ]);

    const ratingDistribution: Record<string, number> = {
      '1': 0,
      '2': 0,
      '3': 0,
      '4': 0,
      '5': 0,
    };
    for (const r of reviewDist) {
      const key = String(r.rating);
      if (key in ratingDistribution) ratingDistribution[key] = r._count;
    }
    const reviewCount = reviewAgg._count || 0;
    const avgRating = Number(reviewAgg._avg.rating || 0);

    // ---------------------------------------------------------------------
    // Disputes — filed against this user within window
    // ---------------------------------------------------------------------
    const disputeWhere = {
      againstId: userId,
      createdAt: { gte: from, lte: to },
    };

    const [disputeCount, openDisputeCount] = await Promise.all([
      this.prisma.dispute.count({ where: disputeWhere }),
      this.prisma.dispute.count({
        where: { ...disputeWhere, status: { in: ['OPEN', 'UNDER_REVIEW'] } },
      }),
    ]);

    const disputeRate = totalBookings > 0 ? disputeCount / totalBookings : 0;

    // ---------------------------------------------------------------------
    // Responsiveness — avg first-response time (minutes) in booking
    // conversations for this user. For each conversation they participate in
    // within the window, find the first inbound message (from another user)
    // and the first subsequent reply from this user. Averaged across all
    // such pairs.
    // ---------------------------------------------------------------------
    const { avgFirstResponseMins, samplesConsidered } =
      await this.computeResponsiveness(userId, from, to);

    // ---------------------------------------------------------------------
    // Scoring
    // ---------------------------------------------------------------------
    const completionScore = completionRate * 30;
    const satisfactionScore =
      reviewCount > 0 ? ((avgRating - 1) / 4) * 30 : 0;
    const disputesScore = Math.max(0, 20 - disputeRate * 100);
    const responsivenessScore =
      samplesConsidered > 0
        ? Math.max(0, 20 - avgFirstResponseMins / 60)
        : 20; // if no samples, do not penalise

    const rawComposite =
      completionScore + satisfactionScore + disputesScore + responsivenessScore;
    const composite = Math.round(Math.min(100, Math.max(0, rawComposite)) * 10) / 10;

    let tier: Tier = 'BRONZE';
    if (composite >= 90) tier = 'PLATINUM';
    else if (composite >= 75) tier = 'GOLD';
    else if (composite >= 60) tier = 'SILVER';

    return {
      userId,
      period: { from: from.toISOString(), to: to.toISOString(), days },
      summary: {
        totalBookings,
        completedBookings,
        cancelledBookings,
        noShowBookings,
        completionRate: round4(completionRate),
        totalRevenue: round2(totalRevenue),
        avgBookingValue: round2(avgBookingValue),
      },
      reviews: {
        count: reviewCount,
        avgRating: round2(avgRating),
        ratingDistribution,
      },
      disputes: {
        count: disputeCount,
        openCount: openDisputeCount,
        disputeRate: round4(disputeRate),
      },
      responsiveness: {
        avgFirstResponseMins: round2(avgFirstResponseMins),
        samplesConsidered,
      },
      compositeScore: composite,
      scoreBreakdown: {
        completion: round2(completionScore),
        satisfaction: round2(satisfactionScore),
        disputes: round2(disputesScore),
        responsiveness: round2(responsivenessScore),
      },
      tier,
    };
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private async computeResponsiveness(
    userId: string,
    from: Date,
    to: Date,
  ): Promise<{ avgFirstResponseMins: number; samplesConsidered: number }> {
    // For each conversation this user participates in, find response gaps:
    // every time the user sends a message and the immediately-preceding
    // message (within the same conversation, within window) came from a
    // different user, record (this.createdAt - prev.createdAt) in minutes.
    //
    // This captures "time to respond to the last inbound message", which is
    // a reasonable proxy for first-response latency when threaded across a
    // multi-message conversation.
    type Row = { diffmins: number };
    const rows = await this.prisma.$queryRawUnsafe<Row[]>(
      `WITH user_convos AS (
         SELECT cp."conversationId"
         FROM "ConversationParticipant" cp
         WHERE cp."userId" = $1
       ),
       windowed AS (
         SELECT m.id,
                m."conversationId",
                m."senderId",
                m."createdAt",
                LAG(m."senderId")  OVER (PARTITION BY m."conversationId" ORDER BY m."createdAt") AS prev_sender,
                LAG(m."createdAt") OVER (PARTITION BY m."conversationId" ORDER BY m."createdAt") AS prev_created
         FROM "Message" m
         JOIN user_convos uc ON uc."conversationId" = m."conversationId"
         WHERE m."createdAt" >= $2 AND m."createdAt" <= $3
       )
       SELECT EXTRACT(EPOCH FROM ("createdAt" - prev_created)) / 60.0 AS diffmins
       FROM windowed
       WHERE "senderId" = $1
         AND prev_sender IS NOT NULL
         AND prev_sender <> $1
         AND prev_created IS NOT NULL`,
      userId,
      from,
      to,
    );

    if (!rows.length) {
      return { avgFirstResponseMins: 0, samplesConsidered: 0 };
    }
    // Cap pathological gaps at 72 hours so a week-long silence doesn't nuke the score.
    const CAP_MINS = 72 * 60;
    const capped = rows.map((r) => Math.min(Number(r.diffmins) || 0, CAP_MINS));
    const avg = capped.reduce((s, v) => s + v, 0) / capped.length;
    return { avgFirstResponseMins: avg, samplesConsidered: capped.length };
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
