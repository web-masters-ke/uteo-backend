import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { CreateTicketDto, UpdateTicketDto, ReplyTicketDto } from './dto/support.dto';

const STAFF_ROLES = new Set(['ADMIN', 'SUPER_ADMIN', 'SUPPORT', 'FINANCE_ADMIN']);

@Injectable()
export class SupportService {
  constructor(private readonly prisma: PrismaService) {}

  private isStaff(role?: string) {
    return !!role && STAFF_ROLES.has(role);
  }

  async create(userId: string, dto: CreateTicketDto) {
    return this.prisma.supportTicket.create({
      data: {
        userId,
        subject: dto.subject.trim(),
        description: dto.description?.trim() || null,
        category: dto.category?.trim() || null,
        priority: dto.priority ?? 'MEDIUM',
      },
    });
  }

  async list(userId: string, userRole?: string) {
    // Staff sees everything; users only see their own
    const where = this.isStaff(userRole) ? {} : { userId };
    return this.prisma.supportTicket.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true } },
        _count: { select: { replies: true } },
      },
    });
  }

  async findOne(id: string, userId: string, userRole?: string) {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true } },
        replies: {
          orderBy: { createdAt: 'asc' },
          include: { author: { select: { id: true, firstName: true, lastName: true, avatar: true } } },
        },
      },
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    if (!this.isStaff(userRole) && ticket.userId !== userId) {
      throw new ForbiddenException('Not your ticket');
    }
    return ticket;
  }

  async update(id: string, userId: string, dto: UpdateTicketDto, userRole?: string) {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id } });
    if (!ticket) throw new NotFoundException('Ticket not found');
    const staff = this.isStaff(userRole);
    // Owner can only close their own ticket; status/priority changes otherwise are staff-only
    if (!staff) {
      if (ticket.userId !== userId) throw new ForbiddenException('Not your ticket');
      if (dto.priority || (dto.status && dto.status !== 'CLOSED')) {
        throw new ForbiddenException('Only support staff can change priority or status');
      }
    }
    const closing = dto.status === 'CLOSED' || dto.status === 'RESOLVED';
    return this.prisma.supportTicket.update({
      where: { id },
      data: {
        status: dto.status ?? ticket.status,
        priority: dto.priority ?? ticket.priority,
        closedAt: closing ? new Date() : ticket.closedAt,
      },
    });
  }

  async reply(id: string, userId: string, dto: ReplyTicketDto, userRole?: string) {
    const ticket = await this.prisma.supportTicket.findUnique({ where: { id } });
    if (!ticket) throw new NotFoundException('Ticket not found');
    const staff = this.isStaff(userRole);
    if (!staff && ticket.userId !== userId) throw new ForbiddenException('Not your ticket');
    const reply = await this.prisma.supportTicketReply.create({
      data: { ticketId: id, authorId: userId, body: dto.body.trim(), isStaff: staff },
      include: { author: { select: { id: true, firstName: true, lastName: true, avatar: true } } },
    });
    // Bump ticket updatedAt + adjust status: staff reply moves to WAITING_USER, user reply to IN_PROGRESS
    await this.prisma.supportTicket.update({
      where: { id },
      data: {
        status: staff
          ? (ticket.status === 'OPEN' || ticket.status === 'IN_PROGRESS' ? 'WAITING_USER' : ticket.status)
          : (ticket.status === 'WAITING_USER' || ticket.status === 'OPEN' ? 'IN_PROGRESS' : ticket.status),
      },
    });
    return reply;
  }
}
