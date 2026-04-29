import { Injectable, NotFoundException, ForbiddenException, BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/services/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { S3Service } from '../../common/services/s3.service';
import { paginate } from '../../common/dto/pagination.dto';
import {
  CreateCourseDto, UpdateCourseDto, ListCoursesDto,
  CreateLessonDto, UpdateLessonDto, UpdateProgressDto,
} from './dto/courses.dto';

const instructorSelect = { id: true, firstName: true, lastName: true, name: true, avatar: true, trainerProfile: { select: { rating: true, specialization: true, firmName: true, trainerType: true } } };

/** Platform commission rate for course sales (10%) */
const PLATFORM_COMMISSION_RATE = 0.10;

@Injectable()
export class CoursesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
    private readonly s3: S3Service,
  ) {}

  // ---- Courses CRUD ----

  async create(userId: string, role: string, dto: CreateCourseDto) {
    if (role !== 'TRAINER' && role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Only trainers can create courses');
    }

    // Admin/Super Admin can assign a course to a specific trainer via dto.instructorId
    const instructorId = (role === 'ADMIN' || role === 'SUPER_ADMIN') && dto.instructorId
      ? dto.instructorId
      : userId;

    return this.prisma.course.create({
      data: {
        instructorId,
        title: dto.title,
        description: dto.description,
        thumbnail: dto.thumbnail,
        price: dto.price ?? 0,
        currency: dto.currency ?? 'KES',
        category: dto.category,
        level: dto.level,
        duration: dto.duration,
        tags: dto.tags ?? [],
        status: 'DRAFT',
        ...(dto.settings ? { settings: dto.settings } : {}),
        ...(dto.certConfig ? { certConfig: dto.certConfig } : {}),
      },
      include: { instructor: { select: instructorSelect }, lessons: true },
    });
  }

  async findAll(dto: ListCoursesDto) {
    const page = Number(dto.page) || 1;
    const limit = Number(dto.limit) || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.CourseWhereInput = {};
    if ((dto as any).instructorId) where.instructorId = (dto as any).instructorId;
    const statusParam = (dto as any).status;
    if (statusParam && statusParam !== 'ALL') where.status = statusParam;
    else if (!statusParam) where.status = 'PUBLISHED';
    // status=ALL → no filter, show all statuses
    if (dto.category) where.category = dto.category;
    if (dto.level) where.level = dto.level;
    if (dto.search) where.title = { contains: dto.search, mode: 'insensitive' };
    if (dto.minPrice != null || dto.maxPrice != null) {
      where.price = {};
      if (dto.minPrice != null) (where.price as any).gte = dto.minPrice;
      if (dto.maxPrice != null) (where.price as any).lte = dto.maxPrice;
    }

    const [items, total] = await Promise.all([
      this.prisma.course.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          instructor: { select: instructorSelect },
          lessons: { orderBy: { sortOrder: 'asc' } },
          _count: { select: { enrollments: true } },
        },
      }),
      this.prisma.course.count({ where }),
    ]);

    return paginate(items, total, page, limit);
  }

  async findOne(id: string) {
    const course = await this.prisma.course.findUnique({
      where: { id },
      include: {
        instructor: { select: instructorSelect },
        lessons: { orderBy: { sortOrder: 'asc' }, include: { questions: { orderBy: { sortOrder: 'asc' } } } },
        _count: { select: { enrollments: true } },
      },
    });
    if (!course) throw new NotFoundException('Course not found');
    return course;
  }

  async update(id: string, userId: string, dto: UpdateCourseDto, role?: string) {
    const course = await this.prisma.course.findUnique({ where: { id } });
    if (!course) throw new NotFoundException('Course not found');
    const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';
    if (course.instructorId !== userId && !isAdmin) throw new ForbiddenException('Not your course');

    const prevStatus = course.status;
    const updatedCourse = await this.prisma.course.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.thumbnail !== undefined && { thumbnail: dto.thumbnail }),
        ...(dto.price !== undefined && { price: dto.price }),
        ...(dto.currency !== undefined && { currency: dto.currency }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.level !== undefined && { level: dto.level }),
        ...(dto.duration !== undefined && { duration: dto.duration }),
        ...(dto.tags !== undefined && { tags: dto.tags }),
        ...(dto.status !== undefined && { status: dto.status as any }),
        ...(dto.settings !== undefined && { settings: dto.settings }),
        ...(dto.certConfig !== undefined && { certConfig: dto.certConfig }),
      },
      include: { instructor: { select: instructorSelect }, lessons: { orderBy: { sortOrder: 'asc' } } },
    });

    // Notify all admins when a course is submitted for review
    if (dto.status === 'UNDER_REVIEW' && prevStatus !== 'UNDER_REVIEW') {
      const admins = await this.prisma.user.findMany({
        where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } },
        select: { id: true },
      });
      if (admins.length) {
        await this.prisma.notification.createMany({
          data: admins.map(a => ({
            userId: a.id,
            type: 'COURSE_REVIEW',
            channel: 'IN_APP',
            title: 'Course Pending Review',
            message: `"${updatedCourse.title}" has been submitted for review by ${updatedCourse.instructor?.firstName ?? 'an instructor'}.`,
            data: JSON.stringify({ courseId: id }),
          })),
        });
      }
    }

    return updatedCourse;
  }

  async remove(id: string, userId: string, role?: string) {
    const course = await this.prisma.course.findUnique({ where: { id } });
    if (!course) throw new NotFoundException('Course not found');
    const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';
    if (course.instructorId !== userId && !isAdmin) throw new ForbiddenException('Not your course');

    await this.prisma.course.delete({ where: { id } });
    return { message: 'Course deleted' };
  }

  async publish(id: string, userId: string, role?: string) {
    const course = await this.prisma.course.findUnique({ where: { id }, include: { lessons: true } });
    if (!course) throw new NotFoundException('Course not found');
    const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';
    if (course.instructorId !== userId && !isAdmin) throw new ForbiddenException('Not your course');
    if (course.status === 'PUBLISHED') throw new BadRequestException('Course already published');
    if (course.lessons.length === 0) throw new BadRequestException('Course must have at least one lesson');

    const published = await this.prisma.course.update({
      where: { id },
      data: { status: 'PUBLISHED' },
      include: { instructor: { select: instructorSelect }, lessons: { orderBy: { sortOrder: 'asc' } } },
    });

    // Notify all followers of the instructor about the new course
    const instructorId = course.instructorId;
    const instructorName = (published.instructor as any)
      ? `${(published.instructor as any).firstName ?? ''} ${(published.instructor as any).lastName ?? ''}`.trim() || 'Your trainer'
      : 'Your trainer';

    const followers = await this.prisma.follow.findMany({
      where: { followingId: instructorId },
      select: { followerId: true },
    });

    if (followers.length > 0) {
      await this.prisma.notification.createMany({
        data: followers.map((f) => ({
          userId: f.followerId,
          type: 'COURSE_NEW',
          channel: 'IN_APP',
          title: 'New Course Available',
          message: `${instructorName} just published "${published.title}" — enrol now!`,
          metadata: { courseId: id, instructorId },
        })),
      }).catch(() => {});
    }

    return published;
  }

  // ---- Lessons ----

  async addLesson(courseId: string, userId: string, dto: CreateLessonDto, role?: string) {
    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course) throw new NotFoundException('Course not found');
    const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';
    if (course.instructorId !== userId && !isAdmin) throw new ForbiddenException('Not your course');

    return this.prisma.courseLesson.create({
      data: {
        courseId,
        title: dto.title,
        description: dto.description,
        contentType: dto.contentType || 'VIDEO',
        videoUrl: dto.videoUrl,
        textContent: dto.textContent,
        duration: dto.duration,
        sortOrder: dto.sortOrder ?? 0,
        isFree: dto.isFree ?? false,
        episodeNumber: dto.episodeNumber,
      },
    });
  }

  async updateLesson(courseId: string, lessonId: string, userId: string, dto: UpdateLessonDto) {
    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course) throw new NotFoundException('Course not found');
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    const isAdmin = user?.role && ['SUPER_ADMIN', 'ADMIN', 'FINANCE_ADMIN', 'SUPPORT'].includes(user.role);
    if (!isAdmin && course.instructorId !== userId) throw new ForbiddenException('Not your course');

    const lesson = await this.prisma.courseLesson.findFirst({ where: { id: lessonId, courseId } });
    if (!lesson) throw new NotFoundException('Lesson not found');

    return this.prisma.courseLesson.update({
      where: { id: lessonId },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.videoUrl !== undefined && { videoUrl: dto.videoUrl }),
        ...(dto.textContent !== undefined && { textContent: dto.textContent }),
        ...(dto.contentType !== undefined && { contentType: dto.contentType }),
        ...(dto.duration !== undefined && { duration: dto.duration }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        ...(dto.isFree !== undefined && { isFree: dto.isFree }),
        ...(dto.episodeNumber !== undefined && { episodeNumber: dto.episodeNumber }),
        ...((dto as any).milestoneId !== undefined && { milestoneId: (dto as any).milestoneId }),
      },
    });
  }

  async removeLesson(courseId: string, lessonId: string, userId: string) {
    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course) throw new NotFoundException('Course not found');
    const rmUser = await this.prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    const rmIsAdmin = rmUser?.role && ['SUPER_ADMIN', 'ADMIN', 'FINANCE_ADMIN', 'SUPPORT'].includes(rmUser.role);
    if (!rmIsAdmin && course.instructorId !== userId) throw new ForbiddenException('Not your course');

    const lesson = await this.prisma.courseLesson.findFirst({ where: { id: lessonId, courseId } });
    if (!lesson) throw new NotFoundException('Lesson not found');

    await this.prisma.courseLesson.delete({ where: { id: lessonId } });
    return { message: 'Lesson deleted' };
  }

  // ---- Enrollment & Progress ----

  async enroll(courseId: string, userId: string) {
    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course) throw new NotFoundException('Course not found');
    if (course.status !== 'PUBLISHED') throw new BadRequestException('Course is not published');

    const existing = await this.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    if (existing) throw new ConflictException('Already enrolled');

    const coursePrice = Number(course.price);

    // Paid course — debit user wallet, credit instructor wallet, generate invoice
    if (coursePrice > 0) {
      const userWallet = await this.prisma.wallet.findUnique({ where: { userId } });
      if (!userWallet) throw new BadRequestException('Wallet not found. Please set up your wallet first.');
      if (Number(userWallet.balance) < coursePrice) throw new BadRequestException('Insufficient wallet balance');

      // Ensure instructor has a wallet (auto-create if missing)
      let instructorWallet = await this.prisma.wallet.findUnique({ where: { userId: course.instructorId } });
      if (!instructorWallet) {
        instructorWallet = await this.prisma.wallet.create({ data: { userId: course.instructorId, balance: 0, currency: 'KES' } });
      }

      const commission = Math.round(coursePrice * PLATFORM_COMMISSION_RATE * 100) / 100;
      const instructorPayout = coursePrice - commission;

      return this.prisma.$transaction(async (tx) => {
        // 1. Debit user wallet
        await this.walletService.debitWallet(
          userWallet.id, coursePrice, 'COURSE_PURCHASE', courseId,
          `Course purchase: ${course.title}`, tx,
        );

        // 2. Credit instructor wallet (minus platform commission)
        await this.walletService.creditWallet(
          instructorWallet!.id, instructorPayout, 'COURSE_SALE', courseId,
          `Course sale: ${course.title} (after ${PLATFORM_COMMISSION_RATE * 100}% commission)`, tx,
        );

        // 3. Credit platform wallet with commission
        if (commission > 0) {
          const platformWalletId = await this._getPlatformWalletId(tx);
          await this.walletService.creditWallet(
            platformWalletId, commission, 'COURSE_COMMISSION', courseId,
            `Course commission: ${course.title} (${PLATFORM_COMMISSION_RATE * 100}%)`, tx,
          );
        }

        // 4. Create enrollment
        const enrollment = await tx.enrollment.create({
          data: { userId, courseId },
          include: { course: { select: { id: true, title: true, thumbnail: true } } },
        });

        // 5. Increment totalEnrolled
        await tx.course.update({
          where: { id: courseId },
          data: { totalEnrolled: { increment: 1 } },
        });

        // 6. Auto-generate invoice: issuer=instructor, recipient=user
        const invoiceNumber = `INV-CRS-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
        await tx.invoice.create({
          data: {
            invoiceNumber,
            issuerId: course.instructorId,
            recipientId: userId,
            courseId: course.id,
            amount: coursePrice,
            tax: 0,
            total: coursePrice,
            currency: course.currency,
            status: 'PAID',
            description: `Course enrollment: ${course.title}`,
            lineItems: [
              { description: course.title, qty: 1, unitPrice: coursePrice, total: coursePrice },
              { description: `Platform commission (${PLATFORM_COMMISSION_RATE * 100}%)`, qty: 1, unitPrice: -commission, total: -commission },
            ],
            dueDate: new Date(),
            paidAt: new Date(),
            issuedAt: new Date(),
          },
        });

        return enrollment;
      });
    }

    // Free course — no wallet interaction needed
    const enrollment = await this.prisma.enrollment.create({
      data: { userId, courseId },
      include: { course: { select: { id: true, title: true, thumbnail: true } } },
    });

    await this.prisma.course.update({
      where: { id: courseId },
      data: { totalEnrolled: { increment: 1 } },
    });

    return enrollment;
  }

  async updateProgress(courseId: string, userId: string, dto: UpdateProgressDto) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    if (!enrollment) throw new NotFoundException('Not enrolled in this course');

    const data: any = { progress: dto.progress };
    if (dto.progress >= 100) {
      data.status = 'COMPLETED';
      data.completedAt = new Date();
    }

    return this.prisma.enrollment.update({
      where: { userId_courseId: { userId, courseId } },
      data,
      include: { course: { select: { id: true, title: true, thumbnail: true } } },
    });
  }

  async myCreated(userId: string, dto: ListCoursesDto) {
    const page = Number(dto.page) || 1;
    const limit = Number(dto.limit) || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.CourseWhereInput = { instructorId: userId };

    const [items, total] = await Promise.all([
      this.prisma.course.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          instructor: { select: instructorSelect },
          lessons: { orderBy: { sortOrder: 'asc' } },
          _count: { select: { lessons: true, enrollments: true } },
        },
      }),
      this.prisma.course.count({ where }),
    ]);

    return paginate(items, total, page, limit);
  }

  // ---- Questions & Quiz ----

  async addQuestion(courseId: string, lessonId: string, userId: string, dto: { question: string; questionType?: string; options?: string[]; correctAnswer?: string; explanation?: string; points?: number; sortOrder?: number }, role?: string) {
    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course) throw new NotFoundException('Course not found');
    const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';
    if (course.instructorId !== userId && !isAdmin) throw new ForbiddenException('Not your course');
    return this.prisma.lessonQuestion.create({
      data: { lessonId, question: dto.question, questionType: dto.questionType || 'MULTIPLE_CHOICE', options: dto.options || [], correctAnswer: dto.correctAnswer, explanation: dto.explanation, points: dto.points ?? 1, sortOrder: dto.sortOrder ?? 0 },
    });
  }

  async removeQuestion(courseId: string, lessonId: string, questionId: string, userId: string) {
    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course) throw new NotFoundException('Course not found');
    const rqUser = await this.prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    const rqIsAdmin = rqUser?.role && ['SUPER_ADMIN', 'ADMIN', 'FINANCE_ADMIN', 'SUPPORT'].includes(rqUser.role);
    if (!rqIsAdmin && course.instructorId !== userId) throw new ForbiddenException('Not your course');
    await this.prisma.lessonQuestion.delete({ where: { id: questionId } });
    return { message: 'Question deleted' };
  }

  async getQuestions(lessonId: string) {
    return this.prisma.lessonQuestion.findMany({ where: { lessonId }, orderBy: { sortOrder: 'asc' } });
  }

  async submitAnswer(questionId: string, userId: string, answer: string) {
    const question = await this.prisma.lessonQuestion.findUnique({ where: { id: questionId } });
    if (!question) throw new NotFoundException('Question not found');
    const isCorrect = question.correctAnswer ? answer.trim().toLowerCase() === question.correctAnswer.trim().toLowerCase() : false;
    const score = isCorrect ? question.points : 0;
    return this.prisma.questionAnswer.upsert({
      where: { questionId_userId: { questionId, userId } },
      create: { questionId, userId, answer, isCorrect, score },
      update: { answer, isCorrect, score },
    });
  }

  async getMyAnswers(lessonId: string, userId: string) {
    const questions = await this.prisma.lessonQuestion.findMany({ where: { lessonId }, include: { answers: { where: { userId } } }, orderBy: { sortOrder: 'asc' } });
    const totalPoints = questions.reduce((s, q) => s + q.points, 0);
    const earnedPoints = questions.reduce((s, q) => s + (q.answers[0]?.score || 0), 0);
    return { questions, totalPoints, earnedPoints, percentage: totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0 };
  }

  /** Resolve the Uteo platform wallet ID from system settings or SUPER_ADMIN user */
  private async _getPlatformWalletId(tx: any): Promise<string> {
    const setting = await tx.systemSetting.findUnique({ where: { key: 'platform.wallet_id' } });
    if (setting) {
      const wallet = await tx.wallet.findUnique({ where: { id: setting.value as string } });
      if (wallet) return wallet.id;
    }
    const admin = await tx.user.findFirst({ where: { role: 'SUPER_ADMIN' }, orderBy: { createdAt: 'asc' } });
    if (!admin) throw new BadRequestException('No admin user found for platform wallet');
    let wallet = await tx.wallet.findUnique({ where: { userId: admin.id } });
    if (!wallet) {
      wallet = await tx.wallet.create({ data: { userId: admin.id, balance: 0, currency: 'KES' } });
    }
    await tx.systemSetting.upsert({
      where: { key: 'platform.wallet_id' },
      create: { key: 'platform.wallet_id', value: wallet.id as any, category: 'platform' },
      update: { value: wallet.id as any },
    });
    return wallet.id;
  }

  async myEnrolled(userId: string, dto: ListCoursesDto) {
    const page = Number(dto.page) || 1;
    const limit = Number(dto.limit) || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.EnrollmentWhereInput = { userId };

    const [items, total] = await Promise.all([
      this.prisma.enrollment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          course: {
            include: {
              instructor: { select: instructorSelect },
              _count: { select: { lessons: true } },
            },
          },
        },
      }),
      this.prisma.enrollment.count({ where }),
    ]);

    return paginate(items, total, page, limit);
  }

  // ---- Milestones (Modules) ----

  async getMilestones(courseId: string) {
    return this.prisma.courseMilestone.findMany({
      where: { courseId },
      orderBy: { orderIndex: 'asc' },
      include: { lessons: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  async createMilestone(courseId: string, data: { title: string; description?: string; orderIndex?: number; passingScore?: number; weight?: number }) {
    const count = await this.prisma.courseMilestone.count({ where: { courseId } });
    return this.prisma.courseMilestone.create({
      data: { courseId, title: data.title, description: data.description, orderIndex: data.orderIndex ?? count, passingScore: data.passingScore ?? 70, weight: data.weight ?? 1 },
    });
  }

  async updateMilestone(milestoneId: string, data: { title?: string; description?: string; orderIndex?: number; passingScore?: number; weight?: number }) {
    return this.prisma.courseMilestone.update({ where: { id: milestoneId }, data });
  }

  async deleteMilestone(milestoneId: string) {
    return this.prisma.courseMilestone.delete({ where: { id: milestoneId } });
  }

  // ---- Assessments ----

  async getAssessments(lessonId: string) {
    return this.prisma.lessonAssessment.findMany({ where: { lessonId }, orderBy: { orderIndex: 'asc' } });
  }

  async addAssessment(lessonId: string, data: { question: string; type?: string; options?: any; correctAnswer?: any; points?: number; orderIndex?: number; explanation?: string }) {
    const count = await this.prisma.lessonAssessment.count({ where: { lessonId } });
    return this.prisma.lessonAssessment.create({
      data: { lessonId, question: data.question, type: (data.type ?? 'MULTIPLE_CHOICE') as any, options: data.options ?? null, correctAnswer: data.correctAnswer ?? null, points: data.points ?? 10, orderIndex: data.orderIndex ?? count, explanation: data.explanation ?? null },
    });
  }

  async updateAssessment(assessmentId: string, data: any) {
    return this.prisma.lessonAssessment.update({ where: { id: assessmentId }, data });
  }

  async deleteAssessment(assessmentId: string) {
    return this.prisma.lessonAssessment.delete({ where: { id: assessmentId } });
  }

  // ---- Certificates ----

  async getCertificates(courseId: string) {
    return this.prisma.courseCertificate.findMany({
      where: { courseId },
      orderBy: { issuedAt: 'desc' },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
    });
  }

  async issueCertificate(courseId: string, userId: string, finalGrade?: number) {
    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course) throw new NotFoundException('Course not found');
    const enrollment = await this.prisma.enrollment.findUnique({ where: { userId_courseId: { courseId, userId } } });

    const year = new Date().getFullYear();
    const count = await this.prisma.courseCertificate.count();
    const certNumber = `UTEO-CERT-${year}-${String(count + 1).padStart(5, '0')}`;
    const verCode = Math.random().toString(36).substring(2, 10).toUpperCase();

    return this.prisma.courseCertificate.upsert({
      where: { courseId_userId: { courseId, userId } },
      create: { courseId, userId, enrollmentId: enrollment?.id, certificateNumber: certNumber, verificationCode: verCode, finalGrade: finalGrade ?? null, metadata: { courseTitle: course.title } },
      update: { finalGrade: finalGrade ?? undefined, status: 'ISSUED', revokedAt: null, revokedBy: null, revokedReason: null },
    });
  }

  async revokeCertificate(certId: string, reason: string, adminId: string) {
    return this.prisma.courseCertificate.update({ where: { id: certId }, data: { status: 'REVOKED', revokedAt: new Date(), revokedBy: adminId, revokedReason: reason } });
  }

  // ---- Lesson Submissions ----

  async submitLesson(lessonId: string, userId: string, answers: Record<string, any>) {
    const assessments = await this.prisma.lessonAssessment.findMany({ where: { lessonId } });
    let earned = 0; let total = 0;
    for (const a of assessments) {
      total += a.points;
      const submitted = answers[a.id];
      const correct = a.correctAnswer as any;
      if (submitted !== undefined && correct !== null) {
        const subStr = Array.isArray(submitted) ? submitted.sort().join(',') : String(submitted).trim().toLowerCase();
        const corStr = Array.isArray(correct) ? (correct as string[]).sort().join(',') : String(correct).trim().toLowerCase();
        if (subStr === corStr) earned += a.points;
      }
    }
    const score = total > 0 ? Math.round((earned / total) * 100) : 0;
    const lesson = await this.prisma.courseLesson.findUnique({ where: { id: lessonId }, include: { milestone: true } });
    const passingScore = lesson?.milestone?.passingScore ?? 70;
    const passed = score >= passingScore;

    const existing = await this.prisma.lessonSubmission.findUnique({ where: { userId_lessonId: { userId, lessonId } } });
    if (existing && existing.score >= score) return { ...existing, alreadyBetter: true };

    const submission = await this.prisma.lessonSubmission.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      create: { userId, lessonId, courseMilestoneId: lesson?.milestoneId ?? null, answers: answers as any, score, passed },
      update: { answers: answers as any, score, passed, gradedAt: null, feedback: null },
    });

    // Auto-update enrollment progress after each submission
    if (lesson?.courseId) {
      try {
        const [totalLessons, passedSubmissions] = await Promise.all([
          this.prisma.courseLesson.count({ where: { courseId: lesson.courseId } }),
          this.prisma.lessonSubmission.findMany({
            where: { userId, lesson: { courseId: lesson.courseId }, passed: true },
            select: { lessonId: true },
            distinct: ['lessonId'],
          }),
        ]);
        const newProgress = totalLessons > 0
          ? Math.min(100, Math.round((passedSubmissions.length / totalLessons) * 100))
          : 0;
        const completedAt = newProgress >= 100 ? new Date() : null;
        await this.prisma.enrollment.updateMany({
          where: { userId, courseId: lesson.courseId },
          data: { progress: newProgress, ...(completedAt ? { completedAt, status: 'COMPLETED' } : {}) },
        });
      } catch { /* non-critical — don't fail submission if progress update fails */ }
    }

    return submission;
  }

  async getMySubmission(lessonId: string, userId: string) {
    return this.prisma.lessonSubmission.findUnique({ where: { userId_lessonId: { userId, lessonId } } });
  }

  async getMySubmissions(lessonId: string, userId: string) {
    const s = await this.prisma.lessonSubmission.findUnique({ where: { userId_lessonId: { userId, lessonId } } });
    return s ? [s] : [];
  }

  async gradeSubmission(submissionId: string, data: { score: number; passed: boolean; feedback?: string }, gradedById: string) {
    return this.prisma.lessonSubmission.update({
      where: { id: submissionId },
      data: { score: data.score, passed: data.passed, feedback: data.feedback, gradedAt: new Date(), gradedById },
    });
  }

  async getPendingSubmissions(courseId: string) {
    const lessons = await this.prisma.courseLesson.findMany({ where: { courseId }, select: { id: true, title: true, contentType: true } });
    const lessonIds = lessons.map(l => l.id);
    const subs = await this.prisma.lessonSubmission.findMany({
      where: { lessonId: { in: lessonIds }, gradedAt: null, lesson: { contentType: { in: ['ASSIGNMENT', 'QUIZ'] } } },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true } }, lesson: { select: { id: true, title: true, contentType: true } } },
      orderBy: { submittedAt: 'desc' },
    });
    return subs;
  }

  async getMyGrade(courseId: string, userId: string) {
    const milestones = await this.prisma.courseMilestone.findMany({
      where: { courseId },
      orderBy: { orderIndex: 'asc' },
      include: { lessons: { select: { id: true } } },
    });
    if (milestones.length === 0) return { finalGrade: 0, milestoneCount: 0, milestones: [], allMilestonesPassed: false };

    let totalWeight = 0; let weightedSum = 0;
    const milestoneResults = await Promise.all(milestones.map(async m => {
      const lessonIds = m.lessons.map(l => l.id);
      const subs = lessonIds.length > 0
        ? await this.prisma.lessonSubmission.findMany({ where: { userId, lessonId: { in: lessonIds } } })
        : [];
      const bestScore = subs.length > 0 ? Math.max(...subs.map(s => s.score)) : 0;
      const passed = bestScore >= m.passingScore;
      totalWeight += m.weight;
      weightedSum += bestScore * m.weight;
      return { milestoneId: m.id, title: m.title, passingScore: m.passingScore, weight: m.weight, bestScore, passed };
    }));

    const finalGrade = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
    const allMilestonesPassed = milestoneResults.every(m => m.passed);
    return { finalGrade, milestoneCount: milestones.length, milestones: milestoneResults, allMilestonesPassed };
  }

  // --- Task 7: Signed lesson URL ---
  async getSignedLessonUrl(lessonId: string, userId: string): Promise<{ url: string; expiresIn: number }> {
    const lesson = await this.prisma.courseLesson.findUnique({
      where: { id: lessonId },
      include: { course: { select: { id: true, instructorId: true } } },
    });
    if (!lesson) throw new NotFoundException('Lesson not found');

    const courseId = lesson.course.id;
    const instructorId = lesson.course.instructorId;

    // Check user is enrolled in the course or is the course instructor
    const isInstructor = instructorId === userId;
    if (!isInstructor) {
      const enrollment = await this.prisma.enrollment.findUnique({
        where: { userId_courseId: { courseId, userId } },
      });
      if (!enrollment) throw new ForbiddenException('You must be enrolled in this course to stream this lesson');
    }

    if (!lesson.videoUrl) throw new BadRequestException('This lesson has no video');

    // Extract S3 key from URL or treat videoUrl as key directly
    let s3Key: string = lesson.videoUrl;
    try {
      const url = new URL(lesson.videoUrl);
      // Strip leading slash from pathname to get the S3 key
      s3Key = url.pathname.startsWith('/') ? url.pathname.substring(1) : url.pathname;
    } catch {
      // Not a full URL — treat as key
    }

    const SIGNED_URL_TTL = 7200; // 2 hours
    const signedUrl = await this.s3.getSignedUrl(s3Key, SIGNED_URL_TTL);
    return { url: signedUrl, expiresIn: SIGNED_URL_TTL };
  }
}
