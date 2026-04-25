import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../common/services/prisma.service';
import { WalletService } from '../wallet/wallet.service';

@Injectable()
export class SubscriptionBillingService {
  private readonly logger = new Logger(SubscriptionBillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
  ) {}

  @Cron('0 8 * * *') // runs daily at 8 AM
  async processRenewals(): Promise<void> {
    this.logger.log('Running subscription renewal job...');
    const now = new Date();

    await this._renewDueSubscriptions(now);
    await this._expireGracePeriodSubscriptions(now);
    await this._sendRenewalReminders(now);

    this.logger.log('Subscription renewal job complete.');
  }

  /** Attempt to renew all ACTIVE subscriptions expiring by tomorrow */
  private async _renewDueSubscriptions(now: Date): Promise<void> {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const dueSubs = await this.prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        autoRenew: true,
        endDate: { lte: tomorrow },
      },
      include: {
        plan: true,
        user: { select: { id: true, firstName: true, email: true, wallet: { select: { id: true, balance: true } } } },
      },
    });

    this.logger.log(`Found ${dueSubs.length} subscriptions due for renewal`);

    for (const sub of dueSubs) {
      const planPrice = Number(sub.plan.price);
      const wallet = (sub.user as any).wallet;

      if (!wallet) {
        this.logger.warn(`User ${sub.userId} has no wallet — skipping renewal for sub ${sub.id}`);
        continue;
      }

      const hasBalance = Number(wallet.balance) >= planPrice;

      if (hasBalance) {
        try {
          await this.prisma.$transaction(async (tx) => {
            // Deduct plan price from wallet
            await this.walletService.debitWallet(
              wallet.id,
              planPrice,
              'SUBSCRIPTION',
              sub.id,
              `Subscription renewal — ${sub.plan.name}`,
              tx,
            );

            // Extend endDate by billing cycle
            const newEndDate = this._computeNextEndDate(sub.endDate, sub.plan.billingCycle);
            await tx.subscription.update({
              where: { id: sub.id },
              data: { endDate: newEndDate, status: 'ACTIVE' },
            });
          });

          // Send renewal success notification
          await this._notify(sub.userId, 'RENEWAL_SUCCESS', 'Subscription Renewed', `Your ${sub.plan.name} subscription has been renewed successfully.`);
          this.logger.log(`Renewed subscription ${sub.id} for user ${sub.userId}`);
        } catch (err) {
          this.logger.error(`Failed to renew subscription ${sub.id}: ${err}`);
          // Put in grace period on debit failure
          await this._moveToGracePeriod(sub.id, sub.userId, sub.plan.name);
        }
      } else {
        // Insufficient balance — move to grace period
        await this._moveToGracePeriod(sub.id, sub.userId, sub.plan.name);
      }
    }
  }

  /** Expire GRACE_PERIOD subscriptions where endDate is > 7 days ago */
  private async _expireGracePeriodSubscriptions(now: Date): Promise<void> {
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - 7);

    const expiringSubs = await this.prisma.subscription.findMany({
      where: {
        status: 'GRACE_PERIOD',
        endDate: { lte: cutoff },
      },
      include: { plan: true },
    });

    this.logger.log(`Found ${expiringSubs.length} subscriptions to expire from grace period`);

    for (const sub of expiringSubs) {
      await this.prisma.subscription.update({ where: { id: sub.id }, data: { status: 'EXPIRED' } });
      await this._notify(sub.userId, 'SUBSCRIPTION_EXPIRED', 'Subscription Expired', `Your ${sub.plan.name} subscription has expired. Renew to regain access.`);
      this.logger.log(`Expired subscription ${sub.id} for user ${sub.userId}`);
    }
  }

  /** Send renewal reminders for subscriptions expiring in exactly 7 days */
  private async _sendRenewalReminders(now: Date): Promise<void> {
    const sevenDaysFromNow = new Date(now);
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    // Match subscriptions expiring within a 24-hour window of 7 days out
    const windowStart = new Date(sevenDaysFromNow);
    windowStart.setHours(0, 0, 0, 0);
    const windowEnd = new Date(sevenDaysFromNow);
    windowEnd.setHours(23, 59, 59, 999);

    const remindSubs = await this.prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        endDate: { gte: windowStart, lte: windowEnd },
      },
      include: { plan: true },
    });

    this.logger.log(`Sending renewal reminders to ${remindSubs.length} users`);

    for (const sub of remindSubs) {
      await this._notify(
        sub.userId,
        'RENEWAL_REMINDER',
        'Subscription Expiring Soon',
        `Your ${sub.plan.name} subscription expires in 7 days. Enable auto-renew or top up your wallet to avoid interruption.`,
      );
    }
  }

  private async _moveToGracePeriod(subId: string, userId: string, planName: string): Promise<void> {
    await this.prisma.subscription.update({ where: { id: subId }, data: { status: 'GRACE_PERIOD' } });
    await this._notify(
      userId,
      'RENEWAL_FAILED',
      'Subscription Renewal Failed',
      `We could not renew your ${planName} subscription due to insufficient wallet balance. You have a 7-day grace period to top up.`,
    );
    this.logger.warn(`Moved subscription ${subId} to GRACE_PERIOD for user ${userId}`);
  }

  private _computeNextEndDate(currentEnd: Date, billingCycle: string): Date {
    const next = new Date(currentEnd);
    if (billingCycle === 'yearly' || billingCycle === 'annual') {
      next.setFullYear(next.getFullYear() + 1);
    } else if (billingCycle === 'quarterly') {
      next.setMonth(next.getMonth() + 3);
    } else {
      // Default: monthly (30 days)
      next.setDate(next.getDate() + 30);
    }
    return next;
  }

  private async _notify(userId: string, type: string, title: string, message: string): Promise<void> {
    try {
      await this.prisma.notification.create({
        data: {
          userId,
          type,
          channel: 'IN_APP',
          title,
          message,
          metadata: {},
          status: 'SENT',
          sentAt: new Date(),
        },
      });
    } catch (err) {
      this.logger.error(`Failed to send notification to ${userId}: ${err}`);
    }
  }
}
