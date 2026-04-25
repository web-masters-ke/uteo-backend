import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
} from '@nestjs/common';
import { CourseMilestonesService } from './course-milestones.service';
import {
  CreateCourseMilestoneDto,
  UpdateCourseMilestoneDto,
  CreateAssessmentDto,
  SubmitAnswersDto,
  GradeSubmissionDto,
} from './dto/course-milestones.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller()
export class CourseMilestonesController {
  constructor(private readonly svc: CourseMilestonesService) {}

  // ---- Milestones ----

  @Post('courses/:courseId/milestones')
  create(
    @Param('courseId') courseId: string,
    @CurrentUser('id') uid: string,
    @Body() dto: CreateCourseMilestoneDto,
  ) {
    return this.svc.create(courseId, uid, dto);
  }

  @Get('courses/:courseId/milestones')
  list(@Param('courseId') courseId: string, @CurrentUser('id') uid: string) {
    return this.svc.list(courseId, uid);
  }

  @Patch('course-milestones/:id')
  update(
    @Param('id') id: string,
    @CurrentUser('id') uid: string,
    @Body() dto: UpdateCourseMilestoneDto,
  ) {
    return this.svc.update(id, uid, dto);
  }

  @Delete('course-milestones/:id')
  remove(@Param('id') id: string, @CurrentUser('id') uid: string) {
    return this.svc.remove(id, uid);
  }

  // ---- Lesson assessments ----

  @Post('lessons/:lessonId/assessments')
  createAssessment(
    @Param('lessonId') lessonId: string,
    @CurrentUser('id') uid: string,
    @Body() dto: CreateAssessmentDto,
  ) {
    return this.svc.createAssessment(lessonId, uid, dto);
  }

  @Get('lessons/:lessonId/assessments')
  listAssessments(@Param('lessonId') lessonId: string, @CurrentUser('id') uid: string) {
    return this.svc.listAssessments(lessonId, uid);
  }

  // ---- Submissions ----

  @Post('lessons/:lessonId/submit')
  submit(
    @Param('lessonId') lessonId: string,
    @CurrentUser('id') uid: string,
    @Body() dto: SubmitAnswersDto,
  ) {
    return this.svc.submitAnswers(lessonId, uid, dto);
  }

  @Patch('submissions/:id/grade')
  grade(
    @Param('id') id: string,
    @CurrentUser('id') uid: string,
    @Body() dto: GradeSubmissionDto,
  ) {
    return this.svc.gradeSubmission(id, uid, dto);
  }

  // ---- Final grade ----

  @Get('courses/:courseId/my-grade')
  myGrade(@Param('courseId') courseId: string, @CurrentUser('id') uid: string) {
    return this.svc.getCourseGrade(courseId, uid);
  }
}
