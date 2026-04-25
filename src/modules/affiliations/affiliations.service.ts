import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { paginate } from '../../common/dto/pagination.dto';
import { CreateAffiliationDto, UpdateAffiliationDto, ListAffiliationsDto } from './dto/affiliations.dto';

@Injectable()
export class AffiliationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateAffiliationDto) {
    return this.prisma.institutionalAffiliation.create({
      data: {
        userId,
        institutionName: dto.institutionName,
        role: dto.role,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        isCurrent: dto.isCurrent ?? true,
        documentUrl: dto.documentUrl,
      },
    });
  }

  async findMine(userId: string, dto: ListAffiliationsDto) {
    const page = Number(dto.page) || 1;
    const limit = Number(dto.limit) || 20;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.institutionalAffiliation.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.institutionalAffiliation.count({ where: { userId } }),
    ]);

    return paginate(items, total, page, limit);
  }

  async findByUser(userId: string, dto: ListAffiliationsDto) {
    const page = Number(dto.page) || 1;
    const limit = Number(dto.limit) || 20;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.institutionalAffiliation.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.institutionalAffiliation.count({ where: { userId } }),
    ]);

    return paginate(items, total, page, limit);
  }

  async update(id: string, userId: string, dto: UpdateAffiliationDto) {
    const aff = await this.prisma.institutionalAffiliation.findUnique({ where: { id } });
    if (!aff) throw new NotFoundException('Affiliation not found');
    if (aff.userId !== userId) throw new ForbiddenException('Not your affiliation');

    return this.prisma.institutionalAffiliation.update({
      where: { id },
      data: {
        ...(dto.institutionName !== undefined && { institutionName: dto.institutionName }),
        ...(dto.role !== undefined && { role: dto.role }),
        ...(dto.startDate !== undefined && { startDate: dto.startDate ? new Date(dto.startDate) : null }),
        ...(dto.endDate !== undefined && { endDate: dto.endDate ? new Date(dto.endDate) : null }),
        ...(dto.isCurrent !== undefined && { isCurrent: dto.isCurrent }),
        ...(dto.documentUrl !== undefined && { documentUrl: dto.documentUrl }),
      },
    });
  }

  async remove(id: string, userId: string) {
    const aff = await this.prisma.institutionalAffiliation.findUnique({ where: { id } });
    if (!aff) throw new NotFoundException('Affiliation not found');
    if (aff.userId !== userId) throw new ForbiddenException('Not your affiliation');

    await this.prisma.institutionalAffiliation.delete({ where: { id } });
    return { message: 'Affiliation deleted' };
  }

  async verify(id: string) {
    const aff = await this.prisma.institutionalAffiliation.findUnique({ where: { id } });
    if (!aff) throw new NotFoundException('Affiliation not found');

    return this.prisma.institutionalAffiliation.update({
      where: { id },
      data: { verified: true },
    });
  }
}
