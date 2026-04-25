import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/services/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { pageParams, paginate } from '../../common/dto/pagination.dto';
import {
  CreateApplicationDto,
  UpdateApplicationStatusDto,
  ListApplicationsDto,
} from './dto/applications.dto';

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(userId: string, dto: CreateApplicationDto) {
    const job = await this.prisma.job.findUnique({ where: { id: dto.jobId } });
    if (!job) throw new NotFoundException('Job not found');

    const existing = await this.prisma.application.findUnique({
      where: { userId_jobId: { userId, jobId: dto.jobId } },
    });
    if (existing) throw new ConflictException('You have already applied to this job');

    // Record interaction
    await this.prisma.jobInteraction.create({
      data: { userId, jobId: dto.jobId, action: 'apply' },
    }).catch(() => null); // fire-and-forget, non-blocking

    return this.prisma.application.create({
      data: {
        userId,
        jobId: dto.jobId,
        coverLetter: dto.coverLetter,
        resumeUrl: dto.resumeUrl,
      },
      include: {
        job: {
          include: {
            company: { select: { id: true, name: true, logoUrl: true } },
          },
        },
      },
    });
  }

  async findAll(userId: string, userRole: string, dto: ListApplicationsDto) {
    const { page, limit, skip } = pageParams(dto);
    const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';
    const where: Prisma.ApplicationWhereInput = {};

    if (dto.status) where.status = dto.status;

    if (isAdmin) {
      // Admin sees everything; optionally filter by jobId
      if (dto.jobId) where.jobId = dto.jobId;
    } else if (dto.jobId) {
      // Recruiter filtering by jobId — verify they own the company
      const job = await this.prisma.job.findUnique({
        where: { id: dto.jobId },
        select: { companyId: true },
      });
      if (!job) throw new NotFoundException('Job not found');
      const recruiter = await this.prisma.recruiter.findUnique({
        where: { userId_companyId: { userId, companyId: job.companyId } },
      });
      if (!recruiter) throw new ForbiddenException('Not authorised to view these applications');
      where.jobId = dto.jobId;
    } else {
      // Default: job seeker sees their own applications
      where.userId = userId;
    }

    const [items, total] = await Promise.all([
      this.prisma.application.findMany({
        where,
        skip,
        take: limit,
        orderBy: { appliedAt: 'desc' },
        include: {
          job: {
            include: {
              company: { select: { id: true, name: true, logoUrl: true } },
            },
          },
          user: { select: { id: true, email: true, firstName: true, lastName: true, avatar: true } },
        },
      }),
      this.prisma.application.count({ where }),
    ]);
    return paginate(items, total, page, limit);
  }

  async findOne(id: string, userId: string, userRole: string) {
    const application = await this.prisma.application.findUnique({
      where: { id },
      include: {
        job: {
          include: {
            company: true,
            jobSkills: { include: { skill: { select: { id: true, name: true } } } },
          },
        },
        user: { select: { id: true, email: true, firstName: true, lastName: true, avatar: true } },
      },
    });
    if (!application) throw new NotFoundException('Application not found');

    const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';
    if (!isAdmin && application.userId !== userId) {
      // Allow recruiter for the job's company to view
      const recruiter = await this.prisma.recruiter.findUnique({
        where: { userId_companyId: { userId, companyId: application.job.companyId } },
      });
      if (!recruiter) throw new ForbiddenException('Not authorised to view this application');
    }
    return application;
  }

  async updateStatus(id: string, userId: string, dto: UpdateApplicationStatusDto) {
    const application = await this.prisma.application.findUnique({
      where: { id },
      include: {
        job: { select: { companyId: true, title: true } },
      },
    });
    if (!application) throw new NotFoundException('Application not found');

    const recruiter = await this.prisma.recruiter.findUnique({
      where: { userId_companyId: { userId, companyId: application.job.companyId } },
    });
    if (!recruiter) throw new ForbiddenException('Not authorised to update this application');

    const updated = await this.prisma.application.update({
      where: { id },
      data: { status: dto.status, notes: dto.notes },
    });

    // Fire an in-app notification to the applicant about the status change.
    // Use fire-and-forget so a notification failure never blocks the response.
    this.notifications
      .createInApp(
        application.userId,
        'APPLICATION_STATUS_UPDATE',
        'Application Status Updated',
        `Your application for "${application.job.title}" has been updated to ${dto.status}.`,
        { applicationId: id, jobTitle: application.job.title, status: dto.status },
      )
      .catch(() => null);

    return updated;
  }

  async withdraw(id: string, userId: string) {
    const application = await this.prisma.application.findUnique({ where: { id } });
    if (!application) throw new NotFoundException('Application not found');
    if (application.userId !== userId) {
      throw new ForbiddenException('You can only withdraw your own applications');
    }
    await this.prisma.application.delete({ where: { id } });
    return { message: 'Application withdrawn' };
  }
}
