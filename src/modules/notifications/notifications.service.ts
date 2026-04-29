import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/services/prisma.service';
import { BrevoService } from '../../common/services/brevo.service';
import { BongaSmsService } from '../../common/services/bonga-sms.service';
import { FcmService } from '../../common/services/fcm.service';
import { paginate } from '../../common/dto/pagination.dto';
import { SendNotificationDto, BulkNotificationDto, ListNotificationsDto } from './dto/notifications.dto';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly brevo: BrevoService,
    private readonly bonga: BongaSmsService,
    private readonly fcm: FcmService,
  ) {}

  async listForUser(userId: string, dto: ListNotificationsDto) {
    const page = Number(dto.page) || 1;
    const limit = Number(dto.limit) || 20;
    const skip = (page - 1) * limit;
    const where: Prisma.NotificationWhereInput = { userId };
    if (dto.type) where.type = dto.type;
    if (dto.channel) where.channel = dto.channel;
    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.notification.count({ where }),
    ]);
    return paginate(items, total, page, limit);
  }

  async markAsRead(id: string, userId: string) {
    const n = await this.prisma.notification.findFirst({ where: { id, userId } });
    if (!n) throw new NotFoundException('Notification not found');
    await this.prisma.notification.update({ where: { id }, data: { status: 'READ', readAt: new Date() } });
    return { message: 'Marked as read' };
  }

  async markAllAsRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, status: { not: 'READ' } },
      data: { status: 'READ', readAt: new Date() },
    });
    return { message: 'All marked as read' };
  }

  async send(dto: SendNotificationDto) {
    const user = await this.prisma.user.findUnique({ where: { id: dto.userId } });
    if (!user) throw new NotFoundException('User not found');
    const notif = await this.prisma.notification.create({
      data: {
        userId: dto.userId,
        type: dto.type,
        channel: dto.channel,
        title: dto.title,
        message: dto.message,
        metadata: dto.metadata || {},
        status: dto.channel === 'IN_APP' ? 'SENT' as any : 'PENDING',
        sentAt: dto.channel === 'IN_APP' ? new Date() : null,
      },
    });
    let sent = false;
    if (dto.channel === 'EMAIL') {
      sent = await this.brevo.sendNotificationEmail(user.email, user.firstName || '', dto.title, dto.message);
    } else if (dto.channel === 'SMS' && user.phone) {
      sent = await this.bonga.sendSms(user.phone, dto.message);
    } else if (dto.channel === 'IN_APP') {
      sent = true;
    } else if (dto.channel === 'PUSH') {
      const tokens: string[] = (user as any).fcmTokens ?? [];
      if (tokens.length > 0) {
        const result = await this.fcm.sendMulticast(tokens, dto.title, dto.message, (dto.metadata as Record<string, string>) ?? {});
        sent = result.successCount > 0;
      } else {
        this.logger.warn(`No FCM tokens for user ${dto.userId} — skipping PUSH`);
        sent = false;
      }
    }
    await this.prisma.notification.update({
      where: { id: notif.id },
      data: { status: sent ? 'SENT' : 'FAILED', sentAt: sent ? new Date() : null },
    });
    return notif;
  }

  async sendBulk(dto: BulkNotificationDto) {
    // If role provided instead of userIds, look up users by role
    let userIds = dto.userIds || [];
    if (dto.role && userIds.length === 0) {
      const users = await this.prisma.user.findMany({ where: { role: dto.role as any, status: 'ACTIVE', deletedAt: null }, select: { id: true } });
      userIds = users.map(u => u.id);
    }
    const results: Array<{ userId: string; status: string; id?: string }> = [];
    for (const uid of userIds) {
      try {
        const r = await this.send({
          userId: uid,
          type: dto.type ?? 'GENERAL',
          channel: dto.channel,
          title: dto.title,
          message: dto.message,
          metadata: dto.metadata,
        });
        results.push({ userId: uid, status: 'sent', id: r.id });
      } catch (e) {
        results.push({ userId: uid, status: 'failed' });
      }
    }
    return { sent: results.filter((r) => r.status === 'sent').length, results };
  }

  async createInApp(
    userId: string,
    type: string,
    title: string,
    message: string,
    metadata?: Record<string, any>,
  ) {
    return this.prisma.notification.create({
      data: {
        userId,
        type,
        channel: 'IN_APP',
        title,
        message,
        metadata: metadata || {},
        status: 'SENT',
        sentAt: new Date(),
      },
    });
  }

  /**
   * Fire EMAIL + SMS + PUSH + IN_APP all at once for a booking confirmation.
   * Called by BookingsService when a booking status transitions to CONFIRMED.
   */
  async sendBookingConfirmation(
    booking: { id: string; scheduledAt: Date | string; duration: number; sessionType: string; amount: number; currency: string },
    user: { id: string; email: string; firstName?: string | null; lastName?: string | null; phone?: string | null; fcmTokens?: string[] },
    trainer: { id: string; email: string; firstName?: string | null; lastName?: string | null },
  ): Promise<void> {
    const name = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Client';
    const trainerName = `${trainer.firstName || ''} ${trainer.lastName || ''}`.trim() || 'Your Trainer';
    const scheduledDate = new Date(booking.scheduledAt).toLocaleString('en-KE', { dateStyle: 'full', timeStyle: 'short' });
    const title = 'Booking Confirmed — Uteo';
    const body = `Hi ${name}, your session with ${trainerName} is confirmed for ${scheduledDate} (${booking.duration} min, ${booking.sessionType}). Amount: ${booking.currency} ${Number(booking.amount).toFixed(2)}.`;
    const htmlBody = `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
        <h1 style="color:#192C67">Booking Confirmed!</h1>
        <p>Hi ${name},</p>
        <p>Your training session has been confirmed.</p>
        <table style="border-collapse:collapse;width:100%;margin:16px 0">
          <tr><td style="padding:8px 0;color:#666;font-size:14px">Trainer</td><td style="padding:8px 0;font-weight:600">${trainerName}</td></tr>
          <tr><td style="padding:8px 0;color:#666;font-size:14px">Date &amp; Time</td><td style="padding:8px 0;font-weight:600">${scheduledDate}</td></tr>
          <tr><td style="padding:8px 0;color:#666;font-size:14px">Duration</td><td style="padding:8px 0;font-weight:600">${booking.duration} minutes</td></tr>
          <tr><td style="padding:8px 0;color:#666;font-size:14px">Session Type</td><td style="padding:8px 0;font-weight:600">${booking.sessionType}</td></tr>
          <tr><td style="padding:8px 0;color:#666;font-size:14px">Amount</td><td style="padding:8px 0;font-weight:600">${booking.currency} ${Number(booking.amount).toFixed(2)}</td></tr>
        </table>
        <p>Best regards,<br/>The Uteo Team</p>
      </div>`;

    const metadata: Record<string, string> = { bookingId: booking.id, trainerId: trainer.id };

    // Run all four channels in parallel; swallow individual failures so one
    // channel error does not block the others.
    await Promise.allSettled([
      // EMAIL
      (async () => {
        const sent = await this.brevo.sendTransactionalEmail(user.email, title, htmlBody);
        await this.prisma.notification.create({
          data: { userId: user.id, type: 'BOOKING_CONFIRMED', channel: 'EMAIL', title, message: body, metadata, status: sent ? 'SENT' : 'FAILED', sentAt: sent ? new Date() : null },
        });
      })(),

      // SMS
      (async () => {
        if (!user.phone) return;
        const sent = await this.bonga.sendSms(user.phone, body);
        await this.prisma.notification.create({
          data: { userId: user.id, type: 'BOOKING_CONFIRMED', channel: 'SMS', title, message: body, metadata, status: sent ? 'SENT' : 'FAILED', sentAt: sent ? new Date() : null },
        });
      })(),

      // PUSH
      (async () => {
        const tokens: string[] = user.fcmTokens ?? [];
        if (tokens.length === 0) return;
        const result = await this.fcm.sendMulticast(tokens, title, body, metadata);
        const sent = result.successCount > 0;
        await this.prisma.notification.create({
          data: { userId: user.id, type: 'BOOKING_CONFIRMED', channel: 'PUSH', title, message: body, metadata, status: sent ? 'SENT' : 'FAILED', sentAt: sent ? new Date() : null },
        });
      })(),

      // IN_APP
      this.prisma.notification.create({
        data: { userId: user.id, type: 'BOOKING_CONFIRMED', channel: 'IN_APP', title, message: body, metadata, status: 'SENT', sentAt: new Date() },
      }),
    ]);
  }
}
