import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma, TaskStatus, TaskType, TaskPriority, ApplicationStatus } from '@prisma/client';
import { PrismaService } from '../../common/services/prisma.service';
import { pageParams, paginate } from '../../common/dto/pagination.dto';
import { CreateTaskDto, UpdateTaskDto, ListTasksDto } from './dto/tasks.dto';

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Create ─────────────────────────────────────────────────────────────
  async create(creatorId: string, dto: CreateTaskDto) {
    if (dto.applicationId) {
      const app = await this.prisma.application.findUnique({
        where: { id: dto.applicationId },
        include: { job: true },
      });
      if (!app) throw new NotFoundException('Application not found');
      if (!dto.jobId) dto.jobId = app.jobId;
      if (!dto.companyId) dto.companyId = app.job.companyId;
    } else if (dto.jobId && !dto.companyId) {
      const job = await this.prisma.job.findUnique({ where: { id: dto.jobId } });
      if (!job) throw new NotFoundException('Job not found');
      dto.companyId = job.companyId;
    }

    return this.prisma.task.create({
      data: {
        title: dto.title,
        description: dto.description,
        type: dto.type ?? TaskType.GENERAL,
        priority: dto.priority ?? TaskPriority.MEDIUM,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        jobId: dto.jobId,
        applicationId: dto.applicationId,
        companyId: dto.companyId,
        assignedToId: dto.assignedToId,
        createdById: creatorId,
      },
      include: this.includes(),
    });
  }

  // ── List with filters ──────────────────────────────────────────────────
  async findAll(userId: string, role: string, dto: ListTasksDto) {
    const { page, limit, skip } = pageParams({ page: dto.page, limit: dto.limit });
    const take = limit;

    const where: Prisma.TaskWhereInput = {};
    if (dto.status) where.status = dto.status;
    if (dto.type) where.type = dto.type;
    if (dto.priority) where.priority = dto.priority;
    if (dto.jobId) where.jobId = dto.jobId;
    if (dto.applicationId) where.applicationId = dto.applicationId;
    if (dto.companyId) where.companyId = dto.companyId;
    if (dto.assignedToId) where.assignedToId = dto.assignedToId;
    if (dto.createdById) where.createdById = dto.createdById;
    if (dto.mine) where.assignedToId = userId;
    if (dto.overdue) {
      where.dueDate = { lt: new Date() };
      where.status = { in: [TaskStatus.OPEN, TaskStatus.IN_PROGRESS] };
    }
    if (dto.search) {
      where.OR = [
        { title: { contains: dto.search, mode: 'insensitive' } },
        { description: { contains: dto.search, mode: 'insensitive' } },
      ];
    }

    // Non-admins see only tasks tied to companies they recruit for OR assigned to them OR created by them
    const isAdminish = ['ADMIN', 'SUPER_ADMIN', 'SUPPORT', 'FINANCE_ADMIN'].includes(role);
    if (!isAdminish) {
      const recruiterCompanies = await this.prisma.recruiter.findMany({
        where: { userId },
        select: { companyId: true },
      });
      const companyIds = recruiterCompanies.map(r => r.companyId);
      where.OR = [
        ...(where.OR ?? []),
        { assignedToId: userId },
        { createdById: userId },
        ...(companyIds.length ? [{ companyId: { in: companyIds } }] : []),
      ];
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.task.findMany({
        where,
        include: this.includes(),
        orderBy: [
          { status: 'asc' },
          { dueDate: 'asc' },
          { createdAt: 'desc' },
        ],
        skip,
        take,
      }),
      this.prisma.task.count({ where }),
    ]);

    return paginate(items, total, page, limit);
  }

  async findOne(id: string, userId: string, role: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: this.includes(),
    });
    if (!task) throw new NotFoundException('Task not found');
    await this.assertAccess(task, userId, role);
    return task;
  }

  // ── Update ─────────────────────────────────────────────────────────────
  async update(id: string, userId: string, role: string, dto: UpdateTaskDto) {
    const existing = await this.prisma.task.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Task not found');
    await this.assertAccess(existing, userId, role);

    const data: Prisma.TaskUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.priority !== undefined) data.priority = dto.priority;
    if (dto.dueDate !== undefined) data.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    if (dto.assignedToId !== undefined) {
      data.assignedTo = dto.assignedToId
        ? { connect: { id: dto.assignedToId } }
        : { disconnect: true };
    }
    if (dto.status !== undefined) {
      data.status = dto.status;
      if (dto.status === TaskStatus.DONE) data.completedAt = new Date();
      if (dto.status !== TaskStatus.DONE && existing.completedAt) data.completedAt = null;
    }

    return this.prisma.task.update({ where: { id }, data, include: this.includes() });
  }

  // ── Convenience: complete / cancel ────────────────────────────────────
  async complete(id: string, userId: string, role: string) {
    return this.update(id, userId, role, { status: TaskStatus.DONE });
  }

  async cancel(id: string, userId: string, role: string) {
    return this.update(id, userId, role, { status: TaskStatus.CANCELLED });
  }

  async remove(id: string, userId: string, role: string) {
    const existing = await this.prisma.task.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Task not found');
    await this.assertAccess(existing, userId, role);
    if (existing.createdById !== userId && !this.isAdmin(role)) {
      throw new ForbiddenException('Only the creator or an admin can delete a task');
    }
    return this.prisma.task.delete({ where: { id } });
  }

  // ── Auto-create tasks when an application changes status ──────────────
  // Called by ApplicationsService when status transitions occur.
  async onApplicationStatusChange(applicationId: string, newStatus: ApplicationStatus, actorId: string) {
    const app = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: { job: { include: { postedBy: true } }, user: true },
    });
    if (!app) return;

    const factory = (type: TaskType, title: string, description: string, priority: TaskPriority = TaskPriority.MEDIUM, daysFromNow = 3) => ({
      type,
      title,
      description,
      priority,
      dueDate: new Date(Date.now() + daysFromNow * 86400_000),
      jobId: app.jobId,
      applicationId: app.id,
      companyId: app.job.companyId,
      assignedToId: app.job.postedById,
      createdById: actorId,
    });

    let payload: Prisma.TaskUncheckedCreateInput | null = null;
    const candidateName = `${app.user.firstName ?? ''} ${app.user.lastName ?? ''}`.trim() || app.user.email;

    switch (newStatus) {
      case ApplicationStatus.REVIEWED:
        payload = factory(
          TaskType.SCREEN_CV,
          `Screen CV — ${candidateName}`,
          `Review the CV and profile for ${candidateName} on "${app.job.title}".`,
          TaskPriority.MEDIUM,
          2,
        );
        break;
      case ApplicationStatus.SHORTLISTED:
        payload = factory(
          TaskType.INTERVIEW_SCHEDULE,
          `Schedule interview — ${candidateName}`,
          `Reach out to ${candidateName} and schedule an interview for "${app.job.title}".`,
          TaskPriority.HIGH,
          2,
        );
        break;
      case ApplicationStatus.INTERVIEW:
        payload = factory(
          TaskType.INTERVIEW_CONDUCT,
          `Conduct interview — ${candidateName}`,
          `Run the scheduled interview with ${candidateName} for "${app.job.title}". Capture notes after.`,
          TaskPriority.HIGH,
          5,
        );
        break;
      case ApplicationStatus.HIRED:
        payload = factory(
          TaskType.OFFER_SEND,
          `Send offer — ${candidateName}`,
          `Prepare and send the offer letter to ${candidateName} for "${app.job.title}".`,
          TaskPriority.URGENT,
          1,
        );
        break;
      default:
        return;
    }

    if (payload) {
      await this.prisma.task.create({ data: payload });
    }
  }

  // ── Stats ──────────────────────────────────────────────────────────────
  async stats(userId: string, role: string) {
    const baseFilter = await this.scopedFilter(userId, role);
    const [open, inProgress, overdue, done] = await Promise.all([
      this.prisma.task.count({ where: { ...baseFilter, status: TaskStatus.OPEN } }),
      this.prisma.task.count({ where: { ...baseFilter, status: TaskStatus.IN_PROGRESS } }),
      this.prisma.task.count({
        where: {
          ...baseFilter,
          status: { in: [TaskStatus.OPEN, TaskStatus.IN_PROGRESS] },
          dueDate: { lt: new Date() },
        },
      }),
      this.prisma.task.count({ where: { ...baseFilter, status: TaskStatus.DONE } }),
    ]);
    return { open, inProgress, overdue, done };
  }

  // ── Helpers ────────────────────────────────────────────────────────────
  private includes() {
    return {
      assignedTo: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true } },
      job: { select: { id: true, title: true } },
      application: { select: { id: true, status: true, user: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true } } } },
      company: { select: { id: true, name: true, logoUrl: true } },
    };
  }

  private isAdmin(role: string) {
    return ['ADMIN', 'SUPER_ADMIN', 'SUPPORT', 'FINANCE_ADMIN'].includes(role);
  }

  private async scopedFilter(userId: string, role: string): Promise<Prisma.TaskWhereInput> {
    if (this.isAdmin(role)) return {};
    const recruiterCompanies = await this.prisma.recruiter.findMany({
      where: { userId },
      select: { companyId: true },
    });
    const companyIds = recruiterCompanies.map(r => r.companyId);
    return {
      OR: [
        { assignedToId: userId },
        { createdById: userId },
        ...(companyIds.length ? [{ companyId: { in: companyIds } }] : []),
      ],
    };
  }

  private async assertAccess(task: { assignedToId: string | null; createdById: string; companyId: string | null }, userId: string, role: string) {
    if (this.isAdmin(role)) return;
    if (task.assignedToId === userId) return;
    if (task.createdById === userId) return;
    if (task.companyId) {
      const link = await this.prisma.recruiter.findFirst({
        where: { userId, companyId: task.companyId },
        select: { id: true },
      });
      if (link) return;
    }
    throw new ForbiddenException('You do not have access to this task');
  }
}
