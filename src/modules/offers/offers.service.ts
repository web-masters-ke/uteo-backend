import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Prisma, OfferStatus } from '@prisma/client';
import { PrismaService } from '../../common/services/prisma.service';
import {
  CreateOfferDto,
  UpdateOfferDto,
  SignOfferDto,
  DeclineOfferDto,
  ListOffersDto,
} from './dto/offers.dto';

const DEFAULT_TERMS = `
<h3>Terms of Employment</h3>
<ol>
  <li><strong>Position &amp; Duties.</strong> You will perform the role described above to the best of your professional ability.</li>
  <li><strong>Probation.</strong> The first three (3) months of your employment shall be a probationary period during which either party may terminate by providing one (1) week's written notice.</li>
  <li><strong>Working Hours.</strong> Standard working hours are 40 hours per week with statutory rest days as per the Employment Act, 2007 (Kenya) or applicable jurisdiction.</li>
  <li><strong>Confidentiality.</strong> You agree to keep confidential all proprietary information of the company during and after your employment.</li>
  <li><strong>Notice.</strong> After probation, either party may terminate this employment by giving one (1) month's written notice.</li>
  <li><strong>Governing Law.</strong> This offer is governed by the laws of Kenya unless otherwise stated.</li>
</ol>
<p>By signing below you accept this offer of employment under the terms and conditions set out in this letter.</p>
`;

@Injectable()
export class OffersService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Create from an application ────────────────────────────────────────────
  async create(creatorId: string, role: string, dto: CreateOfferDto) {
    const app = await this.prisma.application.findUnique({
      where: { id: dto.applicationId },
      include: {
        job: { include: { company: true } },
        user: true,
        offer: true,
      },
    });
    if (!app) throw new NotFoundException('Application not found');
    if (app.offer) throw new ConflictException('An offer already exists for this application');

    await this.assertRecruiterAccessToCompany(creatorId, role, app.job.companyId);

    const candidateName = `${app.user.firstName ?? ''} ${app.user.lastName ?? ''}`.trim() || app.user.email || 'Candidate';
    const companyName = app.job.company?.name ?? 'the Company';
    const today = new Date();
    const startDate = dto.startDate ? new Date(dto.startDate) : new Date(Date.now() + 14 * 86400_000);
    const formattedSalary = dto.salaryAmount
      ? `${dto.salaryCurrency ?? 'KES'} ${dto.salaryAmount.toLocaleString()} ${dto.salaryPeriod ?? 'monthly'}`
      : 'as discussed';

    const defaultBody = `
<p>Dear ${candidateName},</p>
<p>We are pleased to extend you an offer of employment for the position of <strong>${app.job.title}</strong> at <strong>${companyName}</strong>.</p>
<p><strong>Compensation:</strong> ${formattedSalary}</p>
<p><strong>Start date:</strong> ${startDate.toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
${dto.benefits ? `<p><strong>Benefits:</strong> ${dto.benefits}</p>` : ''}
<p>This offer is valid until ${(dto.expiresAt ? new Date(dto.expiresAt) : new Date(Date.now() + 14 * 86400_000)).toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' })}.</p>
<p>We are excited about the value you will bring to the team and look forward to your acceptance.</p>
<p>Sincerely,<br/>The ${companyName} Talent Team</p>
`;

    const offer = await this.prisma.offerLetter.create({
      data: {
        applicationId: app.id,
        jobId: app.jobId,
        companyId: app.job.companyId,
        candidateId: app.userId,
        createdById: creatorId,
        title: dto.title ?? `Offer of Employment — ${app.job.title}`,
        bodyHtml: dto.bodyHtml ?? defaultBody,
        termsHtml: dto.termsHtml ?? DEFAULT_TERMS,
        salaryAmount: dto.salaryAmount ?? null,
        salaryCurrency: dto.salaryCurrency ?? 'KES',
        salaryPeriod: dto.salaryPeriod ?? 'MONTHLY',
        startDate,
        benefits: dto.benefits ?? null,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : new Date(Date.now() + 14 * 86400_000),
        status: OfferStatus.DRAFT,
      },
      include: this.includes(),
    });
    return offer;
  }

  // ── List ──────────────────────────────────────────────────────────────────
  async findAll(userId: string, role: string, dto: ListOffersDto) {
    const where: Prisma.OfferLetterWhereInput = {};
    if (dto.status) where.status = dto.status;
    if (dto.applicationId) where.applicationId = dto.applicationId;
    if (dto.jobId) where.jobId = dto.jobId;
    if (dto.companyId) where.companyId = dto.companyId;
    if (dto.candidateId) where.candidateId = dto.candidateId;

    const isAdminish = ['ADMIN', 'SUPER_ADMIN', 'SUPPORT', 'FINANCE_ADMIN'].includes(role);
    if (!isAdminish) {
      const recruiterCompanies = await this.prisma.recruiter.findMany({ where: { userId }, select: { companyId: true } });
      const companyIds = recruiterCompanies.map((r) => r.companyId);
      where.OR = [
        { candidateId: userId },
        { createdById: userId },
        ...(companyIds.length ? [{ companyId: { in: companyIds } }] : []),
      ];
    }

    const items = await this.prisma.offerLetter.findMany({
      where,
      include: this.includes(),
      orderBy: { createdAt: 'desc' },
    });
    return { items, total: items.length };
  }

  async findOne(id: string, userId: string, role: string, ip?: string, ua?: string) {
    const offer = await this.prisma.offerLetter.findUnique({ where: { id }, include: this.includes() });
    if (!offer) throw new NotFoundException('Offer not found');
    await this.assertOfferAccess(offer, userId, role);

    // If candidate is opening a SENT offer for the first time, mark VIEWED
    if (offer.candidateId === userId && offer.status === OfferStatus.SENT) {
      await this.prisma.offerLetter.update({
        where: { id },
        data: { status: OfferStatus.VIEWED, viewedAt: new Date() },
      });
      return { ...offer, status: OfferStatus.VIEWED, viewedAt: new Date() };
    }
    return offer;
  }

  // ── Update (recruiter, only while DRAFT) ──────────────────────────────────
  async update(id: string, userId: string, role: string, dto: UpdateOfferDto) {
    const offer = await this.prisma.offerLetter.findUnique({ where: { id } });
    if (!offer) throw new NotFoundException('Offer not found');
    if (offer.status !== OfferStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT offers can be edited');
    }
    await this.assertRecruiterAccessToCompany(userId, role, offer.companyId);

    return this.prisma.offerLetter.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.bodyHtml !== undefined && { bodyHtml: dto.bodyHtml }),
        ...(dto.termsHtml !== undefined && { termsHtml: dto.termsHtml }),
        ...(dto.salaryAmount !== undefined && { salaryAmount: dto.salaryAmount }),
        ...(dto.salaryCurrency !== undefined && { salaryCurrency: dto.salaryCurrency }),
        ...(dto.salaryPeriod !== undefined && { salaryPeriod: dto.salaryPeriod }),
        ...(dto.startDate !== undefined && { startDate: new Date(dto.startDate) }),
        ...(dto.benefits !== undefined && { benefits: dto.benefits }),
        ...(dto.expiresAt !== undefined && { expiresAt: new Date(dto.expiresAt) }),
      },
      include: this.includes(),
    });
  }

  // ── Send offer (DRAFT → SENT) ─────────────────────────────────────────────
  async send(id: string, userId: string, role: string) {
    const offer = await this.prisma.offerLetter.findUnique({ where: { id } });
    if (!offer) throw new NotFoundException('Offer not found');
    if (offer.status !== OfferStatus.DRAFT) {
      throw new BadRequestException(`Cannot send an offer in status ${offer.status}`);
    }
    await this.assertRecruiterAccessToCompany(userId, role, offer.companyId);

    return this.prisma.offerLetter.update({
      where: { id },
      data: { status: OfferStatus.SENT, sentAt: new Date() },
      include: this.includes(),
    });
  }

  // ── Sign (candidate) ─────────────────────────────────────────────────────
  async sign(id: string, userId: string, dto: SignOfferDto, ip?: string, ua?: string) {
    const offer = await this.prisma.offerLetter.findUnique({ where: { id } });
    if (!offer) throw new NotFoundException('Offer not found');
    if (offer.candidateId !== userId) throw new ForbiddenException('You can only sign your own offer');
    if (offer.status !== OfferStatus.SENT && offer.status !== OfferStatus.VIEWED) {
      throw new BadRequestException(`Cannot sign an offer in status ${offer.status}`);
    }
    if (offer.expiresAt && offer.expiresAt < new Date()) {
      await this.prisma.offerLetter.update({ where: { id }, data: { status: OfferStatus.EXPIRED } });
      throw new BadRequestException('This offer has expired');
    }
    if (!dto.signatureName?.trim() || !dto.signatureDataUrl?.startsWith('data:image/')) {
      throw new BadRequestException('A valid name and drawn signature are required');
    }

    return this.prisma.offerLetter.update({
      where: { id },
      data: {
        status: OfferStatus.SIGNED,
        signedAt: new Date(),
        signatureName: dto.signatureName.trim(),
        signatureDataUrl: dto.signatureDataUrl,
        signatureIpAddress: ip ?? null,
        signatureUserAgent: ua?.slice(0, 500) ?? null,
      },
      include: this.includes(),
    });
  }

  async decline(id: string, userId: string, dto: DeclineOfferDto) {
    const offer = await this.prisma.offerLetter.findUnique({ where: { id } });
    if (!offer) throw new NotFoundException('Offer not found');
    if (offer.candidateId !== userId) throw new ForbiddenException('You can only decline your own offer');
    if (offer.status !== OfferStatus.SENT && offer.status !== OfferStatus.VIEWED) {
      throw new BadRequestException(`Cannot decline an offer in status ${offer.status}`);
    }

    return this.prisma.offerLetter.update({
      where: { id },
      data: {
        status: OfferStatus.DECLINED,
        declinedAt: new Date(),
        declineReason: dto.reason ?? null,
      },
      include: this.includes(),
    });
  }

  async revoke(id: string, userId: string, role: string) {
    const offer = await this.prisma.offerLetter.findUnique({ where: { id } });
    if (!offer) throw new NotFoundException('Offer not found');
    if (offer.status === OfferStatus.SIGNED || offer.status === OfferStatus.DECLINED) {
      throw new BadRequestException('Already finalised — cannot revoke');
    }
    await this.assertRecruiterAccessToCompany(userId, role, offer.companyId);

    return this.prisma.offerLetter.update({
      where: { id },
      data: { status: OfferStatus.REVOKED, revokedAt: new Date() },
      include: this.includes(),
    });
  }

  // ── helpers ───────────────────────────────────────────────────────────────
  private includes() {
    return {
      job: { select: { id: true, title: true, companyId: true } },
      company: { select: { id: true, name: true, logoUrl: true } },
      candidate: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
    };
  }

  private isAdmin(role: string) {
    return ['ADMIN', 'SUPER_ADMIN', 'SUPPORT', 'FINANCE_ADMIN'].includes(role);
  }

  private async assertRecruiterAccessToCompany(userId: string, role: string, companyId: string) {
    if (this.isAdmin(role)) return;
    const link = await this.prisma.recruiter.findFirst({ where: { userId, companyId } });
    if (!link) throw new ForbiddenException('Not a recruiter for this company');
  }

  private async assertOfferAccess(
    offer: { candidateId: string; createdById: string; companyId: string },
    userId: string,
    role: string,
  ) {
    if (this.isAdmin(role)) return;
    if (offer.candidateId === userId) return;
    if (offer.createdById === userId) return;
    const link = await this.prisma.recruiter.findFirst({
      where: { userId, companyId: offer.companyId },
    });
    if (link) return;
    throw new ForbiddenException('You do not have access to this offer');
  }
}
