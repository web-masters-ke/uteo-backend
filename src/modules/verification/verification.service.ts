import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/services/prisma.service';
import { paginate } from '../../common/dto/pagination.dto';
import { CreateVerificationRequestDto, ReviewVerificationDto, ListVerificationRequestsDto, SubmitCredentialVerificationDto, ReviewCredentialDto } from './dto/verification.dto';

@Injectable()
export class VerificationService {
  constructor(private readonly prisma: PrismaService) {}

  async createRequest(userId: string, dto: CreateVerificationRequestDto) {
    const profile = await this.prisma.trainerProfile.findUnique({ where: { userId } });
    if (!profile) throw new BadRequestException('Trainer profile not found');
    return this.prisma.verificationRequest.create({
      data: { trainerId: profile.id, documentType: dto.documentType, documentUrl: dto.documentUrl, status: 'PENDING' },
    });
  }

  async listRequests(dto: ListVerificationRequestsDto) {
    const page = Number(dto.page) || 1;
    const limit = Number(dto.limit) || 20;
    const skip = (page - 1) * limit;
    const where: Prisma.VerificationRequestWhereInput = {};
    if (dto.status) where.status = dto.status;
    if (dto.search) {
      where.OR = [
        { documentType: { contains: dto.search, mode: 'insensitive' } },
        { trainer: { user: { firstName: { contains: dto.search, mode: 'insensitive' } } } },
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.verificationRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          trainer: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } } },
          reviewedBy: { select: { id: true, firstName: true, lastName: true } },
          certification: true,
        },
      }),
      this.prisma.verificationRequest.count({ where }),
    ]);
    return paginate(items, total, page, limit);
  }

  async review(id: string, dto: ReviewVerificationDto, adminId: string) {
    const req = await this.prisma.verificationRequest.findUnique({
      where: { id },
      include: { trainer: true, certification: true },
    });
    if (!req) throw new NotFoundException('Request not found');
    if (req.status !== 'PENDING') throw new BadRequestException('Already reviewed');
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.verificationRequest.update({
        where: { id },
        data: { status: dto.status, reviewNote: dto.reviewNote, reviewedById: adminId, reviewedAt: new Date() },
        include: { trainer: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } } } },
      });

      // If linked to a certification, update that certification too
      if (req.certificationId) {
        if (dto.status === 'APPROVED') {
          await tx.certification.update({
            where: { id: req.certificationId },
            data: { verified: true, verificationNote: dto.reviewNote, verifiedAt: new Date(), verifiedBy: adminId },
          });
        } else if (dto.status === 'REJECTED') {
          await tx.certification.update({
            where: { id: req.certificationId },
            data: { verified: false, verificationNote: dto.reviewNote, rejectedReason: dto.reviewNote },
          });
        }
      }

      if (dto.status === 'APPROVED') {
        const all = await tx.verificationRequest.findMany({ where: { trainerId: req.trainerId } });
        const allApproved = all.every(r => r.id === id || r.status === 'APPROVED');
        await tx.trainerProfile.update({
          where: { id: req.trainerId },
          data: { verificationStatus: allApproved ? 'VERIFIED' : 'UNDER_REVIEW' },
        });
        // Recalculate tier after verification approval (if cert-linked)
        if (req.certificationId) {
          await this._recalculateTierInTx(tx, req.trainerId);
        }
      }
      if (dto.status === 'REJECTED') {
        await tx.trainerProfile.update({
          where: { id: req.trainerId },
          data: { verificationStatus: 'REJECTED' },
        });
      }
      return updated;
    });
  }

  /**
   * Submit a certification for verification - creates a VerificationRequest linked to the certification.
   */
  async submitCredentialForVerification(certificationId: string, userId: string, dto: SubmitCredentialVerificationDto) {
    const cert = await this.prisma.certification.findUnique({
      where: { id: certificationId },
      include: { trainer: true },
    });
    if (!cert) throw new NotFoundException('Certification not found');
    if (cert.trainer.userId !== userId) throw new BadRequestException('Not your certification');
    if (cert.verified) throw new BadRequestException('Certification is already verified');

    // Check if there's already a pending verification request for this cert
    const existing = await this.prisma.verificationRequest.findFirst({
      where: { certificationId, status: 'PENDING' },
    });
    if (existing) throw new BadRequestException('A verification request is already pending for this certification');

    return this.prisma.verificationRequest.create({
      data: {
        trainerId: cert.trainerId,
        certificationId,
        documentType: cert.credentialType,
        documentUrl: cert.documentUrl || '',
        status: 'PENDING',
        reviewNote: dto.note,
      },
      include: { certification: true },
    });
  }

  /**
   * Admin reviews a specific credential/certification.
   */
  async reviewCredential(certificationId: string, dto: ReviewCredentialDto, adminId: string) {
    const cert = await this.prisma.certification.findUnique({
      where: { id: certificationId },
      include: { trainer: true },
    });
    if (!cert) throw new NotFoundException('Certification not found');

    // Find the pending verification request for this certification
    const verReq = await this.prisma.verificationRequest.findFirst({
      where: { certificationId, status: 'PENDING' },
    });

    return this.prisma.$transaction(async (tx) => {
      // Update the verification request if one exists
      if (verReq) {
        await tx.verificationRequest.update({
          where: { id: verReq.id },
          data: { status: dto.status, reviewNote: dto.reviewNote, reviewedById: adminId, reviewedAt: new Date() },
        });
      }

      // Update the certification itself
      if (dto.status === 'APPROVED') {
        await tx.certification.update({
          where: { id: certificationId },
          data: {
            verified: true,
            verificationNote: dto.reviewNote,
            verifiedAt: new Date(),
            verifiedBy: adminId,
            rejectedReason: null,
          },
        });

        // Check if ALL certifications for this trainer are now verified
        const allCerts = await tx.certification.findMany({ where: { trainerId: cert.trainerId } });
        const allVerified = allCerts.every(c => c.id === certificationId || c.verified);
        if (allVerified) {
          await tx.trainerProfile.update({
            where: { id: cert.trainerId },
            data: { verificationStatus: 'VERIFIED' },
          });
        }
      } else if (dto.status === 'REJECTED') {
        await tx.certification.update({
          where: { id: certificationId },
          data: {
            verified: false,
            verificationNote: dto.reviewNote,
            rejectedReason: dto.rejectedReason || dto.reviewNote,
          },
        });
        // Rejection of a cert does NOT change profile status per spec
      }

      // Recalculate tier after any credential review
      await this._recalculateTierInTx(tx, cert.trainerId);

      return tx.certification.findUnique({
        where: { id: certificationId },
        include: { trainer: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } } } },
      });
    });
  }

  /**
   * Admin lists all certifications pending verification, with trainer info.
   */
  async listPendingCredentials(dto: ListVerificationRequestsDto) {
    const page = Number(dto.page) || 1;
    const limit = Number(dto.limit) || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.CertificationWhereInput = { verified: false };
    if (dto.search) {
      where.OR = [
        { name: { contains: dto.search, mode: 'insensitive' } },
        { issuer: { contains: dto.search, mode: 'insensitive' } },
        { trainer: { user: { firstName: { contains: dto.search, mode: 'insensitive' } } } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.certification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          trainer: {
            include: { user: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true } } },
          },
          verificationRequests: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      }),
      this.prisma.certification.count({ where }),
    ]);
    return paginate(items, total, page, limit);
  }

  async listAllCredentials(dto: ListVerificationRequestsDto) {
    const page = Number(dto.page) || 1;
    const limit = Number(dto.limit) || 20;
    const skip = (page - 1) * limit;
    const where: Prisma.CertificationWhereInput = {};
    const statusStr = dto.status as string;
    if (statusStr === 'verified') where.verified = true;
    else if (statusStr === 'unverified') where.verified = false;
    else if (statusStr === 'rejected') where.rejectedReason = { not: null };
    if (dto.search) {
      where.OR = [
        { name: { contains: dto.search, mode: 'insensitive' } },
        { issuer: { contains: dto.search, mode: 'insensitive' } },
        { trainer: { user: { firstName: { contains: dto.search, mode: 'insensitive' } } } },
      ];
    }
    const [items, total] = await Promise.all([
      this.prisma.certification.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        include: {
          trainer: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true } } } },
        },
      }),
      this.prisma.certification.count({ where }),
    ]);
    return paginate(items, total, page, limit);
  }

  /**
   * Admin stats: total pending, approved today, rejected today, by credential type breakdown.
   */
  async credentialStats() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [totalPending, approvedToday, rejectedToday, byCredentialType] = await Promise.all([
      this.prisma.certification.count({ where: { verified: false } }),
      this.prisma.certification.count({ where: { verified: true, verifiedAt: { gte: todayStart } } }),
      this.prisma.certification.count({ where: { rejectedReason: { not: null }, verifiedAt: { gte: todayStart } } }),
      this.prisma.certification.groupBy({
        by: ['credentialType'],
        _count: { id: true },
        where: { verified: false },
      }),
    ]);

    const byType: Record<string, number> = {};
    for (const item of byCredentialType) {
      byType[item.credentialType] = item._count.id;
    }

    return { totalPending, approvedToday, rejectedToday, byCredentialType: byType };
  }

  /**
   * Internal helper: recalculate tier within a transaction context.
   */
  private async _recalculateTierInTx(tx: Prisma.TransactionClient, profileId: string) {
    const profile = await tx.trainerProfile.findUnique({
      where: { id: profileId },
      include: { certifications: { where: { verified: true } } },
    });
    if (!profile) return;

    const verifiedCerts = profile.certifications;
    const verifiedCount = verifiedCerts.length;
    const hasLicenseOrMembership = verifiedCerts.some(
      c => c.credentialType === 'LICENSE' || c.credentialType === 'PROFESSIONAL_MEMBERSHIP',
    );

    let tier: 'CERTIFIED' | 'EXPERIENCED' | 'ENTRY_LEVEL' = 'ENTRY_LEVEL';
    if (verifiedCount >= 2 && hasLicenseOrMembership) {
      tier = 'CERTIFIED';
    } else if (profile.experience >= 5 || verifiedCount > 0) {
      tier = 'EXPERIENCED';
    }

    await tx.trainerProfile.update({ where: { id: profileId }, data: { tier } });
  }

  /**
   * Trainer's own credentials + team credentials (if OWNER).
   * - Solo trainer: returns own certifications + requests.
   * - Firm OWNER: returns credentials for every team member (self + consultants + associates).
   *   UI can group by trainer.
   */
  async myCredentials(userId: string) {
    const myProfile = await this.prisma.trainerProfile.findUnique({
      where: { userId },
    });

    // Check if this user is a firm OWNER (has team members under them)
    const ownerMember = await this.prisma.teamMember.findFirst({
      where: { firmId: userId, userId, role: 'OWNER' },
    });

    let teamMemberIds: string[] = [userId];
    let team: any[] = [];
    if (ownerMember) {
      team = await this.prisma.teamMember.findMany({
        where: { firmId: userId, isActive: true },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true } },
        },
        orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
      });
      teamMemberIds = team.map((t) => t.userId);
    } else {
      team = [{
        userId,
        role: 'SOLO',
        title: null,
        user: await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, firstName: true, lastName: true, email: true, avatar: true } }),
      }];
    }

    // Get all trainer profiles for these users
    const profiles = await this.prisma.trainerProfile.findMany({
      where: { userId: { in: teamMemberIds } },
      include: {
        certifications: { orderBy: { createdAt: 'desc' } },
        user: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true } },
      },
    });

    // Verification requests for these profiles
    const profileIds = profiles.map((p) => p.id);
    const requests = profileIds.length > 0 ? await this.prisma.verificationRequest.findMany({
      where: { trainerId: { in: profileIds } },
      orderBy: { createdAt: 'desc' },
      include: { reviewedBy: { select: { id: true, firstName: true, lastName: true, avatar: true } } },
    }) : [];

    // Flatten all certifications with owner info embedded + group by owner
    const certifications = profiles.flatMap((p) =>
      p.certifications.map((c) => ({
        ...c,
        trainerId: p.id,
        owner: p.user,
        tier: p.tier,
        trainerProfileId: p.id,
      })),
    );

    // Aggregate stats across everyone
    const byType: Record<string, number> = {};
    for (const c of certifications) {
      const t = c.credentialType || 'OTHER';
      byType[t] = (byType[t] || 0) + 1;
    }

    const pendingCredentials = certifications.filter((c) => !c.verified && !c.rejectedReason).length;
    const approvedCredentials = certifications.filter((c) => c.verified).length;
    const rejectedCredentials = certifications.filter((c) => c.rejectedReason).length;
    const pendingRequests = requests.filter((r) => r.status === 'PENDING').length;
    const approvedRequests = requests.filter((r) => r.status === 'APPROVED').length;
    const rejectedRequests = requests.filter((r) => r.status === 'REJECTED').length;

    // Build a "team members with profile ID" list for the Add Credential picker
    const teamMembers = profiles.map((p) => {
      const tm = team.find((t) => t.userId === p.userId);
      return {
        userId: p.userId,
        profileId: p.id,
        firstName: p.user.firstName,
        lastName: p.user.lastName,
        email: p.user.email,
        avatar: p.user.avatar,
        role: tm?.role || 'MEMBER',
        title: tm?.title || null,
        tier: p.tier,
        isMe: p.userId === userId,
      };
    });

    return {
      isOrgOwner: !!ownerMember,
      profile: myProfile ? {
        id: myProfile.id,
        tier: myProfile.tier,
        verificationStatus: myProfile.verificationStatus,
        firmName: myProfile.firmName,
        trainerType: myProfile.trainerType,
      } : null,
      teamMembers,
      certifications,
      requests,
      stats: {
        totalCertifications: certifications.length,
        pendingCredentials,
        approvedCredentials,
        rejectedCredentials,
        pendingRequests,
        approvedRequests,
        rejectedRequests,
        byType,
      },
    };
  }
}
