import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { paginate } from '../../common/dto/pagination.dto';
import { CreateConversationDto, SendMessageDto, UpdateMessageFileDto, ListConversationsDto, ListMessagesDto } from './dto/chat.dto';

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async createOrGet(userId: string, dto: CreateConversationDto) {
    if (!dto.participantIds.includes(userId)) dto.participantIds.push(userId);

    if (dto.type === 'DIRECT' && dto.participantIds.length === 2) {
      const existing = await this.prisma.conversation.findFirst({
        where: {
          type: 'DIRECT',
          AND: dto.participantIds.map((pid) => ({
            participants: { some: { userId: pid, leftAt: null } },
          })),
        },
        include: {
          participants: { include: { user: { select: { id: true, firstName: true, lastName: true, avatar: true } } } },
          messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      });
      if (existing && existing.participants.filter((p) => !p.leftAt).length === 2) return existing;
    }

    if (dto.type === 'BOOKING' && dto.bookingId) {
      const ex = await this.prisma.conversation.findUnique({
        where: { bookingId: dto.bookingId },
        include: { participants: { include: { user: { select: { id: true, firstName: true, lastName: true, avatar: true } } } } },
      });
      if (ex) return ex;
    }

    return this.prisma.conversation.create({
      data: {
        type: dto.type,
        bookingId: dto.bookingId,
        participants: { create: dto.participantIds.map((id) => ({ userId: id })) },
      },
      include: { participants: { include: { user: { select: { id: true, firstName: true, lastName: true, avatar: true } } } } },
    });
  }

  async listConversations(userId: string, dto: ListConversationsDto) {
    const page = Number(dto.page) || 1;
    const limit = Number(dto.limit) || 20;
    const skip = (page - 1) * limit;
    const where = { participants: { some: { userId, leftAt: null } } };

    const [items, total] = await Promise.all([
      this.prisma.conversation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          participants: {
            where: { leftAt: null },
            include: { user: { select: { id: true, firstName: true, lastName: true, avatar: true } } },
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: { sender: { select: { id: true, firstName: true, lastName: true } } },
          },
          booking: { select: { id: true, status: true, sessionType: true } },
        },
      }),
      this.prisma.conversation.count({ where }),
    ]);

    // Compute per-conversation unread counts using lastReadAt on participant
    const participantRecords = await this.prisma.conversationParticipant.findMany({
      where: { userId, conversationId: { in: items.map((c) => c.id) } },
      select: { conversationId: true, lastReadAt: true },
    });
    const lastReadMap = new Map(participantRecords.map((p) => [p.conversationId, p.lastReadAt]));

    const unreadCounts = await Promise.all(
      items.map(async (conv) => {
        const lastReadAt = lastReadMap.get(conv.id);
        const count = await this.prisma.message.count({
          where: {
            conversationId: conv.id,
            senderId: { not: userId },
            ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {}),
          },
        });
        return { conversationId: conv.id, count };
      }),
    );
    const unreadMap = new Map(unreadCounts.map((u) => [u.conversationId, u.count]));

    const enriched = items.map((conv) => ({ ...conv, unread: unreadMap.get(conv.id) ?? 0 }));
    return paginate(enriched, total, page, limit);
  }

  async getConversation(id: string, userId: string) {
    const c = await this.prisma.conversation.findUnique({
      where: { id },
      include: {
        participants: {
          where: { leftAt: null },
          include: { user: { select: { id: true, firstName: true, lastName: true, avatar: true } } },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 50,
          include: { sender: { select: { id: true, firstName: true, lastName: true, avatar: true } } },
        },
        booking: { select: { id: true, status: true, sessionType: true, scheduledAt: true } },
      },
    });
    if (!c) throw new NotFoundException('Conversation not found');
    if (!c.participants.some((p) => p.userId === userId)) throw new ForbiddenException('Not a participant');
    return c;
  }

  async sendMessage(convId: string, userId: string, dto: SendMessageDto) {
    const c = await this.prisma.conversation.findUnique({
      where: { id: convId },
      include: { participants: { where: { leftAt: null } } },
    });
    if (!c) throw new NotFoundException('Conversation not found');
    if (!c.participants.some((p) => p.userId === userId)) throw new ForbiddenException('Not a participant');

    const msg = await this.prisma.$transaction(async (tx) => {
      const msg = await tx.message.create({
        data: {
          conversationId: convId,
          senderId: userId,
          content: dto.content,
          messageType: dto.messageType || 'TEXT',
          fileUrl: dto.fileUrl,
        },
        include: { sender: { select: { id: true, firstName: true, lastName: true, avatar: true } } },
      });
      await tx.conversation.update({ where: { id: convId }, data: { updatedAt: new Date() } });
      await tx.conversationParticipant.update({
        where: { conversationId_userId: { conversationId: convId, userId } },
        data: { lastReadAt: new Date() },
      }).catch(() => {});
      return msg;
    });

    // Notify other participants — skip APPLICATION seed messages
    const msgType = dto.messageType || 'TEXT';
    if (msgType !== 'APPLICATION') {
      const senderName = `${msg.sender.firstName} ${msg.sender.lastName}`;
      const notifBody =
        msgType === 'VOICE_NOTE' ? 'Sent a voice note' :
        msgType === 'IMAGE' ? 'Sent an image' :
        msgType === 'FILE' ? `Sent a file: ${dto.content ?? ''}` :
        (dto.content ?? '').slice(0, 100);

      const others = c.participants.filter((p) => p.userId !== userId);
      for (const p of others) {
        this.notifications.createInApp(
          p.userId,
          'NEW_MESSAGE',
          `${senderName} sent you a message`,
          notifBody,
          { conversationId: convId },
        ).catch(() => null);
      }
    }

    return msg;
  }

  async getMessages(convId: string, userId: string, dto: ListMessagesDto) {
    const c = await this.prisma.conversation.findUnique({
      where: { id: convId },
      include: { participants: { where: { leftAt: null } } },
    });
    if (!c) throw new NotFoundException('Conversation not found');
    if (!c.participants.some((p) => p.userId === userId)) throw new ForbiddenException('Not a participant');

    const page = Number(dto.page) || 1;
    const limit = Number(dto.limit) || 50;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.message.findMany({
        where: { conversationId: convId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { sender: { select: { id: true, firstName: true, lastName: true, avatar: true } } },
      }),
      this.prisma.message.count({ where: { conversationId: convId } }),
    ]);

    // Mark all messages in this conversation as read for this user + update lastReadAt
    await Promise.all([
      this.prisma.message.updateMany({
        where: { conversationId: convId, senderId: { not: userId }, isRead: false },
        data: { isRead: true },
      }),
      this.prisma.conversationParticipant.update({
        where: { conversationId_userId: { conversationId: convId, userId } },
        data: { lastReadAt: new Date() },
      }),
    ]).catch(() => {});

    return paginate(items, total, page, limit);
  }

  async updateMessageFile(messageId: string, userId: string, dto: UpdateMessageFileDto) {
    const m = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: { conversation: { include: { participants: true } } },
    });
    if (!m) throw new NotFoundException('Message not found');
    if (m.senderId !== userId) throw new ForbiddenException('Not the sender');
    return this.prisma.message.update({
      where: { id: messageId },
      data: { fileUrl: dto.fileUrl },
      include: { sender: { select: { id: true, firstName: true, lastName: true, avatar: true } } },
    });
  }

  async markAsRead(messageId: string, userId: string) {
    const m = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: { conversation: { include: { participants: true } } },
    });
    if (!m) throw new NotFoundException('Message not found');
    if (!m.conversation.participants.some((p) => p.userId === userId)) throw new ForbiddenException('Not a participant');

    await Promise.all([
      this.prisma.message.update({ where: { id: messageId }, data: { isRead: true } }),
      this.prisma.conversationParticipant.update({
        where: { conversationId_userId: { conversationId: m.conversationId, userId } },
        data: { lastReadAt: new Date() },
      }).catch(() => {}),
    ]);
    return { message: 'Marked as read' };
  }
}
