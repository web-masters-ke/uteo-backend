import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/services/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { BrevoService } from '../../common/services/brevo.service';
import { TasksService } from '../tasks/tasks.service';
import { pageParams, paginate } from '../../common/dto/pagination.dto';
import {
  CreateApplicationDto,
  UpdateApplicationStatusDto,
  ListApplicationsDto,
  CreateManualApplicationDto,
} from './dto/applications.dto';

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly brevo: BrevoService,
    private readonly tasks: TasksService,
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
    }).catch(() => null);

    const application = await this.prisma.application.create({
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

    // Notify job seeker — application submitted confirmation
    this.notifications.createInApp(
      userId,
      'APPLICATION_SUBMITTED',
      'Application submitted',
      `Your application for "${job.title}" has been submitted. You'll hear back soon.`,
      { jobId: job.id, jobTitle: job.title },
    ).catch(() => null);

    // Notify recruiter of new application
    this.notifications.createInApp(
      job.postedById,
      'APPLICATION_RECEIVED',
      'New application received',
      `Someone applied for your "${job.title}" posting.`,
      { jobId: job.id, jobTitle: job.title },
    ).catch(() => null);

    // Fire-and-forget: open a conversation between applicant and recruiter
    this.seedApplicationThread(userId, job).catch(() => null);

    return application;
  }

  async createManual(recruiterId: string, body: CreateManualApplicationDto) {
    if (!body.candidateEmail?.trim()) throw new BadRequestException('Email is required');
    if (!body.candidateFirstName?.trim()) throw new BadRequestException('First name is required');

    // Find or create the candidate user
    let candidate = await this.prisma.user.findUnique({ where: { email: body.candidateEmail.trim().toLowerCase() } });
    if (!candidate) {
      const rawPassword = body.candidatePassword && body.candidatePassword.length >= 6
        ? body.candidatePassword
        : Math.random().toString(36).slice(-10) + 'Aa1!';
      const hash = await bcrypt.hash(rawPassword, 10);
      candidate = await this.prisma.user.create({
        data: {
          email: body.candidateEmail.trim().toLowerCase(),
          firstName: body.candidateFirstName.trim(),
          lastName: body.candidateLastName?.trim() ?? '',
          phone: body.candidatePhone?.trim() || undefined,
          passwordHash: hash,
          role: 'CLIENT',
          status: 'ACTIVE',
        },
      });
    }

    // Create application if jobId supplied
    if (body.jobId) {
      const existing = await this.prisma.application.findUnique({
        where: { userId_jobId: { userId: candidate.id, jobId: body.jobId } },
      });
      const status = body.status ?? 'SUBMITTED';
      if (existing) {
        await this.prisma.application.update({
          where: { id: existing.id },
          data: { status: status as any, notes: body.notes },
        });
        return { user: candidate, applicationId: existing.id, action: 'updated' };
      }
      const app = await this.prisma.application.create({
        data: {
          userId: candidate.id,
          jobId: body.jobId,
          status: status as any,
          notes: body.notes,
        },
      });
      return { user: candidate, applicationId: app.id, action: 'created' };
    }

    return { user: candidate, applicationId: null, action: candidate ? 'user_created' : 'user_found' };
  }

  private async seedApplicationThread(
    applicantId: string,
    job: { id: string; postedById: string; title: string },
  ) {
    // Reuse existing direct thread if one already exists between these two users
    const existing = await this.prisma.conversation.findFirst({
      where: {
        type: 'DIRECT',
        AND: [
          { participants: { some: { userId: applicantId, leftAt: null } } },
          { participants: { some: { userId: job.postedById, leftAt: null } } },
        ],
      },
      select: { id: true },
    });

    const convId = existing?.id ?? (
      await this.prisma.conversation.create({
        data: {
          type: 'DIRECT',
          participants: {
            create: [{ userId: applicantId }, { userId: job.postedById }],
          },
        },
        select: { id: true },
      })
    ).id;

    await this.prisma.message.create({
      data: {
        conversationId: convId,
        senderId: applicantId,
        messageType: 'APPLICATION',
        content: `Applied for "${job.title}"`,
      },
    });

    await this.prisma.conversation.update({
      where: { id: convId },
      data: { updatedAt: new Date() },
    });
  }

  async findAll(userId: string, userRole: string, dto: ListApplicationsDto) {
    const { page, limit, skip } = pageParams(dto);
    const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN' || userRole === 'FINANCE_ADMIN' || userRole === 'SUPPORT';
    const where: Prisma.ApplicationWhereInput = {};

    if (dto.status) where.status = dto.status;

    if (dto.search) {
      const s = dto.search.trim();
      where.OR = [
        { user: { firstName: { contains: s, mode: 'insensitive' } } },
        { user: { lastName: { contains: s, mode: 'insensitive' } } },
        { user: { email: { contains: s, mode: 'insensitive' } } },
        { job: { title: { contains: s, mode: 'insensitive' } } },
      ];
    }

    if (dto.dateFrom || dto.dateTo) {
      where.appliedAt = {
        ...(dto.dateFrom ? { gte: new Date(dto.dateFrom) } : {}),
        ...(dto.dateTo ? { lte: new Date(dto.dateTo + 'T23:59:59.999Z') } : {}),
      };
    }

    const recruiterProfiles = await this.prisma.recruiter.findMany({ where: { userId }, select: { companyId: true } });
    const isRecruiter = recruiterProfiles.length > 0 || userRole === 'TRAINER';

    if (isAdmin) {
      // Admin sees everything; optionally filter by jobId or status
      if (dto.jobId) where.jobId = dto.jobId;
    } else if (dto.jobId) {
      // Recruiter filtering by jobId — verify they belong to the job's company
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
    } else if (isRecruiter) {
      // Recruiter without jobId — all applications for any job at their company(ies)
      if (recruiterProfiles.length > 0) {
        const companyIds = recruiterProfiles.map((r) => r.companyId);
        where.job = { companyId: { in: companyIds } };
      } else {
        // TRAINER role fallback — jobs they personally posted
        where.job = { postedById: userId };
      }
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

  async updateStatus(id: string, userId: string, dto: UpdateApplicationStatusDto, userRole?: string) {
    const application = await this.prisma.application.findUnique({
      where: { id },
      include: {
        job: {
          select: {
            id: true,
            companyId: true,
            title: true,
            postedById: true,
            company: { select: { name: true } },
          },
        },
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });
    if (!application) throw new NotFoundException('Application not found');

    const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN' || userRole === 'FINANCE_ADMIN' || userRole === 'SUPPORT';
    if (!isAdmin) {
      const recruiter = await this.prisma.recruiter.findUnique({
        where: { userId_companyId: { userId, companyId: application.job.companyId } },
      });
      if (!recruiter) throw new ForbiddenException('Not authorised to update this application');
    }

    const updated = await this.prisma.application.update({
      where: { id },
      data: {
        status: dto.status,
        notes: dto.notes,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
        meetingLink: dto.meetingLink,
      },
    });

    // Auto-create the next task in the hiring workflow
    this.tasks
      .onApplicationStatusChange(id, dto.status as any, userId)
      .catch(() => null);

    // ── Post-hire orchestration ────────────────────────────────────────
    // When status flips to HIRED, do the rest of the lifecycle:
    //   1. Increment hired count → close the job if all vacancies are filled
    //   2. Auto-withdraw candidate's other active applications
    //   3. Add the candidate to the company's team
    //   4. Auto-create onboarding tasks for the recruiter
    if (dto.status === 'HIRED') {
      this.runPostHireFlow(application, userId).catch((err) => {
        // Best-effort: never fail the status update because of post-hire
        console.error('[post-hire] failed:', err instanceof Error ? err.message : err);
      });
    }

    const applicant = application.user;
    const jobTitle = application.job.title;
    const companyName = application.job.company?.name ?? 'the company';
    const firstName = applicant?.firstName ?? 'there';
    const applicantEmail = applicant?.email;
    const recruiterId = application.job.postedById;

    // In-app notification
    this.notifications
      .createInApp(
        application.userId,
        'APPLICATION_STATUS_UPDATE',
        'Application Status Updated',
        `Your application for "${jobTitle}" has been updated to ${dto.status}.`,
        { applicationId: id, jobTitle, status: dto.status },
      )
      .catch(() => null);

    // Email + chat message for key transitions
    const statusMessages: Record<string, { subject: string; html: string; chat: string }> = {
      HIRED: {
        subject: `Congratulations, you have been hired for the ${jobTitle} role`,
        html: `<p>Hi ${firstName},</p><p>We are pleased to confirm that you have been selected for the <strong>${jobTitle}</strong> position at <strong>${companyName}</strong>.</p><p>Our team will reach out shortly with your offer letter and onboarding details.</p><p>Welcome to the team.</p><p>Sincerely,<br/>${companyName}</p>`,
        chat: `Hi ${firstName}, congratulations. You have been hired for the ${jobTitle} role at ${companyName}. We will follow up shortly with your offer letter and onboarding details. Welcome to the team.`,
      },
      OFFER: {
        subject: `Offer of employment for the ${jobTitle} role at ${companyName}`,
        html: `<p>Hi ${firstName},</p><p>We are pleased to extend an <strong>offer of employment</strong> for the <strong>${jobTitle}</strong> position at <strong>${companyName}</strong>.</p><p>Please review the offer at your earliest convenience and let us know if you have any questions.</p><p>Sincerely,<br/>${companyName}</p>`,
        chat: `Hi ${firstName}, we have extended an offer of employment for the ${jobTitle} role at ${companyName}. Please review the offer in your account at your earliest convenience.`,
      },
      INTERVIEW: {
        subject: `Interview invitation for the ${jobTitle} role`,
        html: `<p>Hi ${firstName},</p><p>You have been invited to interview for the <strong>${jobTitle}</strong> position at <strong>${companyName}</strong>. Our team will follow up shortly with the proposed schedule.</p><p>Sincerely,<br/>${companyName}</p>`,
        chat: `Hi ${firstName}, you have been invited to interview for the ${jobTitle} role at ${companyName}. We will share the schedule details shortly.`,
      },
      SHORTLISTED: {
        subject: `Your application has been shortlisted for the ${jobTitle} role`,
        html: `<p>Hi ${firstName},</p><p>Your application for <strong>${jobTitle}</strong> at <strong>${companyName}</strong> has been <strong>shortlisted</strong>. We will be in touch with next steps soon.</p><p>Sincerely,<br/>${companyName}</p>`,
        chat: `Hi ${firstName}, your application for ${jobTitle} at ${companyName} has been shortlisted. We will be in touch with next steps soon.`,
      },
      REJECTED: {
        subject: `Application Update — ${jobTitle}`,
        html: `<p>Hi ${firstName},</p><p>Thank you for your interest in the <strong>${jobTitle}</strong> position at <strong>${companyName}</strong>.</p><p>After careful consideration, we have decided to move forward with other candidates at this time. We appreciate the time you invested and encourage you to apply for future opportunities.</p><p>Best regards,<br/>${companyName}</p>`,
        chat: `Hi ${firstName}, thank you for applying for the ${jobTitle} role at ${companyName}. After careful review we have decided to proceed with other candidates. We appreciate your time and encourage you to apply for future openings.`,
      },
    };

    const msg = statusMessages[dto.status];
    if (msg) {
      // Send email
      if (applicantEmail) {
        this.brevo.sendTransactionalEmail(applicantEmail, msg.subject, msg.html).catch(() => null);
      }

      // Send in-app chat message in the applicant↔recruiter thread
      this.sendStatusChatMessage(application.userId, recruiterId, msg.chat).catch(() => null);
    }

    return updated;
  }

  private async sendStatusChatMessage(applicantId: string, recruiterId: string, content: string): Promise<void> {
    // Find existing conversation between applicant and recruiter
    const conv = await this.prisma.conversation.findFirst({
      where: {
        AND: [
          { participants: { some: { userId: applicantId, leftAt: null } } },
          { participants: { some: { userId: recruiterId, leftAt: null } } },
        ],
      },
      select: { id: true },
    });
    if (!conv) return;

    await this.prisma.message.create({
      data: {
        conversationId: conv.id,
        senderId: recruiterId,
        content,
        messageType: 'TEXT',
      },
    });

    // Bump conversation updatedAt
    await this.prisma.conversation.update({
      where: { id: conv.id },
      data: { updatedAt: new Date() },
    });
  }

  async withdraw(id: string, userId: string, userRole?: string) {
    const application = await this.prisma.application.findUnique({
      where: { id },
      include: { job: { select: { id: true, title: true, postedById: true } } },
    });
    if (!application) throw new NotFoundException('Application not found');
    const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN' || userRole === 'FINANCE_ADMIN' || userRole === 'SUPPORT';
    if (!isAdmin && application.userId !== userId) {
      throw new ForbiddenException('You can only withdraw your own applications');
    }
    await this.prisma.application.delete({ where: { id } });

    // Notify recruiter the candidate withdrew
    this.notifications.createInApp(
      application.job.postedById,
      'APPLICATION_WITHDRAWN',
      'Application withdrawn',
      `An applicant has withdrawn their application for "${application.job.title}".`,
      { jobId: application.job.id, jobTitle: application.job.title },
    ).catch(() => null);

    return { message: 'Application withdrawn' };
  }

  // ── Post-hire orchestration ───────────────────────────────────────────────
  // Called when an application transitions to HIRED. Best-effort — logs and continues
  // on partial failure so a missing FK or already-existing team-member doesn't roll
  // back the original status update.
  private async runPostHireFlow(
    application: {
      id: string;
      userId: string;
      job: {
        id: string;
        companyId: string;
        title: string;
        postedById: string;
        company?: { name: string } | null;
      };
      user: { id: string; email: string | null; firstName: string | null; lastName: string | null };
    },
    actorId: string,
  ) {
    const job = application.job;
    const candidateId = application.userId;
    const candidateName = `${application.user.firstName ?? ''} ${application.user.lastName ?? ''}`.trim() || application.user.email || 'New hire';

    // 1. Close the job if all vacancies are filled
    try {
      const jobRecord = await this.prisma.job.findUnique({
        where: { id: job.id },
        select: { vacancies: true, status: true },
      });
      const vacancies = jobRecord?.vacancies ?? 1;
      const hiredCount = await this.prisma.application.count({
        where: { jobId: job.id, status: 'HIRED' as any },
      });
      if (hiredCount >= vacancies && jobRecord?.status === 'ACTIVE') {
        await this.prisma.job.update({
          where: { id: job.id },
          data: { status: 'CLOSED' as any },
        });
      }
    } catch (e) {
      console.error('[post-hire] close-job:', e);
    }

    // 2. Auto-withdraw candidate's other active applications
    try {
      await this.prisma.application.updateMany({
        where: {
          userId: candidateId,
          id: { not: application.id },
          status: { in: ['SUBMITTED', 'REVIEWED', 'SHORTLISTED', 'INTERVIEW'] as any[] },
        },
        data: { status: 'WITHDRAWN' as any, notes: `Auto-withdrawn — hired at ${job.company?.name ?? 'another company'} for ${job.title}.` },
      });
    } catch (e) {
      console.error('[post-hire] withdraw-others:', e);
    }

    // 3. Add the candidate to the company's team
    //    TeamMember.firmId references a User (the firm owner). Use the job's poster as the firm anchor.
    try {
      const exists = await this.prisma.teamMember.findFirst({
        where: { firmId: job.postedById, userId: candidateId, isActive: true },
      });
      if (!exists) {
        await this.prisma.teamMember.create({
          data: {
            firmId: job.postedById,
            userId: candidateId,
            invitedById: actorId,
            isActive: true,
            joinedAt: new Date(),
            role: 'CONSULTANT' as any,
            title: job.title,
          },
        });
      }
    } catch (e) {
      console.error('[post-hire] add-team-member:', e);
    }

    // 4. Auto-create onboarding tasks for the recruiter
    try {
      const onboarding = [
        { title: `Send signed offer letter — ${candidateName}`, type: 'OFFER_SEND', priority: 'URGENT', daysFromNow: 1 },
        { title: `Add ${candidateName} to payroll`, type: 'ONBOARD', priority: 'HIGH', daysFromNow: 3 },
        { title: `Order equipment for ${candidateName}`, type: 'ONBOARD', priority: 'HIGH', daysFromNow: 5 },
        { title: `Schedule onboarding call with ${candidateName}`, type: 'ONBOARD', priority: 'MEDIUM', daysFromNow: 2 },
      ];
      await this.prisma.task.createMany({
        data: onboarding.map((t) => ({
          type: t.type as any,
          title: t.title,
          description: `Auto-created on hire for "${job.title}".`,
          priority: t.priority as any,
          dueDate: new Date(Date.now() + t.daysFromNow * 86400_000),
          jobId: job.id,
          applicationId: application.id,
          companyId: job.companyId,
          assignedToId: job.postedById,
          createdById: actorId,
        })),
      });
    } catch (e) {
      console.error('[post-hire] onboarding-tasks:', e);
    }
  }
}
