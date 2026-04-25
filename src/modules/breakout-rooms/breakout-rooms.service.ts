import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { CreateBreakoutRoomDto, UpdateBreakoutParticipantsDto, MoveParticipantDto, ProvisionRoomsDto } from './dto/breakout-rooms.dto';

const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN', 'SUPPORT'];

@Injectable()
export class BreakoutRoomsService {
  constructor(private readonly prisma: PrismaService) {}

  // ---- helpers --------------------------------------------------------------

  private isAdmin(role?: string) {
    return !!role && ADMIN_ROLES.includes(role);
  }

  private slugify(name: string): string {
    return (
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40) || 'room'
    );
  }

  private randomSuffix(len = 4): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let out = '';
    for (let i = 0; i < len; i++) {
      out += chars[Math.floor(Math.random() * chars.length)];
    }
    return out;
  }

  private async fetchBookingOrThrow(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: { id: true, trainerId: true, clientId: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    return booking;
  }

  private async fetchRoomOrThrow(roomId: string) {
    const room = await this.prisma.videoSessionRoom.findUnique({ where: { id: roomId } });
    if (!room) throw new NotFoundException('Breakout room not found');
    return room;
  }

  /**
   * Users considered part of a booking's session universe.
   * = booking.clientId + booking.trainerId + any team members of the trainer's firm.
   * + any user already listed as a participant in any existing VideoSessionRoom for this booking.
   */
  private async allowedParticipantUniverse(bookingId: string): Promise<Set<string>> {
    const booking = await this.fetchBookingOrThrow(bookingId);
    const universe = new Set<string>([booking.trainerId, booking.clientId]);

    // Team members of the trainer's org (if the trainer is part of a firm)
    const trainerTeam = await this.prisma.teamMember.findMany({
      where: { firmId: booking.trainerId, isActive: true },
      select: { userId: true },
    });
    trainerTeam.forEach((t) => universe.add(t.userId));

    // If the trainer themself is a team member of some firm, add the firm owner + other firm members
    const membership = await this.prisma.teamMember.findFirst({
      where: { userId: booking.trainerId, isActive: true },
      select: { firmId: true },
    });
    if (membership?.firmId) {
      universe.add(membership.firmId);
      const siblings = await this.prisma.teamMember.findMany({
        where: { firmId: membership.firmId, isActive: true },
        select: { userId: true },
      });
      siblings.forEach((t) => universe.add(t.userId));
    }

    // Anyone already granted in previous rooms for this booking
    const existingRooms = await this.prisma.videoSessionRoom.findMany({
      where: { bookingId },
      select: { participants: true, hostId: true },
    });
    for (const r of existingRooms) {
      r.participants.forEach((p) => universe.add(p));
      if (r.hostId) universe.add(r.hostId);
    }

    return universe;
  }

  private async assertBookingVisibility(bookingId: string, userId: string, userRole?: string) {
    const booking = await this.fetchBookingOrThrow(bookingId);
    if (this.isAdmin(userRole)) return booking;
    if (userId === booking.trainerId || userId === booking.clientId) return booking;

    // Team members of the trainer's firm may also view sessions
    const isTeamMember = await this.prisma.teamMember.findFirst({
      where: { firmId: booking.trainerId, userId, isActive: true },
      select: { id: true },
    });
    if (isTeamMember) return booking;

    throw new ForbiddenException('Not authorized for this booking');
  }

  private async summarizeUsers(userIds: string[]) {
    if (!userIds.length) return [];
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, firstName: true, lastName: true, avatar: true },
    });
    return users;
  }

  private async enrichRoom(room: any) {
    const participantIds: string[] = [...(room.participants || [])];
    if (room.hostId && !participantIds.includes(room.hostId)) participantIds.push(room.hostId);
    const users = await this.summarizeUsers(participantIds);
    const byId = new Map(users.map((u) => [u.id, u]));
    return {
      ...room,
      participants: (room.participants || []).map(
        (id: string) =>
          byId.get(id) || { id, firstName: null, lastName: null, avatar: null },
      ),
      host: room.hostId ? byId.get(room.hostId) || null : null,
    };
  }

  // ---- queries --------------------------------------------------------------

  async listForBooking(bookingId: string, userId: string, userRole?: string) {
    await this.assertBookingVisibility(bookingId, userId, userRole);

    const rooms = await this.prisma.videoSessionRoom.findMany({
      where: { bookingId },
      orderBy: { openedAt: 'asc' },
    });

    // Build tree
    const byId = new Map<string, any>();
    for (const r of rooms) {
      byId.set(r.id, { ...(await this.enrichRoom(r)), breakouts: [] });
    }
    const roots: any[] = [];
    for (const r of rooms) {
      const node = byId.get(r.id);
      if (r.parentRoomId && byId.has(r.parentRoomId)) {
        byId.get(r.parentRoomId).breakouts.push(node);
      } else {
        roots.push(node);
      }
    }
    return roots;
  }

  // ---- mutations ------------------------------------------------------------

  async createBreakout(
    bookingId: string,
    userId: string,
    userRole: string | undefined,
    dto: CreateBreakoutRoomDto,
  ) {
    const booking = await this.fetchBookingOrThrow(bookingId);

    // Only the trainer of the booking (or an admin) can create breakouts
    const isTrainer = userId === booking.trainerId;
    const isAdmin = this.isAdmin(userRole);
    if (!isTrainer && !isAdmin) {
      throw new ForbiddenException('Only the trainer or an admin can create breakout rooms');
    }

    const universe = await this.allowedParticipantUniverse(bookingId);
    const invalid = dto.participantUserIds.filter((id) => !universe.has(id));
    if (invalid.length) {
      throw new BadRequestException(
        `Participants not part of this session: ${invalid.join(', ')}`,
      );
    }

    const hostUserId = dto.hostUserId || booking.trainerId;
    if (!universe.has(hostUserId)) {
      throw new BadRequestException('Host must be part of the session');
    }

    // Parent room: auto-create one if none exists so the breakouts sit beneath it
    let parentRoom = await this.prisma.videoSessionRoom.findFirst({
      where: { bookingId, parentRoomId: null },
      orderBy: { openedAt: 'asc' },
    });
    if (!parentRoom) {
      const bookingShort = booking.id.split('-')[0];
      parentRoom = await this.prisma.videoSessionRoom.create({
        data: {
          bookingId,
          parentRoomId: null,
          name: 'Main room',
          jaasRoomName: `uteo-session-${bookingShort}-main-${this.randomSuffix()}`,
          participants: Array.from(universe),
          hostId: booking.trainerId,
          status: 'OPEN',
        },
      });
    }

    const bookingShort = booking.id.split('-')[0];
    const jaasRoomName = `uteo-session-${bookingShort}-${this.slugify(dto.name)}-${this.randomSuffix()}`;

    const created = await this.prisma.videoSessionRoom.create({
      data: {
        bookingId,
        parentRoomId: parentRoom.id,
        name: dto.name,
        jaasRoomName,
        participants: Array.from(new Set(dto.participantUserIds)),
        hostId: hostUserId,
        status: 'OPEN',
      },
    });

    return this.enrichRoom(created);
  }

  async updateParticipants(roomId: string, userId: string, userRole: string | undefined, dto: UpdateBreakoutParticipantsDto) {
    const room = await this.fetchRoomOrThrow(roomId);
    const booking = await this.fetchBookingOrThrow(room.bookingId);

    const isHost = room.hostId === userId;
    const isTrainer = booking.trainerId === userId;
    const isAdmin = this.isAdmin(userRole);
    if (!isHost && !isTrainer && !isAdmin) {
      throw new ForbiddenException('Only the host, trainer, or admin can update participants');
    }

    const universe = await this.allowedParticipantUniverse(room.bookingId);
    for (const id of dto.add || []) {
      if (!universe.has(id)) throw new BadRequestException(`User ${id} is not part of this session`);
    }

    const current = new Set(room.participants);
    (dto.add || []).forEach((id) => current.add(id));
    (dto.remove || []).forEach((id) => current.delete(id));

    const updated = await this.prisma.videoSessionRoom.update({
      where: { id: roomId },
      data: { participants: Array.from(current) },
    });
    return this.enrichRoom(updated);
  }

  async closeBreakout(roomId: string, userId: string, userRole: string | undefined) {
    const room = await this.fetchRoomOrThrow(roomId);
    const booking = await this.fetchBookingOrThrow(room.bookingId);
    const isHost = room.hostId === userId;
    const isTrainer = booking.trainerId === userId;
    const isAdmin = this.isAdmin(userRole);
    if (!isHost && !isTrainer && !isAdmin) {
      throw new ForbiddenException('Only the host, trainer, or admin can close this room');
    }
    if (room.status === 'CLOSED') return this.enrichRoom(room);

    const updated = await this.prisma.videoSessionRoom.update({
      where: { id: roomId },
      data: { status: 'CLOSED', closedAt: new Date() },
    });
    return this.enrichRoom(updated);
  }

  async reopenBreakout(roomId: string, userId: string, userRole: string | undefined) {
    const room = await this.fetchRoomOrThrow(roomId);
    const booking = await this.fetchBookingOrThrow(room.bookingId);
    const isHost = room.hostId === userId;
    const isTrainer = booking.trainerId === userId;
    const isAdmin = this.isAdmin(userRole);
    if (!isHost && !isTrainer && !isAdmin) {
      throw new ForbiddenException('Only the host, trainer, or admin can reopen this room');
    }
    if (room.status === 'OPEN') return this.enrichRoom(room);

    const updated = await this.prisma.videoSessionRoom.update({
      where: { id: roomId },
      data: { status: 'OPEN', closedAt: null },
    });
    return this.enrichRoom(updated);
  }

  /**
   * Atomically moves a participant from one breakout room to another.
   * The main room's participant list is never modified (it represents the full
   * session universe). Only breakout-level assignment changes.
   */
  async moveParticipant(
    toRoomId: string,
    callerId: string,
    userRole: string | undefined,
    dto: MoveParticipantDto,
  ) {
    const toRoom = await this.fetchRoomOrThrow(toRoomId);
    const booking = await this.fetchBookingOrThrow(toRoom.bookingId);

    const isTrainer = booking.trainerId === callerId;
    const isAdmin = this.isAdmin(userRole);
    if (!isTrainer && !isAdmin) {
      throw new ForbiddenException('Only the trainer or admin can move participants');
    }

    const universe = await this.allowedParticipantUniverse(toRoom.bookingId);
    if (!universe.has(dto.userId)) {
      throw new BadRequestException('User is not part of this session');
    }

    await this.prisma.$transaction(async (tx) => {
      // Remove from source breakout (if supplied and different)
      if (dto.fromRoomId && dto.fromRoomId !== toRoomId) {
        const fromRoom = await tx.videoSessionRoom.findUnique({ where: { id: dto.fromRoomId } });
        if (fromRoom && fromRoom.bookingId === toRoom.bookingId) {
          await tx.videoSessionRoom.update({
            where: { id: dto.fromRoomId },
            data: { participants: fromRoom.participants.filter((p) => p !== dto.userId) },
          });
        }
      }
      // Add to target breakout
      const current = new Set(toRoom.participants);
      current.add(dto.userId);
      await tx.videoSessionRoom.update({
        where: { id: toRoomId },
        data: { participants: Array.from(current) },
      });
    });

    const updated = await this.prisma.videoSessionRoom.findUnique({ where: { id: toRoomId } });
    return this.enrichRoom(updated);
  }

  /**
   * Provisions N named breakout rooms under this booking's main room.
   * Creates the main room first if it doesn't exist yet.
   * Idempotent for existing rooms — only adds the diff up to `count`.
   */
  async provisionRooms(
    bookingId: string,
    callerId: string,
    userRole: string | undefined,
    dto: ProvisionRoomsDto,
  ) {
    const booking = await this.fetchBookingOrThrow(bookingId);

    const isTrainer = booking.trainerId === callerId;
    const isAdmin = this.isAdmin(userRole);
    if (!isTrainer && !isAdmin) {
      throw new ForbiddenException('Only the trainer or admin can provision rooms');
    }

    // Ensure main room exists
    let parentRoom = await this.prisma.videoSessionRoom.findFirst({
      where: { bookingId, parentRoomId: null },
      orderBy: { openedAt: 'asc' },
    });
    if (!parentRoom) {
      const universe = await this.allowedParticipantUniverse(bookingId);
      const bookingShort = booking.id.split('-')[0];
      parentRoom = await this.prisma.videoSessionRoom.create({
        data: {
          bookingId,
          parentRoomId: null,
          name: 'Main Room',
          jaasRoomName: `uteo-session-${bookingShort}-main-${this.randomSuffix()}`,
          participants: Array.from(universe),
          hostId: booking.trainerId,
          status: 'OPEN',
        },
      });
    }

    // Count how many breakout rooms already exist
    const existing = await this.prisma.videoSessionRoom.count({
      where: { bookingId, parentRoomId: { not: null } },
    });
    const toCreate = Math.max(0, dto.count - existing);

    const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const bookingShort = booking.id.split('-')[0];
    const created: any[] = [];

    for (let i = 0; i < toCreate; i++) {
      const idx = existing + i;
      const label = ALPHA[idx] ?? `${idx + 1}`;
      const name = dto.names?.[idx] || `Group ${label}`;
      const jaasRoomName = `uteo-session-${bookingShort}-${this.slugify(name)}-${this.randomSuffix()}`;
      const room = await this.prisma.videoSessionRoom.create({
        data: {
          bookingId,
          parentRoomId: parentRoom.id,
          name,
          jaasRoomName,
          participants: [booking.trainerId],
          hostId: booking.trainerId,
          status: 'OPEN',
        },
      });
      created.push(await this.enrichRoom(room));
    }

    // Re-fetch full tree so caller gets authoritative state
    const allRooms = await this.listForBooking(bookingId, callerId, userRole);
    return { parentRooms: allRooms, provisioned: created.length };
  }

  async assignHost(roomId: string, userId: string, userRole: string | undefined, newHostUserId: string) {
    const room = await this.fetchRoomOrThrow(roomId);
    const booking = await this.fetchBookingOrThrow(room.bookingId);
    const isTrainer = booking.trainerId === userId;
    const isAdmin = this.isAdmin(userRole);
    if (!isTrainer && !isAdmin) {
      throw new ForbiddenException('Only the trainer or an admin can assign hosts');
    }

    const universe = await this.allowedParticipantUniverse(room.bookingId);
    if (!universe.has(newHostUserId)) {
      throw new BadRequestException('New host must be part of the session');
    }

    // Ensure the new host is in the participants array
    const participants = new Set(room.participants);
    participants.add(newHostUserId);

    const updated = await this.prisma.videoSessionRoom.update({
      where: { id: roomId },
      data: { hostId: newHostUserId, participants: Array.from(participants) },
    });
    return this.enrichRoom(updated);
  }
}
