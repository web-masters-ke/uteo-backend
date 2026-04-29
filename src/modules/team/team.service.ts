import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { BrevoService } from '../../common/services/brevo.service';
import { InviteDto, UpdateMemberDto, AssignBookingDto } from './dto/team.dto';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class TeamService {
  private readonly logger = new Logger(TeamService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly brevo: BrevoService,
  ) {}

  // ── Invite a consultant to the firm ───────────────────────────────────────
  async invite(firmId: string, invitedById: string, dto: InviteDto) {
    // Verify the caller is the firm owner or an ADMIN member
    await this.assertCanManage(firmId, invitedById);

    // Check for existing active member with this email
    const existingUser = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existingUser) {
      const existingMember = await this.prisma.teamMember.findUnique({
        where: { firmId_userId: { firmId, userId: existingUser.id } },
      });
      if (existingMember && existingMember.isActive) {
        throw new BadRequestException('This user is already a member of your firm');
      }
    }

    // Check for existing pending invite
    const existingInvite = await this.prisma.teamInvite.findFirst({
      where: { firmId, email: dto.email, status: 'PENDING' },
    });
    if (existingInvite) {
      throw new BadRequestException('A pending invite already exists for this email');
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const invite = await this.prisma.teamInvite.create({
      data: {
        firmId,
        email: dto.email,
        role: dto.role,
        token,
        status: 'PENDING',
        expiresAt,
      },
    });

    // Create a PENDING user account if one doesn't exist
    if (!existingUser) {
      await this.prisma.user.create({
        data: {
          email: dto.email,
          role: 'TRAINER',
          status: 'PENDING',
          passwordHash: await bcrypt.hash(randomBytes(16).toString('hex'), 12),
        },
      });
    }

    // Send invite email
    const firm = await this.prisma.user.findUnique({
      where: { id: firmId },
      select: { firstName: true, lastName: true, name: true },
    });
    const firmName = firm?.name || `${firm?.firstName || ''} ${firm?.lastName || ''}`.trim() || 'A Uteo firm';
    const acceptUrl = `${process.env.APP_URL || 'http://localhost:3000'}/team/invite?token=${token}`;

    await this.brevo.sendEmail({
      to: [{ email: dto.email }],
      subject: `You've been invited to join ${firmName} on Uteo`,
      htmlContent: `
        <h1>Team Invitation</h1>
        <p>You have been invited to join <strong>${firmName}</strong> as a <strong>${dto.role}</strong>${dto.title ? ` (${dto.title})` : ''}.</p>
        <p>Click the link below to accept the invitation:</p>
        <p><a href="${acceptUrl}">${acceptUrl}</a></p>
        <p>This invitation expires in 7 days.</p>
        <p>Best regards,<br/>The Uteo Team</p>
      `,
    });

    this.logger.log(`Invite sent to ${dto.email} for firm ${firmId}`);
    return invite;
  }

  // ── Accept an invite ──────────────────────────────────────────────────────
  async acceptInvite(token: string, userId: string) {
    const invite = await this.prisma.teamInvite.findUnique({ where: { token } });
    if (!invite) throw new NotFoundException('Invite not found');
    if (invite.status !== 'PENDING') throw new BadRequestException(`Invite is ${invite.status.toLowerCase()}`);
    if (invite.expiresAt < new Date()) {
      await this.prisma.teamInvite.update({ where: { id: invite.id }, data: { status: 'EXPIRED' } });
      throw new BadRequestException('Invite has expired');
    }

    // The accepting user must match the invited email
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.email !== invite.email) {
      throw new ForbiddenException('This invite was sent to a different email address');
    }

    // Create team member and update invite in a transaction
    const member = await this.prisma.$transaction(async (tx) => {
      // Update invite status
      await tx.teamInvite.update({
        where: { id: invite.id },
        data: { status: 'ACCEPTED' },
      });

      // Activate user if PENDING
      if (user.status === 'PENDING') {
        await tx.user.update({
          where: { id: userId },
          data: { status: 'ACTIVE', role: 'TRAINER' },
        });
      }

      // Get the firm owner to use as invitedBy
      const firmOwnerMember = await tx.teamMember.findFirst({
        where: { firmId: invite.firmId, role: 'OWNER' },
      });
      const invitedById = firmOwnerMember?.userId || invite.firmId;

      // Create or reactivate team member
      const existing = await tx.teamMember.findUnique({
        where: { firmId_userId: { firmId: invite.firmId, userId } },
      });

      if (existing) {
        return tx.teamMember.update({
          where: { id: existing.id },
          data: { role: invite.role, isActive: true, joinedAt: new Date() },
          include: { firm: { select: { id: true, firstName: true, lastName: true, name: true } }, user: { select: { id: true, firstName: true, lastName: true, email: true } } },
        });
      }

      return tx.teamMember.create({
        data: {
          firmId: invite.firmId,
          userId,
          role: invite.role,
          invitedById,
          invitedAt: invite.createdAt,
          joinedAt: new Date(),
        },
        include: { firm: { select: { id: true, firstName: true, lastName: true, name: true } }, user: { select: { id: true, firstName: true, lastName: true, email: true } } },
      });
    });

    // Send welcome email
    const firmUser = await this.prisma.user.findUnique({
      where: { id: invite.firmId },
      select: { name: true, firstName: true },
    });
    const firmName = firmUser?.name || firmUser?.firstName || 'your firm';

    await this.brevo.sendEmail({
      to: [{ email: user.email, name: user.firstName || undefined }],
      subject: `Welcome to ${firmName} on Uteo`,
      htmlContent: `
        <h1>Welcome aboard!</h1>
        <p>Hi ${user.firstName || 'there'},</p>
        <p>You are now a member of <strong>${firmName}</strong> on Uteo. You can start receiving assigned bookings and collaborating with your team.</p>
        <p>Best regards,<br/>The Uteo Team</p>
      `,
    });

    return member;
  }

  // ── List firm members ─────────────────────────────────────────────────────
  async listMembers(firmId: string) {
    return this.prisma.teamMember.findMany({
      where: { firmId },
      include: {
        user: {
          select: {
            id: true, firstName: true, lastName: true, name: true,
            email: true, phone: true, avatar: true, status: true,
          },
        },
        invitedBy: {
          select: { id: true, firstName: true, lastName: true, name: true },
        },
        department: {
          select: { id: true, name: true },
        },
      },
      orderBy: [{ role: 'asc' }, { joinedAt: 'desc' }],
    });
  }

  // ── Get single member detail ──────────────────────────────────────────────
  async getMember(memberId: string) {
    const member = await this.prisma.teamMember.findUnique({
      where: { id: memberId },
      include: {
        user: {
          select: {
            id: true, firstName: true, lastName: true, name: true,
            email: true, phone: true, avatar: true, status: true, role: true,
            trainerProfile: { select: { bio: true, hourlyRate: true, rating: true, specialization: true, verificationStatus: true } },
          },
        },
        firm: {
          select: { id: true, firstName: true, lastName: true, name: true },
        },
        invitedBy: {
          select: { id: true, firstName: true, lastName: true, name: true },
        },
      },
    });
    if (!member) throw new NotFoundException('Team member not found');
    return member;
  }

  // ── Update member ─────────────────────────────────────────────────────────
  async updateMember(memberId: string, firmId: string, callerId: string, dto: UpdateMemberDto) {
    await this.assertCanManage(firmId, callerId);

    const member = await this.prisma.teamMember.findUnique({ where: { id: memberId } });
    if (!member) throw new NotFoundException('Team member not found');
    if (member.firmId !== firmId) throw new ForbiddenException('Member does not belong to your firm');
    if (member.role === 'OWNER' && dto.role && dto.role !== 'OWNER') {
      throw new BadRequestException('Cannot change the role of the firm owner');
    }

    return this.prisma.teamMember.update({
      where: { id: memberId },
      data: {
        ...(dto.role !== undefined && { role: dto.role }),
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.specialization !== undefined && { specialization: dto.specialization }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, name: true, email: true, avatar: true },
        },
      },
    });
  }

  // ── Remove member ─────────────────────────────────────────────────────────
  async removeMember(memberId: string, firmId: string, callerId: string) {
    await this.assertCanManage(firmId, callerId);

    const member = await this.prisma.teamMember.findUnique({ where: { id: memberId } });
    if (!member) throw new NotFoundException('Team member not found');
    if (member.firmId !== firmId) throw new ForbiddenException('Member does not belong to your firm');
    if (member.role === 'OWNER') throw new BadRequestException('Cannot remove the firm owner');

    await this.prisma.teamMember.delete({ where: { id: memberId } });
    return { success: true, message: 'Team member removed' };
  }

  // ── List pending invites ──────────────────────────────────────────────────
  async listInvites(firmId: string) {
    // Expire any stale invites first
    await this.prisma.teamInvite.updateMany({
      where: { firmId, status: 'PENDING', expiresAt: { lt: new Date() } },
      data: { status: 'EXPIRED' },
    });

    return this.prisma.teamInvite.findMany({
      where: { firmId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── Cancel invite ─────────────────────────────────────────────────────────
  async cancelInvite(inviteId: string, firmId: string, callerId: string) {
    await this.assertCanManage(firmId, callerId);

    const invite = await this.prisma.teamInvite.findUnique({ where: { id: inviteId } });
    if (!invite) throw new NotFoundException('Invite not found');
    if (invite.firmId !== firmId) throw new ForbiddenException('Invite does not belong to your firm');
    if (invite.status !== 'PENDING') throw new BadRequestException(`Cannot cancel an invite that is ${invite.status.toLowerCase()}`);

    return this.prisma.teamInvite.update({
      where: { id: inviteId },
      data: { status: 'CANCELLED' },
    });
  }

  // ── Assign booking to a consultant ────────────────────────────────────────
  async assignBooking(memberId: string, firmId: string, callerId: string, dto: AssignBookingDto) {
    await this.assertCanManage(firmId, callerId);

    const member = await this.prisma.teamMember.findUnique({ where: { id: memberId } });
    if (!member) throw new NotFoundException('Team member not found');
    if (member.firmId !== firmId) throw new ForbiddenException('Member does not belong to your firm');
    if (!member.isActive) throw new BadRequestException('Team member is inactive');

    const booking = await this.prisma.booking.findUnique({ where: { id: dto.bookingId } });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.trainerId !== firmId) throw new ForbiddenException('Booking does not belong to your firm');

    // Reassign the booking's trainerId to the consultant
    const updated = await this.prisma.booking.update({
      where: { id: dto.bookingId },
      data: { trainerId: member.userId },
      include: {
        trainer: { select: { id: true, firstName: true, lastName: true, email: true } },
        client: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    this.logger.log(`Booking ${dto.bookingId} assigned to consultant ${member.userId} by ${callerId}`);
    return updated;
  }

  // ── Add an existing Uteo trainer directly to the firm ────────────────────
  async addExistingTrainer(
    firmId: string,
    callerId: string,
    dto: { trainerUserId: string; role?: string; title?: string; departmentId?: string },
  ) {
    await this.assertCanManage(firmId, callerId);

    const trainer = await this.prisma.user.findUnique({
      where: { id: dto.trainerUserId },
      select: { id: true, firstName: true, lastName: true, email: true, role: true },
    });
    if (!trainer) throw new NotFoundException('Trainer not found');
    if (trainer.role !== 'TRAINER') throw new BadRequestException('User is not a trainer');
    if (trainer.id === firmId) throw new BadRequestException('You cannot add yourself as a member');

    const existing = await this.prisma.teamMember.findUnique({
      where: { firmId_userId: { firmId, userId: trainer.id } },
    });
    if (existing?.isActive) throw new BadRequestException('This trainer is already a member of your org');

    const role = (dto.role as any) || 'CONSULTANT';

    const member = await this.prisma.$transaction(async (tx) => {
      if (existing) {
        return tx.teamMember.update({
          where: { id: existing.id },
          data: { role, title: dto.title, isActive: true, joinedAt: new Date(), departmentId: dto.departmentId || null },
          include: { user: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true } } },
        });
      }
      return tx.teamMember.create({
        data: { firmId, userId: trainer.id, role, title: dto.title, invitedById: callerId, invitedAt: new Date(), joinedAt: new Date(), departmentId: dto.departmentId || null },
        include: { user: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true } } },
      });
    });

    // Notify the trainer
    const firmUser = await this.prisma.user.findUnique({ where: { id: firmId }, select: { name: true, firstName: true } });
    const firmName = firmUser?.name || firmUser?.firstName || 'an organization';
    await this.brevo.sendEmail({
      to: [{ email: trainer.email, name: trainer.firstName || undefined }],
      subject: `You've been added to ${firmName} on Uteo`,
      htmlContent: `<p>Hi ${trainer.firstName || 'there'},</p><p>You have been added to <strong>${firmName}</strong> as a <strong>${role}</strong> on Uteo. You can now receive assigned bookings and collaborate with the team.</p><p>Best,<br/>The Uteo Team</p>`,
    }).catch(() => {});

    this.logger.log(`Trainer ${trainer.id} added to firm ${firmId} as ${role} by ${callerId}`);
    return member;
  }

  // ── Get my firm (for consultants) ─────────────────────────────────────────
  async getMyFirm(userId: string) {
    const membership = await this.prisma.teamMember.findFirst({
      where: { userId, isActive: true },
      include: {
        firm: {
          select: {
            id: true, firstName: true, lastName: true, name: true,
            email: true, avatar: true,
            trainerProfile: {
              select: { bio: true, specialization: true, rating: true, verificationStatus: true },
            },
          },
        },
      },
    });
    if (!membership) throw new NotFoundException('You are not a member of any firm');
    return membership;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  /**
   * Assert the caller is the firm owner OR has OWNER/ADMIN role in the firm.
   */
  private async assertCanManage(firmId: string, callerId: string) {
    // Firm owner can always manage
    if (callerId === firmId) return;

    // Check if caller is an ADMIN member of the firm
    const callerMember = await this.prisma.teamMember.findUnique({
      where: { firmId_userId: { firmId, userId: callerId } },
    });
    if (callerMember && ['OWNER', 'ADMIN'].includes(callerMember.role) && callerMember.isActive) {
      return;
    }

    throw new ForbiddenException('Only the firm owner or admins can perform this action');
  }
}
