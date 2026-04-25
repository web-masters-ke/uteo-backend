import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/services/prisma.service';
import { BrevoService } from '../../common/services/brevo.service';
import { BongaSmsService } from '../../common/services/bonga-sms.service';
import { paginate } from '../../common/dto/pagination.dto';
import { CreateReminderDto, ListRemindersDto } from './dto/reminders.dto';

@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly brevo: BrevoService,
    private readonly bongaSms: BongaSmsService,
  ) {}

  async create(userId: string, dto: CreateReminderDto) {
    const scheduledAt = new Date(dto.scheduledAt);
    if (scheduledAt <= new Date()) {
      throw new BadRequestException('scheduledAt must be in the future');
    }

    return this.prisma.scheduledReminder.create({
      data: {
        userId,
        type: dto.type,
        channel: dto.channel,
        title: dto.title,
        message: dto.message,
        scheduledAt,
        metadata: dto.metadata ?? Prisma.JsonNull,
        status: 'SCHEDULED',
      },
    });
  }

  async findAll(userId: string, dto: ListRemindersDto) {
    const page = Number(dto.page) || 1;
    const limit = Number(dto.limit) || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.ScheduledReminderWhereInput = { userId };
    if (dto.status) where.status = dto.status;
    if (dto.type) where.type = dto.type;

    const [items, total] = await Promise.all([
      this.prisma.scheduledReminder.findMany({
        where,
        skip,
        take: limit,
        orderBy: { scheduledAt: 'asc' },
      }),
      this.prisma.scheduledReminder.count({ where }),
    ]);

    return paginate(items, total, page, limit);
  }

  async cancel(id: string, userId: string) {
    const reminder = await this.prisma.scheduledReminder.findUnique({ where: { id } });
    if (!reminder) throw new NotFoundException('Reminder not found');
    if (reminder.userId !== userId) throw new ForbiddenException('Not your reminder');
    if (reminder.status !== 'SCHEDULED') throw new BadRequestException('Only scheduled reminders can be cancelled');

    return this.prisma.scheduledReminder.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
  }

  async createBookingReminders(userId: string, bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        trainer: { select: { id: true, firstName: true, lastName: true, name: true } },
        client: { select: { id: true, firstName: true, lastName: true, name: true, email: true, phone: true } },
      },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.clientId !== userId && booking.trainerId !== userId) {
      throw new ForbiddenException('Not your booking');
    }

    const scheduledAt = new Date(booking.scheduledAt);
    const now = new Date();
    const trainerName = booking.trainer.name || `${booking.trainer.firstName} ${booking.trainer.lastName}`;

    const reminders: { offsetMs: number; label: string }[] = [
      { offsetMs: 24 * 60 * 60 * 1000, label: '24 hours' },
      { offsetMs: 1 * 60 * 60 * 1000, label: '1 hour' },
    ];

    const created: any[] = [];

    for (const r of reminders) {
      const reminderTime = new Date(scheduledAt.getTime() - r.offsetMs);
      if (reminderTime <= now) continue; // skip if already past

      const reminder = await this.prisma.scheduledReminder.create({
        data: {
          userId: booking.clientId,
          type: 'BOOKING_REMINDER',
          channel: 'EMAIL',
          title: `Session Reminder - ${r.label} before`,
          message: `Your session with ${trainerName} is in ${r.label}. Scheduled for ${scheduledAt.toISOString()}.`,
          scheduledAt: reminderTime,
          status: 'SCHEDULED',
          metadata: { bookingId, trainerId: booking.trainerId, offsetLabel: r.label },
        },
      });
      created.push(reminder);
    }

    return { created: created.length, reminders: created };
  }

  async adminPending(dto: ListRemindersDto) {
    const page = Number(dto.page) || 1;
    const limit = Number(dto.limit) || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.ScheduledReminderWhereInput = { status: 'SCHEDULED' };

    const [items, total] = await Promise.all([
      this.prisma.scheduledReminder.findMany({
        where,
        skip,
        take: limit,
        orderBy: { scheduledAt: 'asc' },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        },
      }),
      this.prisma.scheduledReminder.count({ where }),
    ]);

    return paginate(items, total, page, limit);
  }

  /**
   * Process due reminders — intended to be called by a cron job or scheduler.
   * Finds all SCHEDULED reminders where scheduledAt <= now and dispatches them.
   */
  async processDueReminders() {
    const due = await this.prisma.scheduledReminder.findMany({
      where: {
        status: 'SCHEDULED',
        scheduledAt: { lte: new Date() },
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, name: true, email: true, phone: true } },
      },
      take: 50,
      orderBy: { scheduledAt: 'asc' },
    });

    for (const reminder of due) {
      try {
        let sent = false;
        const userName = reminder.user.name || reminder.user.firstName || 'there';

        if (reminder.channel === 'EMAIL' && reminder.user.email) {
          sent = await this.brevo.sendNotificationEmail(
            reminder.user.email,
            userName,
            reminder.title,
            reminder.message,
          );
        } else if (reminder.channel === 'SMS' && reminder.user.phone) {
          sent = await this.bongaSms.sendSms(reminder.user.phone, `${reminder.title}: ${reminder.message}`);
        } else if (reminder.channel === 'IN_APP') {
          // Create in-app notification
          await this.prisma.notification.create({
            data: {
              userId: reminder.userId,
              type: reminder.type,
              channel: 'IN_APP',
              title: reminder.title,
              message: reminder.message,
              metadata: reminder.metadata ?? Prisma.JsonNull,
              status: 'SENT',
              sentAt: new Date(),
            },
          });
          sent = true;
        }

        await this.prisma.scheduledReminder.update({
          where: { id: reminder.id },
          data: {
            status: sent ? 'SENT' : 'FAILED',
            sentAt: sent ? new Date() : null,
          },
        });
      } catch (error) {
        this.logger.error(`Failed to process reminder ${reminder.id}: ${error}`);
        await this.prisma.scheduledReminder.update({
          where: { id: reminder.id },
          data: { status: 'FAILED' },
        });
      }
    }

    return { processed: due.length };
  }
}
