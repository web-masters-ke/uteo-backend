import {
  IsString,
  IsOptional,
  IsBoolean,
  IsDateString,
  IsInt,
  IsIn,
  IsUrl,
  MinLength,
  Min,
  Max,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  avatar?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  headline?: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  resumeUrl?: string;

  @IsOptional()
  @IsString()
  portfolioUrl?: string;

  @IsOptional()
  @IsString()
  linkedinUrl?: string;

  @IsOptional()
  @IsString()
  githubUrl?: string;

  @IsOptional()
  @IsBoolean()
  openToWork?: boolean;

  @IsOptional()
  @IsBoolean()
  isHiring?: boolean;
}

export class AddExperienceDto {
  @IsString()
  @MinLength(2)
  company: string;

  @IsString()
  @MinLength(2)
  title: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsDateString()
  startDate: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsBoolean()
  isCurrent?: boolean;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateExperienceDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  company?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  title?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsBoolean()
  isCurrent?: boolean;

  @IsOptional()
  @IsString()
  description?: string;
}

export class AddEducationDto {
  @IsString()
  @MinLength(2)
  institution: string;

  @IsString()
  @MinLength(2)
  degree: string;

  @IsOptional()
  @IsString()
  fieldOfStudy?: string;

  @IsInt()
  @Min(1950)
  @Max(2100)
  @Transform(({ value }) => Number(value))
  startYear: number;

  @IsOptional()
  @IsInt()
  @Min(1950)
  @Max(2100)
  @Transform(({ value }) => (value !== undefined ? Number(value) : undefined))
  endYear?: number;

  @IsOptional()
  @IsBoolean()
  isCurrent?: boolean;
}

export class UpdateEducationDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  institution?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  degree?: string;

  @IsOptional()
  @IsString()
  fieldOfStudy?: string;

  @IsOptional()
  @IsInt()
  @Min(1950)
  @Max(2100)
  @Transform(({ value }) => (value !== undefined ? Number(value) : undefined))
  startYear?: number;

  @IsOptional()
  @IsInt()
  @Min(1950)
  @Max(2100)
  @Transform(({ value }) => (value !== undefined ? Number(value) : undefined))
  endYear?: number;

  @IsOptional()
  @IsBoolean()
  isCurrent?: boolean;
}

export class AddUserSkillDto {
  @IsOptional()
  @IsString()
  skillId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  skillName?: string;

  @IsOptional()
  @IsIn(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'])
  proficiency?: string;
}
