import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { randomBytes, createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import {
  RegisterDto,
  LoginDto,
  RefreshTokenDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dto/auth.dto';

@Injectable()
export class AuthService {
  private readonly jwtSecret: string;
  private readonly accessTtl: number;
  private readonly refreshTtl: number;

  constructor(private readonly prisma: PrismaService) {
    this.jwtSecret = process.env.JWT_SECRET || 'uteo-dev-secret-2026';
    this.accessTtl = Number(process.env.JWT_ACCESS_TTL) || 86400;
    this.refreshTtl = Number(process.env.JWT_REFRESH_TTL) || 2592000;
  }

  async register(dto: RegisterDto) {
    const existingEmail = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existingEmail) throw new ConflictException('Email already registered');

    if (dto.phone) {
      const existingPhone = await this.prisma.user.findUnique({
        where: { phone: dto.phone },
      });
      if (existingPhone)
        throw new ConflictException('Phone number already registered');
    }

    const allowedRoles = ['CLIENT', 'TRAINER'];
    const role =
      dto.role && allowedRoles.includes(dto.role) ? dto.role : 'CLIENT';
    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: dto.email.toLowerCase(),
          phone: dto.phone || null,
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          name: [dto.firstName, dto.lastName].filter(Boolean).join(' ') || null,
          role: role as any,
          status: 'ACTIVE',
          emailVerified: false,
          phoneVerified: false,
        },
      });

      // Create wallet for user — seed 1M starter credit for demo/betting
      await tx.wallet.create({
        data: {
          userId: newUser.id,
          balance: 1000000,
          currency: 'KES',
          starterCreditGranted: true,
        },
      });

      // If trainer, create trainer profile with optional fields
      if (role === 'TRAINER') {
        await tx.trainerProfile.create({
          data: {
            userId: newUser.id,
            verificationStatus: 'PENDING',
            firmName: dto.firmName || null,
            trainerType: (dto.trainerType as any) || 'PROFESSIONAL',
            categoryId: dto.categoryId || null,
            specialization: dto.specialization || null,
            bio: dto.bio || null,
            hourlyRate: dto.hourlyRate || 0,
            experience: dto.experience || 0,
            county: dto.county || null,
            location: dto.location || null,
            tier: 'ENTRY_LEVEL',
          },
        });

        // Attach trainer to org/firm
        if (dto.firmId) {
          await tx.teamMember.create({
            data: {
              firmId: dto.firmId,
              userId: newUser.id,
              role: (dto.teamRole as any) || 'CONSULTANT',
              isActive: true,
              invitedById: dto.firmId, // firm owner invited them
              joinedAt: new Date(),
              departmentId: dto.departmentId || null,
            },
          });
        }

        // Mark as in-house Uteo trainer (attach to admin/platform)
        if (dto.isInHouse) {
          const admin = await tx.user.findFirst({ where: { role: 'SUPER_ADMIN' }, orderBy: { createdAt: 'asc' } });
          if (admin) {
            await tx.teamMember.create({
              data: {
                firmId: admin.id,
                userId: newUser.id,
                role: 'CONSULTANT',
                title: 'In-House Trainer',
                isActive: true,
                invitedById: admin.id,
                joinedAt: new Date(),
              },
            });
          }
        }
      }

      // Add skills to trainer profile
      if (role === 'TRAINER' && dto.skills && dto.skills.length > 0) {
        const profile = await tx.trainerProfile.findUnique({ where: { userId: newUser.id } });
        if (profile) {
          for (const skillName of dto.skills) {
            let skill = await tx.skill.findFirst({ where: { name: { equals: skillName, mode: 'insensitive' } } });
            if (!skill) skill = await tx.skill.create({ data: { name: skillName } });
            await tx.trainerSkill.create({ data: { trainerId: profile.id, skillId: skill.id } }).catch(() => {});
          }
        }
      }

      // Add credentials/certifications to trainer profile
      if (role === 'TRAINER' && dto.credentials && dto.credentials.length > 0) {
        const profile = await tx.trainerProfile.findUnique({ where: { userId: newUser.id } });
        if (profile) {
          for (const cred of dto.credentials) {
            await tx.certification.create({
              data: {
                trainerId: profile.id,
                name: cred.name,
                issuer: cred.issuer || null,
                yearObtained: cred.year ? parseInt(cred.year) : null,
                documentUrl: cred.documentUrl || null,
                credentialType: (cred.type as any) || 'CERTIFICATE',
                verified: false,
              },
            });
          }
        }
      }

      // If client, create booking relationship with assigned trainer
      if (role === 'CLIENT' && dto.assignedTrainerId) {
        // Create a direct conversation so they can chat immediately
        await tx.conversation.create({
          data: {
            type: 'DIRECT',
            participants: {
              create: [
                { userId: newUser.id },
                { userId: dto.assignedTrainerId },
              ],
            },
          },
        });
        // Create a notification for the trainer
        await tx.notification.create({
          data: {
            userId: dto.assignedTrainerId,
            type: 'CLIENT_ASSIGNED',
            channel: 'IN_APP',
            title: 'New client assigned',
            message: `${dto.firstName} ${dto.lastName} has been assigned to you as a client.`,
            status: 'PENDING',
          },
        });
      }

      return newUser;
    });

    const tokens = await this.generateTokens(user.id, user.role);
    const enriched = await this.getMe(user.id);
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: enriched,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (!user || !user.passwordHash)
      throw new UnauthorizedException('Invalid email or password');
    if (user.deletedAt)
      throw new UnauthorizedException('Account has been deactivated');
    if (user.status === 'SUSPENDED')
      throw new UnauthorizedException('Account is suspended');
    if (user.status === 'DEACTIVATED')
      throw new UnauthorizedException('Account is deactivated');

    const validPassword = await bcrypt.compare(dto.password, user.passwordHash);
    if (!validPassword)
      throw new UnauthorizedException('Invalid email or password');

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), status: 'ACTIVE' },
    });

    const tokens = await this.generateTokens(user.id, user.role);
    const enriched = await this.getMe(user.id);
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: enriched,
    };
  }

  async refresh(dto: RefreshTokenDto) {
    const session = await this.prisma.userSession.findUnique({
      where: { refreshToken: dto.refreshToken },
      include: { user: true },
    });
    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Revoke old session, issue new tokens
    await this.prisma.userSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    const user = session.user;
    if (!user || user.status !== 'ACTIVE')
      throw new UnauthorizedException('User not found or inactive');

    const tokens = await this.generateTokens(user.id, user.role);
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async logout(userId: string) {
    await this.prisma.userSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { message: 'Logged out successfully' };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (!user)
      return { message: 'If an account exists, a reset email has been sent' };

    const resetToken = randomBytes(32).toString('hex');
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token: resetToken,
        expiresAt: new Date(Date.now() + 3600000),
      },
    });

    // TODO: send reset email via notifications module
    return {
      message: 'If an account exists, a reset email has been sent',
      token: resetToken,
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const row = await this.prisma.passwordResetToken.findUnique({
      where: { token: dto.token },
    });
    if (!row || row.usedAt || row.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: row.userId },
        data: { passwordHash },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: row.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.userSession.updateMany({
        where: { userId: row.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    return { message: 'Password reset successfully' };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        trainerProfile: {
          include: {
            skills: { include: { skill: true } },
            certifications: true,
            availabilitySlots: true,
          },
        },
        wallet: { select: { id: true, balance: true, currency: true } },
        teamMembership: { where: { isActive: true }, select: { role: true, firmId: true, title: true, firm: { select: { firstName: true, lastName: true, name: true } } }, take: 1 },
        firmMembers: { where: { isActive: true }, select: { id: true }, take: 1 },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    const teamMembership = (user as any).teamMembership?.[0];
    const hasFirmMembers = (user as any).firmMembers?.length > 0;
    const teamRole = hasFirmMembers ? 'OWNER' : teamMembership?.role || null;
    const firmId = hasFirmMembers ? user.id : teamMembership?.firmId || null;
    const firmName = teamMembership?.firm ? `${teamMembership.firm.firstName || ''} ${teamMembership.firm.lastName || ''}`.trim() || teamMembership.firm.name : null;
    const { teamMembership: _tm, firmMembers: _fm, ...clean } = user as any;
    return { ...this.sanitizeUser(clean), teamRole, firmId, firmName, isOrgOwner: teamRole === 'OWNER' || teamRole === 'ADMIN' };
  }

  private async generateTokens(userId: string, role: string) {
    const accessToken = jwt.sign(
      { sub: userId, role, type: 'access' },
      this.jwtSecret,
      { expiresIn: this.accessTtl },
    );
    const refreshToken = randomBytes(48).toString('hex');
    await this.prisma.userSession.create({
      data: {
        userId,
        refreshToken,
        expiresAt: new Date(Date.now() + this.refreshTtl * 1000),
      },
    });
    return { accessToken, refreshToken };
  }

  private sanitizeUser(user: any) {
    const { passwordHash, deletedAt, ...rest } = user;
    return rest;
  }
}
