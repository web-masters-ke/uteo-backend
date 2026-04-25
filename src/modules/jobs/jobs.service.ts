import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma, JobStatus } from '@prisma/client';
import { PrismaService } from '../../common/services/prisma.service';
import { pageParams, paginate } from '../../common/dto/pagination.dto';
import {
  CreateJobDto,
  UpdateJobDto,
  JobFilterDto,
  InteractJobDto,
} from './dto/jobs.dto';

const VALID_ACTIONS = ['view', 'click', 'save', 'apply', 'skip'];

@Injectable()
export class JobsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateJobDto) {
    // Verify the user is a recruiter for the company
    const recruiter = await this.prisma.recruiter.findUnique({
      where: { userId_companyId: { userId, companyId: dto.companyId } },
    });
    if (!recruiter) {
      throw new ForbiddenException('You are not a recruiter for this company');
    }

    const { skillIds, ...jobData } = dto;
    const job = await this.prisma.job.create({
      data: {
        ...jobData,
        postedById: userId,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        jobSkills: skillIds && skillIds.length > 0
          ? { create: skillIds.map((skillId) => ({ skillId })) }
          : undefined,
      },
      include: {
        company: { select: { id: true, name: true, logoUrl: true } },
        jobSkills: { include: { skill: { select: { id: true, name: true } } } },
        _count: { select: { applications: true } },
      },
    });
    return job;
  }

  async findAll(dto: JobFilterDto) {
    const { page, limit, skip } = pageParams(dto);
    const where: Prisma.JobWhereInput = {};

    where.status = dto.status ?? JobStatus.ACTIVE;

    // keyword is an alias for search (sent by the browse-jobs page)
    const searchTerm = dto.search || dto.keyword;
    if (searchTerm) {
      where.OR = [
        { title: { contains: searchTerm, mode: 'insensitive' } },
        { description: { contains: searchTerm, mode: 'insensitive' } },
        { requirements: { contains: searchTerm, mode: 'insensitive' } },
        { company: { name: { contains: searchTerm, mode: 'insensitive' } } },
      ];
    }

    // jobType accepts a single value OR comma-separated list e.g. "FULL_TIME,REMOTE,HYBRID"
    if (dto.jobType) {
      const types = dto.jobType.split(',').map((t) => t.trim()).filter(Boolean) as any[];
      if (types.length === 1) {
        where.jobType = types[0];
      } else if (types.length > 1) {
        where.jobType = { in: types };
      }
    }

    if (dto.location) where.location = { contains: dto.location, mode: 'insensitive' };
    if (dto.companyId) where.companyId = dto.companyId;

    if (dto.salaryMin !== undefined) {
      where.salaryMax = { gte: dto.salaryMin };
    }
    if (dto.salaryMax !== undefined) {
      where.salaryMin = { lte: dto.salaryMax };
    }

    if (dto.skillIds && dto.skillIds.length > 0) {
      where.jobSkills = { some: { skillId: { in: dto.skillIds } } };
    }

    const [items, total] = await Promise.all([
      this.prisma.job.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          company: { select: { id: true, name: true, logoUrl: true, isVerified: true } },
          jobSkills: { include: { skill: { select: { id: true, name: true } } } },
          _count: { select: { applications: true } },
        },
      }),
      this.prisma.job.count({ where }),
    ]);
    return paginate(items, total, page, limit);
  }

  async findOne(id: string) {
    const job = await this.prisma.job.findUnique({
      where: { id },
      include: {
        company: true,
        jobSkills: { include: { skill: true } },
        _count: { select: { applications: true } },
      },
    });
    if (!job) throw new NotFoundException('Job not found');
    return job;
  }

  async update(id: string, userId: string, dto: UpdateJobDto) {
    const job = await this.prisma.job.findUnique({ where: { id } });
    if (!job) throw new NotFoundException('Job not found');
    if (job.postedById !== userId) {
      // Check if admin recruiter for company
      const recruiter = await this.prisma.recruiter.findUnique({
        where: { userId_companyId: { userId, companyId: job.companyId } },
      });
      if (!recruiter) throw new ForbiddenException('Not authorised to update this job');
    }

    const { skillIds, ...updateData } = dto;

    const updated = await this.prisma.$transaction(async (tx) => {
      if (skillIds !== undefined) {
        await tx.jobSkill.deleteMany({ where: { jobId: id } });
        if (skillIds.length > 0) {
          await tx.jobSkill.createMany({
            data: skillIds.map((skillId) => ({ jobId: id, skillId })),
            skipDuplicates: true,
          });
        }
      }
      return tx.job.update({
        where: { id },
        data: {
          ...updateData,
          expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        },
        include: {
          company: { select: { id: true, name: true, logoUrl: true } },
          jobSkills: { include: { skill: { select: { id: true, name: true } } } },
        },
      });
    });
    return updated;
  }

  async remove(id: string, userId: string, userRole: string) {
    const job = await this.prisma.job.findUnique({ where: { id } });
    if (!job) throw new NotFoundException('Job not found');
    const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';
    if (!isAdmin && job.postedById !== userId) {
      throw new ForbiddenException('Not authorised to delete this job');
    }
    await this.prisma.job.delete({ where: { id } });
    return { message: 'Job deleted' };
  }

  async saveJob(jobId: string, userId: string) {
    const job = await this.prisma.job.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Job not found');
    const existing = await this.prisma.savedJob.findUnique({
      where: { userId_jobId: { userId, jobId } },
    });
    if (existing) throw new ConflictException('Job already saved');
    return this.prisma.savedJob.create({ data: { userId, jobId } });
  }

  async unsaveJob(jobId: string, userId: string) {
    const saved = await this.prisma.savedJob.findUnique({
      where: { userId_jobId: { userId, jobId } },
    });
    if (!saved) throw new NotFoundException('Saved job not found');
    await this.prisma.savedJob.delete({ where: { userId_jobId: { userId, jobId } } });
    return { message: 'Job unsaved' };
  }

  async getSavedJobs(userId: string) {
    const saved = await this.prisma.savedJob.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        job: {
          include: {
            company: { select: { id: true, name: true, logoUrl: true, isVerified: true } },
            jobSkills: { include: { skill: { select: { id: true, name: true } } } },
            _count: { select: { applications: true } },
          },
        },
      },
    });
    return saved;
  }

  async interact(jobId: string, userId: string, dto: InteractJobDto) {
    if (!VALID_ACTIONS.includes(dto.action)) {
      throw new BadRequestException(`Invalid action. Must be one of: ${VALID_ACTIONS.join(', ')}`);
    }
    return this.prisma.jobInteraction.create({
      data: { jobId, userId, action: dto.action },
    });
  }
}
