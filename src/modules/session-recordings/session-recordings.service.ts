import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';

@Injectable()
export class SessionRecordingsService {
  constructor(private readonly prisma: PrismaService) {}

  async save(bookingId: string, userId: string, dto: { url: string; durationSec?: number; startedAt: string; endedAt?: string; metadata?: any }) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId }, select: { id: true, trainerId: true, clientId: true } });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.trainerId !== userId) throw new ForbiddenException('Only the trainer can save recordings');
    if (!dto.url) throw new BadRequestException('url required');
    return this.prisma.sessionRecording.create({
      data: {
        bookingId,
        url: dto.url,
        durationSec: dto.durationSec,
        startedAt: new Date(dto.startedAt),
        endedAt: dto.endedAt ? new Date(dto.endedAt) : null,
        recordedBy: userId,
        metadata: dto.metadata ?? undefined,
      },
    });
  }

  async listForBooking(bookingId: string, userId: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId }, select: { trainerId: true, clientId: true } });
    if (!booking) throw new NotFoundException('Booking not found');
    if (![booking.trainerId, booking.clientId].includes(userId)) {
      const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
      if (!u || !['ADMIN', 'SUPER_ADMIN', 'SUPPORT'].includes(u.role)) throw new ForbiddenException('Not a participant');
    }
    return this.prisma.sessionRecording.findMany({ where: { bookingId }, orderBy: { startedAt: 'desc' } });
  }

  async listMy(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.sessionRecording.findMany({
        where: { booking: { OR: [{ trainerId: userId }, { clientId: userId }] } },
        include: { booking: { select: { id: true, scheduledAt: true, sessionType: true, trainer: { select: { firstName: true, lastName: true } }, client: { select: { firstName: true, lastName: true } } } } },
        orderBy: { startedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.sessionRecording.count({ where: { booking: { OR: [{ trainerId: userId }, { clientId: userId }] } } }),
    ]);
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async remove(id: string, userId: string) {
    const rec = await this.prisma.sessionRecording.findUnique({ where: { id }, include: { booking: { select: { trainerId: true } } } });
    if (!rec) throw new NotFoundException('Recording not found');
    if (rec.booking.trainerId !== userId) {
      const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
      if (!u || !['ADMIN', 'SUPER_ADMIN'].includes(u.role)) throw new ForbiddenException('Not allowed');
    }
    await this.prisma.sessionRecording.delete({ where: { id } });
    return { success: true };
  }
}
