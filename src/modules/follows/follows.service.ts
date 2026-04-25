import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { paginate, pageParams } from '../../common/dto/pagination.dto';
import { ListFollowsDto } from './dto/follows.dto';

@Injectable()
export class FollowsService {
  constructor(private readonly prisma: PrismaService) {}

  async follow(followerId: string, followingId: string) {
    if (followerId === followingId) throw new BadRequestException('Cannot follow yourself');
    const target = await this.prisma.user.findFirst({ where: { id: followingId, deletedAt: null } });
    if (!target) throw new NotFoundException('User not found');

    const existing = await this.prisma.follow.findUnique({
      where: { followerId_followingId: { followerId, followingId } },
    });
    if (existing) {
      const profile = await this.prisma.trainerProfile.findUnique({
        where: { userId: followingId },
        select: { followerCount: true },
      });
      return { followerCount: profile?.followerCount ?? 0, isFollowing: true };
    }

    const follower = await this.prisma.user.findUnique({
      where: { id: followerId },
      select: { firstName: true, lastName: true, name: true },
    });
    const followerName = follower ? `${follower.firstName ?? ''} ${follower.lastName ?? ''}`.trim() || follower.name || 'Someone' : 'Someone';

    const { followerCount } = await this.prisma.$transaction(async (tx) => {
      await tx.follow.create({ data: { followerId, followingId } });
      const hasProfile = await tx.trainerProfile.findUnique({
        where: { userId: followingId },
        select: { id: true },
      });
      if (hasProfile) {
        const updated = await tx.trainerProfile.update({
          where: { userId: followingId },
          data: { followerCount: { increment: 1 } },
          select: { followerCount: true },
        });
        return { followerCount: updated.followerCount };
      }
      const count = await tx.follow.count({ where: { followingId } });
      return { followerCount: count };
    });

    // Notify the trainer they have a new follower
    await this.prisma.notification.create({
      data: {
        userId: followingId,
        type: 'FOLLOW',
        channel: 'IN_APP',
        title: 'New Follower',
        message: `${followerName} started following you.`,
        metadata: { followerId },
      },
    }).catch(() => {});

    return { followerCount, isFollowing: true };
  }

  async unfollow(followerId: string, followingId: string) {
    const existing = await this.prisma.follow.findUnique({
      where: { followerId_followingId: { followerId, followingId } },
    });
    if (!existing) {
      const profile = await this.prisma.trainerProfile.findUnique({
        where: { userId: followingId },
        select: { followerCount: true },
      });
      return { followerCount: profile?.followerCount ?? 0, isFollowing: false };
    }

    const { followerCount } = await this.prisma.$transaction(async (tx) => {
      await tx.follow.delete({ where: { followerId_followingId: { followerId, followingId } } });
      const hasProfile = await tx.trainerProfile.findUnique({
        where: { userId: followingId },
        select: { id: true },
      });
      if (hasProfile) {
        const updated = await tx.trainerProfile.update({
          where: { userId: followingId },
          data: { followerCount: { decrement: 1 } },
          select: { followerCount: true },
        });
        // Guard against negative drift
        if (updated.followerCount < 0) {
          await tx.trainerProfile.update({ where: { userId: followingId }, data: { followerCount: 0 } });
          return { followerCount: 0 };
        }
        return { followerCount: updated.followerCount };
      }
      const count = await tx.follow.count({ where: { followingId } });
      return { followerCount: count };
    });

    return { followerCount, isFollowing: false };
  }

  async getFollowers(userId: string, dto: ListFollowsDto) {
    const { page, limit, skip } = pageParams(dto);
    const [rows, total] = await Promise.all([
      this.prisma.follow.findMany({
        where: { followingId: userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          follower: {
            select: {
              id: true, firstName: true, lastName: true, name: true, email: true, avatar: true,
              trainerProfile: {
                select: { id: true, rating: true, specialization: true, hourlyRate: true, currency: true, followerCount: true },
              },
            },
          },
        },
      }),
      this.prisma.follow.count({ where: { followingId: userId } }),
    ]);
    const items = rows.map((r) => ({ id: r.id, createdAt: r.createdAt, user: r.follower }));
    return paginate(items, total, page, limit);
  }

  async getFollowing(userId: string, dto: ListFollowsDto) {
    const { page, limit, skip } = pageParams(dto);
    const [rows, total] = await Promise.all([
      this.prisma.follow.findMany({
        where: { followerId: userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          following: {
            select: {
              id: true, firstName: true, lastName: true, name: true, email: true, avatar: true,
              trainerProfile: {
                select: { id: true, rating: true, specialization: true, hourlyRate: true, currency: true, followerCount: true },
              },
            },
          },
        },
      }),
      this.prisma.follow.count({ where: { followerId: userId } }),
    ]);
    const items = rows.map((r) => ({ id: r.id, createdAt: r.createdAt, user: r.following }));
    return paginate(items, total, page, limit);
  }

  async isFollowing(followerId: string, followingId: string) {
    const existing = await this.prisma.follow.findUnique({
      where: { followerId_followingId: { followerId, followingId } },
    });
    return { isFollowing: !!existing };
  }

  async getStats(userId: string) {
    const [followerCount, followingCount] = await Promise.all([
      this.prisma.follow.count({ where: { followingId: userId } }),
      this.prisma.follow.count({ where: { followerId: userId } }),
    ]);
    return { followerCount, followingCount };
  }
}
