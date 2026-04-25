import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/services/prisma.service';
import { paginate } from '../../common/dto/pagination.dto';
import { CreateReviewDto, UpdateReviewDto, ListReviewsDto } from './dto/reviews.dto';
@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}
  async create(userId: string, dto: CreateReviewDto) {
    const booking = await this.prisma.booking.findUnique({ where: { id: dto.bookingId } });
    if (!booking) throw new NotFoundException('Booking not found');
    if (!['COMPLETED', 'IN_PROGRESS'].includes(booking.status)) {
      throw new BadRequestException('Can only review a session that is in progress or completed');
    }
    const isClient = booking.clientId === userId;
    const isTrainer = booking.trainerId === userId;
    if (!isClient && !isTrainer) throw new ForbiddenException('Only a booking participant can leave a review');
    const existing = await this.prisma.review.findFirst({ where: { bookingId: dto.bookingId, reviewerId: userId } });
    if (existing) throw new BadRequestException('You have already reviewed this session');
    // revieweeId: client reviews the trainer; trainer reviews the client
    const revieweeId = isClient ? booking.trainerId : booking.clientId;
    return this.prisma.$transaction(async (tx) => {
      // Auto-complete an IN_PROGRESS booking when a review is submitted
      if (booking.status === 'IN_PROGRESS') {
        await tx.booking.update({ where: { id: dto.bookingId }, data: { status: 'COMPLETED', completedAt: new Date() } });
        await tx.bookingStatusLog.create({ data: { bookingId: dto.bookingId, fromStatus: 'IN_PROGRESS', toStatus: 'COMPLETED', reason: 'Auto-completed on review submission', changedBy: userId } });
      }
      const review = await tx.review.create({
        data: { bookingId: dto.bookingId, reviewerId: userId, revieweeId, trainerId: booking.trainerId, rating: dto.rating, comment: dto.comment },
        include: { reviewer: { select: { id:true, firstName:true, lastName:true, avatar:true } }, reviewee: { select: { id:true, firstName:true, lastName:true, avatar:true } } },
      });
      // Refresh trainer aggregate stats
      const stats = await tx.review.aggregate({ where: { trainerId: booking.trainerId, isVisible: true }, _avg: { rating: true }, _count: { rating: true } });
      await tx.trainerProfile.updateMany({ where: { userId: booking.trainerId }, data: { rating: stats._avg.rating||0, totalReviews: stats._count.rating||0 } });
      return review;
    });
  }
  async findAll(dto: ListReviewsDto, userRole?: string) { const page=Number(dto.page)||1; const limit=Number(dto.limit)||20; const skip=(page-1)*limit; const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN'; const where: Prisma.ReviewWhereInput = {}; if (dto.isVisible === 'true') where.isVisible = true; else if (dto.isVisible === 'false') where.isVisible = false; else if (!isAdmin) where.isVisible = true; if (dto.trainerId) where.trainerId = dto.trainerId; if (dto.reviewerId) where.reviewerId = dto.reviewerId; if (dto.rating) where.rating = dto.rating; if (dto.search) { where.OR = [{ comment: { contains: dto.search, mode: 'insensitive' } }, { reviewer: { OR: [{ firstName: { contains: dto.search, mode: 'insensitive' } }, { lastName: { contains: dto.search, mode: 'insensitive' } }] } }, { trainer: { OR: [{ firstName: { contains: dto.search, mode: 'insensitive' } }, { lastName: { contains: dto.search, mode: 'insensitive' } }] } }]; } const [items,total] = await Promise.all([this.prisma.review.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' }, include: { reviewer: { select: { id:true, firstName:true, lastName:true, avatar:true } }, trainer: { select: { id:true, firstName:true, lastName:true, avatar:true } }, booking: { select: { id:true, sessionType:true, scheduledAt:true } } } }), this.prisma.review.count({ where })]); return paginate(items, total, page, limit); }
  async findOne(id: string) { const r = await this.prisma.review.findUnique({ where: { id }, include: { reviewer: { select: { id:true, firstName:true, lastName:true, avatar:true } }, trainer: { select: { id:true, firstName:true, lastName:true, avatar:true } }, booking: { select: { id:true, sessionType:true, scheduledAt:true } } } }); if (!r) throw new NotFoundException('Review not found'); return r; }
  async update(id: string, userId: string, dto: UpdateReviewDto, userRole?: string) { const r = await this.prisma.review.findUnique({ where: { id } }); if (!r) throw new NotFoundException('Review not found'); const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN'; if (!isAdmin && r.reviewerId !== userId) throw new ForbiddenException('Not your review'); return this.prisma.$transaction(async (tx) => { const updated = await tx.review.update({ where: { id }, data: { rating: dto.rating, comment: dto.comment }, include: { reviewer: { select: { id:true, firstName:true, lastName:true, avatar:true } }, trainer: { select: { id:true, firstName:true, lastName:true, avatar:true } }, booking: { select: { id:true, sessionType:true, scheduledAt:true } } } }); if (dto.rating != null) { const stats = await tx.review.aggregate({ where: { trainerId: r.trainerId, isVisible: true }, _avg: { rating: true }, _count: { rating: true } }); await tx.trainerProfile.updateMany({ where: { userId: r.trainerId }, data: { rating: stats._avg.rating||0, totalReviews: stats._count.rating||0 } }); } return updated; }); }
  async remove(id: string, userId: string, userRole?: string) { const r = await this.prisma.review.findUnique({ where: { id } }); if (!r) throw new NotFoundException('Review not found'); const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN'; if (!isAdmin && r.reviewerId !== userId) throw new ForbiddenException('Not your review'); return this.prisma.$transaction(async (tx) => { await tx.review.delete({ where: { id } }); const stats = await tx.review.aggregate({ where: { trainerId: r.trainerId, isVisible: true }, _avg: { rating: true }, _count: { rating: true } }); await tx.trainerProfile.updateMany({ where: { userId: r.trainerId }, data: { rating: stats._avg.rating||0, totalReviews: stats._count.rating||0 } }); return { message: 'Review deleted' }; }); }
  async hide(id: string) { await this.prisma.review.update({ where: { id }, data: { isVisible: false } }); return { message: 'Review hidden' }; }
  async show(id: string) { await this.prisma.review.update({ where: { id }, data: { isVisible: true } }); return { message: 'Review visible' }; }
  async getGlobalStats() { const [s, d] = await Promise.all([this.prisma.review.aggregate({ _avg: { rating: true }, _count: { rating: true } }), this.prisma.review.groupBy({ by: ['rating'], _count: true })]); return { averageRating: s._avg.rating||0, totalReviews: s._count.rating||0, distribution: d.reduce((a,i)=>({...a,[i.rating]:i._count}),{1:0,2:0,3:0,4:0,5:0}) }; }
  async getTrainerStats(trainerId: string) { const [s, d] = await Promise.all([this.prisma.review.aggregate({ where: { trainerId, isVisible: true }, _avg: { rating: true }, _count: { rating: true } }), this.prisma.review.groupBy({ by: ['rating'], where: { trainerId, isVisible: true }, _count: true })]); return { averageRating: s._avg.rating||0, totalReviews: s._count.rating||0, distribution: d.reduce((a,i)=>({...a,[i.rating]:i._count}),{1:0,2:0,3:0,4:0,5:0}) }; }

  // --- Task 9: Trainer response to review ---
  async respondToReview(reviewId: string, trainerId: string, responseText: string) {
    const review = await this.prisma.review.findUnique({
      where: { id: reviewId },
      include: { booking: { select: { trainerId: true } } },
    });
    if (!review) throw new NotFoundException('Review not found');
    // Verify the review is for this trainer's booking
    if (review.booking.trainerId !== trainerId && review.trainerId !== trainerId) {
      throw new ForbiddenException('You can only respond to reviews for your own sessions');
    }
    if (review.trainerResponse) {
      throw new BadRequestException('You have already responded to this review');
    }
    return this.prisma.review.update({
      where: { id: reviewId },
      data: { trainerResponse: responseText, trainerRespondedAt: new Date() },
      include: {
        reviewer: { select: { id: true, firstName: true, lastName: true, avatar: true } },
        trainer: { select: { id: true, firstName: true, lastName: true, avatar: true } },
        booking: { select: { id: true, sessionType: true, scheduledAt: true } },
      },
    });
  }
}
