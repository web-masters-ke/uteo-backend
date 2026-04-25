import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { EntryType } from '@prisma/client';

@Injectable()
export class ReconciliationService {
  constructor(private readonly prisma: PrismaService) {}

  async getReport(from: string, to: string) {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);

    const ledgerEntries = await this.prisma.ledgerEntry.findMany({
      where: { createdAt: { gte: fromDate, lte: toDate } },
      include: {
        wallet: {
          include: {
            user: { select: { firstName: true, lastName: true, email: true } },
          },
        },
        transaction: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    let runningBalance = 0;
    let totalDebits = 0;
    let totalCredits = 0;
    let totalRefunds = 0;

    const entries = ledgerEntries.map((e) => {
      const amount = Number(e.amount);
      let debit = 0;
      let credit = 0;

      if (e.entryType === EntryType.DEBIT) {
        debit = amount;
        totalDebits += amount;
        runningBalance -= amount;
      } else {
        credit = amount;
        totalCredits += amount;
        runningBalance += amount;
      }

      if (
        e.entryType === EntryType.DEBIT &&
        e.transaction.referenceType?.toUpperCase().includes('REFUND')
      ) {
        totalRefunds += amount;
      }

      const u = e.wallet.user;
      const userName =
        [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email;

      return {
        id: e.id,
        date: e.createdAt.toISOString(),
        transactionId: e.transactionId,
        type: e.transaction.referenceType ?? 'UNKNOWN',
        debit,
        credit,
        runningBalance: Math.round(runningBalance * 100) / 100,
        user: userName,
      };
    });

    const commissions = await this.prisma.commissionRecord.findMany({
      where: { createdAt: { gte: fromDate, lte: toDate } },
      select: { commissionAmount: true },
    });
    const commissionEarned = commissions.reduce(
      (sum, c) => sum + Number(c.commissionAmount),
      0,
    );

    const round = (n: number) => Math.round(n * 100) / 100;

    return {
      summary: {
        totalDebits: round(totalDebits),
        totalCredits: round(totalCredits),
        netBalance: round(totalCredits - totalDebits),
        commissionEarned: round(commissionEarned),
        totalRefunds: round(totalRefunds),
        isBalanced: Math.abs(totalDebits - totalCredits) < 0.01,
      },
      entries,
      from,
      to,
    };
  }
}
