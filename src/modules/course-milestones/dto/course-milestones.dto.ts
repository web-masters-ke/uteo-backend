import {
  IsString,
  IsOptional,
  IsInt,
  IsEnum,
  IsBoolean,
  Min,
  Max,
  MaxLength,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCourseMilestoneDto {
  @IsString() @MaxLength(200) title: string;
  @IsOptional() @IsString() @MaxLength(5000) description?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) orderIndex?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100) passingScore?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) weight?: number;
}

export class UpdateCourseMilestoneDto {
  @IsOptional() @IsString() @MaxLength(200) title?: string;
  @IsOptional() @IsString() @MaxLength(5000) description?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) orderIndex?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100) passingScore?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) weight?: number;
}

export enum AssessmentTypeDto {
  MULTIPLE_CHOICE = 'MULTIPLE_CHOICE',
  TEXT = 'TEXT',
  FILE_UPLOAD = 'FILE_UPLOAD',
  CHECKBOX = 'CHECKBOX',
}

export class CreateAssessmentDto {
  @IsString() @MaxLength(5000) question: string;
  @IsOptional() @IsEnum(AssessmentTypeDto) type?: AssessmentTypeDto;
  @IsOptional() options?: any;          // array for MC/checkbox
  @IsOptional() correctAnswer?: any;    // string or array (answer index/value or values)
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) points?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) orderIndex?: number;
}

export class SubmitAnswersDto {
  @IsObject() answers: Record<string, any>;   // { [assessmentId]: answer }
}

export class GradeSubmissionDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100) score?: number;
  @IsOptional() @IsBoolean() passed?: boolean;
  @IsOptional() @IsString() @MaxLength(5000) feedback?: string;
}
