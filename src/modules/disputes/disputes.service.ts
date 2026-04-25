import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/services/prisma.service';
import { EscrowService } from '../escrow/escrow.service';
import { SlaService } from '../sla/sla.service';
import { paginate } from '../../common/dto/pagination.dto';
import { CreateDisputeDto, ResolveDisputeDto, ListDisputesDto, EscalateDisputeDto } from './dto/disputes.dto';
@Injectable()
export class DisputesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly escrowService: EscrowService,
    private readonly slaService: SlaService,
  ) {}
  async create(userId: string, dto: CreateDisputeDto, userRole?: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id: dto.bookingId } });
    if (!booking) throw new NotFoundException('Booking not found');
    const isAdmin = ['ADMIN', 'SUPER_ADMIN', 'SUPPORT'].includes(userRole || '');
    if (!isAdmin && booking.clientId !== userId && booking.trainerId !== userId) throw new BadRequestException('Not a participant');
    const existing = await this.prisma.dispute.findFirst({ where: { bookingId: dto.bookingId, status: { in: ['OPEN','UNDER_REVIEW'] } } });
    if (existing) throw new BadRequestException('Active dispute already exists');
    // For admin-created disputes, raise on behalf of the client
    const raisedById = isAdmin ? booking.clientId : userId;
    const againstId = raisedById === booking.clientId ? booking.trainerId : booking.clientId;
    return this.prisma.$transaction(async (tx) => {
      const d = await tx.dispute.create({ data: { bookingId: dto.bookingId, raisedById, againstId, reason: dto.reason, category: dto.category ?? 'OTHER', description: dto.description, status: 'OPEN' }, include: { raisedBy: { select: { id:true, firstName:true, lastName:true } }, against: { select: { id:true, firstName:true, lastName:true } } } });
      await tx.booking.update({ where: { id: dto.bookingId }, data: { status: 'DISPUTED' } });
      await tx.bookingStatusLog.create({ data: { bookingId: dto.bookingId, fromStatus: booking.status, toStatus: 'DISPUTED', reason: dto.reason, changedBy: userId } });
      return d;
    }).then(async (d) => {
      // Auto-assign SLA policy based on dispute category (fire-and-forget, non-blocking)
      this.slaService.autoAssignOnDisputeCreate(d.id, d.category).catch(() => {});
      return d;
    });
  }
  async findAll(dto: ListDisputesDto) { const page=Number(dto.page)||1; const limit=Number(dto.limit)||20; const skip=(page-1)*limit; const where: Prisma.DisputeWhereInput = {}; if (dto.status) where.status = dto.status; if (dto.search) where.OR = [{ reason: { contains: dto.search, mode: 'insensitive' } }, { description: { contains: dto.search, mode: 'insensitive' } }]; const [items,total] = await Promise.all([this.prisma.dispute.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' }, include: { booking: { select: { id:true, amount:true, status:true, sessionType:true, scheduledAt:true, duration:true, trainerId:true, clientId:true, escrow: { select: { id:true, amount:true, status:true } }, trainer: { select: { id:true, firstName:true, lastName:true, trainerProfile: { select: { firmName:true } } } } } }, raisedBy: { select: { id:true, firstName:true, lastName:true } }, against: { select: { id:true, firstName:true, lastName:true } }, resolvedBy: { select: { id:true, firstName:true, lastName:true } }, assignedTo: { select: { id:true, firstName:true, lastName:true, avatar:true, role:true } }, _count: { select: { comments: true } } } }), this.prisma.dispute.count({ where })]); return paginate(items, total, page, limit); }
  async findOne(id: string) {
    const d = await this.prisma.dispute.findUnique({
      where: { id },
      include: {
        booking: { include: { trainer: { select: { id:true, firstName:true, lastName:true, avatar:true, trainerProfile: { select: { firmName:true } } } }, client: { select: { id:true, firstName:true, lastName:true, avatar:true } }, escrow: true, statusLogs: { orderBy: { createdAt: 'desc' }, take: 20 } } },
        raisedBy: { select: { id:true, firstName:true, lastName:true, avatar:true } },
        against: { select: { id:true, firstName:true, lastName:true, avatar:true } },
        resolvedBy: { select: { id:true, firstName:true, lastName:true, avatar:true } },
        assignedTo: { select: { id:true, firstName:true, lastName:true, avatar:true, role:true } },
        comments: { orderBy: { createdAt: 'asc' }, include: { author: { select: { id:true, firstName:true, lastName:true, avatar:true, role:true } } } },
      },
    });
    if (!d) throw new NotFoundException('Dispute not found');
    return d;
  }

  /** List disputes where the user is a participant (raiser or against) */
  async findMyDisputes(userId: string, dto: ListDisputesDto) {
    const page = Number(dto.page) || 1;
    const limit = Number(dto.limit) || 20;
    const skip = (page - 1) * limit;
    const where: Prisma.DisputeWhereInput = {
      OR: [{ raisedById: userId }, { againstId: userId }],
    };
    if (dto.status) where.status = dto.status;
    const [items, total] = await Promise.all([
      this.prisma.dispute.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: {
          booking: { select: { id: true, amount: true, status: true, sessionType: true, scheduledAt: true, duration: true, trainerId: true, clientId: true, escrow: { select: { id: true, amount: true, status: true } } } },
          raisedBy: { select: { id: true, firstName: true, lastName: true } },
          against: { select: { id: true, firstName: true, lastName: true } },
          resolvedBy: { select: { id: true, firstName: true, lastName: true } },
          assignedTo: { select: { id: true, firstName: true, lastName: true, avatar: true, role: true } },
          _count: { select: { comments: true } },
        },
      }),
      this.prisma.dispute.count({ where }),
    ]);
    return paginate(items, total, page, limit);
  }

  async resolve(id: string, dto: ResolveDisputeDto, adminId: string) {
    const dispute = await this.prisma.dispute.findUnique({ where: { id }, include: { booking: { include: { escrow: true } } } });
    if (!dispute) throw new NotFoundException('Dispute not found');
    if (!['OPEN','UNDER_REVIEW'].includes(dispute.status)) throw new BadRequestException('Dispute not open');
    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.dispute.update({ where: { id }, data: { status: dto.status, resolution: dto.resolution, resolvedById: adminId, resolvedAt: new Date() } });
      const escrowStatus = dispute.booking?.escrow?.status;
      const canActOnEscrow = escrowStatus && ['FUNDED', 'HELD', 'FROZEN'].includes(escrowStatus);
      if (dto.status==='RESOLVED_RELEASE' && canActOnEscrow) { await this.escrowService.release({ bookingId: dispute.bookingId, reason: dto.resolution }, adminId); await tx.booking.update({ where: { id: dispute.bookingId }, data: { status: 'COMPLETED', completedAt: new Date() } }); }
      else if (dto.status==='RESOLVED_REFUND' && canActOnEscrow) { await this.escrowService.refund({ bookingId: dispute.bookingId, reason: dto.resolution }, adminId); await tx.booking.update({ where: { id: dispute.bookingId }, data: { status: 'CANCELLED', cancellationReason: dto.resolution } }); }

      // Notify both parties about resolution
      const resLabel = dto.status === 'RESOLVED_RELEASE' ? 'Funds released to trainer' : dto.status === 'RESOLVED_REFUND' ? 'Funds refunded to client' : 'Closed without financial action';
      await tx.notification.create({ data: { userId: dispute.raisedById, type: 'DISPUTE_RESOLVED', channel: 'IN_APP', status: 'PENDING', title: 'Dispute Resolved', message: `Your dispute has been resolved: ${resLabel}. ${dto.resolution || ''}` } });
      await tx.notification.create({ data: { userId: dispute.againstId, type: 'DISPUTE_RESOLVED', channel: 'IN_APP', status: 'PENDING', title: 'Dispute Resolved', message: `A dispute against you has been resolved: ${resLabel}. ${dto.resolution || ''}` } });

      return updated;
    });
    // Mark SLA resolved (fire-and-forget)
    this.slaService.markResolved(id).catch(() => {});
    return this.findOne(result.id);
  }

  /**
   * Formally escalate a dispute up the support chain.
   * - Level 1 = L1 support, 2 = finance/admin, 3 = super-admin (capped).
   * - Allowed callers: raisedBy, against, assignee, or admin/support roles.
   * - Also freezes escrow the first time it is escalated, and logs a public comment.
   */
  async escalate(id: string, userId: string, userRole: string, dto: EscalateDisputeDto) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id },
      include: { booking: { include: { escrow: true } } },
    });
    if (!dispute) throw new NotFoundException('Dispute not found');

    const isAdmin = ['ADMIN', 'SUPER_ADMIN', 'SUPPORT', 'FINANCE_ADMIN'].includes(userRole || '');
    const isParty = dispute.raisedById === userId || dispute.againstId === userId;
    const isAssignee = dispute.assignedToId === userId;
    if (!isAdmin && !isParty && !isAssignee) {
      throw new BadRequestException('You are not involved in this dispute');
    }

    if (['RESOLVED_RELEASE', 'RESOLVED_REFUND', 'CLOSED'].includes(dispute.status)) {
      throw new BadRequestException('Cannot escalate a resolved or closed dispute');
    }

    const currentLevel = (dispute as any).escalationLevel ?? 1;
    if (currentLevel >= 3) {
      throw new BadRequestException('Dispute is already at the highest escalation level');
    }

    // If the caller specified a target, map it to a level; otherwise just +1
    const targetMap: Record<string, number> = { FINANCE_ADMIN: 2, SUPER_ADMIN: 3 };
    const requested = dto.escalateTo ? targetMap[dto.escalateTo] : currentLevel + 1;
    const newLevel = Math.min(3, Math.max(currentLevel + 1, requested));

    const updated = await this.prisma.$transaction(async (tx) => {
      // 1. Bump escalation metadata + move to UNDER_REVIEW on first escalation
      const data: any = {
        escalationLevel: newLevel,
        escalatedAt: new Date(),
        escalatedById: userId,
        escalationNote: dto.note,
      };
      if (dispute.status === 'OPEN') data.status = 'UNDER_REVIEW';
      const u = await tx.dispute.update({ where: { id }, data });

      // 2. Freeze escrow on first move out of OPEN (same behaviour as prior escalate())
      if (dispute.status === 'OPEN' && dispute.booking?.escrow && ['FUNDED', 'HELD'].includes(dispute.booking.escrow.status)) {
        await tx.escrowAccount.update({ where: { id: dispute.booking.escrow.id }, data: { status: 'FROZEN' } });
        await tx.escrowStatusLog.create({
          data: { escrowId: dispute.booking.escrow.id, fromStatus: dispute.booking.escrow.status, toStatus: 'FROZEN', reason: 'Dispute escalated for investigation', changedBy: userId },
        });
      }

      // 3. Public audit comment (reuse DisputeComment as history)
      await tx.disputeComment.create({
        data: {
          disputeId: id,
          authorId: userId,
          content: `Escalated to level ${newLevel}: ${dto.note}`,
          isInternal: false,
        },
      });

      // 4. Notify both parties + any assignee
      const notifBase = { type: 'DISPUTE_ESCALATED', channel: 'IN_APP' as const, status: 'PENDING' as const };
      const recipients = new Set<string>();
      if (dispute.raisedById !== userId) recipients.add(dispute.raisedById);
      if (dispute.againstId !== userId) recipients.add(dispute.againstId);
      if (dispute.assignedToId && dispute.assignedToId !== userId) recipients.add(dispute.assignedToId);
      for (const recipient of recipients) {
        await tx.notification.create({
          data: {
            ...notifBase,
            userId: recipient,
            title: 'Dispute Escalated',
            message: `Dispute ${id.slice(0, 8)} escalated to level ${newLevel}. Note: ${dto.note.slice(0, 120)}${dto.note.length > 120 ? '...' : ''}`,
            metadata: { disputeId: id, escalationLevel: newLevel },
          },
        });
      }

      // 5. Notify back-office at or above the new level
      const targetRoles: string[] =
        newLevel >= 3 ? ['SUPER_ADMIN']
        : newLevel === 2 ? ['FINANCE_ADMIN', 'ADMIN', 'SUPER_ADMIN']
        : ['SUPPORT', 'ADMIN', 'SUPER_ADMIN'];
      const admins = await tx.user.findMany({
        where: { role: { in: targetRoles as any }, status: 'ACTIVE' },
        select: { id: true },
      });
      for (const admin of admins) {
        if (admin.id === userId) continue;
        await tx.notification.create({
          data: {
            ...notifBase,
            userId: admin.id,
            title: `Dispute Escalated (L${newLevel})`,
            message: `Dispute ${id.slice(0, 8)} escalated to level ${newLevel}. Amount at stake: KES ${Number(dispute.booking?.escrow?.amount || dispute.booking?.amount || 0).toLocaleString()}`,
            metadata: { disputeId: id, escalationLevel: newLevel },
          },
        });
      }

      return u;
    });

    // Return with comments count (spec: "updated dispute with comments count")
    return this.prisma.dispute.findUnique({
      where: { id: updated.id },
      include: {
        booking: { select: { id: true, amount: true, status: true, sessionType: true, scheduledAt: true } },
        raisedBy: { select: { id: true, firstName: true, lastName: true } },
        against: { select: { id: true, firstName: true, lastName: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true, avatar: true, role: true } },
        _count: { select: { comments: true } },
      },
    });
  }

  /**
   * Assign a dispute to a team member.
   * - Admin: can assign to any ADMIN/SUPER_ADMIN/SUPPORT user
   * - Org owner (trainer who is a firm OWNER): can assign to their team members
   */
  async assign(id: string, assigneeId: string, actorId: string, actorRole: string) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id },
      include: { booking: { select: { trainerId: true, clientId: true } } },
    });
    if (!dispute) throw new NotFoundException('Dispute not found');

    const assignee = await this.prisma.user.findUnique({
      where: { id: assigneeId },
      select: { id: true, firstName: true, lastName: true, role: true },
    });
    if (!assignee) throw new NotFoundException('Assignee not found');

    const isAdmin = ['ADMIN', 'SUPER_ADMIN', 'SUPPORT', 'FINANCE_ADMIN'].includes(actorRole);
    if (!isAdmin) {
      // Org owner check — the actor must own a firm and the assignee must be on their team
      const isParty = dispute.booking.trainerId === actorId || dispute.booking.clientId === actorId;
      if (!isParty) throw new BadRequestException('You can only assign disputes involving you');
      const ownsFirm = await this.prisma.teamMember.findFirst({
        where: { firmId: actorId, userId: actorId, role: 'OWNER' },
      });
      if (!ownsFirm) throw new BadRequestException('Only org owners can assign disputes to team members');
      const inTeam = await this.prisma.teamMember.findFirst({
        where: { firmId: actorId, userId: assigneeId, isActive: true },
      });
      if (!inTeam) throw new BadRequestException('Assignee is not a member of your team');
    } else {
      // Admin assignee must have an admin-level role
      if (!['ADMIN', 'SUPER_ADMIN', 'SUPPORT', 'FINANCE_ADMIN'].includes(assignee.role)) {
        throw new BadRequestException('Admin disputes must be assigned to a back-office team member');
      }
    }

    await this.prisma.dispute.update({
      where: { id },
      data: { assignedToId: assigneeId, assignedAt: new Date(), assignedById: actorId },
    });

    // Notify the assignee
    await this.prisma.notification.create({
      data: {
        userId: assigneeId,
        type: 'DISPUTE_ASSIGNED',
        channel: 'IN_APP',
        status: 'PENDING',
        title: 'Dispute Assigned to You',
        message: `A dispute (${id.slice(0, 8)}) has been assigned to you. Reason: ${dispute.reason}`,
        metadata: { disputeId: id },
      },
    });

    // Internal comment logging the assignment
    await this.prisma.disputeComment.create({
      data: {
        disputeId: id,
        authorId: actorId,
        content: `Assigned to ${assignee.firstName} ${assignee.lastName}`,
        isInternal: true,
      },
    });

    return this.findOne(id);
  }

  /** Unassign a dispute */
  async unassign(id: string, actorId: string, actorRole: string) {
    const dispute = await this.prisma.dispute.findUnique({ where: { id } });
    if (!dispute) throw new NotFoundException('Dispute not found');
    const isAdmin = ['ADMIN', 'SUPER_ADMIN', 'SUPPORT', 'FINANCE_ADMIN'].includes(actorRole);
    if (!isAdmin && dispute.assignedById !== actorId) {
      throw new BadRequestException('Only the person who assigned or an admin can unassign');
    }
    await this.prisma.dispute.update({
      where: { id },
      data: { assignedToId: null, assignedAt: null, assignedById: null },
    });
    await this.prisma.disputeComment.create({
      data: { disputeId: id, authorId: actorId, content: 'Assignment removed', isInternal: true },
    });
    return this.findOne(id);
  }

  /** Post a comment (with optional attachments) on a dispute */
  async addComment(id: string, authorId: string, content: string, attachments?: any[], isInternal?: boolean) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id },
      include: { booking: { select: { trainerId: true, clientId: true } } },
    });
    if (!dispute) throw new NotFoundException('Dispute not found');

    // Visibility check: only parties, assignee, and admins can comment
    const author = await this.prisma.user.findUnique({ where: { id: authorId }, select: { role: true } });
    const isAdmin = author && ['ADMIN', 'SUPER_ADMIN', 'SUPPORT', 'FINANCE_ADMIN'].includes(author.role);
    const isParty = dispute.raisedById === authorId || dispute.againstId === authorId;
    const isAssignee = dispute.assignedToId === authorId;
    if (!isAdmin && !isParty && !isAssignee) {
      throw new BadRequestException('You cannot comment on this dispute');
    }

    // Only admins/assignees can post internal notes
    const internal = !!(isInternal && (isAdmin || isAssignee));

    const comment = await this.prisma.disputeComment.create({
      data: { disputeId: id, authorId, content, attachments: (attachments && attachments.length ? attachments : undefined) as any, isInternal: internal },
      include: { author: { select: { id: true, firstName: true, lastName: true, avatar: true, role: true } } },
    });

    // Record SLA first response when the opposing party or assignee posts (fire-and-forget)
    const isFirstResponder = authorId !== dispute.raisedById;
    if (!internal && isFirstResponder) {
      this.slaService.recordFirstResponse(id).catch(() => {});
    }

    // Notify the other party (and assignee, if any) — unless it's an internal note
    if (!internal) {
      const recipients = new Set<string>();
      if (dispute.raisedById !== authorId) recipients.add(dispute.raisedById);
      if (dispute.againstId !== authorId) recipients.add(dispute.againstId);
      if (dispute.assignedToId && dispute.assignedToId !== authorId) recipients.add(dispute.assignedToId);
      for (const userId of recipients) {
        await this.prisma.notification.create({
          data: {
            userId,
            type: 'DISPUTE_COMMENT',
            channel: 'IN_APP',
            status: 'PENDING',
            title: 'New Dispute Comment',
            message: `New update on dispute ${id.slice(0, 8)}: ${content.slice(0, 80)}${content.length > 80 ? '...' : ''}`,
            metadata: { disputeId: id, commentId: comment.id },
          },
        });
      }
    }
    return comment;
  }

  /** List comments visible to this user (hides internal notes from non-admins/non-assignees) */
  async listComments(id: string, userId: string, userRole: string) {
    const dispute = await this.prisma.dispute.findUnique({ where: { id } });
    if (!dispute) throw new NotFoundException('Dispute not found');
    const isAdmin = ['ADMIN', 'SUPER_ADMIN', 'SUPPORT', 'FINANCE_ADMIN'].includes(userRole);
    const isAssignee = dispute.assignedToId === userId;
    const canSeeInternal = isAdmin || isAssignee;
    return this.prisma.disputeComment.findMany({
      where: { disputeId: id, ...(canSeeInternal ? {} : { isInternal: false }) },
      orderBy: { createdAt: 'asc' },
      include: { author: { select: { id: true, firstName: true, lastName: true, avatar: true, role: true } } },
    });
  }

  /** Filer withdraws their own dispute (only if status is OPEN) */
  async withdraw(id: string, userId: string) {
    const dispute = await this.prisma.dispute.findUnique({ where: { id } });
    if (!dispute) throw new NotFoundException('Dispute not found');
    if (dispute.raisedById !== userId) throw new BadRequestException('Only the filer can withdraw a dispute');
    if (dispute.status !== 'OPEN') throw new BadRequestException('Only OPEN disputes can be withdrawn');

    await this.prisma.$transaction(async (tx) => {
      await tx.dispute.update({
        where: { id },
        data: { status: 'CLOSED', resolution: 'Withdrawn by filer', resolvedAt: new Date() },
      });
      // Revert booking status if it was marked disputed
      await tx.bookingStatusLog.create({
        data: { bookingId: dispute.bookingId, fromStatus: 'DISPUTED', toStatus: 'DISPUTED', reason: 'Dispute withdrawn by filer', changedBy: userId },
      });
      await tx.notification.create({
        data: { userId: dispute.againstId, type: 'DISPUTE_WITHDRAWN', channel: 'IN_APP', status: 'PENDING', title: 'Dispute Withdrawn', message: `The dispute against you has been withdrawn by the filer.` },
      });
    });
    return this.findOne(id);
  }

  /** List team members the current user can assign disputes to */
  async assignableTeam(userId: string, userRole: string) {
    const isAdmin = ['ADMIN', 'SUPER_ADMIN', 'SUPPORT', 'FINANCE_ADMIN'].includes(userRole);
    if (isAdmin) {
      // Back-office admins — anyone with admin/support role
      return this.prisma.user.findMany({
        where: { role: { in: ['ADMIN', 'SUPER_ADMIN', 'SUPPORT', 'FINANCE_ADMIN'] }, status: 'ACTIVE' },
        select: { id: true, firstName: true, lastName: true, email: true, avatar: true, role: true },
        orderBy: [{ role: 'asc' }, { firstName: 'asc' }],
      });
    }
    // Org owner — team members under their firm
    const team = await this.prisma.teamMember.findMany({
      where: { firmId: userId, isActive: true, userId: { not: userId } },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true, role: true } } },
      orderBy: { role: 'asc' },
    });
    return team.map((t) => ({ ...t.user, title: t.title, teamRole: t.role }));
  }
}
