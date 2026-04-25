import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';

function letterGrade(pct: number | null): string {
  if (pct == null) return 'N/A';
  if (pct >= 90) return 'A';
  if (pct >= 85) return 'A-';
  if (pct >= 80) return 'B+';
  if (pct >= 75) return 'B';
  if (pct >= 70) return 'B-';
  if (pct >= 65) return 'C+';
  if (pct >= 60) return 'C';
  if (pct >= 55) return 'C-';
  if (pct >= 50) return 'D';
  return 'F';
}

/** Convert percentage to 4.0 GPA scale */
function toGpa(pct: number): number {
  if (pct >= 90) return 4.0;
  if (pct >= 85) return 3.7;
  if (pct >= 80) return 3.3;
  if (pct >= 75) return 3.0;
  if (pct >= 70) return 2.7;
  if (pct >= 65) return 2.3;
  if (pct >= 60) return 2.0;
  if (pct >= 55) return 1.7;
  if (pct >= 50) return 1.3;
  return 0.0;
}

@Injectable()
export class TranscriptsService {
  constructor(private readonly prisma: PrismaService) {}

  async getTranscript(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, firstName: true, lastName: true, email: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const enrollments = await this.prisma.enrollment.findMany({
      where: { userId },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            category: true,
            instructor: { select: { id: true, firstName: true, lastName: true } },
            milestones: { select: { id: true, passingScore: true, weight: true } },
          },
        },
        certificate: { select: { id: true, certificateNumber: true, finalGrade: true, issuedAt: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const entries = await Promise.all(
      enrollments.map(async (en: any) => {
        // Compute final grade only if milestones exist
        let final: number | null = null;
        let passedMilestones = 0;
        const total = en.course.milestones.length;

        if (total > 0) {
          const subs = await this.prisma.lessonSubmission.findMany({
            where: { userId, courseMilestoneId: { in: en.course.milestones.map((m: any) => m.id) } },
          });
          // Best submission per milestone
          const bestByMs = new Map<string, number>();
          for (const s of subs) {
            const prev = bestByMs.get(s.courseMilestoneId!) ?? -1;
            if (s.score > prev) bestByMs.set(s.courseMilestoneId!, s.score);
          }
          let weightedSum = 0;
          let weightTotal = 0;
          for (const m of en.course.milestones) {
            const best = bestByMs.get(m.id) ?? 0;
            weightedSum += best * (m.weight || 1);
            weightTotal += m.weight || 1;
            if (best >= (m.passingScore || 70)) passedMilestones++;
          }
          final = weightTotal > 0 ? Math.round((weightedSum / weightTotal) * 100) / 100 : null;
        } else if (en.certificate?.finalGrade != null) {
          final = Number(en.certificate.finalGrade);
        }

        const completed = total > 0 ? passedMilestones === total : !!en.certificate;

        return {
          enrollmentId: en.id,
          courseId: en.course.id,
          title: en.course.title,
          category: en.course.category,
          instructorName: en.course.instructor
            ? `${en.course.instructor.firstName ?? ''} ${en.course.instructor.lastName ?? ''}`.trim()
            : null,
          enrolledAt: en.createdAt,
          completedAt: completed ? (en.certificate?.issuedAt ?? en.updatedAt) : null,
          finalGrade: final,
          letterGrade: letterGrade(final),
          milestoneCount: total,
          passedMilestones,
          certificateId: en.certificate?.id ?? null,
          certificateNumber: en.certificate?.certificateNumber ?? null,
          certificateStatus: en.certificate?.status ?? null,
        };
      }),
    );

    const graded = entries.filter((e) => e.finalGrade != null);
    const cgpa = graded.length > 0
      ? Math.round((graded.reduce((a, e) => a + toGpa(e.finalGrade as number), 0) / graded.length) * 100) / 100
      : null;

    return {
      user,
      summary: {
        totalCoursesEnrolled: entries.length,
        totalCoursesCompleted: entries.filter((e) => e.completedAt).length,
        totalCertificates: entries.filter((e) => e.certificateId).length,
        cgpa,
      },
      courses: entries,
    };
  }

  async getUserTranscript(targetUserId: string, callerId: string, callerRole?: string) {
    if (targetUserId === callerId) return this.getTranscript(targetUserId);
    const isAdmin = ['ADMIN', 'SUPER_ADMIN', 'SUPPORT'].includes(callerRole || '');
    if (!isAdmin) throw new ForbiddenException('Cannot view another user transcript');
    return this.getTranscript(targetUserId);
  }
}
