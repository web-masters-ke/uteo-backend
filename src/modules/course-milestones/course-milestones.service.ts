import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Inject,
  forwardRef,
  Logger,
} from '@nestjs/common';
import { AssessmentType } from '@prisma/client';
import { PrismaService } from '../../common/services/prisma.service';
import { CertificatesService } from '../certificates/certificates.service';
import {
  CreateCourseMilestoneDto,
  UpdateCourseMilestoneDto,
  CreateAssessmentDto,
  SubmitAnswersDto,
  GradeSubmissionDto,
} from './dto/course-milestones.dto';

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN', 'FINANCE_ADMIN', 'SUPPORT'];

@Injectable()
export class CourseMilestonesService {
  private readonly logger = new Logger(CourseMilestonesService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => CertificatesService))
    private readonly certificates: CertificatesService,
  ) {}

  private async _tryAutoIssueCertificate(courseId: string, userId: string) {
    try {
      await this.certificates.autoIssueIfPassed(courseId, userId);
    } catch (err) {
      // Non-blocking; never fail grading because certificate issuance failed.
      this.logger.debug(
        `auto-issue hook skipped: ${(err as Error).message}`,
      );
    }
  }

  private async _isAdmin(userId: string): Promise<boolean> {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    return !!u?.role && ADMIN_ROLES.includes(u.role);
  }

  private async _assertCourseOwner(courseId: string, userId: string) {
    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course) throw new NotFoundException('Course not found');
    const isAdmin = await this._isAdmin(userId);
    if (course.instructorId !== userId && !isAdmin) {
      throw new ForbiddenException('Not your course');
    }
    return course;
  }

  // ----- Milestones -----

  async create(courseId: string, userId: string, dto: CreateCourseMilestoneDto) {
    await this._assertCourseOwner(courseId, userId);

    if (dto.orderIndex != null && dto.orderIndex < 0) {
      throw new BadRequestException('orderIndex must be >= 0');
    }

    return this.prisma.courseMilestone.create({
      data: {
        courseId,
        title: dto.title,
        description: dto.description,
        orderIndex: dto.orderIndex ?? 0,
        passingScore: dto.passingScore ?? 70,
        weight: dto.weight ?? 1,
      },
      include: {
        lessons: { orderBy: { sortOrder: 'asc' } },
        _count: { select: { submissions: true, lessons: true } },
      },
    });
  }

  async list(courseId: string, userId?: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, status: true, instructorId: true },
    });
    if (!course) throw new NotFoundException('Course not found');

    const isAdmin = userId ? await this._isAdmin(userId) : false;
    const isOwner = userId && course.instructorId === userId;

    if (course.status !== 'PUBLISHED' && !isOwner && !isAdmin) {
      throw new ForbiddenException('Course is not published');
    }

    return this.prisma.courseMilestone.findMany({
      where: { courseId },
      orderBy: { orderIndex: 'asc' },
      include: {
        lessons: {
          orderBy: { sortOrder: 'asc' },
          include: {
            _count: { select: { assessments: true } },
          },
        },
        _count: { select: { submissions: true, lessons: true } },
      },
    });
  }

  async update(id: string, userId: string, dto: UpdateCourseMilestoneDto) {
    const milestone = await this.prisma.courseMilestone.findUnique({
      where: { id },
      include: { course: { select: { instructorId: true } } },
    });
    if (!milestone) throw new NotFoundException('Milestone not found');
    const isAdmin = await this._isAdmin(userId);
    if (milestone.course.instructorId !== userId && !isAdmin) {
      throw new ForbiddenException('Not your course');
    }

    return this.prisma.courseMilestone.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.orderIndex !== undefined && { orderIndex: dto.orderIndex }),
        ...(dto.passingScore !== undefined && { passingScore: dto.passingScore }),
        ...(dto.weight !== undefined && { weight: dto.weight }),
      },
      include: {
        lessons: { orderBy: { sortOrder: 'asc' } },
        _count: { select: { submissions: true, lessons: true } },
      },
    });
  }

  async remove(id: string, userId: string) {
    const milestone = await this.prisma.courseMilestone.findUnique({
      where: { id },
      include: { course: { select: { instructorId: true } } },
    });
    if (!milestone) throw new NotFoundException('Milestone not found');
    const isAdmin = await this._isAdmin(userId);
    if (milestone.course.instructorId !== userId && !isAdmin) {
      throw new ForbiddenException('Not your course');
    }

    await this.prisma.courseMilestone.delete({ where: { id } });
    return { message: 'Milestone deleted' };
  }

  // ----- Lesson assessments -----

  async createAssessment(lessonId: string, userId: string, dto: CreateAssessmentDto) {
    const lesson = await this.prisma.courseLesson.findUnique({
      where: { id: lessonId },
      include: { course: { select: { instructorId: true } } },
    });
    if (!lesson) throw new NotFoundException('Lesson not found');
    const isAdmin = await this._isAdmin(userId);
    if (lesson.course.instructorId !== userId && !isAdmin) {
      throw new ForbiddenException('Not your course');
    }

    return this.prisma.lessonAssessment.create({
      data: {
        lessonId,
        question: dto.question,
        type: (dto.type as AssessmentType) ?? AssessmentType.MULTIPLE_CHOICE,
        options: dto.options ?? undefined,
        correctAnswer: dto.correctAnswer ?? undefined,
        points: dto.points ?? 10,
        orderIndex: dto.orderIndex ?? 0,
      },
    });
  }

  async listAssessments(lessonId: string, userId: string) {
    const lesson = await this.prisma.courseLesson.findUnique({
      where: { id: lessonId },
      include: { course: { select: { id: true, instructorId: true, status: true } } },
    });
    if (!lesson) throw new NotFoundException('Lesson not found');

    const isAdmin = await this._isAdmin(userId);
    const isOwner = lesson.course.instructorId === userId;

    if (!isOwner && !isAdmin) {
      const enrolled = await this.prisma.enrollment.findUnique({
        where: { userId_courseId: { userId, courseId: lesson.course.id } },
      });
      if (!enrolled) throw new ForbiddenException('Not enrolled in this course');
    }

    const assessments = await this.prisma.lessonAssessment.findMany({
      where: { lessonId },
      orderBy: { orderIndex: 'asc' },
    });

    // Strip correctAnswer from learners — instructors/admins see it
    if (!isOwner && !isAdmin) {
      return assessments.map((a) => ({
        ...a,
        correctAnswer: undefined,
      }));
    }
    return assessments;
  }

  // ----- Submissions & auto-grading -----

  private _isAnswerCorrect(
    type: AssessmentType,
    correctAnswer: unknown,
    userAnswer: unknown,
  ): boolean {
    if (correctAnswer == null) return false;
    if (type === AssessmentType.MULTIPLE_CHOICE) {
      return String(userAnswer).trim() === String(correctAnswer).trim();
    }
    if (type === AssessmentType.CHECKBOX) {
      const correctArr = Array.isArray(correctAnswer)
        ? correctAnswer.map((v) => String(v))
        : [String(correctAnswer)];
      const userArr = Array.isArray(userAnswer)
        ? userAnswer.map((v) => String(v))
        : [String(userAnswer)];
      if (correctArr.length !== userArr.length) return false;
      const sortedCorrect = [...correctArr].sort();
      const sortedUser = [...userArr].sort();
      return sortedCorrect.every((v, i) => v === sortedUser[i]);
    }
    return false;
  }

  async submitAnswers(lessonId: string, userId: string, dto: SubmitAnswersDto) {
    const lesson = await this.prisma.courseLesson.findUnique({
      where: { id: lessonId },
      include: {
        course: { select: { id: true } },
        milestone: { select: { id: true, passingScore: true } },
        assessments: true,
      },
    });
    if (!lesson) throw new NotFoundException('Lesson not found');

    const enrolled = await this.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId: lesson.course.id } },
    });
    if (!enrolled) throw new ForbiddenException('Not enrolled in this course');

    const answers = dto.answers ?? {};
    const assessments = lesson.assessments;

    if (assessments.length === 0) {
      throw new BadRequestException('Lesson has no assessments');
    }

    // Auto-grade MC/CHECKBOX, leave TEXT/FILE_UPLOAD for manual grading.
    let totalPoints = 0;
    let earnedPoints = 0;
    let hasManual = false;

    for (const a of assessments) {
      totalPoints += a.points;
      const ans = (answers as any)[a.id];
      if (a.type === AssessmentType.MULTIPLE_CHOICE || a.type === AssessmentType.CHECKBOX) {
        if (ans !== undefined && this._isAnswerCorrect(a.type, a.correctAnswer, ans)) {
          earnedPoints += a.points;
        }
      } else {
        // TEXT / FILE_UPLOAD require manual grading
        if (ans !== undefined) hasManual = true;
      }
    }

    const score =
      totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;

    const passingScore = lesson.milestone?.passingScore ?? 70;
    const passed = !hasManual && score >= passingScore;
    const gradedAt = hasManual ? null : new Date();

    const submission = await this.prisma.lessonSubmission.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      create: {
        userId,
        lessonId,
        courseMilestoneId: lesson.milestoneId ?? null,
        answers: answers as any,
        score,
        passed,
        gradedAt,
        submittedAt: new Date(),
      },
      update: {
        answers: answers as any,
        score,
        passed,
        gradedAt,
        submittedAt: new Date(),
        courseMilestoneId: lesson.milestoneId ?? null,
      },
    });

    // Auto-issue certificate if this submission tipped the learner into full completion.
    if (passed) {
      await this._tryAutoIssueCertificate(lesson.course.id, userId);
    }

    return submission;
  }

  async gradeSubmission(
    submissionId: string,
    graderId: string,
    dto: GradeSubmissionDto,
  ) {
    const submission = await this.prisma.lessonSubmission.findUnique({
      where: { id: submissionId },
      include: {
        lesson: {
          include: {
            course: { select: { instructorId: true } },
            milestone: { select: { passingScore: true } },
          },
        },
      },
    });
    if (!submission) throw new NotFoundException('Submission not found');

    const isAdmin = await this._isAdmin(graderId);
    if (submission.lesson.course.instructorId !== graderId && !isAdmin) {
      throw new ForbiddenException('Not your course');
    }

    const nextScore = dto.score ?? submission.score;
    const passingScore = submission.lesson.milestone?.passingScore ?? 70;
    const nextPassed = dto.passed ?? nextScore >= passingScore;

    const updated = await this.prisma.lessonSubmission.update({
      where: { id: submissionId },
      data: {
        ...(dto.score !== undefined && { score: dto.score }),
        passed: nextPassed,
        ...(dto.feedback !== undefined && { feedback: dto.feedback }),
        gradedAt: new Date(),
        gradedById: graderId,
      },
      include: { lesson: { select: { courseId: true } } },
    });

    if (nextPassed) {
      await this._tryAutoIssueCertificate(
        updated.lesson.courseId,
        updated.userId,
      );
    }

    return updated;
  }

  // ----- Final grade across milestones -----

  async getCourseGrade(courseId: string, userId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, title: true, instructorId: true, status: true },
    });
    if (!course) throw new NotFoundException('Course not found');

    // Enrollment check (instructors/admins can view for themselves too)
    const isAdmin = await this._isAdmin(userId);
    const isOwner = course.instructorId === userId;
    if (!isOwner && !isAdmin) {
      const enrolled = await this.prisma.enrollment.findUnique({
        where: { userId_courseId: { userId, courseId } },
      });
      if (!enrolled) throw new ForbiddenException('Not enrolled in this course');
    }

    const milestones = await this.prisma.courseMilestone.findMany({
      where: { courseId },
      orderBy: { orderIndex: 'asc' },
      include: {
        submissions: {
          where: { userId },
          orderBy: { score: 'desc' },
          take: 1, // best submission per milestone
        },
      },
    });

    const breakdown = milestones.map((m) => {
      const best = m.submissions[0];
      return {
        milestoneId: m.id,
        title: m.title,
        orderIndex: m.orderIndex,
        weight: m.weight,
        passingScore: m.passingScore,
        score: best?.score ?? 0,
        passed: best?.passed ?? false,
        submittedAt: best?.submittedAt ?? null,
      };
    });

    const totalWeight = breakdown.reduce((s, b) => s + b.weight, 0);
    const weightedScore = breakdown.reduce((s, b) => s + b.score * b.weight, 0);
    const finalGrade = totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 0;
    const allPassed = breakdown.length > 0 && breakdown.every((b) => b.passed);

    return {
      courseId,
      userId,
      finalGrade,
      totalWeight,
      milestoneCount: milestones.length,
      allMilestonesPassed: allPassed,
      breakdown,
    };
  }
}
