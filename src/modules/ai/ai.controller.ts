import { Controller, Post, Body } from '@nestjs/common';
import { AiService } from './ai.service';
import { InterviewQuestionsDto, CandidateInsightDto, CareerAdviceDto, EnhanceJobDto } from './dto/ai.dto';
import { Public } from '../../common/decorators/public.decorator';

@Controller('ai')
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Post('interview-questions')
  interviewQuestions(@Body() dto: InterviewQuestionsDto) {
    return this.ai.generateInterviewQuestions(dto.jobTitle, dto.skills ?? [], dto.candidateName, dto.notes);
  }

  @Post('candidate-insight')
  candidateInsight(@Body() dto: CandidateInsightDto) {
    return this.ai.generateCandidateInsight(dto.candidateName, dto.headline ?? null, dto.skills ?? [], dto.matchedSkills ?? [], dto.jobTitle);
  }

  @Post('career-advice')
  careerAdvice(@Body() dto: CareerAdviceDto) {
    return this.ai.careerAdvice(dto.messages);
  }

  @Post('enhance-job')
  enhanceJob(@Body() dto: EnhanceJobDto) {
    return this.ai.enhanceJobDescription(dto.title, dto.description);
  }
}
