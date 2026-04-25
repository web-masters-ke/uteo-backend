import { Controller, Get, Post, Patch, Delete, Param, Body, Query } from '@nestjs/common';
import { CoursesService } from './courses.service';
import {
  CreateCourseDto, UpdateCourseDto, ListCoursesDto,
  CreateLessonDto, UpdateLessonDto, UpdateProgressDto,
} from './dto/courses.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';

@Controller('courses')
export class CoursesController {
  constructor(private readonly svc: CoursesService) {}

  // ---- Course CRUD ----

  @Post()
  create(@CurrentUser('id') uid: string, @CurrentUser('role') role: string, @Body() dto: CreateCourseDto) {
    return this.svc.create(uid, role, dto);
  }

  @Public()
  @Get()
  findAll(@Query() dto: ListCoursesDto) {
    return this.svc.findAll(dto);
  }

  @Get('my/created')
  myCreated(@CurrentUser('id') uid: string, @Query() dto: ListCoursesDto) {
    return this.svc.myCreated(uid, dto);
  }

  @Get('my/enrolled')
  myEnrolled(@CurrentUser('id') uid: string, @Query() dto: ListCoursesDto) {
    return this.svc.myEnrolled(uid, dto);
  }

  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @CurrentUser('id') uid: string, @CurrentUser('role') role: string, @Body() dto: UpdateCourseDto) {
    return this.svc.update(id, uid, dto, role);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser('id') uid: string, @CurrentUser('role') role: string) {
    return this.svc.remove(id, uid, role);
  }

  @Post(':id/publish')
  publish(@Param('id') id: string, @CurrentUser('id') uid: string, @CurrentUser('role') role: string) {
    return this.svc.publish(id, uid, role);
  }

  // ---- Lessons ----

  @Post(':id/lessons')
  addLesson(@Param('id') id: string, @CurrentUser('id') uid: string, @CurrentUser('role') role: string, @Body() dto: CreateLessonDto) {
    return this.svc.addLesson(id, uid, dto, role);
  }

  @Patch(':courseId/lessons/:lessonId')
  updateLesson(
    @Param('courseId') courseId: string,
    @Param('lessonId') lessonId: string,
    @CurrentUser('id') uid: string,
    @Body() dto: UpdateLessonDto,
  ) {
    return this.svc.updateLesson(courseId, lessonId, uid, dto);
  }

  @Delete(':courseId/lessons/:lessonId')
  removeLesson(
    @Param('courseId') courseId: string,
    @Param('lessonId') lessonId: string,
    @CurrentUser('id') uid: string,
  ) {
    return this.svc.removeLesson(courseId, lessonId, uid);
  }

  // ---- Enrollment & Progress ----

  @Post(':id/enroll')
  enroll(@Param('id') id: string, @CurrentUser('id') uid: string) {
    return this.svc.enroll(id, uid);
  }

  @Patch(':id/progress')
  updateProgress(@Param('id') id: string, @CurrentUser('id') uid: string, @Body() dto: UpdateProgressDto) {
    return this.svc.updateProgress(id, uid, dto);
  }

  // ---- Questions & Quizzes ----

  @Post(':courseId/lessons/:lessonId/questions')
  addQuestion(
    @Param('courseId') courseId: string,
    @Param('lessonId') lessonId: string,
    @CurrentUser('id') uid: string,
    @CurrentUser('role') role: string,
    @Body() body: { question: string; questionType?: string; options?: string[]; correctAnswer?: string; explanation?: string; points?: number; sortOrder?: number },
  ) { return this.svc.addQuestion(courseId, lessonId, uid, body, role); }

  @Delete(':courseId/lessons/:lessonId/questions/:questionId')
  removeQuestion(
    @Param('courseId') courseId: string,
    @Param('lessonId') lessonId: string,
    @Param('questionId') questionId: string,
    @CurrentUser('id') uid: string,
  ) { return this.svc.removeQuestion(courseId, lessonId, questionId, uid); }

  @Public()
  @Get(':courseId/lessons/:lessonId/questions')
  getQuestions(@Param('lessonId') lessonId: string) { return this.svc.getQuestions(lessonId); }

  // ---- Milestones (Modules) ----

  @Get(':id/milestones')
  getMilestones(@Param('id') id: string) { return this.svc.getMilestones(id); }

  @Post(':id/milestones')
  createMilestone(@Param('id') id: string, @Body() body: any) { return this.svc.createMilestone(id, body); }

  @Patch(':id/milestones/:mid')
  updateMilestone(@Param('mid') mid: string, @Body() body: any) { return this.svc.updateMilestone(mid, body); }

  @Delete(':id/milestones/:mid')
  deleteMilestone(@Param('mid') mid: string) { return this.svc.deleteMilestone(mid); }

  // ---- Assessments ----

  @Get(':courseId/lessons/:lessonId/assessments')
  getAssessments(@Param('lessonId') lid: string) { return this.svc.getAssessments(lid); }

  @Post(':courseId/lessons/:lessonId/assessments')
  addAssessment(@Param('lessonId') lid: string, @Body() body: any) { return this.svc.addAssessment(lid, body); }

  @Patch(':courseId/lessons/:lessonId/assessments/:aid')
  updateAssessment(@Param('aid') aid: string, @Body() body: any) { return this.svc.updateAssessment(aid, body); }

  @Delete(':courseId/lessons/:lessonId/assessments/:aid')
  deleteAssessment(@Param('aid') aid: string) { return this.svc.deleteAssessment(aid); }

  @Get(':id/submissions/pending')
  getPendingSubmissions(@Param('id') id: string) { return this.svc.getPendingSubmissions(id); }

  @Get(':id/my-grade')
  getMyGrade(@Param('id') id: string, @CurrentUser('id') uid: string) { return this.svc.getMyGrade(id, uid); }

  // ---- Certificates ----

  @Get(':id/certificates')
  getCertificates(@Param('id') id: string) { return this.svc.getCertificates(id); }

  @Post(':id/certificates/issue/:userId')
  issueCert(@Param('id') id: string, @Param('userId') uid: string, @Body() body: { finalGrade?: number }) {
    return this.svc.issueCertificate(id, uid, body.finalGrade);
  }

  @Patch(':id/certificates/:certId/revoke')
  revokeCert(@Param('certId') certId: string, @Body() body: { reason: string }, @CurrentUser('id') aid: string) {
    return this.svc.revokeCertificate(certId, body.reason, aid);
  }

  // --- Task 7: Signed lesson stream URL ---
  @Get('lessons/:lessonId/stream')
  getLessonStream(@Param('lessonId') lessonId: string, @CurrentUser('id') uid: string) {
    return this.svc.getSignedLessonUrl(lessonId, uid);
  }

  @Post(':courseId/lessons/:lessonId/questions/:questionId/answer')
  submitAnswer(
    @Param('questionId') questionId: string,
    @CurrentUser('id') uid: string,
    @Body() body: { answer: string },
  ) { return this.svc.submitAnswer(questionId, uid, body.answer); }

  @Get(':courseId/lessons/:lessonId/my-answers')
  myAnswers(@Param('lessonId') lessonId: string, @CurrentUser('id') uid: string) {
    return this.svc.getMyAnswers(lessonId, uid);
  }
}
