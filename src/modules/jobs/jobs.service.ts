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

    const { skillIds, hiringStages, ...jobData } = dto;
    const job = await this.prisma.job.create({
      data: {
        ...jobData,
        postedById: userId,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        hiringStages: hiringStages ? JSON.parse(JSON.stringify(hiringStages)) : [],
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

  async update(id: string, userId: string, dto: UpdateJobDto, userRole?: string) {
    const job = await this.prisma.job.findUnique({ where: { id } });
    if (!job) throw new NotFoundException('Job not found');
    const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN' || userRole === 'FINANCE_ADMIN';
    if (!isAdmin && job.postedById !== userId) {
      // Check if admin recruiter for company
      const recruiter = await this.prisma.recruiter.findUnique({
        where: { userId_companyId: { userId, companyId: job.companyId } },
      });
      if (!recruiter) throw new ForbiddenException('Not authorised to update this job');
    }

    const { skillIds, hiringStages, ...updateData } = dto;

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
          ...(hiringStages !== undefined ? { hiringStages: hiringStages as any } : {}),
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
    // Application has no onDelete:Cascade — must delete children before job
    await this.prisma.$transaction(async (tx) => {
      await tx.application.deleteMany({ where: { jobId: id } });
      await tx.job.delete({ where: { id } });
    });
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

  async getCandidates(jobId: string, recruiterId: string) {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      include: { jobSkills: { include: { skill: { select: { id: true, name: true } } } } },
    });
    if (!job) throw new NotFoundException('Job not found');

    const recruiter = await this.prisma.recruiter.findUnique({
      where: { userId_companyId: { userId: recruiterId, companyId: job.companyId } },
    });
    if (!recruiter) throw new ForbiddenException('Not authorised to view candidates for this job');

    const jobSkillIds = job.jobSkills.map((js) => js.skill.id);

    // Fetch actual applicants for this job (applied, manually added, etc.)
    const applications = await this.prisma.application.findMany({
      where: { jobId },
      orderBy: { appliedAt: 'desc' },
      include: {
        user: {
          select: {
            id: true, firstName: true, lastName: true, avatar: true, email: true,
            userSkills: { include: { skill: { select: { id: true, name: true } } } },
            jobSeekerProfile: { select: { headline: true, location: true, resumeUrl: true, portfolioUrl: true, linkedinUrl: true } },
          },
        },
      },
    });

    const applicantUserIds = new Set(applications.map((a) => a.user.id));

    const toCandidate = (user: typeof applications[0]['user'], applied: boolean) => {
      const profile = user.jobSeekerProfile;
      const candidateSkillIds = user.userSkills.map((us) => us.skillId);
      const skillScore = jobSkillIds.length > 0
        ? Math.round((candidateSkillIds.filter((id) => jobSkillIds.includes(id)).length / jobSkillIds.length) * 50)
        : 0;
      const locationScore = this.scoreLocation(profile?.location ?? null, job.location);
      const profileScore = (profile?.headline ? 10 : 0) + (profile?.resumeUrl ? 10 : 0);
      const matchedSkills = user.userSkills
        .filter((us) => jobSkillIds.includes(us.skillId))
        .map((us) => us.skill.name);
      return {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        avatar: user.avatar,
        email: user.email,
        headline: profile?.headline ?? null,
        location: profile?.location ?? null,
        resumeUrl: profile?.resumeUrl ?? null,
        portfolioUrl: profile?.portfolioUrl ?? null,
        linkedinUrl: profile?.linkedinUrl ?? null,
        skills: user.userSkills.map((us) => ({ id: us.skillId, name: us.skill.name })),
        matchScore: applied ? 100 + skillScore : skillScore + locationScore + profileScore,
        scoreBreakdown: { skillScore, locationScore, profileScore },
        matchedSkills,
        applied,
      };
    };

    // Applicants first (sorted by most recent application)
    const applicantItems = applications.map((a) => toCandidate(a.user, true));

    // Open-to-work candidates, excluding those who already applied
    const openToWork = await this.prisma.jobSeekerProfile.findMany({
      where: { openToWork: true, user: { deletedAt: null, status: 'ACTIVE', id: { notIn: [...applicantUserIds] } } },
      include: {
        user: {
          select: {
            id: true, firstName: true, lastName: true, avatar: true, email: true,
            userSkills: { include: { skill: { select: { id: true, name: true } } } },
            jobSeekerProfile: { select: { headline: true, location: true, resumeUrl: true, portfolioUrl: true, linkedinUrl: true } },
          },
        },
      },
      take: 200,
    });

    const openItems = openToWork
      .map((p) => toCandidate(p.user, false))
      .sort((a, b) => b.matchScore - a.matchScore);

    const items = [...applicantItems, ...openItems];
    return { items, total: items.length };
  }

  private scoreLocation(candidateLocation: string | null, jobLocation: string | null | undefined): number {
    if (!candidateLocation || !jobLocation) return 0;
    const norm = (s: string) => s.toLowerCase().trim();
    const c = norm(candidateLocation);
    const j = norm(jobLocation);
    if (c === j) return 20;
    const cTokens = c.split(/[\s,]+/);
    const jTokens = j.split(/[\s,]+/);
    const overlap = cTokens.filter((t) => jTokens.includes(t)).length;
    if (overlap > 0) return Math.round((overlap / Math.max(cTokens.length, jTokens.length)) * 20);
    return 0;
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
