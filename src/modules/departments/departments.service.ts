import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { CreateDepartmentDto, UpdateDepartmentDto } from './dto/departments.dto';

@Injectable()
export class DepartmentsService {
  private readonly logger = new Logger(DepartmentsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Create department ─────────────────────────────────────────────────────
  async create(firmId: string, callerId: string, dto: CreateDepartmentDto) {
    await this.assertCanManage(firmId, callerId);

    // Validate lead belongs to the firm if provided
    if (dto.leadId) {
      await this.assertMemberBelongsToFirm(firmId, dto.leadId);
    }

    const maxSort = await this.prisma.department.aggregate({
      where: { firmId },
      _max: { sortOrder: true },
    });

    const dept = await this.prisma.department.create({
      data: {
        firmId,
        name: dto.name,
        description: dto.description,
        leadId: dto.leadId || null,
        sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
      },
      include: {
        lead: { select: { id: true, firstName: true, lastName: true, avatar: true } },
        _count: { select: { members: true } },
      },
    });

    this.logger.log(`Department "${dto.name}" created for firm ${firmId}`);
    return dept;
  }

  // ── List firm's departments ───────────────────────────────────────────────
  async list(firmId: string) {
    return this.prisma.department.findMany({
      where: { firmId },
      include: {
        lead: { select: { id: true, firstName: true, lastName: true, avatar: true } },
        _count: { select: { members: true } },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  // ── Get department with members ───────────────────────────────────────────
  async getOne(id: string, firmId: string) {
    const dept = await this.prisma.department.findUnique({
      where: { id },
      include: {
        lead: { select: { id: true, firstName: true, lastName: true, avatar: true, email: true } },
        members: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                name: true,
                email: true,
                avatar: true,
                status: true,
              },
            },
          },
          orderBy: [{ role: 'asc' }, { joinedAt: 'desc' }],
        },
        _count: { select: { members: true, slots: true } },
      },
    });

    if (!dept) throw new NotFoundException('Department not found');
    if (dept.firmId !== firmId) throw new ForbiddenException('Department does not belong to your firm');

    return dept;
  }

  // ── Update department ─────────────────────────────────────────────────────
  async update(id: string, firmId: string, callerId: string, dto: UpdateDepartmentDto) {
    await this.assertCanManage(firmId, callerId);

    const dept = await this.prisma.department.findUnique({ where: { id } });
    if (!dept) throw new NotFoundException('Department not found');
    if (dept.firmId !== firmId) throw new ForbiddenException('Department does not belong to your firm');

    // Validate lead belongs to the firm if provided
    if (dto.leadId) {
      await this.assertMemberBelongsToFirm(firmId, dto.leadId);
    }

    return this.prisma.department.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.leadId !== undefined && { leadId: dto.leadId || null }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      },
      include: {
        lead: { select: { id: true, firstName: true, lastName: true, avatar: true } },
        _count: { select: { members: true } },
      },
    });
  }

  // ── Delete department ─────────────────────────────────────────────────────
  async remove(id: string, firmId: string, callerId: string) {
    await this.assertCanManage(firmId, callerId);

    const dept = await this.prisma.department.findUnique({ where: { id } });
    if (!dept) throw new NotFoundException('Department not found');
    if (dept.firmId !== firmId) throw new ForbiddenException('Department does not belong to your firm');

    // Clear departmentId from team members before deleting
    await this.prisma.teamMember.updateMany({
      where: { departmentId: id },
      data: { departmentId: null },
    });

    // Clear departmentId from availability slots
    await this.prisma.availabilitySlot.updateMany({
      where: { departmentId: id },
      data: { departmentId: null },
    });

    await this.prisma.department.delete({ where: { id } });

    this.logger.log(`Department ${id} deleted from firm ${firmId}`);
    return { success: true, message: 'Department deleted' };
  }

  // ── Add member to department ──────────────────────────────────────────────
  async addMember(departmentId: string, firmId: string, callerId: string, memberId: string) {
    await this.assertCanManage(firmId, callerId);

    const dept = await this.prisma.department.findUnique({ where: { id: departmentId } });
    if (!dept) throw new NotFoundException('Department not found');
    if (dept.firmId !== firmId) throw new ForbiddenException('Department does not belong to your firm');

    const member = await this.prisma.teamMember.findUnique({ where: { id: memberId } });
    if (!member) throw new NotFoundException('Team member not found');
    if (member.firmId !== firmId) throw new ForbiddenException('Member does not belong to your firm');

    if (member.departmentId === departmentId) {
      throw new BadRequestException('Member is already in this department');
    }

    return this.prisma.teamMember.update({
      where: { id: memberId },
      data: { departmentId },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, name: true, email: true, avatar: true },
        },
        department: { select: { id: true, name: true } },
      },
    });
  }

  // ── Remove member from department ─────────────────────────────────────────
  async removeMember(departmentId: string, firmId: string, callerId: string, memberId: string) {
    await this.assertCanManage(firmId, callerId);

    const dept = await this.prisma.department.findUnique({ where: { id: departmentId } });
    if (!dept) throw new NotFoundException('Department not found');
    if (dept.firmId !== firmId) throw new ForbiddenException('Department does not belong to your firm');

    const member = await this.prisma.teamMember.findUnique({ where: { id: memberId } });
    if (!member) throw new NotFoundException('Team member not found');
    if (member.departmentId !== departmentId) {
      throw new BadRequestException('Member is not in this department');
    }

    return this.prisma.teamMember.update({
      where: { id: memberId },
      data: { departmentId: null },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, name: true, email: true, avatar: true },
        },
      },
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async assertCanManage(firmId: string, callerId: string) {
    if (callerId === firmId) return;

    const callerMember = await this.prisma.teamMember.findUnique({
      where: { firmId_userId: { firmId, userId: callerId } },
    });
    if (callerMember && ['OWNER', 'ADMIN'].includes(callerMember.role) && callerMember.isActive) {
      return;
    }

    throw new ForbiddenException('Only the firm owner or admins can manage departments');
  }

  private async assertMemberBelongsToFirm(firmId: string, userId: string) {
    const member = await this.prisma.teamMember.findFirst({
      where: { firmId, userId, isActive: true },
    });
    // Also check if the user IS the firm owner directly
    if (!member && userId !== firmId) {
      throw new BadRequestException('The specified user is not an active member of your firm');
    }
  }
}
