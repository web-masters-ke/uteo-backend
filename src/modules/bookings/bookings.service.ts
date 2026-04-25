import { Injectable, NotFoundException, BadRequestException, ForbiddenException, ConflictException, Logger } from '@nestjs/common';
import { Prisma, BookingStatus } from '@prisma/client';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../../common/services/prisma.service';
import { RedisService } from '../../common/services/redis.service';
import { EscrowService } from '../escrow/escrow.service';
import { WalletService } from '../wallet/wallet.service';
import { NotificationsService } from '../notifications/notifications.service';
import { paginate } from '../../common/dto/pagination.dto';
import { CreateBookingDto, UpdateBookingStatusDto, ListBookingsDto } from './dto/bookings.dto';

const JAAS_APP_ID = process.env.JAAS_APP_ID || 'vpaas-magic-cookie-315e6ce2ff244da49ecbd19f303846d7';
const JAAS_KEY_ID = process.env.JAAS_KEY_ID || '';
const JAAS_PRIVATE_KEY = (process.env.JAAS_PRIVATE_KEY || '').replace(/\\n/g, '\n');

function randomSuffix(len = 4): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function slugify(name: string): string {
  return (name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)) || 'room';
}

function buildJaasUrl(jaasRoomName: string): string {
  return `https://8x8.vc/${JAAS_APP_ID}/${encodeURIComponent(jaasRoomName)}`;
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  PENDING_PAYMENT: ['CONFIRMED','CANCELLED'], CONFIRMED: ['IN_PROGRESS','CANCELLED','NO_SHOW'],
  IN_PROGRESS: ['COMPLETED','DISPUTED'], COMPLETED: [], CANCELLED: [], DISPUTED: ['COMPLETED','CANCELLED'], NO_SHOW: ['CANCELLED'],
};

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly escrowService: EscrowService,
    private readonly walletService: WalletService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(userId: string, dto: CreateBookingDto) {
    // Determine who is the trainer and who is the client
    const callerUser = await this.prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    const isTrainerCreating = callerUser?.role === 'TRAINER' && dto.trainerId === userId;

    let trainerId: string;
    let clientId: string;

    if (isTrainerCreating) {
      // Trainer creating a booking for a client
      trainerId = userId;
      if (dto.clientId) {
        clientId = dto.clientId;
      } else if (dto.clientEmail) {
        // New client — find or create
        let client = await this.prisma.user.findUnique({ where: { email: dto.clientEmail } });
        if (!client) {
          const names = (dto.clientName || '').split(' ');
          client = await this.prisma.user.create({
            data: {
              email: dto.clientEmail,
              phone: dto.clientPhone || null,
              firstName: names[0] || 'Client',
              lastName: names.slice(1).join(' ') || '',
              role: 'CLIENT',
              status: 'ACTIVE',
            },
          });
          // Create wallet for new client
          await this.prisma.wallet.create({ data: { userId: client.id, balance: 0, currency: 'KES' } });

          // Notify the org owner if trainer belongs to one
          const trainerTeam = await this.prisma.teamMember.findFirst({
            where: { userId: trainerId, isActive: true },
            select: { firmId: true },
          });
          if (trainerTeam?.firmId && trainerTeam.firmId !== trainerId) {
            await this.prisma.notification.create({
              data: {
                userId: trainerTeam.firmId,
                type: 'CLIENT_ADDED',
                channel: 'IN_APP',
                title: 'New client added',
                message: `${names[0] || 'A new client'} ${names.slice(1).join(' ')} was added by your team member via a booking.`,
                status: 'PENDING',
              },
            });
          }
        }
        clientId = client.id;
      } else {
        throw new BadRequestException('clientId or clientEmail is required when trainer creates a booking');
      }
    } else {
      // Client booking a trainer
      trainerId = dto.trainerId;
      clientId = userId;
    }

    const trainer = await this.prisma.user.findFirst({ where: { id: trainerId, role: 'TRAINER', deletedAt: null, status: 'ACTIVE' }, include: { trainerProfile: true } });
    if (!trainer) throw new NotFoundException('Trainer not found');
    if (!trainer.trainerProfile) throw new BadRequestException('Trainer has no profile');
    if (clientId === trainerId) throw new BadRequestException('Cannot book yourself');

    // Auto-calculate amount from trainer rate if amount is 0
    let amount = dto.amount;
    if (amount === 0 && trainer.trainerProfile.hourlyRate) {
      amount = Number(trainer.trainerProfile.hourlyRate) * (dto.duration / 60);
    }

    const scheduledAt = new Date(dto.scheduledAt);
    if (scheduledAt <= new Date()) throw new BadRequestException('Scheduled time must be in the future');

    // --- Task 1: Redis slot lock ---
    const lockKey = `slot:${trainerId}:${scheduledAt.toISOString()}`;
    const lockValue = `booking-${userId}-${Date.now()}`;
    const acquired = await this.redis.acquireLock(lockKey, lockValue, 600);
    if (!acquired) throw new ConflictException('This time slot is no longer available');

    let booking: any;
    try {
    booking = await this.prisma.$transaction(async (tx) => {
      const b = await tx.booking.create({ data: { trainerId, clientId, amount, currency: dto.currency||'KES', status: 'PENDING_PAYMENT', sessionType: dto.sessionType, scheduledAt, duration: dto.duration, location: dto.location, meetingLink: dto.meetingLink, notes: dto.notes, courseId: dto.courseId || null, lessonId: dto.lessonId || null } });
      await tx.bookingStatusLog.create({ data: { bookingId: b.id, fromStatus: null, toStatus: 'PENDING_PAYMENT', changedBy: userId } });
      const clientWallet = await tx.wallet.findUnique({ where: { userId: clientId } });
      if (!clientWallet) throw new BadRequestException('Client wallet not found');
      await tx.escrowAccount.create({ data: { bookingId: b.id, payerWalletId: clientWallet.id, amount: dto.amount, currency: dto.currency||'KES', status: 'CREATED' } });
      return b;
    });
    // Release the slot lock after booking is persisted — the booking itself now holds the slot
    await this.redis.releaseLock(lockKey, lockValue);
    } catch (err) {
      // Always release lock on failure
      await this.redis.releaseLock(lockKey, lockValue);
      throw err;
    }

    // --- Generate Jitsi room(s) for virtual/hybrid sessions ---
    if (['VIRTUAL', 'HYBRID'].includes(dto.sessionType) && !dto.meetingLink) {
      const bookingShort = booking.id.split('-')[0];
      const mainJaasName = `ptak-session-${bookingShort}-main-${randomSuffix()}`;
      const mainUrl = buildJaasUrl(mainJaasName);

      await this.prisma.booking.update({ where: { id: booking.id }, data: { meetingLink: mainUrl } });

      const mainRoom = await this.prisma.videoSessionRoom.create({
        data: { bookingId: booking.id, parentRoomId: null, name: 'Main Room', jaasRoomName: mainJaasName, participants: [trainerId, clientId], hostId: trainerId, status: 'OPEN' },
      });

      // Auto-create breakout sub-rooms if requested
      if (dto.breakoutRooms) {
        const { count, assignMode = 'auto' } = dto.breakoutRooms;
        // Sub-participants = all except trainer (who hosts from main)
        const subParticipants = [clientId];
        for (let i = 1; i <= count; i++) {
          const brJaasName = `ptak-session-${bookingShort}-${slugify(`room-${i}`)}-${randomSuffix()}`;
          // Auto: distribute round-robin; manual: put everyone in every room (trainer will reassign)
          const assigned = assignMode === 'auto'
            ? subParticipants.filter((_, idx) => idx % count === i - 1)
            : subParticipants;
          await this.prisma.videoSessionRoom.create({
            data: { bookingId: booking.id, parentRoomId: mainRoom.id, name: `Breakout Room ${i}`, jaasRoomName: brJaasName, participants: [trainerId, ...assigned], hostId: trainerId, status: 'OPEN' },
          });
        }

        // Notify client about room assignment
        await this.prisma.notification.create({
          data: {
            userId: clientId,
            type: 'SESSION_ROOM_ASSIGNED',
            channel: 'IN_APP',
            title: 'Session rooms ready',
            message: `Your session has been prepared with ${count} breakout rooms. Join your assigned room when the session starts.`,
            status: 'PENDING',
          },
        });
      }
    }

    return this.findOne(booking.id);
  }

  async findAll(dto: ListBookingsDto, userId?: string, userRole?: string) {
    const page=Number(dto.page)||1; const limit=Number(dto.limit)||20; const skip=(page-1)*limit;
    const where: Prisma.BookingWhereInput = {};
    if (userId && !['ADMIN','SUPER_ADMIN','SUPPORT'].includes(userRole||'')) where.OR = [{ clientId: userId }, { trainerId: userId }];
    if (dto.status) where.status = dto.status;
    if (dto.trainerId) where.trainerId = dto.trainerId;
    if (dto.clientId) where.clientId = dto.clientId;
    if (dto.dateFrom || dto.dateTo) { where.scheduledAt = {}; if (dto.dateFrom) (where.scheduledAt as any).gte = new Date(dto.dateFrom); if (dto.dateTo) (where.scheduledAt as any).lte = new Date(dto.dateTo); }
    if (dto.search) { where.OR = [{ trainer: { firstName: { contains: dto.search, mode: 'insensitive' } } }, { client: { firstName: { contains: dto.search, mode: 'insensitive' } } }]; }
    const orderBy: any = dto.sortBy==='amount' ? { amount: dto.sortOrder||'desc' } : dto.sortBy==='scheduledAt' ? { scheduledAt: dto.sortOrder||'desc' } : { createdAt: dto.sortOrder||'desc' };
    const [items,total] = await Promise.all([
      this.prisma.booking.findMany({ where, skip, take: limit, orderBy, include: { trainer: { select: { id:true, firstName:true, lastName:true, avatar:true, email:true, trainerProfile: { select: { firmName:true, tier:true, trainerType:true, specialization:true } }, teamMembership: { where: { isActive:true }, select: { firmId:true, role:true, department: { select: { id:true, name:true } }, firm: { select: { id:true, firstName:true, lastName:true, name:true } } }, take:1 } } }, client: { select: { id:true, firstName:true, lastName:true, avatar:true, email:true } }, escrow: { select: { id:true, status:true, amount:true } } } }),
      this.prisma.booking.count({ where }),
    ]);
    return paginate(items, total, page, limit);
  }

  async findOne(id: string) {
    const b = await this.prisma.booking.findUnique({ where: { id }, include: { trainer: { select: { id:true, firstName:true, lastName:true, avatar:true, email:true, phone:true } }, client: { select: { id:true, firstName:true, lastName:true, avatar:true, email:true, phone:true } }, escrow: true, statusLogs: { orderBy: { createdAt: 'desc' } }, reviews: { include: { reviewer: { select: { id:true, firstName:true, lastName:true, avatar:true } } } }, videoRooms: { orderBy: { openedAt: 'asc' }, select: { id: true, parentRoomId: true, name: true, jaasRoomName: true, participants: true, hostId: true, status: true, openedAt: true, closedAt: true } } } });
    // Attach course + lesson details if this is a pre-recorded booking
    if (b && b.courseId) {
      const course = await this.prisma.course.findUnique({ where: { id: b.courseId }, select: { id: true, title: true, thumbnail: true, category: true } });
      const lesson = b.lessonId ? await this.prisma.courseLesson.findUnique({ where: { id: b.lessonId }, select: { id: true, title: true, videoUrl: true, duration: true, sortOrder: true } }) : null;
      (b as any).course = course;
      (b as any).lesson = lesson;
    }
    if (!b) throw new NotFoundException('Booking not found');
    return b;
  }

  async updateStatus(id: string, dto: UpdateBookingStatusDto, userId: string, userRole: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id }, include: { escrow: true } });
    if (!booking) throw new NotFoundException('Booking not found');
    const isParticipant = userId===booking.clientId || userId===booking.trainerId;
    const isAdmin = ['ADMIN','SUPER_ADMIN','SUPPORT'].includes(userRole);
    if (!isParticipant && !isAdmin) throw new ForbiddenException('Not authorized');
    const allowed = VALID_TRANSITIONS[booking.status] || [];
    if (!allowed.includes(dto.status)) throw new BadRequestException(`Cannot transition from ${booking.status} to ${dto.status}`);
    // --- Task 3: Cancellation refund tiers ---
    let refundPercent = 0;
    if (dto.status === 'CANCELLED' && booking.escrow && ['FUNDED', 'HELD'].includes(booking.escrow.status)) {
      const hoursUntil = (new Date(booking.scheduledAt).getTime() - Date.now()) / 3_600_000;
      if (hoursUntil > 48) refundPercent = 100;
      else if (hoursUntil >= 24) refundPercent = 50;
      else refundPercent = 0;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const data: any = { status: dto.status };
      if (dto.status==='CANCELLED') { data.cancellationReason = dto.reason; data.cancelledBy = userId; }
      if (dto.status==='COMPLETED') data.completedAt = new Date();
      const u = await tx.booking.update({ where: { id }, data });
      await tx.bookingStatusLog.create({ data: { bookingId: id, fromStatus: booking.status, toStatus: dto.status, reason: dto.reason, changedBy: userId } });
      if (booking.escrow) {
        if (dto.status==='CONFIRMED' && booking.escrow.status==='CREATED') { await tx.escrowAccount.update({ where: { id: booking.escrow.id }, data: { status: 'FUNDED', fundedAt: new Date() } }); await tx.escrowStatusLog.create({ data: { escrowId: booking.escrow.id, fromStatus: 'CREATED', toStatus: 'FUNDED', changedBy: userId } }); }
        if (dto.status==='DISPUTED') { await tx.escrowAccount.update({ where: { id: booking.escrow.id }, data: { status: 'FROZEN' } }); await tx.escrowStatusLog.create({ data: { escrowId: booking.escrow.id, fromStatus: booking.escrow.status, toStatus: 'FROZEN', reason: dto.reason, changedBy: userId } }); }
        if (dto.status === 'CANCELLED' && refundPercent >= 0 && ['FUNDED', 'HELD'].includes(booking.escrow.status)) {
          const totalAmount = Number(booking.escrow.amount);
          const clientRefund = Math.round(totalAmount * (refundPercent / 100) * 100) / 100;
          const trainerPortion = Math.round((totalAmount - clientRefund) * 100) / 100;
          if (clientRefund > 0) {
            await this.walletService.creditWallet(booking.escrow.payerWalletId, clientRefund, 'REFUND', booking.escrow.id, `Cancellation refund (${refundPercent}%) for booking ${id}`, tx);
          }
          if (trainerPortion > 0) {
            const trainerWallet = await tx.wallet.findUnique({ where: { userId: booking.trainerId } });
            if (trainerWallet) {
              await this.walletService.creditWallet(trainerWallet.id, trainerPortion, 'CANCELLATION_FEE', booking.escrow.id, `Cancellation fee (${100 - refundPercent}%) for booking ${id}`, tx);
            }
          }
          const newEscrowStatus = clientRefund === totalAmount ? 'REFUNDED' : 'RELEASED';
          await tx.escrowAccount.update({ where: { id: booking.escrow.id }, data: { status: newEscrowStatus } });
          await tx.escrowStatusLog.create({ data: { escrowId: booking.escrow.id, fromStatus: booking.escrow.status, toStatus: newEscrowStatus, reason: `Cancellation: ${refundPercent}% refund to client`, changedBy: userId } });
        }
      }
      return u;
    });

    // Fire booking confirmation notifications after the DB transaction commits.
    // We look up the client and trainer users so the notification service has
    // email, phone, and FCM tokens available.
    if (dto.status === 'CONFIRMED') {
      this.prisma.user
        .findMany({
          where: { id: { in: [booking.clientId, booking.trainerId] } },
          select: { id: true, email: true, firstName: true, lastName: true, phone: true, fcmTokens: true },
        })
        .then((users) => {
          const clientUser = users.find((u) => u.id === booking.clientId);
          const trainerUser = users.find((u) => u.id === booking.trainerId);
          if (clientUser && trainerUser) {
            this.notificationsService
              .sendBookingConfirmation(
                { id: booking.id, scheduledAt: booking.scheduledAt, duration: booking.duration, sessionType: booking.sessionType, amount: Number(booking.amount), currency: booking.currency },
                { id: clientUser.id, email: clientUser.email, firstName: clientUser.firstName, lastName: clientUser.lastName, phone: clientUser.phone, fcmTokens: clientUser.fcmTokens },
                { id: trainerUser.id, email: trainerUser.email, firstName: trainerUser.firstName, lastName: trainerUser.lastName },
              )
              .catch((err) => this.logger.error(`sendBookingConfirmation failed for booking ${booking.id}: ${err}`));
          }
        })
        .catch((err) => this.logger.error(`Failed to load users for booking confirmation notifications: ${err}`));
    }

    return this.findOne(updated.id);
  }

  async getStatusLogs(id: string) { const b = await this.prisma.booking.findUnique({ where: { id } }); if (!b) throw new NotFoundException('Booking not found'); return this.prisma.bookingStatusLog.findMany({ where: { bookingId: id }, orderBy: { createdAt: 'desc' } }); }

  async reschedule(id: string, userId: string, userRole: string, newScheduledAt: string, reason?: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id }, include: { escrow: true } });
    if (!booking) throw new NotFoundException('Booking not found');
    const isParticipant = userId === booking.clientId || userId === booking.trainerId;
    const isAdmin = ['ADMIN', 'SUPER_ADMIN', 'SUPPORT'].includes(userRole);
    if (!isParticipant && !isAdmin) throw new ForbiddenException('Not authorized');
    if (!['PENDING_PAYMENT', 'CONFIRMED'].includes(booking.status)) throw new BadRequestException('Can only reschedule pending or confirmed bookings');
    const newDate = new Date(newScheduledAt);
    if (newDate <= new Date()) throw new BadRequestException('New date must be in the future');

    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.booking.update({
        where: { id },
        data: { scheduledAt: newDate, rescheduledAt: new Date(), rescheduledBy: userId },
      });
      await tx.bookingStatusLog.create({
        data: { bookingId: id, fromStatus: booking.status, toStatus: booking.status, reason: reason || `Rescheduled to ${newDate.toISOString()}`, changedBy: userId },
      });
      return u;
    });
    return this.findOne(updated.id);
  }

  // --- Task 2: Session completion confirmation ---
  async confirmSessionCompletion(bookingId: string, userId: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId }, include: { escrow: true } });
    if (!booking) throw new NotFoundException('Booking not found');
    const isTrainer = booking.trainerId === userId;
    const isClient = booking.clientId === userId;
    if (!isTrainer && !isClient) throw new ForbiddenException('Not a participant of this booking');
    if (!['CONFIRMED', 'IN_PROGRESS'].includes(booking.status)) {
      throw new BadRequestException('Session must be CONFIRMED or IN_PROGRESS to confirm completion');
    }

    const updateData: any = {};
    if (isTrainer && !booking.trainerConfirmed) {
      updateData.trainerConfirmed = true;
      updateData.trainerConfirmedAt = new Date();
    } else if (isClient && !booking.clientConfirmed) {
      updateData.clientConfirmed = true;
      updateData.clientConfirmedAt = new Date();
    } else {
      return { confirmed: true, bothConfirmed: booking.trainerConfirmed && booking.clientConfirmed, bookingStatus: booking.status };
    }

    const trainerConfirmed = isTrainer ? true : booking.trainerConfirmed;
    const clientConfirmed = isClient ? true : booking.clientConfirmed;
    const bothConfirmed = trainerConfirmed && clientConfirmed;

    if (bothConfirmed) {
      updateData.status = 'COMPLETED';
      updateData.completedAt = new Date();
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.booking.update({ where: { id: bookingId }, data: updateData });
      if (bothConfirmed) {
        await tx.bookingStatusLog.create({ data: { bookingId, fromStatus: booking.status, toStatus: 'COMPLETED', reason: 'Both participants confirmed session completion', changedBy: userId } });
        // Trigger escrow release when both confirmed
        if (booking.escrow && ['FUNDED', 'HELD'].includes(booking.escrow.status)) {
          // Mark escrow for release (actual release happens via escrow service)
          await tx.escrowAccount.update({ where: { id: booking.escrow.id }, data: { status: 'HELD' } });
        }
      }
      return u;
    });

    // Release escrow outside transaction to avoid nesting
    if (bothConfirmed && booking.escrow && ['FUNDED', 'HELD'].includes(booking.escrow.status)) {
      try {
        await this.escrowService.release({ bookingId, reason: 'Session completed — both parties confirmed' }, userId);
      } catch (e) {
        // Log but don't fail — escrow release can be retried manually
      }
    }

    return { confirmed: true, bothConfirmed, bookingStatus: updated.status };
  }

  async getStats() {
    const [byStatus, totalRevenue, recent] = await Promise.all([
      this.prisma.booking.groupBy({ by: ['status'], _count: true }),
      this.prisma.booking.aggregate({ _sum: { amount: true }, where: { status: 'COMPLETED' } }),
      this.prisma.booking.count({ where: { createdAt: { gte: new Date(Date.now()-30*24*60*60*1000) } } }),
    ]);
    return { byStatus: byStatus.reduce((a,i)=>({...a,[i.status]:i._count}),{}), totalRevenue: totalRevenue._sum.amount||0, recentBookings: recent };
  }

  /**
   * My Clients — paginated, deduplicated client list for a trainer
   * Aggregates booking stats server-side so the frontend doesn't need to scan all bookings.
   */
  async myClients(trainerId: string, q: { page: number; limit: number; search?: string; filter?: string }) {
    const page = Math.max(1, q.page);
    const limit = Math.min(Math.max(1, q.limit), 50);
    const skip = (page - 1) * limit;

    // Base where clause — all bookings where this user is the trainer
    const baseWhere: Prisma.BookingWhereInput = { trainerId };

    // Find distinct client IDs with search
    const searchWhere: Prisma.UserWhereInput | undefined = q.search ? {
      OR: [
        { firstName: { contains: q.search, mode: 'insensitive' } },
        { lastName: { contains: q.search, mode: 'insensitive' } },
        { email: { contains: q.search, mode: 'insensitive' } },
        { phone: { contains: q.search, mode: 'insensitive' } },
      ],
    } : undefined;

    // Group bookings by clientId to dedupe and aggregate
    const grouped = await this.prisma.booking.groupBy({
      by: ['clientId'],
      where: baseWhere,
      _count: { _all: true },
      _sum: { amount: true },
      _max: { scheduledAt: true },
    });

    // Fetch user records for those clients (filtered by search if provided)
    const clientIds = grouped.map(g => g.clientId);
    const bookingClients = await this.prisma.user.findMany({
      where: { id: { in: clientIds }, ...(searchWhere || {}) },
      select: { id: true, firstName: true, lastName: true, email: true, phone: true, avatar: true, createdAt: true },
    });

    // Also fetch directly-assigned learners who have no bookings yet
    const directLearners = await this.prisma.user.findMany({
      where: { assignedTrainerId: trainerId, id: { notIn: clientIds }, ...(searchWhere || {}) },
      select: { id: true, firstName: true, lastName: true, email: true, phone: true, avatar: true, createdAt: true },
    });

    // Merge aggregates
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    const enriched = [
      ...bookingClients.map(c => {
        const g = grouped.find(g => g.clientId === c.id)!;
        const lastAt = g._max.scheduledAt ? new Date(g._max.scheduledAt).getTime() : 0;
        const active = lastAt > thirtyDaysAgo;
        return { ...c, totalBookings: g._count._all, totalSpent: Number(g._sum.amount || 0), lastSessionAt: g._max.scheduledAt, active };
      }),
      ...directLearners.map(c => ({
        ...c, totalBookings: 0, totalSpent: 0, lastSessionAt: null,
        active: new Date(c.createdAt).getTime() > thirtyDaysAgo,
      })),
    ];

    // Apply filter
    let filtered = enriched;
    if (q.filter === 'active') filtered = enriched.filter(c => c.active);
    else if (q.filter === 'inactive') filtered = enriched.filter(c => !c.active);

    // Sort: active first, then most recent session
    filtered.sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1;
      const aT = a.lastSessionAt ? new Date(a.lastSessionAt).getTime() : 0;
      const bT = b.lastSessionAt ? new Date(b.lastSessionAt).getTime() : 0;
      return bT - aT;
    });

    const total = filtered.length;
    const items = filtered.slice(skip, skip + limit);
    const activeCount = enriched.filter(c => c.active).length;
    const newThisMonth = enriched.filter(c => new Date(c.createdAt).getTime() > thirtyDaysAgo).length;
    const totalRevenue = enriched.reduce((s, c) => s + c.totalSpent, 0);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      stats: { totalClients: enriched.length, activeCount, newThisMonth, totalRevenue },
    };
  }

  /**
   * Generate a short-lived JaaS JWT for the calling user on a specific booking.
   * Trainer → moderator: true. Client / team member → moderator: false.
   * The token covers all rooms in the booking (room: '*').
   */
  async generateJaasToken(bookingId: string, userId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: { id: true, trainerId: true, clientId: true, scheduledAt: true, duration: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    // Allow trainer, client, and team members of the trainer's firm
    const isTrainer = userId === booking.trainerId;
    const isClient = userId === booking.clientId;
    let isTeamMember = false;
    if (!isTrainer && !isClient) {
      const membership = await this.prisma.teamMember.findFirst({
        where: { firmId: booking.trainerId, userId, isActive: true },
        select: { id: true },
      });
      isTeamMember = !!membership;
    }
    if (!isTrainer && !isClient && !isTeamMember) {
      throw new ForbiddenException('Not a participant of this booking');
    }

    const userRecord = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true, email: true, avatar: true },
    });
    if (!userRecord) throw new NotFoundException('User not found');

    if (!JAAS_APP_ID || !JAAS_KEY_ID || !JAAS_PRIVATE_KEY) {
      throw new BadRequestException('JaaS is not configured on this server');
    }

    const now = Math.floor(Date.now() / 1000);
    // Token valid for: from booking time − 30 min to booking time + duration + 60 min buffer
    const scheduledTs = Math.floor(new Date(booking.scheduledAt).getTime() / 1000);
    const exp = scheduledTs + (booking.duration * 60) + 3600;
    const actualExp = Math.max(exp, now + 7200); // at least 2 h from now

    const payload = {
      iss: 'chat',
      sub: JAAS_APP_ID,
      aud: 'jitsi',
      iat: now,
      nbf: now - 10,
      exp: actualExp,
      room: '*',
      context: {
        user: {
          id: userId,
          name: `${userRecord.firstName || ''} ${userRecord.lastName || ''}`.trim() || userRecord.email,
          email: userRecord.email,
          avatar: userRecord.avatar || '',
          moderator: isTrainer ? 'true' : 'false',
        },
        features: {
          livestreaming: 'false',
          'outbound-call': 'false',
          transcription: 'false',
          recording: isTrainer ? 'true' : 'false',
        },
      },
    };

    const token = jwt.sign(payload, JAAS_PRIVATE_KEY, {
      algorithm: 'RS256',
      keyid: `${JAAS_APP_ID}/${JAAS_KEY_ID}`,
    });

    return { token, moderator: isTrainer };
  }
}
