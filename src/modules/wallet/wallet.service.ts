import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { v4 as uuid } from 'uuid';
import { PrismaService } from '../../common/services/prisma.service';
import { paginate } from '../../common/dto/pagination.dto';
import { DepositDto, WithdrawDto, ListTransactionsDto } from './dto/wallet.dto';
import { DarajaService } from '../payments/daraja.service';

@Injectable()
export class WalletService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly daraja: DarajaService,
  ) {}

  async getMyWallet(userId: string) {
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new NotFoundException('Wallet not found');
    const [recent, escrowHeld, escrowPending, totalEarned, totalSpent] = await Promise.all([
      this.prisma.ledgerEntry.findMany({ where: { walletId: wallet.id }, include: { transaction: true }, orderBy: { createdAt: 'desc' }, take: 10 }),
      // Money this user has in escrow (as client — funded but not released)
      this.prisma.escrowAccount.aggregate({ where: { payerWalletId: wallet.id, status: { in: ['FUNDED', 'HELD', 'FROZEN'] } }, _sum: { amount: true }, _count: true }),
      // Money coming to this user (as trainer — funded escrows for their bookings)
      this.prisma.escrowAccount.aggregate({ where: { booking: { trainerId: userId }, status: { in: ['FUNDED', 'HELD'] } }, _sum: { amount: true }, _count: true }),
      // Total earned (credits to wallet)
      this.prisma.ledgerEntry.aggregate({ where: { walletId: wallet.id, entryType: 'CREDIT' }, _sum: { amount: true } }),
      // Total spent (debits from wallet)
      this.prisma.ledgerEntry.aggregate({ where: { walletId: wallet.id, entryType: 'DEBIT' }, _sum: { amount: true } }),
    ]);
    return {
      ...wallet,
      recentTransactions: recent,
      escrowHeldByMe: Number(escrowHeld._sum.amount || 0),
      escrowHeldCount: escrowHeld._count,
      escrowPendingForMe: Number(escrowPending._sum.amount || 0),
      escrowPendingCount: escrowPending._count,
      totalEarned: Number(totalEarned._sum.amount || 0),
      totalSpent: Number(totalSpent._sum.amount || 0),
    };
  }

  async getWalletByUserId(userId: string) { const w = await this.prisma.wallet.findUnique({ where: { userId }, include: { user: { select: { id:true, firstName:true, lastName:true, email:true } } } }); if (!w) throw new NotFoundException('Wallet not found'); return w; }
  async getBalance(userId: string) { const w = await this.prisma.wallet.findUnique({ where: { userId }, select: { id:true, balance:true, currency:true } }); if (!w) throw new NotFoundException('Wallet not found'); return w; }

  async deposit(userId: string, dto: DepositDto) {
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new NotFoundException('Wallet not found');

    // M-Pesa → real STK push. Wallet is credited only when Safaricom's
    // callback confirms success (see PaymentsService.handleMpesaWebhook).
    if (dto.provider === 'MPESA') {
      if (!dto.phone) throw new BadRequestException('phone is required for M-Pesa');
      const payment = await this.prisma.payment.create({
        data: {
          userId,
          amount: dto.amount,
          currency: dto.currency || 'KES',
          provider: 'MPESA',
          status: 'PENDING',
          metadata: { phone: dto.phone, channel: 'wallet_topup' },
        },
      });
      const push = await this.daraja.stkPush({
        phone: dto.phone,
        amount: dto.amount,
        accountReference: `SS${payment.id.slice(0, 6)}`,
        description: 'Wallet top-up',
      });
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'PROCESSING',
          providerReference: push.checkoutRequestId,
          metadata: {
            phone: dto.phone,
            channel: 'wallet_topup',
            merchantRequestId: push.merchantRequestId,
            checkoutRequestId: push.checkoutRequestId,
            daraja: push.responseDescription,
            mock: push.mock ?? false,
          },
        },
      });
      return {
        status: 'PROCESSING',
        message: push.customerMessage,
        paymentId: payment.id,
        merchantRequestId: push.merchantRequestId,
        checkoutRequestId: push.checkoutRequestId,
        mock: push.mock ?? false,
      };
    }

    // Card / Bank transfer — instant credit for now (these are usually routed
    // through a PSP like Stripe/Pesapal in production).
    const idemKey = `deposit-${userId}-${Date.now()}-${uuid().slice(0,8)}`;
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({ data: { userId, amount: dto.amount, currency: dto.currency||'KES', provider: dto.provider, status: 'SUCCESS', metadata: { phone: dto.phone, channel: 'wallet_topup' } } });
      const walletTx = await tx.walletTransaction.create({ data: { referenceType: 'DEPOSIT', referenceId: payment.id, idempotencyKey: idemKey, description: `Deposit via ${dto.provider}` } });
      await tx.ledgerEntry.create({ data: { walletId: wallet.id, transactionId: walletTx.id, entryType: 'CREDIT', amount: dto.amount } });
      const updated = await tx.wallet.update({ where: { id: wallet.id }, data: { balance: { increment: dto.amount } } });
      return { wallet: updated, payment, transaction: walletTx };
    });
  }

  async withdraw(userId: string, dto: WithdrawDto) {
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new NotFoundException('Wallet not found');
    if (Number(wallet.balance) < dto.amount) throw new BadRequestException('Insufficient balance');
    const idemKey = `withdraw-${userId}-${Date.now()}-${uuid().slice(0,8)}`;
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({ data: { userId, amount: dto.amount, currency: dto.currency||'KES', provider: dto.provider, status: 'PROCESSING', metadata: { phone: dto.phone, accountNumber: dto.accountNumber } } });
      const walletTx = await tx.walletTransaction.create({ data: { referenceType: 'WITHDRAWAL', referenceId: payment.id, idempotencyKey: idemKey, description: `Withdrawal via ${dto.provider}` } });
      await tx.ledgerEntry.create({ data: { walletId: wallet.id, transactionId: walletTx.id, entryType: 'DEBIT', amount: dto.amount } });
      const updated = await tx.wallet.update({ where: { id: wallet.id }, data: { balance: { decrement: dto.amount } } });
      return { wallet: updated, payment, transaction: walletTx };
    });
  }

  async getTransactions(userId: string, dto: ListTransactionsDto) {
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new NotFoundException('Wallet not found');
    const page=Number(dto.page)||1; const limit=Number(dto.limit)||20; const skip=(page-1)*limit;
    const where: Prisma.LedgerEntryWhereInput = { walletId: wallet.id };
    if (dto.type === 'CREDIT' || dto.type === 'DEBIT') where.entryType = dto.type as any;
    if (dto.dateFrom || dto.dateTo) {
      where.createdAt = {};
      if (dto.dateFrom) (where.createdAt as any).gte = new Date(dto.dateFrom);
      if (dto.dateTo) (where.createdAt as any).lte = new Date(dto.dateTo);
    }
    if (dto.minAmount || dto.maxAmount) {
      where.amount = {};
      if (dto.minAmount) (where.amount as any).gte = Number(dto.minAmount);
      if (dto.maxAmount) (where.amount as any).lte = Number(dto.maxAmount);
    }
    // referenceType + text search go on the related transaction
    const txFilters: any = {};
    if (dto.referenceType) txFilters.referenceType = dto.referenceType;
    if (dto.search) txFilters.OR = [
      { description: { contains: dto.search, mode: 'insensitive' } },
      { referenceId: { contains: dto.search, mode: 'insensitive' } },
    ];
    if (Object.keys(txFilters).length > 0) where.transaction = txFilters;
    const [items,total] = await Promise.all([
      this.prisma.ledgerEntry.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' }, include: { transaction: true } }),
      this.prisma.ledgerEntry.count({ where }),
    ]);
    return paginate(items, total, page, limit);
  }

  async creditWallet(walletId: string, amount: number, refType: string, refId: string, desc: string, tx: Prisma.TransactionClient) {
    const idemKey = `${refType}-credit-${refId}-${Date.now()}`;
    const walletTx = await tx.walletTransaction.create({ data: { referenceType: refType, referenceId: refId, idempotencyKey: idemKey, description: desc } });
    await tx.ledgerEntry.create({ data: { walletId, transactionId: walletTx.id, entryType: 'CREDIT', amount } });
    await tx.wallet.update({ where: { id: walletId }, data: { balance: { increment: amount } } });
    return walletTx;
  }

  async debitWallet(walletId: string, amount: number, refType: string, refId: string, desc: string, tx: Prisma.TransactionClient) {
    const wallet = await tx.wallet.findUnique({ where: { id: walletId } });
    if (!wallet || Number(wallet.balance) < amount) throw new BadRequestException('Insufficient wallet balance');
    const idemKey = `${refType}-debit-${refId}-${Date.now()}`;
    const walletTx = await tx.walletTransaction.create({ data: { referenceType: refType, referenceId: refId, idempotencyKey: idemKey, description: desc } });
    await tx.ledgerEntry.create({ data: { walletId, transactionId: walletTx.id, entryType: 'DEBIT', amount } });
    await tx.wallet.update({ where: { id: walletId }, data: { balance: { decrement: amount } } });
    return walletTx;
  }

  async adminFund(userId: string, amount: number, description?: string) {
    let wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) wallet = await this.prisma.wallet.create({ data: { userId, balance: 0, currency: 'KES' } });
    return this.prisma.$transaction(async (tx) => {
      const walletTx = await tx.walletTransaction.create({ data: { referenceType: 'TOPUP', referenceId: userId, idempotencyKey: `admin-fund-${userId}-${Date.now()}`, description: description || 'Admin wallet funding' } });
      await tx.ledgerEntry.create({ data: { walletId: wallet!.id, transactionId: walletTx.id, entryType: 'CREDIT', amount } });
      const updated = await tx.wallet.update({ where: { id: wallet!.id }, data: { balance: { increment: amount } } });
      return { wallet: updated, transaction: walletTx };
    });
  }

  async transfer(fromUserId: string, toUserId: string, amount: number, description?: string) {
    const fromWallet = await this.prisma.wallet.findUnique({ where: { userId: fromUserId } });
    if (!fromWallet) throw new NotFoundException('Your wallet not found');
    if (Number(fromWallet.balance) < amount) throw new BadRequestException('Insufficient balance');
    let toWallet = await this.prisma.wallet.findUnique({ where: { userId: toUserId } });
    if (!toWallet) toWallet = await this.prisma.wallet.create({ data: { userId: toUserId, balance: 0, currency: 'KES' } });
    return this.prisma.$transaction(async (tx) => {
      const walletTx = await tx.walletTransaction.create({ data: { referenceType: 'TRANSFER', referenceId: toUserId, idempotencyKey: `transfer-${fromUserId}-${toUserId}-${Date.now()}`, description: description || 'Internal transfer' } });
      await tx.ledgerEntry.create({ data: { walletId: fromWallet.id, transactionId: walletTx.id, entryType: 'DEBIT', amount } });
      await tx.wallet.update({ where: { id: fromWallet.id }, data: { balance: { decrement: amount } } });
      await tx.ledgerEntry.create({ data: { walletId: toWallet!.id, transactionId: walletTx.id, entryType: 'CREDIT', amount } });
      await tx.wallet.update({ where: { id: toWallet!.id }, data: { balance: { increment: amount } } });
      return { transaction: walletTx, message: `KES ${amount} transferred` };
    });
  }

  async listAllWallets() {
    return this.prisma.wallet.findMany({
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true, role: true, avatar: true } } },
      orderBy: { balance: 'desc' },
    });
  }

  async listAllTransactions(limit = 100) {
    const entries = await this.prisma.ledgerEntry.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        transaction: true,
        wallet: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } } },
      },
    });
    return entries.map(e => ({
      id: e.id,
      type: e.entryType,
      amount: Number(e.amount),
      description: e.transaction?.description ?? '',
      referenceType: e.transaction?.referenceType ?? '',
      createdAt: e.createdAt,
      user: e.wallet?.user ?? null,
      walletId: e.walletId,
    }));
  }

  /** Downloadable statement — full transaction history (no pagination) for the filters given */
  async getStatement(userId: string, dto: ListTransactionsDto) {
    const wallet = await this.prisma.wallet.findUnique({ where: { userId }, include: { user: { select: { firstName: true, lastName: true, email: true } } } });
    if (!wallet) throw new NotFoundException('Wallet not found');
    const where: Prisma.LedgerEntryWhereInput = { walletId: wallet.id };
    if (dto.type === 'CREDIT' || dto.type === 'DEBIT') where.entryType = dto.type as any;
    if (dto.dateFrom || dto.dateTo) {
      where.createdAt = {};
      if (dto.dateFrom) (where.createdAt as any).gte = new Date(dto.dateFrom);
      if (dto.dateTo) (where.createdAt as any).lte = new Date(dto.dateTo);
    }
    const txFilters: any = {};
    if (dto.referenceType) txFilters.referenceType = dto.referenceType;
    if (dto.search) txFilters.OR = [
      { description: { contains: dto.search, mode: 'insensitive' } },
      { referenceId: { contains: dto.search, mode: 'insensitive' } },
    ];
    if (Object.keys(txFilters).length > 0) where.transaction = txFilters;

    const entries = await this.prisma.ledgerEntry.findMany({
      where, orderBy: { createdAt: 'desc' },
      include: { transaction: true },
      take: 10000,
    });
    const totalCredits = entries.filter(e => e.entryType === 'CREDIT').reduce((s, e) => s + Number(e.amount), 0);
    const totalDebits = entries.filter(e => e.entryType === 'DEBIT').reduce((s, e) => s + Number(e.amount), 0);
    return {
      holder: wallet.user,
      currency: wallet.currency,
      balance: Number(wallet.balance),
      period: { from: dto.dateFrom || null, to: dto.dateTo || null },
      totals: { credits: totalCredits, debits: totalDebits, net: totalCredits - totalDebits },
      entries,
      generatedAt: new Date(),
    };
  }

  /** Receipt for a single transaction (ledger entry id) */
  async getReceipt(userId: string, entryId: string) {
    const entry = await this.prisma.ledgerEntry.findUnique({
      where: { id: entryId },
      include: { transaction: true, wallet: { include: { user: { select: { firstName: true, lastName: true, email: true } } } } },
    });
    if (!entry || entry.wallet.userId !== userId) throw new NotFoundException('Transaction not found');
    return {
      id: entry.id,
      entryType: entry.entryType,
      amount: Number(entry.amount),
      currency: entry.wallet.currency,
      description: entry.transaction?.description || '',
      referenceType: entry.transaction?.referenceType || '',
      referenceId: entry.transaction?.referenceId || '',
      createdAt: entry.createdAt,
      holder: entry.wallet.user,
      balanceAfter: null, // could be computed with running balance if needed
    };
  }

  /** Upcoming escrow auto-releases (COMPLETED bookings where escrow still HELD/FUNDED) */
  async getUpcomingEscrowReleases(userId: string) {
    // Escrows where this user is the trainer (incoming) or client (potential refund)
    const escrows = await this.prisma.escrowAccount.findMany({
      where: {
        status: { in: ['FUNDED', 'HELD'] },
        booking: { OR: [{ trainerId: userId }, { clientId: userId }] },
      },
      include: {
        booking: {
          select: {
            id: true, amount: true, status: true, scheduledAt: true, completedAt: true, duration: true, trainerId: true, clientId: true,
            trainer: { select: { id: true, firstName: true, lastName: true, avatar: true } },
            client: { select: { id: true, firstName: true, lastName: true, avatar: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    // Auto-release typically happens 48-72h after COMPLETED — compute ETA
    return escrows.map(e => {
      const completedAt = e.booking.completedAt;
      const autoReleaseAt = completedAt ? new Date(new Date(completedAt).getTime() + 72 * 60 * 60 * 1000) : null;
      return {
        ...e,
        autoReleaseAt,
        hoursUntilRelease: autoReleaseAt ? Math.max(0, Math.floor((autoReleaseAt.getTime() - Date.now()) / (60 * 60 * 1000))) : null,
        role: e.booking.trainerId === userId ? 'TRAINER' : 'CLIENT',
      };
    });
  }

  /** Spending & earning insights by month for the last N months */
  async getSpendingInsights(userId: string, months: number = 6) {
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new NotFoundException('Wallet not found');
    const since = new Date();
    since.setMonth(since.getMonth() - months);
    since.setDate(1);
    since.setHours(0, 0, 0, 0);
    const entries = await this.prisma.ledgerEntry.findMany({
      where: { walletId: wallet.id, createdAt: { gte: since } },
      include: { transaction: true },
    });
    // Group by YYYY-MM
    const byMonth: Record<string, { credits: number; debits: number; month: string }> = {};
    for (const e of entries) {
      const d = new Date(e.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!byMonth[key]) byMonth[key] = { credits: 0, debits: 0, month: key };
      if (e.entryType === 'CREDIT') byMonth[key].credits += Number(e.amount);
      else byMonth[key].debits += Number(e.amount);
    }
    // Group by referenceType (for the breakdown donut)
    const byType: Record<string, { credits: number; debits: number; count: number }> = {};
    for (const e of entries) {
      const t = e.transaction?.referenceType || 'OTHER';
      if (!byType[t]) byType[t] = { credits: 0, debits: 0, count: 0 };
      if (e.entryType === 'CREDIT') byType[t].credits += Number(e.amount);
      else byType[t].debits += Number(e.amount);
      byType[t].count++;
    }
    return {
      monthly: Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month)),
      byType: Object.entries(byType).map(([name, v]) => ({ name, ...v })),
      currentBalance: Number(wallet.balance),
      lowBalanceThreshold: 1000, // KES 1,000 default threshold
    };
  }

  /** Recent withdrawal history (debits referencing withdrawals) with status inferred from payment records */
  /**
   * Poll the STK push status. Returns payment.status (PENDING/PROCESSING/
   * SUCCESS/FAILED) plus the wallet balance. UI calls this every ~2s while
   * the M-Pesa popup is on the phone.
   */
  async getDepositStatus(userId: string, paymentId: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment || payment.userId !== userId) throw new NotFoundException('Payment not found');
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    return {
      paymentId: payment.id,
      status: payment.status,
      amount: payment.amount,
      provider: payment.provider,
      providerReference: payment.providerReference,
      metadata: payment.metadata,
      balance: wallet?.balance ?? 0,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    };
  }

  async getWithdrawals(userId: string, limit: number = 20) {
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new NotFoundException('Wallet not found');
    const entries = await this.prisma.ledgerEntry.findMany({
      where: { walletId: wallet.id, entryType: 'DEBIT', transaction: { referenceType: { in: ['WITHDRAWAL', 'WITHDRAW'] } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { transaction: true },
    });
    // Try to fetch matching Payment records for provider + status info
    return Promise.all(entries.map(async (e) => {
      const payment = e.transaction?.referenceId
        ? await this.prisma.payment.findFirst({ where: { id: e.transaction.referenceId } }).catch(() => null)
        : null;
      return {
        id: e.id,
        amount: Number(e.amount),
        createdAt: e.createdAt,
        description: e.transaction?.description || '',
        provider: payment?.provider || 'MPESA',
        status: payment?.status || 'PROCESSING',
        metadata: payment?.metadata || null,
        providerRef: payment?.providerReference || null,
        processedAt: payment?.updatedAt || null,
      };
    }));
  }

  /** Idempotent — grants 1M starter credit once per user. Safe to call on every app open. */
  async claimStarterCredit(userId: string) {
    let wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) wallet = await this.prisma.wallet.create({ data: { userId, balance: 0, currency: 'KES' } });
    if (wallet.starterCreditGranted) {
      return { alreadyClaimed: true, balance: Number(wallet.balance) };
    }
    return this.prisma.$transaction(async (tx) => {
      const walletTx = await tx.walletTransaction.create({
        data: {
          referenceType: 'STARTER_CREDIT',
          referenceId: userId,
          idempotencyKey: `starter-credit-${userId}`,
          description: 'Welcome bonus — KES 1,000,000 starter credit',
        },
      });
      await tx.ledgerEntry.create({ data: { walletId: wallet!.id, transactionId: walletTx.id, entryType: 'CREDIT', amount: 1000000 } });
      const updated = await tx.wallet.update({
        where: { id: wallet!.id },
        data: { balance: { increment: 1000000 }, starterCreditGranted: true },
      });
      return { alreadyClaimed: false, credited: 1000000, balance: Number(updated.balance) };
    });
  }

  /**
   * Upsert a platform-level holding wallet by type.
   * Types: 'HOLDING' | 'REVENUE' | 'REFUND_RESERVE'
   * Creates the record on first access; never throws if it already exists.
   */
  async getPlatformWallet(type: 'HOLDING' | 'REVENUE' | 'REFUND_RESERVE') {
    return this.prisma.platformWallet.upsert({
      where: { type },
      create: { type, balance: 0, currency: 'KES' },
      update: {},
    });
  }
}
