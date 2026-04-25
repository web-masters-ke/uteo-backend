import { Controller, Get, Post, Patch, Param, Body } from '@nestjs/common';
import { CoursesService } from './courses.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('lessons')
export class LessonsController {
  constructor(private readonly svc: CoursesService) {}

  /** GET /lessons/:lessonId/assessments — fetch quiz questions for a lesson */
  @Get(':lessonId/assessments')
  getAssessments(@Param('lessonId') lessonId: string) {
    return this.svc.getAssessments(lessonId);
  }

  /** POST /lessons/:lessonId/submit — submit answers, auto-grade MC/TF, return score */
  @Post(':lessonId/submit')
  submit(
    @Param('lessonId') lessonId: string,
    @CurrentUser('id') uid: string,
    @Body() body: { answers: Record<string, string | string[]> },
  ) {
    return this.svc.submitLesson(lessonId, uid, body.answers);
  }

  /** GET /lessons/:lessonId/submissions — learner's own submission history */
  @Get(':lessonId/submissions')
  mySubmissions(
    @Param('lessonId') lessonId: string,
    @CurrentUser('id') uid: string,
  ) {
    return this.svc.getMySubmissions(lessonId, uid);
  }
}

@Controller('submissions')
export class SubmissionsController {
  constructor(private readonly svc: CoursesService) {}

  /** PATCH /submissions/:id/grade — instructor manual grading */
  @Patch(':id/grade')
  grade(
    @Param('id') id: string,
    @CurrentUser('id') uid: string,
    @Body() body: { score: number; passed: boolean; feedback?: string },
  ) {
    return this.svc.gradeSubmission(id, body, uid);
  }
}
