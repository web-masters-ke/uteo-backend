import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { pageParams, paginate } from '../../common/dto/pagination.dto';
import {
  CreateCompanyDto,
  UpdateCompanyDto,
  ListCompaniesDto,
  AddRecruiterDto,
  UpdateRecruiterDto,
} from './dto/companies.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateCompanyDto, userRole?: string) {
    const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN' || userRole === 'FINANCE_ADMIN';
    const recruiterUserId = (isAdmin && dto.ownerId) ? dto.ownerId : userId;
    const company = await this.prisma.company.create({
      data: {
        name: dto.name,
        description: dto.description,
        industry: dto.industry,
        website: dto.website,
        logoUrl: dto.logoUrl,
        size: dto.size,
        location: dto.location,
        recruiters: {
          create: { userId: recruiterUserId, title: undefined, role: 'OWNER' },
        },
      },
      include: { recruiters: { include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } } } },
    });
    return company;
  }

  async findAll(dto: ListCompaniesDto) {
    const { page, limit, skip } = pageParams(dto);
    const where: Prisma.CompanyWhereInput = {};
    if (dto.search) {
      where.OR = [
        { name: { contains: dto.search, mode: 'insensitive' } },
        { description: { contains: dto.search, mode: 'insensitive' } },
        { industry: { contains: dto.search, mode: 'insensitive' } },
      ];
    }
    if (dto.industry) where.industry = { contains: dto.industry, mode: 'insensitive' };
    if (dto.size) where.size = dto.size;
    if (dto.location) where.location = { contains: dto.location, mode: 'insensitive' };

    const [items, total] = await Promise.all([
      this.prisma.company.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { jobs: true, recruiters: true } } },
      }),
      this.prisma.company.count({ where }),
    ]);
    return paginate(items, total, page, limit);
  }

  async findMine(userId: string) {
    return this.prisma.company.findFirst({
      where: { recruiters: { some: { userId } } },
      include: {
        _count: { select: { jobs: true, recruiters: true } },
        recruiters: {
          include: {
            user: { select: { id: true, email: true, firstName: true, lastName: true, avatar: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  async findOne(id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      include: {
        _count: { select: { jobs: true, recruiters: true } },
        recruiters: {
          include: {
            user: { select: { id: true, email: true, firstName: true, lastName: true, avatar: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!company) throw new NotFoundException('Company not found');
    return company;
  }

  async update(id: string, userId: string, dto: UpdateCompanyDto, userRole?: string) {
    await this.assertRecruiter(id, userId, userRole);
    return this.prisma.company.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        industry: dto.industry,
        website: dto.website,
        logoUrl: dto.logoUrl,
        size: dto.size,
        location: dto.location,
        isVerified: dto.isVerified,
      },
    });
  }

  async addRecruiter(companyId: string, requesterId: string, dto: AddRecruiterDto, requesterRole?: string) {
    const requester = await this.assertRecruiterWithRecord(companyId, requesterId, requesterRole);
    // Only OWNER, ADMIN (or platform admin) can add team members
    if (requester && !['OWNER', 'ADMIN'].includes(requester.role)) {
      throw new ForbiddenException('Only owners and admins can add team members');
    }

    let user: { id: string; email: string | null } | null = null;
    if (dto.userId) {
      user = await this.prisma.user.findUnique({ where: { id: dto.userId }, select: { id: true, email: true } });
    } else if (dto.email) {
      user = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase().trim() }, select: { id: true, email: true } });
    } else {
      throw new ConflictException('Provide either userId or email');
    }
    if (!user) throw new NotFoundException(`No Uteo user with that email. Ask them to sign up first, then invite.`);

    const existing = await this.prisma.recruiter.findUnique({
      where: { userId_companyId: { userId: user.id, companyId } },
    });
    if (existing) throw new ConflictException('User is already a team member for this company');

    // Only OWNER can create another OWNER
    let role = dto.role ?? 'HIRING_MANAGER';
    if (role === 'OWNER' && requester?.role !== 'OWNER') {
      throw new ForbiddenException('Only the company owner can grant OWNER role');
    }

    return this.prisma.recruiter.create({
      data: { userId: user.id, companyId, title: dto.title, role: role as any },
      include: { user: { select: { id: true, email: true, firstName: true, lastName: true, avatar: true } } },
    });
  }

  async updateRecruiter(companyId: string, targetUserId: string, requesterId: string, dto: UpdateRecruiterDto, requesterRole?: string) {
    const requester = await this.assertRecruiterWithRecord(companyId, requesterId, requesterRole);
    if (requester && !['OWNER', 'ADMIN'].includes(requester.role)) {
      throw new ForbiddenException('Only owners and admins can change team roles');
    }
    const target = await this.prisma.recruiter.findUnique({
      where: { userId_companyId: { userId: targetUserId, companyId } },
    });
    if (!target) throw new NotFoundException('Team member not found');
    // Don't let an ADMIN demote the OWNER
    if (target.role === 'OWNER' && requester?.role !== 'OWNER') {
      throw new ForbiddenException('Only the owner can change their own role');
    }
    if (dto.role === 'OWNER' && requester?.role !== 'OWNER') {
      throw new ForbiddenException('Only the company owner can grant OWNER role');
    }
    return this.prisma.recruiter.update({
      where: { userId_companyId: { userId: targetUserId, companyId } },
      data: { title: dto.title ?? target.title, role: (dto.role ?? target.role) as any },
      include: { user: { select: { id: true, email: true, firstName: true, lastName: true, avatar: true } } },
    });
  }

  async removeRecruiter(companyId: string, requesterId: string, targetUserId: string, requesterRole?: string) {
    const requester = await this.assertRecruiterWithRecord(companyId, requesterId, requesterRole);
    if (requester && !['OWNER', 'ADMIN'].includes(requester.role) && requesterId !== targetUserId) {
      throw new ForbiddenException('Only owners and admins can remove team members');
    }
    const recruiter = await this.prisma.recruiter.findUnique({
      where: { userId_companyId: { userId: targetUserId, companyId } },
    });
    if (!recruiter) throw new NotFoundException('Recruiter not found');
    if (recruiter.role === 'OWNER') {
      throw new ForbiddenException('The owner cannot be removed');
    }
    await this.prisma.recruiter.delete({
      where: { userId_companyId: { userId: targetUserId, companyId } },
    });
    return { message: 'Team member removed' };
  }

  private async assertRecruiterWithRecord(companyId: string, userId: string, userRole?: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Company not found');
    const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN' || userRole === 'FINANCE_ADMIN';
    const rec = await this.prisma.recruiter.findUnique({
      where: { userId_companyId: { userId, companyId } },
    });
    if (!rec && !isAdmin) throw new ForbiddenException('You are not a member of this company');
    return rec;
  }

  // ── helpers ──────────────────────────────────────────────────────────────

  private async assertRecruiter(companyId: string, userId: string, userRole?: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Company not found');
    const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN' || userRole === 'FINANCE_ADMIN';
    if (isAdmin) return company;
    const rec = await this.prisma.recruiter.findUnique({
      where: { userId_companyId: { userId, companyId } },
    });
    if (!rec) throw new ForbiddenException('You are not a recruiter for this company');
    return company;
  }
}
