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
} from './dto/companies.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateCompanyDto) {
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
          create: { userId, title: undefined },
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

  async findOne(id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      include: {
        _count: { select: { jobs: true, recruiters: true } },
        recruiters: {
          include: {
            user: { select: { id: true, email: true, firstName: true, lastName: true, avatar: true } },
          },
        },
      },
    });
    if (!company) throw new NotFoundException('Company not found');
    return company;
  }

  async update(id: string, userId: string, dto: UpdateCompanyDto) {
    await this.assertRecruiter(id, userId);
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

  async addRecruiter(companyId: string, requesterId: string, dto: AddRecruiterDto) {
    await this.assertRecruiter(companyId, requesterId);
    const user = await this.prisma.user.findUnique({ where: { id: dto.userId } });
    if (!user) throw new NotFoundException('User not found');
    const existing = await this.prisma.recruiter.findUnique({
      where: { userId_companyId: { userId: dto.userId, companyId } },
    });
    if (existing) throw new ConflictException('User is already a recruiter for this company');
    return this.prisma.recruiter.create({
      data: { userId: dto.userId, companyId, title: dto.title },
      include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } },
    });
  }

  async removeRecruiter(companyId: string, requesterId: string, targetUserId: string) {
    await this.assertRecruiter(companyId, requesterId);
    const recruiter = await this.prisma.recruiter.findUnique({
      where: { userId_companyId: { userId: targetUserId, companyId } },
    });
    if (!recruiter) throw new NotFoundException('Recruiter not found');
    await this.prisma.recruiter.delete({
      where: { userId_companyId: { userId: targetUserId, companyId } },
    });
    return { message: 'Recruiter removed' };
  }

  // ── helpers ──────────────────────────────────────────────────────────────

  private async assertRecruiter(companyId: string, userId: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Company not found');
    const rec = await this.prisma.recruiter.findUnique({
      where: { userId_companyId: { userId, companyId } },
    });
    if (!rec) throw new ForbiddenException('You are not a recruiter for this company');
    return company;
  }
}
