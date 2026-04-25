import { IsString, IsOptional, IsArray, IsNotEmpty } from 'class-validator';

export class InterviewQuestionsDto {
  @IsString() @IsNotEmpty()
  jobTitle: string;

  @IsArray() @IsOptional()
  skills?: string[];

  @IsString() @IsOptional()
  candidateName?: string;

  @IsString() @IsOptional()
  notes?: string;
}

export class CandidateInsightDto {
  @IsString() @IsNotEmpty()
  candidateName: string;

  @IsString() @IsOptional()
  headline?: string;

  @IsArray() @IsOptional()
  skills?: string[];

  @IsArray() @IsOptional()
  matchedSkills?: string[];

  @IsString() @IsNotEmpty()
  jobTitle: string;
}

export class CareerAdviceDto {
  @IsArray()
  messages: { role: 'user' | 'assistant'; content: string }[];
}

export class EnhanceJobDto {
  @IsString() @IsNotEmpty()
  title: string;

  @IsString() @IsNotEmpty()
  description: string;
}
