import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { CommissionsService } from '../commissions/commissions.service';
import { FundEscrowDto, ReleaseEscrowDto, RefundEscrowDto, FreezeEscrowDto } from './dto/escrow.dto';

@Injectable()
export class EscrowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
    private readonly commissionsService: CommissionsService,
  ) {}

  async fund(dto: FundEscrowDto, userId: string) {
    const escrow = await this.prisma.escrowAccount.findUnique({ where: { bookingId: dto.bookingId }, include: { booking: true } });
    if (!escrow) throw new NotFoundException('Escrow not found');
    if (escrow.status !== 'CREATED') throw new BadRequestException(`Escrow is already ${escrow.status}`);
    if (escrow.booking.clientId !== userId) throw new BadRequestException('Only the client can fund');
    return this.prisma.$transaction(async (tx) => {
      await this.walletService.debitWallet(escrow.payerWalletId, Number(escrow.amount), 'ESCROW', escrow.id, `Escrow for booking ${dto.bookingId}`, tx);
      const updated = await tx.escrowAccount.update({ where: { id: escrow.id }, data: { status: 'FUNDED', fundedAt: new Date() } });
      await tx.escrowStatusLog.create({ data: { escrowId: escrow.id, fromStatus: 'CREATED', toStatus: 'FUNDED', changedBy: userId } });
      await tx.booking.update({ where: { id: dto.bookingId }, data: { status: 'CONFIRMED' } });
      await tx.bookingStatusLog.create({ data: { bookingId: dto.bookingId, fromStatus: 'PENDING_PAYMENT', toStatus: 'CONFIRMED', changedBy: userId } });
      return updated;
    });
  }

  async release(dto: ReleaseEscrowDto, userId: string) {
    const escrow = await this.prisma.escrowAccount.findUnique({ where: { bookingId: dto.bookingId }, include: { booking: true } });
    if (!escrow) throw new NotFoundException('Escrow not found');
    if (!['FUNDED', 'HELD'].includes(escrow.status)) throw new BadRequestException(`Cannot release ${escrow.status}`);

    return this.prisma.$transaction(async (tx) => {
      // Use the new prioritized commission lookup:
      // 1. Org-specific rule (if trainer belongs to an org) matching booking amount
      // 2. Plan-specific rate (if trainer has subscription with commissionRate)
      // 3. Global rule matching the booking amount
      // 4. Default 10% fallback
      const commission = await this.commissionsService.findCommissionForBooking(
        escrow.booking.trainerId,
        Number(escrow.amount),
      );

      const rate = commission.rate;
      const commissionAmount = Number(escrow.amount) * rate;
      const payout = Number(escrow.amount) - commissionAmount;

      const trainerWallet = await tx.wallet.findUnique({ where: { userId: escrow.booking.trainerId } });
      if (!trainerWallet) throw new BadRequestException('Trainer wallet not found');

      await this.walletService.creditWallet(trainerWallet.id, payout, 'ESCROW', escrow.id, `Payout for booking ${dto.bookingId}`, tx);

      // Credit Uteo platform wallet with commission
      const platformWallet = await this._getOrCreatePlatformWallet(tx);
      if (commissionAmount > 0) {
        await this.walletService.creditWallet(platformWallet.id, commissionAmount, 'COMMISSION', escrow.id, `Commission from booking ${dto.bookingId} (${(rate * 100).toFixed(1)}%)`, tx);
      }

      await tx.commissionRecord.create({
        data: {
          bookingId: dto.bookingId,
          escrowId: escrow.id,
          bookingAmount: escrow.amount,
          commissionRate: rate,
          commissionAmount: commissionAmount,
          trainerPayoutAmount: payout,
          ruleId: commission.ruleId || 'default',
        },
      });

      const updated = await tx.escrowAccount.update({ where: { id: escrow.id }, data: { status: 'RELEASED', releasedAt: new Date() } });
      await tx.escrowStatusLog.create({ data: { escrowId: escrow.id, fromStatus: escrow.status, toStatus: 'RELEASED', reason: dto.reason, changedBy: userId } });
      return updated;
    });
  }

  async refund(dto: RefundEscrowDto, userId: string) {
    const escrow = await this.prisma.escrowAccount.findUnique({ where: { bookingId: dto.bookingId }, include: { booking: true } });
    if (!escrow) throw new NotFoundException('Escrow not found');
    if (!['FUNDED', 'HELD', 'FROZEN'].includes(escrow.status)) throw new BadRequestException(`Cannot refund ${escrow.status}`);
    return this.prisma.$transaction(async (tx) => {
      await this.walletService.creditWallet(escrow.payerWalletId, Number(escrow.amount), 'ESCROW', escrow.id, `Refund for booking ${dto.bookingId}`, tx);
      const updated = await tx.escrowAccount.update({ where: { id: escrow.id }, data: { status: 'REFUNDED' } });
      await tx.escrowStatusLog.create({ data: { escrowId: escrow.id, fromStatus: escrow.status, toStatus: 'REFUNDED', reason: dto.reason, changedBy: userId } });
      return updated;
    });
  }

  async freeze(dto: FreezeEscrowDto, userId: string) {
    const escrow = await this.prisma.escrowAccount.findUnique({ where: { bookingId: dto.bookingId } });
    if (!escrow) throw new NotFoundException('Escrow not found');
    if (!['FUNDED', 'HELD'].includes(escrow.status)) throw new BadRequestException(`Cannot freeze ${escrow.status}`);
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.escrowAccount.update({ where: { id: escrow.id }, data: { status: 'FROZEN' } });
      await tx.escrowStatusLog.create({ data: { escrowId: escrow.id, fromStatus: escrow.status, toStatus: 'FROZEN', reason: dto.reason, changedBy: userId } });
      return updated;
    });
  }

  async findOne(id: string) {
    const e = await this.prisma.escrowAccount.findUnique({
      where: { id },
      include: {
        booking: { select: { id: true, trainerId: true, clientId: true, amount: true } },
        statusLogs: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!e) throw new NotFoundException('Escrow not found');
    return e;
  }

  async findByBookingId(bookingId: string) {
    const e = await this.prisma.escrowAccount.findUnique({
      where: { bookingId },
      include: {
        booking: { select: { id: true, trainerId: true, clientId: true, amount: true } },
        statusLogs: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!e) throw new NotFoundException('Escrow not found');
    return e;
  }

  /** Get or create the Uteo platform wallet — uses the PLATFORM_WALLET system setting */
  private async _getOrCreatePlatformWallet(tx: any) {
    // Check for existing platform wallet setting
    const setting = await tx.systemSetting.findUnique({ where: { key: 'platform.wallet_id' } });
    if (setting) {
      const wallet = await tx.wallet.findUnique({ where: { id: setting.value as string } });
      if (wallet) return wallet;
    }
    // Find admin user to tie the platform wallet to
    const admin = await tx.user.findFirst({ where: { role: 'SUPER_ADMIN' }, orderBy: { createdAt: 'asc' } });
    if (!admin) throw new BadRequestException('No admin user found for platform wallet');
    // Check if admin already has a wallet
    let wallet = await tx.wallet.findUnique({ where: { userId: admin.id } });
    if (!wallet) {
      wallet = await tx.wallet.create({ data: { userId: admin.id, balance: 0, currency: 'KES' } });
    }
    // Save wallet ID as system setting
    await tx.systemSetting.upsert({
      where: { key: 'platform.wallet_id' },
      create: { key: 'platform.wallet_id', value: wallet.id as any, category: 'platform' },
      update: { value: wallet.id as any },
    });
    return wallet;
  }
}
