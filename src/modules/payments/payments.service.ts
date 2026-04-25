import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { Prisma, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../../common/services/prisma.service';
import { paginate } from '../../common/dto/pagination.dto';
import { InitiateMpesaDto, MpesaWebhookDto, ListPaymentsDto } from './dto/payments.dto';
import { DarajaService } from './daraja.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly daraja: DarajaService,
  ) {}

  async initiateMpesa(userId: string, dto: InitiateMpesaDto) {
    const payment = await this.prisma.payment.create({
      data: {
        userId,
        amount: dto.amount,
        currency: 'KES',
        provider: 'MPESA',
        status: 'PENDING',
        metadata: {
          phone: dto.phone,
          accountReference: dto.accountReference || 'PTAK',
          description: dto.description || 'PTAK Payment',
        },
      },
    });

    try {
      const result = await this.daraja.stkPush({
        phone: dto.phone,
        amount: dto.amount,
        accountReference: dto.accountReference || `SS${payment.id.slice(0, 6)}`,
        description: dto.description || 'PTAK',
      });
      // Persist the merchant/checkout request IDs so the callback can reconcile
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          providerReference: result.checkoutRequestId,
          status: 'PROCESSING',
          metadata: {
            ...(payment.metadata as any),
            merchantRequestId: result.merchantRequestId,
            checkoutRequestId: result.checkoutRequestId,
            daraja: result.responseDescription,
            mock: result.mock ?? false,
          },
        },
      });
      return {
        paymentId: payment.id,
        status: 'PROCESSING',
        message: result.customerMessage,
        merchantRequestId: result.merchantRequestId,
        checkoutRequestId: result.checkoutRequestId,
        mock: result.mock ?? false,
      };
    } catch (err: any) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'FAILED', metadata: { ...(payment.metadata as any), error: err.message } },
      });
      throw err;
    }
  }

  /**
   * Called by Safaricom on STK push completion.
   * Matches by checkoutRequestId stored in Payment.providerReference.
   */
  async handleMpesaWebhook(dto: MpesaWebhookDto) {
    this.logger.log(`M-Pesa webhook: ${JSON.stringify(dto)}`);
    const parsed = this.daraja.parseCallback(dto);
    if (!parsed.checkoutRequestId) return { ResultCode: 0, ResultDesc: 'Accepted' };

    const payment = await this.prisma.payment.findFirst({
      where: { providerReference: parsed.checkoutRequestId },
    });
    if (!payment) {
      this.logger.warn(`Callback for unknown checkoutRequestId=${parsed.checkoutRequestId}`);
      return { ResultCode: 0, ResultDesc: 'Accepted' };
    }

    if (parsed.success) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'SUCCESS',
          providerReference: parsed.mpesaReceiptNumber || payment.providerReference,
          metadata: {
            ...(payment.metadata as any),
            mpesaReceiptNumber: parsed.mpesaReceiptNumber,
            transactionDate: parsed.transactionDate,
            resultDesc: parsed.resultDesc,
          },
        },
      });
      // Credit wallet if this was a wallet deposit
      await this.creditWalletFromPayment(payment.id).catch((e) =>
        this.logger.error(`Wallet credit from payment failed: ${e.message}`),
      );
    } else {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'FAILED',
          metadata: {
            ...(payment.metadata as any),
            resultCode: parsed.resultCode,
            resultDesc: parsed.resultDesc,
          },
        },
      });
    }
    return { ResultCode: 0, ResultDesc: 'Accepted' };
  }

  private async creditWalletFromPayment(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) return;
    const meta = (payment.metadata as any) || {};
    if (meta.channel !== 'wallet_topup') return; // only credit wallet deposits
    const wallet = await this.prisma.wallet.findUnique({ where: { userId: payment.userId } });
    if (!wallet) return;
    // Idempotent: check for existing WalletTransaction tied to this payment
    const existing = await this.prisma.walletTransaction.findFirst({
      where: { referenceType: 'DEPOSIT', referenceId: payment.id },
    });
    if (existing) return;
    await this.prisma.$transaction(async (tx) => {
      const walletTx = await tx.walletTransaction.create({
        data: {
          referenceType: 'DEPOSIT',
          referenceId: payment.id,
          idempotencyKey: `deposit-${payment.id}`,
          description: `M-Pesa deposit ${meta.mpesaReceiptNumber || ''}`.trim(),
        },
      });
      await tx.ledgerEntry.create({
        data: {
          walletId: wallet.id,
          transactionId: walletTx.id,
          entryType: 'CREDIT',
          amount: payment.amount,
        },
      });
      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { increment: payment.amount } },
      });
    });
  }

  async findAll(userId: string, dto: ListPaymentsDto, isAdmin: boolean) {
    const page=Number(dto.page)||1; const limit=Number(dto.limit)||20; const skip=(page-1)*limit;
    const where: Prisma.PaymentWhereInput = {}; if (!isAdmin) where.userId = userId; if (dto.status) where.status = dto.status; if (dto.provider) where.provider = dto.provider;
    const [items,total] = await Promise.all([this.prisma.payment.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' }, include: { user: { select: { id:true, firstName:true, lastName:true, email:true } } } }), this.prisma.payment.count({ where })]);
    return paginate(items, total, page, limit);
  }

  async findOne(id: string) { const p = await this.prisma.payment.findUnique({ where: { id }, include: { user: { select: { id:true, firstName:true, lastName:true, email:true } } } }); if (!p) throw new NotFoundException('Payment not found'); return p; }

  async getStats() {
    const [total, byStatus, byProvider, totalAmount] = await Promise.all([
      this.prisma.payment.count(),
      this.prisma.payment.groupBy({ by: ['status'], _count: true, _sum: { amount: true } }),
      this.prisma.payment.groupBy({ by: ['provider'], _count: true, _sum: { amount: true } }),
      this.prisma.payment.aggregate({ _sum: { amount: true }, where: { status: 'SUCCESS' } }),
    ]);
    return {
      total,
      totalSuccessful: totalAmount._sum.amount||0,
      byStatus: byStatus.map(s=>({ status: s.status, count: s._count, amount: s._sum.amount||0 })),
      byProvider: byProvider.map(p=>({ provider: p.provider, count: p._count, amount: p._sum.amount||0 })),
    };
  }

  async updatePayment(id: string, status: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id } });
    if (!payment) throw new NotFoundException('Payment not found');
    const validStatuses: PaymentStatus[] = ['PENDING','PROCESSING','SUCCESS','FAILED','REFUNDED'];
    if (!validStatuses.includes(status as PaymentStatus)) throw new BadRequestException(`Invalid status: ${status}. Valid: ${validStatuses.join(', ')}`);
    const transitions: Record<string, string[]> = {
      PENDING: ['PROCESSING', 'SUCCESS', 'FAILED'],
      PROCESSING: ['SUCCESS', 'FAILED'],
      SUCCESS: ['REFUNDED'],
      FAILED: [],
      REFUNDED: [],
    };
    const allowed = transitions[payment.status] || [];
    if (!allowed.includes(status)) throw new BadRequestException(`Cannot transition from ${payment.status} to ${status}. Allowed: ${allowed.join(', ') || 'none'}`);
    this.logger.log(`Payment ${id} status change: ${payment.status} -> ${status}`);
    return this.prisma.payment.update({ where: { id }, data: { status: status as PaymentStatus }, include: { user: { select: { id:true, firstName:true, lastName:true, email:true } } } });
  }
}
