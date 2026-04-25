import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { paginate } from '../../common/dto/pagination.dto';
import {
  ListUsersDto,
  UpdateUserDto,
  UpdateUserStatusDto,
  UpdateUserRoleDto,
} from './dto/users.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(dto: ListUsersDto) {
    const page = Number(dto.page) || 1;
    const limit = Number(dto.limit) || 20;
    const skip = (page - 1) * limit;
    const where: Prisma.UserWhereInput = { deletedAt: null };
    if (dto.role) where.role = dto.role;
    if (dto.status) where.status = dto.status;
    if (dto.search) {
      where.OR = [
        { firstName: { contains: dto.search, mode: 'insensitive' } },
        { lastName: { contains: dto.search, mode: 'insensitive' } },
        { email: { contains: dto.search, mode: 'insensitive' } },
      ];
    }
    const orderBy: any = dto.sortBy
      ? { [dto.sortBy]: dto.sortOrder || 'desc' }
      : { createdAt: 'desc' };
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        select: this.safeSelect,
      }),
      this.prisma.user.count({ where }),
    ]);
    return paginate(items, total, page, limit);
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: {
        ...this.safeSelect,
        trainerProfile: {
          include: {
            skills: { include: { skill: true } },
            certifications: true,
          },
        },
        wallet: {
          select: { id: true, balance: true, currency: true },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
    if (!user) throw new NotFoundException('User not found');
    if (dto.email && dto.email !== user.email) {
      const existing = await this.prisma.user.findUnique({
        where: { email: dto.email.toLowerCase() },
      });
      if (existing) throw new ConflictException('Email already in use');
    }
    if (dto.phone && dto.phone !== user.phone) {
      const existing = await this.prisma.user.findUnique({
        where: { phone: dto.phone },
      });
      if (existing) throw new ConflictException('Phone already in use');
    }
    return this.prisma.user.update({
      where: { id },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email?.toLowerCase(),
        phone: dto.phone,
        avatar: dto.avatar,
        name: [dto.firstName || user.firstName, dto.lastName || user.lastName]
          .filter(Boolean)
          .join(' ') || undefined,
      },
      select: this.safeSelect,
    });
  }

  async updateStatus(id: string, dto: UpdateUserStatusDto) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
    if (!user) throw new NotFoundException('User not found');
    return this.prisma.user.update({
      where: { id },
      data: { status: dto.status },
      select: this.safeSelect,
    });
  }

  async updateRole(id: string, dto: UpdateUserRoleDto) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
    if (!user) throw new NotFoundException('User not found');
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: { role: dto.role },
        select: this.safeSelect,
      });
      if (dto.role === 'TRAINER') {
        const existing = await tx.trainerProfile.findUnique({
          where: { userId: id },
        });
        if (!existing) {
          await tx.trainerProfile.create({
            data: { userId: id, verificationStatus: 'PENDING' },
          });
        }
      }
      return updated;
    });
  }

  async softDelete(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
    if (!user) throw new NotFoundException('User not found');
    await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'DEACTIVATED' },
    });
    return { message: 'User deleted' };
  }

  async getStats() {
    const [total, byRole, byStatus] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.user.groupBy({
        by: ['role'],
        _count: true,
        where: { deletedAt: null },
      }),
      this.prisma.user.groupBy({
        by: ['status'],
        _count: true,
        where: { deletedAt: null },
      }),
    ]);
    return {
      total,
      byRole: byRole.reduce(
        (acc, i) => ({ ...acc, [i.role]: i._count }),
        {},
      ),
      byStatus: byStatus.reduce(
        (acc, i) => ({ ...acc, [i.status]: i._count }),
        {},
      ),
    };
  }

  async saveFcmToken(userId: string, token: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, fcmTokens: true } });
    if (!user) throw new NotFoundException('User not found');
    // Add token if not already present (dedup)
    const tokens: string[] = (user as any).fcmTokens ?? [];
    if (!tokens.includes(token)) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { fcmTokens: { push: token } },
      });
    }
    return { message: 'FCM token saved' };
  }

  async removeFcmToken(userId: string, token: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, fcmTokens: true } });
    if (!user) throw new NotFoundException('User not found');
    const tokens: string[] = ((user as any).fcmTokens ?? []).filter((t: string) => t !== token);
    await this.prisma.user.update({ where: { id: userId }, data: { fcmTokens: tokens } });
    return { message: 'FCM token removed' };
  }

  async inviteLearner(
    trainerId: string,
    body: { firstName: string; lastName?: string; email: string; phone?: string; password: string },
  ) {
    if (!body.password || body.password.length < 6) throw new BadRequestException('Password must be at least 6 characters');
    const existing = await this.prisma.user.findUnique({ where: { email: body.email } });
    if (existing) throw new ConflictException('A user with this email already exists');
    const passwordHash = await bcrypt.hash(body.password, 10);
    const learner = await this.prisma.user.create({
      data: {
        email: body.email,
        phone: body.phone || undefined,
        firstName: body.firstName,
        lastName: body.lastName || '',
        passwordHash,
        role: 'CLIENT',
        status: 'ACTIVE',
        assignedTrainerId: trainerId,
      },
      select: { id: true, firstName: true, lastName: true, email: true, phone: true, createdAt: true },
    });
    return learner;
  }

  private safeSelect = {
    id: true,
    email: true,
    phone: true,
    firstName: true,
    lastName: true,
    name: true,
    avatar: true,
    role: true,
    status: true,
    emailVerified: true,
    phoneVerified: true,
    lastLoginAt: true,
    createdAt: true,
    updatedAt: true,
  } as const;
}
