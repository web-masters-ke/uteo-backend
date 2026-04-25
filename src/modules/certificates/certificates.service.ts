import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { CertificateStatus, Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../common/services/prisma.service';
import { CourseMilestonesService } from '../course-milestones/course-milestones.service';
import { NotificationsService } from '../notifications/notifications.service';
import { paginate } from '../../common/dto/pagination.dto';
import {
  IssueCertificateDto,
  ListMyCertificatesDto,
  RevokeCertificateDto,
} from './dto/certificates.dto';

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN', 'FINANCE_ADMIN', 'SUPPORT'];
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

@Injectable()
export class CertificatesService {
  private readonly logger = new Logger(CertificatesService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => CourseMilestonesService))
    private readonly milestones: CourseMilestonesService,
    private readonly notifications: NotificationsService,
  ) {}

  private async _isAdmin(userId: string): Promise<boolean> {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    return !!u?.role && ADMIN_ROLES.includes(u.role);
  }

  private _generateVerificationCode(): string {
    // 10-char base32 slug, e.g. "A7F3K9L2QT"
    const bytes = randomBytes(10);
    let out = '';
    for (let i = 0; i < 10; i++) {
      out += BASE32_ALPHABET[bytes[i] % BASE32_ALPHABET.length];
    }
    return out;
  }

  private async _generateCertificateNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.prisma.courseCertificate.count();
    const seq = String(count + 1).padStart(5, '0');
    return `SKS-CERT-${year}-${seq}`;
  }

  /**
   * Issue a certificate (idempotent — returns existing if already issued).
   * Validates enrollment, reads final grade via course-milestones service.
   * Issues when there are no milestones defined OR allMilestonesPassed.
   */
  async issue(
    courseId: string,
    userId: string,
    issuerId?: string,
    opts: { force?: boolean } = {},
  ) {
    const existing = await this.prisma.courseCertificate.findUnique({
      where: { courseId_userId: { courseId, userId } },
      include: { course: true, user: true },
    });
    if (existing) return existing;

    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: {
        instructor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            name: true,
            email: true,
          },
        },
        lessons: { select: { duration: true } },
        _count: { select: { milestones: true } },
      },
    });
    if (!course) throw new NotFoundException('Course not found');

    const enrollment = await this.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    if (!enrollment) {
      throw new BadRequestException('User is not enrolled in this course');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        name: true,
        email: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');

    // Read grade (idempotent short-circuit already handled above).
    let finalGrade: number | null = null;
    let milestoneCount = course._count.milestones;
    let allPassed = true;

    if (milestoneCount > 0) {
      try {
        const grade = await this.milestones.getCourseGrade(courseId, userId);
        finalGrade = grade.finalGrade;
        allPassed = grade.allMilestonesPassed;
        milestoneCount = grade.milestoneCount;
      } catch (err) {
        // Could be a Forbidden if enrollment check mis-fires; treat as not passed.
        allPassed = false;
      }
    } else {
      // No milestones defined — allow issue based on enrollment completion.
      allPassed = true;
    }

    if (!opts.force && !allPassed) {
      throw new BadRequestException(
        'Course requirements not met — user has not passed all milestones',
      );
    }

    const totalHours = Math.round(
      ((course.lessons || []).reduce(
        (s, l) => s + (l.duration ?? 0),
        0,
      ) /
        60) *
        10,
    ) / 10;

    const studentName =
      [user.firstName, user.lastName].filter(Boolean).join(' ') ||
      user.name ||
      user.email;
    const instructorName =
      [course.instructor.firstName, course.instructor.lastName]
        .filter(Boolean)
        .join(' ') ||
      course.instructor.name ||
      course.instructor.email;

    const metadata: Prisma.InputJsonValue = {
      instructorName,
      instructorId: course.instructor.id,
      courseTitle: course.title,
      studentName,
      issuedDate: new Date().toISOString(),
      finalGrade,
      milestoneCount,
      totalHours,
      issuedBy: issuerId ?? null,
      forced: opts.force ? true : false,
    };

    // Retry loop on certificate number / verification code collision
    let attempt = 0;
    while (attempt < 5) {
      try {
        const certificateNumber = await this._generateCertificateNumber();
        const verificationCode = this._generateVerificationCode();
        const created = await this.prisma.courseCertificate.create({
          data: {
            courseId,
            userId,
            enrollmentId: enrollment.id,
            certificateNumber,
            verificationCode,
            finalGrade:
              finalGrade != null ? new Prisma.Decimal(finalGrade) : null,
            status: CertificateStatus.ISSUED,
            metadata,
          },
        });

        // Fire-and-forget notification (do not block issuance on delivery failure).
        try {
          await this.notifications.createInApp(
            userId,
            'CERTIFICATE_ISSUED',
            'Certificate earned',
            `You've earned a certificate for ${course.title}`,
            {
              certificateId: created.id,
              courseId,
              certificateNumber: created.certificateNumber,
              verificationCode: created.verificationCode,
            },
          );
        } catch (err) {
          this.logger.warn(
            `Failed to create certificate notification for user=${userId}: ${(err as Error).message}`,
          );
        }

        return created;
      } catch (err: any) {
        if (err?.code === 'P2002') {
          attempt++;
          continue;
        }
        throw err;
      }
    }
    throw new BadRequestException(
      'Could not allocate a unique certificate number; please retry',
    );
  }

  /**
   * Best-effort auto-issue after a lesson submission grades out.
   * Swallows all errors so callers (grading path) never fail because of it.
   */
  async autoIssueIfPassed(courseId: string, userId: string): Promise<void> {
    try {
      const course = await this.prisma.course.findUnique({
        where: { id: courseId },
        select: { _count: { select: { milestones: true } } },
      });
      if (!course) return;

      if (course._count.milestones === 0) {
        // No milestones — only auto-issue if all lessons have a passing submission.
        // Keep it conservative and skip here; explicit issue endpoint handles this.
        return;
      }

      const grade = await this.milestones.getCourseGrade(courseId, userId);
      if (grade.allMilestonesPassed) {
        await this.issue(courseId, userId);
      }
    } catch (err) {
      this.logger.debug(
        `autoIssueIfPassed skipped for course=${courseId} user=${userId}: ${(err as Error).message}`,
      );
    }
  }

  async listMy(userId: string, dto: ListMyCertificatesDto) {
    const page = Number(dto.page) || 1;
    const limit = Math.min(Number(dto.limit) || 20, 100);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.courseCertificate.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { issuedAt: 'desc' },
        include: {
          course: {
            select: {
              id: true,
              title: true,
              thumbnail: true,
              instructor: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  name: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.courseCertificate.count({ where: { userId } }),
    ]);

    return paginate(items, total, page, limit);
  }

  /**
   * PUBLIC verification lookup — minimal payload for third-party verifiers.
   * Returns `{valid:false}` when the code is unknown OR the certificate is revoked.
   */
  async getByCode(verificationCode: string) {
    const cert = await this.prisma.courseCertificate.findUnique({
      where: { verificationCode },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            instructor: {
              select: {
                firstName: true,
                lastName: true,
                name: true,
              },
            },
          },
        },
        user: {
          select: {
            firstName: true,
            lastName: true,
            name: true,
          },
        },
      },
    });

    if (!cert) {
      return { valid: false };
    }

    if (cert.status === CertificateStatus.REVOKED) {
      return {
        valid: false,
        status: cert.status,
        certificateNumber: cert.certificateNumber,
        revokedAt: cert.revokedAt,
      };
    }

    const studentName =
      [cert.user.firstName, cert.user.lastName].filter(Boolean).join(' ') ||
      cert.user.name ||
      '';
    const instructorName =
      [cert.course.instructor.firstName, cert.course.instructor.lastName]
        .filter(Boolean)
        .join(' ') ||
      cert.course.instructor.name ||
      '';

    return {
      valid: true,
      certificateNumber: cert.certificateNumber,
      verificationCode: cert.verificationCode,
      studentName,
      courseTitle: cert.course.title,
      instructorName,
      finalGrade: cert.finalGrade,
      issuedAt: cert.issuedAt,
      status: cert.status,
    };
  }

  async getById(id: string, userId: string) {
    const cert = await this.prisma.courseCertificate.findUnique({
      where: { id },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            thumbnail: true,
            instructor: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                name: true,
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            name: true,
            email: true,
          },
        },
      },
    });
    if (!cert) throw new NotFoundException('Certificate not found');

    const isAdmin = await this._isAdmin(userId);
    if (cert.userId !== userId && !isAdmin) {
      throw new ForbiddenException('Not your certificate');
    }
    return cert;
  }

  async revoke(id: string, adminId: string, dto: RevokeCertificateDto) {
    const isAdmin = await this._isAdmin(adminId);
    if (!isAdmin) throw new ForbiddenException('Admin only');

    const cert = await this.prisma.courseCertificate.findUnique({
      where: { id },
      include: { course: { select: { title: true } } },
    });
    if (!cert) throw new NotFoundException('Certificate not found');

    if (cert.status === CertificateStatus.REVOKED) {
      return cert;
    }

    const updated = await this.prisma.courseCertificate.update({
      where: { id },
      data: {
        status: CertificateStatus.REVOKED,
        revokedAt: new Date(),
        revokedBy: adminId,
        revokedReason: dto.reason,
      },
    });

    try {
      await this.notifications.createInApp(
        cert.userId,
        'CERTIFICATE_REVOKED',
        'Certificate revoked',
        `Your certificate for ${cert.course.title} has been revoked. Reason: ${dto.reason}`,
        {
          certificateId: cert.id,
          courseId: cert.courseId,
          certificateNumber: cert.certificateNumber,
          reason: dto.reason,
        },
      );
    } catch (err) {
      this.logger.warn(
        `Failed to notify user of revocation: ${(err as Error).message}`,
      );
    }

    return updated;
  }

  /**
   * Authorization helper for the "issue" endpoint — course instructor or admin only.
   */
  async assertCanIssue(courseId: string, actorId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { instructorId: true },
    });
    if (!course) throw new NotFoundException('Course not found');
    const isAdmin = await this._isAdmin(actorId);
    if (course.instructorId !== actorId && !isAdmin) {
      throw new ForbiddenException('Only the course instructor or an admin can issue');
    }
  }
}
