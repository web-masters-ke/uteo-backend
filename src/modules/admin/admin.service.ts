import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/services/prisma.service';
import { paginate } from '../../common/dto/pagination.dto';
import { ListAuditLogsDto, VerifyTrainerDto, AnalyticsQueryDto } from './dto/admin.dto';
@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}
  async getDashboard() {
    const [totalUsers,totalTrainers,verified,totalBookings,completed,activeEscrows,rev,recentSignups,activeSubs,totalJobs,activeJobs,totalApplications,totalCompanies,newApplications] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.user.count({ where: { role: 'TRAINER', deletedAt: null } }),
      this.prisma.trainerProfile.count({ where: { verificationStatus: 'VERIFIED' } }),
      this.prisma.booking.count(),
      this.prisma.booking.count({ where: { status: 'COMPLETED' } }),
      this.prisma.escrowAccount.count({ where: { status: { in: ['FUNDED','HELD','FROZEN'] } } }),
      this.prisma.booking.aggregate({ _sum: { amount: true }, where: { status: 'COMPLETED' } }),
      this.prisma.user.count({ where: { createdAt: { gte: new Date(Date.now()-7*86400000) }, deletedAt: null } }),
      this.prisma.subscription.count({ where: { status: 'ACTIVE' } }),
      this.prisma.job.count(),
      this.prisma.job.count({ where: { status: 'ACTIVE' } }),
      this.prisma.application.count(),
      this.prisma.company.count(),
      this.prisma.application.count({ where: { appliedAt: { gte: new Date(Date.now()-7*86400000) } } }),
    ]);
    return { totalUsers, totalTrainers, verifiedTrainers: verified, totalBookings, completedBookings: completed, activeEscrows, totalRevenue: rev._sum.amount||0, recentSignups, activeSubscriptions: activeSubs, totalJobs, activeJobs, totalApplications, totalCompanies, newApplications };
  }
  async getAnalytics(dto: AnalyticsQueryDto) {
    const from = dto.dateFrom ? new Date(dto.dateFrom) : new Date(Date.now()-30*86400000);
    const to = dto.dateTo ? new Date(dto.dateTo) : new Date();
    const [bookings, signups, payments] = await Promise.all([
      this.prisma.booking.findMany({ where: { createdAt: { gte: from, lte: to } }, select: { createdAt: true, amount: true }, orderBy: { createdAt: 'asc' } }),
      this.prisma.user.findMany({ where: { createdAt: { gte: from, lte: to }, deletedAt: null }, select: { createdAt: true }, orderBy: { createdAt: 'asc' } }),
      this.prisma.payment.findMany({ where: { createdAt: { gte: from, lte: to }, status: 'SUCCESS' }, select: { createdAt: true, amount: true }, orderBy: { createdAt: 'asc' } }),
    ]);
    const group = (items: {createdAt:Date,amount?:any}[]) => { const m = new Map<string,{total:number,count:number}>(); items.forEach(i => { const d = i.createdAt.toISOString().split('T')[0]; const e = m.get(d)||{total:0,count:0}; e.total += Number(i.amount||1); e.count++; m.set(d, e); }); return Array.from(m.entries()).map(([date,data])=>({date,...data})).sort((a,b)=>a.date.localeCompare(b.date)); };
    return { dateRange: { from, to }, bookingsPerDay: group(bookings), signupsPerDay: group(signups as any), revenuePerDay: group(payments) };
  }
  async getAuditLogs(dto: ListAuditLogsDto) {
    const page=Number(dto.page)||1; const limit=Number(dto.limit)||20; const skip=(page-1)*limit;
    const where: Prisma.AuditLogWhereInput = {};
    if (dto.action) where.action = { contains: dto.action, mode: 'insensitive' };
    if (dto.resource) where.resource = { contains: dto.resource, mode: 'insensitive' };
    if (dto.userId) where.userId = dto.userId;
    if (dto.dateFrom || dto.dateTo) { where.createdAt = {}; if (dto.dateFrom) (where.createdAt as any).gte = new Date(dto.dateFrom); if (dto.dateTo) (where.createdAt as any).lte = new Date(dto.dateTo); }
    const [items,total] = await Promise.all([this.prisma.auditLog.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' }, include: { user: { select: { id:true, firstName:true, lastName:true, email:true } } } }), this.prisma.auditLog.count({ where })]);
    return paginate(items, total, page, limit);
  }
  async verifyTrainer(trainerId: string, dto: VerifyTrainerDto, adminId: string) {
    const profile = await this.prisma.trainerProfile.findUnique({ where: { id: trainerId } });
    if (!profile) throw new NotFoundException('Trainer profile not found');
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.trainerProfile.update({ where: { id: trainerId }, data: { verificationStatus: dto.status }, include: { user: { select: { id:true, firstName:true, lastName:true, email:true } } } });
      await tx.auditLog.create({ data: { userId: adminId, action: 'VERIFY_TRAINER', resource: 'TrainerProfile', resourceId: trainerId, oldValue: { verificationStatus: profile.verificationStatus }, newValue: { verificationStatus: dto.status, note: dto.note } } });
      return updated;
    });
  }
}
