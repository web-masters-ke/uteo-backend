import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/services/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { paginate, pageParams } from '../../common/dto/pagination.dto';
import {
  RequestPayoutDto,
  ListPayoutsDto,
  AdminListPayoutsDto,
  CompletePayoutDto,
} from './dto/payouts.dto';

const MIN_FEE_KES = 50;

@Injectable()
export class PayoutsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
  ) {}

  private readonly includeUser = {
    user: {
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        avatar: true,
      },
    },
  };

  /* ------------------------------------------------------------------ */
  /*  Request payout                                                    */
  /* ------------------------------------------------------------------ */

  async request(userId: string, dto: RequestPayoutDto) {
    // Validate wallet balance
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId },
    });
    if (!wallet) throw new NotFoundException('Wallet not found');
    if (Number(wallet.balance) < dto.amount) {
      throw new BadRequestException(
        `Insufficient balance. Available: ${Number(wallet.balance)}, Requested: ${dto.amount}`,
      );
    }

    // Calculate fee
    const feeRate = dto.method === 'MPESA' ? 0.015 : 0.005;
    const fee = Math.max(dto.amount * feeRate, MIN_FEE_KES);
    const netAmount = dto.amount - fee;

    if (netAmount <= 0) {
      throw new BadRequestException('Amount too small after fees');
    }

    return this.prisma.payout.create({
      data: {
        userId,
        amount: dto.amount,
        fee,
        netAmount,
        currency: 'KES',
        method: dto.method,
        status: 'REQUESTED',
        destination: dto.destination,
      },
      include: this.includeUser,
    });
  }

  /* ------------------------------------------------------------------ */
  /*  List my payouts                                                   */
  /* ------------------------------------------------------------------ */

  async findAll(userId: string, dto: ListPayoutsDto) {
    const { page, limit, skip } = pageParams(dto);

    const where: Prisma.PayoutWhereInput = { userId };
    if (dto.status) where.status = dto.status as any;

    const [items, total] = await Promise.all([
      this.prisma.payout.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: this.includeUser,
      }),
      this.prisma.payout.count({ where }),
    ]);

    return paginate(items, total, page, limit);
  }

  /* ------------------------------------------------------------------ */
  /*  Single payout                                                     */
  /* ------------------------------------------------------------------ */

  async findOne(id: string) {
    const payout = await this.prisma.payout.findUnique({
      where: { id },
      include: this.includeUser,
    });
    if (!payout) throw new NotFoundException('Payout not found');
    return payout;
  }

  /* ------------------------------------------------------------------ */
  /*  Admin: approve                                                    */
  /* ------------------------------------------------------------------ */

  async approve(id: string, adminId: string) {
    const payout = await this.prisma.payout.findUnique({ where: { id } });
    if (!payout) throw new NotFoundException('Payout not found');
    if (payout.status !== 'REQUESTED') {
      throw new BadRequestException(`Cannot approve payout with status ${payout.status}`);
    }

    return this.prisma.payout.update({
      where: { id },
      data: { status: 'APPROVED', approvedBy: adminId },
      include: this.includeUser,
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Admin: mark as processing                                         */
  /* ------------------------------------------------------------------ */

  async process(id: string) {
    const payout = await this.prisma.payout.findUnique({ where: { id } });
    if (!payout) throw new NotFoundException('Payout not found');
    if (payout.status !== 'APPROVED') {
      throw new BadRequestException(`Cannot process payout with status ${payout.status}`);
    }

    return this.prisma.payout.update({
      where: { id },
      data: { status: 'PROCESSING' },
      include: this.includeUser,
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Admin: complete — deducts from wallet in a transaction            */
  /* ------------------------------------------------------------------ */

  async complete(id: string, dto: CompletePayoutDto) {
    const payout = await this.prisma.payout.findUnique({ where: { id } });
    if (!payout) throw new NotFoundException('Payout not found');
    if (!['APPROVED', 'PROCESSING'].includes(payout.status)) {
      throw new BadRequestException(`Cannot complete payout with status ${payout.status}`);
    }

    const wallet = await this.prisma.wallet.findUnique({
      where: { userId: payout.userId },
    });
    if (!wallet) throw new NotFoundException('User wallet not found');

    return this.prisma.$transaction(async (tx) => {
      // 1. Update payout status
      const updated = await tx.payout.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          reference: dto.reference || null,
          processedAt: new Date(),
        },
        include: this.includeUser,
      });

      // 2. Debit wallet (full amount including fee)
      await this.walletService.debitWallet(
        wallet.id,
        Number(payout.amount),
        'PAYOUT',
        payout.id,
        `Payout ${payout.method} to ${payout.destination}`,
        tx,
      );

      // 3. Credit platform wallet with the payout fee
      const fee = Number(payout.fee);
      if (fee > 0) {
        const platformWalletId = await this._getPlatformWalletId(tx);
        await this.walletService.creditWallet(
          platformWalletId, fee, 'PAYOUT_FEE', payout.id,
          `Payout fee: ${payout.method} to ${payout.destination}`, tx,
        );
      }

      return updated;
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

  /* ------------------------------------------------------------------ */
  /*  Admin: reject                                                     */
  /* ------------------------------------------------------------------ */

  async reject(id: string, reason: string) {
    const payout = await this.prisma.payout.findUnique({ where: { id } });
    if (!payout) throw new NotFoundException('Payout not found');
    if (!['REQUESTED', 'APPROVED'].includes(payout.status)) {
      throw new BadRequestException(`Cannot reject payout with status ${payout.status}`);
    }

    return this.prisma.payout.update({
      where: { id },
      data: { status: 'REJECTED', rejectedReason: reason },
      include: this.includeUser,
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Admin: queue (list all)                                           */
  /* ------------------------------------------------------------------ */

  async adminQueue(dto: AdminListPayoutsDto) {
    const { page, limit, skip } = pageParams(dto);

    const where: Prisma.PayoutWhereInput = {};
    if (dto.status) where.status = dto.status as any;
    if (dto.userId) where.userId = dto.userId;
    if (dto.method) where.method = dto.method as any;

    const [items, total] = await Promise.all([
      this.prisma.payout.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'asc' },
        include: this.includeUser,
      }),
      this.prisma.payout.count({ where }),
    ]);

    return paginate(items, total, page, limit);
  }

  /* ------------------------------------------------------------------ */
  /*  Admin: stats                                                      */
  /* ------------------------------------------------------------------ */

  async adminStats() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalCompleted,
      pendingAmount,
      thisMonth,
      byMethod,
    ] = await Promise.all([
      this.prisma.payout.aggregate({
        where: { status: 'COMPLETED' },
        _sum: { netAmount: true },
        _count: true,
      }),
      this.prisma.payout.aggregate({
        where: { status: { in: ['REQUESTED', 'APPROVED', 'PROCESSING'] } },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.payout.aggregate({
        where: {
          status: 'COMPLETED',
          processedAt: { gte: startOfMonth },
        },
        _sum: { netAmount: true },
        _count: true,
      }),
      this.prisma.payout.groupBy({
        by: ['method'],
        where: { status: 'COMPLETED' },
        _sum: { netAmount: true },
        _count: true,
      }),
    ]);

    return {
      totalPaidOut: Number(totalCompleted._sum.netAmount || 0),
      totalPaidOutCount: totalCompleted._count,
      pendingAmount: Number(pendingAmount._sum.amount || 0),
      pendingCount: pendingAmount._count,
      thisMonthPaidOut: Number(thisMonth._sum.netAmount || 0),
      thisMonthCount: thisMonth._count,
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
    };
  }
}
