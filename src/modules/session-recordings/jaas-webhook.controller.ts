import {
  Controller,
  Post,
  Body,
  Headers,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { createHmac } from 'crypto';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../common/services/prisma.service';

@Controller('webhooks')
export class JaasWebhookController {
  private readonly logger = new Logger(JaasWebhookController.name);
  private readonly secret: string;

  constructor(private readonly prisma: PrismaService) {
    this.secret = process.env.JAAS_WEBHOOK_SECRET || '';
  }

  @Public()
  @Post('jaas')
  async handleJaasWebhook(
    @Body() rawBody: any,
    @Headers('x-jaas-signature') signature: string,
  ) {
    // Validate HMAC-SHA256 signature
    this._validateSignature(JSON.stringify(rawBody), signature);

    const { event, data } = rawBody;
    this.logger.log(`JaaS webhook received: event=${event}`);

    if (event === 'RECORDING_CREATED') {
      await this._handleRecordingCreated(data);
    }

    return { received: true };
  }

  private _validateSignature(body: string, signature: string): void {
    if (!this.secret) {
      this.logger.warn('JAAS_WEBHOOK_SECRET not set — skipping signature validation');
      return;
    }
    if (!signature) throw new UnauthorizedException('Missing x-jaas-signature header');
    const expected = createHmac('sha256', this.secret).update(body).digest('hex');
    const provided = signature.replace(/^sha256=/, '');
    if (expected !== provided) {
      throw new UnauthorizedException('Invalid JaaS webhook signature');
    }
  }

  private async _handleRecordingCreated(data: any): Promise<void> {
    const { roomName, fileUrl, duration } = data ?? {};
    if (!roomName || !fileUrl) {
      throw new BadRequestException('RECORDING_CREATED event missing roomName or fileUrl');
    }

    // roomName = booking ID by convention
    const bookingId = roomName as string;

    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: { id: true, trainerId: true, clientId: true },
    });
    if (!booking) {
      this.logger.warn(`JaaS webhook: booking ${bookingId} not found — skipping`);
      return;
    }

    // Upsert session recording
    const existing = await this.prisma.sessionRecording.findFirst({
      where: { bookingId },
      orderBy: { createdAt: 'desc' },
    });

    if (existing) {
      await this.prisma.sessionRecording.update({
        where: { id: existing.id },
        data: { url: fileUrl, durationSec: duration ?? existing.durationSec },
      });
      this.logger.log(`Updated recording for booking ${bookingId}`);
    } else {
      await this.prisma.sessionRecording.create({
        data: {
          bookingId,
          url: fileUrl,
          durationSec: duration ?? null,
          startedAt: new Date(),
          recordedBy: 'jaas',
          metadata: data,
        },
      });
      this.logger.log(`Created recording for booking ${bookingId}`);
    }

    // Notify both participants
    const notificationPayload = [
      { userId: booking.trainerId, title: 'Session Recording Ready', message: 'Your session recording is ready. You can view it from the bookings section.' },
      { userId: booking.clientId, title: 'Session Recording Ready', message: 'Your session recording is ready. You can view it from the bookings section.' },
    ];

    for (const notif of notificationPayload) {
      try {
        await this.prisma.notification.create({
          data: {
            userId: notif.userId,
            type: 'RECORDING_READY',
            channel: 'IN_APP',
            title: notif.title,
            message: notif.message,
            metadata: { bookingId, fileUrl },
            status: 'SENT',
            sentAt: new Date(),
          },
        });
      } catch (err) {
        this.logger.error(`Failed to notify user ${notif.userId}: ${err}`);
      }
    }
  }
}
