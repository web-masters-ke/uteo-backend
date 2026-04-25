import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/services/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { CommissionsService } from '../commissions/commissions.service';
import {
  CreateMilestoneDto,
  UpdateMilestoneDto,
  DisputeMilestoneDto,
  RecordAttendanceDto,
} from './dto/milestones.dto';

@Injectable()
export class MilestonesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
    private readonly commissionsService: CommissionsService,
  ) {}

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private async _getBookingOrThrow(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { escrow: true, milestones: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    return booking;
  }

  private _isAdmin(role?: string) {
    return ['ADMIN', 'SUPER_ADMIN', 'SUPPORT', 'FINANCE_ADMIN'].includes(
      role || '',
    );
  }

  /** Get or create the PTAK platform wallet (mirrors EscrowService) */
  private async _getOrCreatePlatformWallet(tx: Prisma.TransactionClient) {
    const setting = await tx.systemSetting.findUnique({
      where: { key: 'platform.wallet_id' },
    });
    if (setting) {
      const wallet = await tx.wallet.findUnique({
        where: { id: setting.value as string },
      });
      if (wallet) return wallet;
    }
    const admin = await tx.user.findFirst({
      where: { role: 'SUPER_ADMIN' },
      orderBy: { createdAt: 'asc' },
    });
    if (!admin) throw new BadRequestException('No admin user found for platform wallet');
    let wallet = await tx.wallet.findUnique({ where: { userId: admin.id } });
    if (!wallet) {
      wallet = await tx.wallet.create({
        data: { userId: admin.id, balance: 0, currency: 'KES' },
      });
    }
    await tx.systemSetting.upsert({
      where: { key: 'platform.wallet_id' },
      create: {
        key: 'platform.wallet_id',
        value: wallet.id as any,
        category: 'platform',
      },
      update: { value: wallet.id as any },
    });
    return wallet;
  }

  // ---------------------------------------------------------------------------
  // CRUD
  // ---------------------------------------------------------------------------

  async create(bookingId: string, userId: string, dto: CreateMilestoneDto) {
    const booking = await this._getBookingOrThrow(bookingId);
    if (booking.trainerId !== userId) {
      throw new ForbiddenException('Only the trainer on this booking can create milestones');
    }
    const existingSum = booking.milestones.reduce(
      (s, m) => s + Number(m.amount),
      0,
    );
    const bookingAmount = Number(booking.amount);
    if (existingSum + Number(dto.amount) > bookingAmount + 0.001) {
      throw new BadRequestException(
        `Sum of milestone amounts (${existingSum + Number(dto.amount)}) exceeds booking amount (${bookingAmount})`,
      );
    }
    const orderIndex =
      dto.orderIndex ?? booking.milestones.length; // append at end by default
    return this.prisma.milestone.create({
      data: {
        bookingId,
        title: dto.title,
        description: dto.description,
        amount: dto.amount,
        orderIndex,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      },
    });
  }

  async listForBooking(bookingId: string, userId: string, userRole?: string) {
    const booking = await this._getBookingOrThrow(bookingId);
    const isParty = booking.trainerId === userId || booking.clientId === userId;
    if (!isParty && !this._isAdmin(userRole)) {
      throw new ForbiddenException('Not a participant in this booking');
    }
    const items = await this.prisma.milestone.findMany({
      where: { bookingId },
      orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
      include: {
        _count: { select: { attendance: true } },
      },
    });
    const totalAmount = items.reduce((s, m) => s + Number(m.amount), 0);
    return {
      items,
      bookingAmount: Number(booking.amount),
      totalMilestoneAmount: totalAmount,
      remaining: Number(booking.amount) - totalAmount,
    };
  }

  async update(milestoneId: string, userId: string, dto: UpdateMilestoneDto) {
    const milestone = await this.prisma.milestone.findUnique({
      where: { id: milestoneId },
      include: { booking: { include: { milestones: true } } },
    });
    if (!milestone) throw new NotFoundException('Milestone not found');
    if (milestone.booking.trainerId !== userId) {
      throw new ForbiddenException('Only the trainer can update milestones');
    }
    if (milestone.status !== 'PENDING') {
      throw new BadRequestException(
        `Cannot edit milestone with status ${milestone.status} — only PENDING milestones are editable`,
      );
    }
    // Re-check sum if amount changes
    if (dto.amount != null) {
      const otherSum = milestone.booking.milestones
        .filter((m) => m.id !== milestoneId)
        .reduce((s, m) => s + Number(m.amount), 0);
      const bookingAmount = Number(milestone.booking.amount);
      if (otherSum + Number(dto.amount) > bookingAmount + 0.001) {
        throw new BadRequestException(
          `Sum of milestone amounts (${otherSum + Number(dto.amount)}) exceeds booking amount (${bookingAmount})`,
        );
      }
    }
    return this.prisma.milestone.update({
      where: { id: milestoneId },
      data: {
        title: dto.title,
        description: dto.description,
        amount: dto.amount,
        orderIndex: dto.orderIndex,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      },
    });
  }

  async markDelivered(milestoneId: string, userId: string) {
    const milestone = await this.prisma.milestone.findUnique({
      where: { id: milestoneId },
      include: { booking: true },
    });
    if (!milestone) throw new NotFoundException('Milestone not found');
    if (milestone.booking.trainerId !== userId) {
      throw new ForbiddenException('Only the trainer can mark a milestone delivered');
    }
    if (!['PENDING', 'IN_PROGRESS'].includes(milestone.status)) {
      throw new BadRequestException(
        `Cannot mark ${milestone.status} milestone as delivered`,
      );
    }
    const updated = await this.prisma.milestone.update({
      where: { id: milestoneId },
      data: { status: 'DELIVERED', deliveredAt: new Date() },
    });
    // Notify the client
    await this.prisma.notification.create({
      data: {
        userId: milestone.booking.clientId,
        type: 'MILESTONE_DELIVERED',
        channel: 'IN_APP',
        status: 'PENDING',
        title: 'Milestone delivered',
        message: `The trainer has marked "${milestone.title}" as delivered. Review and release payment when ready.`,
        metadata: { bookingId: milestone.bookingId, milestoneId },
      },
    });
    return updated;
  }

  async release(milestoneId: string, userId: string) {
    const milestone = await this.prisma.milestone.findUnique({
      where: { id: milestoneId },
      include: { booking: { include: { escrow: true } } },
    });
    if (!milestone) throw new NotFoundException('Milestone not found');
    const booking = milestone.booking;
    if (booking.clientId !== userId) {
      throw new ForbiddenException('Only the client can release a milestone');
    }
    if (milestone.status === 'RELEASED') {
      throw new BadRequestException('Milestone already released');
    }
    if (milestone.status === 'DISPUTED') {
      throw new BadRequestException('Cannot release a disputed milestone');
    }
    const escrow = booking.escrow;
    if (!escrow) throw new BadRequestException('Booking has no escrow account');
    if (!['FUNDED', 'HELD'].includes(escrow.status)) {
      throw new BadRequestException(
        `Escrow must be FUNDED or HELD to release milestone (current: ${escrow.status})`,
      );
    }
    const milestoneAmount = Number(milestone.amount);
    if (milestoneAmount <= 0) {
      throw new BadRequestException('Milestone amount must be positive');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Commission lookup
      const commission = await this.commissionsService.findCommissionForBooking(
        booking.trainerId,
        milestoneAmount,
      );
      const rate = commission.rate;
      const commissionAmount = milestoneAmount * rate;
      const payout = milestoneAmount - commissionAmount;

      // 2. Trainer wallet
      let trainerWallet = await tx.wallet.findUnique({
        where: { userId: booking.trainerId },
      });
      if (!trainerWallet) {
        trainerWallet = await tx.wallet.create({
          data: { userId: booking.trainerId, balance: 0, currency: 'KES' },
        });
      }

      // 3. Credit trainer the payout (partial from escrow)
      await this.walletService.creditWallet(
        trainerWallet.id,
        payout,
        'MILESTONE',
        milestoneId,
        `Milestone payout: ${milestone.title} (booking ${booking.id})`,
        tx,
      );

      // 4. Credit platform commission
      if (commissionAmount > 0) {
        const platformWallet = await this._getOrCreatePlatformWallet(tx);
        await this.walletService.creditWallet(
          platformWallet.id,
          commissionAmount,
          'MILESTONE_COMMISSION',
          milestoneId,
          `Commission from milestone ${milestone.title} (${(rate * 100).toFixed(1)}%)`,
          tx,
        );
      }

      // 5. Debit escrow amount + update escrow.amount (partial)
      const newEscrowAmount = Number(escrow.amount) - milestoneAmount;
      if (newEscrowAmount < -0.001) {
        throw new BadRequestException(
          'Milestone amount exceeds remaining escrow balance',
        );
      }
      const escrowFullyReleased = newEscrowAmount <= 0.001;
      await tx.escrowAccount.update({
        where: { id: escrow.id },
        data: {
          amount: Math.max(0, newEscrowAmount),
          status: escrowFullyReleased ? 'RELEASED' : 'HELD',
          releasedAt: escrowFullyReleased ? new Date() : escrow.releasedAt,
        },
      });
      await tx.escrowStatusLog.create({
        data: {
          escrowId: escrow.id,
          fromStatus: escrow.status,
          toStatus: escrowFullyReleased ? 'RELEASED' : 'HELD',
          reason: `Milestone released: ${milestone.title} (KES ${milestoneAmount})`,
          changedBy: userId,
        },
      });

      // 6. Flip milestone to RELEASED
      const updated = await tx.milestone.update({
        where: { id: milestoneId },
        data: {
          status: 'RELEASED',
          releasedAt: new Date(),
          releasedBy: userId,
        },
      });

      // 7. Notify the trainer
      await tx.notification.create({
        data: {
          userId: booking.trainerId,
          type: 'MILESTONE_RELEASED',
          channel: 'IN_APP',
          status: 'PENDING',
          title: 'Milestone payment released',
          message: `The client released "${milestone.title}". KES ${payout.toFixed(2)} credited to your wallet.`,
          metadata: {
            bookingId: booking.id,
            milestoneId,
            amount: milestoneAmount,
            payout,
            commission: commissionAmount,
          },
        },
      });

      return {
        milestone: updated,
        payout,
        commissionAmount,
        commissionRate: rate,
        escrowRemaining: Math.max(0, newEscrowAmount),
        escrowFullyReleased,
      };
    });
  }

  async dispute(milestoneId: string, userId: string, dto: DisputeMilestoneDto) {
    const milestone = await this.prisma.milestone.findUnique({
      where: { id: milestoneId },
      include: { booking: true },
    });
    if (!milestone) throw new NotFoundException('Milestone not found');
    const booking = milestone.booking;
    const isParty = booking.clientId === userId || booking.trainerId === userId;
    if (!isParty) {
      throw new ForbiddenException('Not a participant in this booking');
    }
    if (milestone.status === 'RELEASED') {
      throw new BadRequestException('Cannot dispute a released milestone');
    }

    // Check for an existing open dispute on this booking
    const existingOpen = await this.prisma.dispute.findFirst({
      where: {
        bookingId: booking.id,
        status: { in: ['OPEN', 'UNDER_REVIEW'] },
      },
    });

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.milestone.update({
        where: { id: milestoneId },
        data: { status: 'DISPUTED' },
      });
      let dispute = null as any;
      if (!existingOpen) {
        const againstId =
          userId === booking.clientId ? booking.trainerId : booking.clientId;
        dispute = await tx.dispute.create({
          data: {
            bookingId: booking.id,
            raisedById: userId,
            againstId,
            reason: `Milestone dispute: ${milestone.title}`,
            description: dto.note || null,
            status: 'OPEN',
          },
        });
        // Flag booking as disputed (if not already)
        if (booking.status !== 'DISPUTED') {
          await tx.booking.update({
            where: { id: booking.id },
            data: { status: 'DISPUTED' },
          });
          await tx.bookingStatusLog.create({
            data: {
              bookingId: booking.id,
              fromStatus: booking.status,
              toStatus: 'DISPUTED',
              reason: `Milestone disputed: ${milestone.title}`,
              changedBy: userId,
            },
          });
        }
      } else {
        // Attach a comment to the existing dispute
        await tx.disputeComment.create({
          data: {
            disputeId: existingOpen.id,
            authorId: userId,
            content: `Milestone "${milestone.title}" disputed. ${dto.note || ''}`.trim(),
            isInternal: false,
          },
        });
        dispute = existingOpen;
      }

      // Notify counter-party
      const counterId =
        userId === booking.clientId ? booking.trainerId : booking.clientId;
      await tx.notification.create({
        data: {
          userId: counterId,
          type: 'MILESTONE_DISPUTED',
          channel: 'IN_APP',
          status: 'PENDING',
          title: 'Milestone disputed',
          message: `A milestone ("${milestone.title}") on your booking has been disputed.${dto.note ? ' Note: ' + dto.note.slice(0, 120) : ''}`,
          metadata: {
            bookingId: booking.id,
            milestoneId,
            disputeId: dispute?.id,
          },
        },
      });

      return { milestone: updated, dispute };
    });
  }

  // ---------------------------------------------------------------------------
  // Attendance
  // ---------------------------------------------------------------------------

  async recordAttendance(
    bookingId: string,
    recorderId: string,
    dto: RecordAttendanceDto,
  ) {
    const booking = await this._getBookingOrThrow(bookingId);
    // Only the trainer (or an admin) can record attendance
    // Clients are limited to recording their own entry only
    const recorder = await this.prisma.user.findUnique({
      where: { id: recorderId },
      select: { role: true },
    });
    const isAdmin = this._isAdmin(recorder?.role);
    const isTrainer = booking.trainerId === recorderId;
    const isClient = booking.clientId === recorderId;
    if (!isTrainer && !isClient && !isAdmin) {
      throw new ForbiddenException('Not a participant in this booking');
    }
    if (!dto.entries || dto.entries.length === 0) {
      throw new BadRequestException('entries is required and must be non-empty');
    }
    // Client can only record themselves
    if (isClient && !isTrainer && !isAdmin) {
      for (const e of dto.entries) {
        if (e.userId !== recorderId) {
          throw new ForbiddenException(
            'Clients can only record attendance for themselves',
          );
        }
      }
    }
    // Validate milestone (if given) belongs to this booking
    if (dto.milestoneId) {
      const m = await this.prisma.milestone.findUnique({
        where: { id: dto.milestoneId },
      });
      if (!m || m.bookingId !== bookingId) {
        throw new BadRequestException(
          'milestoneId does not belong to this booking',
        );
      }
    }

    const results = [] as any[];
    for (const entry of dto.entries) {
      // Upsert via the composite unique (bookingId, milestoneId, userId).
      // Prisma can't upsert on composite unique when one key is nullable in the
      // same clean way, so we do a find → create/update manually.
      const existing = await this.prisma.attendanceRecord.findFirst({
        where: {
          bookingId,
          milestoneId: dto.milestoneId ?? null,
          userId: entry.userId,
        },
      });
      const payload = {
        presenceStatus: entry.presenceStatus ?? 'PRESENT',
        checkedInAt: entry.checkedInAt ? new Date(entry.checkedInAt) : undefined,
        checkedOutAt: entry.checkedOutAt ? new Date(entry.checkedOutAt) : undefined,
        note: entry.note,
      };
      if (existing) {
        results.push(
          await this.prisma.attendanceRecord.update({
            where: { id: existing.id },
            data: payload,
          }),
        );
      } else {
        results.push(
          await this.prisma.attendanceRecord.create({
            data: {
              bookingId,
              milestoneId: dto.milestoneId ?? null,
              userId: entry.userId,
              ...payload,
            },
          }),
        );
      }
    }
    return { count: results.length, records: results };
  }

  async getAttendance(bookingId: string, userId: string, userRole?: string) {
    const booking = await this._getBookingOrThrow(bookingId);
    const isAdmin = this._isAdmin(userRole);
    const isTrainer = booking.trainerId === userId;
    const isClient = booking.clientId === userId;
    if (!isAdmin && !isTrainer && !isClient) {
      throw new ForbiddenException('Not a participant in this booking');
    }
    const where: Prisma.AttendanceRecordWhereInput = { bookingId };
    // Client sees only own
    if (isClient && !isTrainer && !isAdmin) {
      where.userId = userId;
    }
    return this.prisma.attendanceRecord.findMany({
      where,
      orderBy: [{ milestoneId: 'asc' }, { createdAt: 'asc' }],
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true } },
        milestone: { select: { id: true, title: true, orderIndex: true, status: true } },
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Content gating
  // ---------------------------------------------------------------------------

  async canAccessContent(userId: string, bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { escrow: true },
    });
    if (!booking) return { canAccess: false, reason: 'Booking not found' };
    const isParty = booking.trainerId === userId || booking.clientId === userId;
    if (!isParty) return { canAccess: false, reason: 'Not a participant' };
    if (!booking.escrow) {
      return {
        canAccess: false,
        reason: 'No escrow account — booking must be funded first',
      };
    }
    const gatedStatuses = ['FUNDED', 'HELD', 'RELEASED'];
    if (gatedStatuses.includes(booking.escrow.status)) {
      return {
        canAccess: true,
        reason: `Escrow is ${booking.escrow.status}`,
        escrowStatus: booking.escrow.status,
      };
    }
    return {
      canAccess: false,
      reason: `Escrow status is ${booking.escrow.status} — content access requires FUNDED / HELD / RELEASED`,
      escrowStatus: booking.escrow.status,
    };
  }
}
