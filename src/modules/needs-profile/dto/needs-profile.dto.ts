import {
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ExperienceLevel } from '@prisma/client';

export class UpsertNeedsProfileDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  goals?: string[];

  @IsOptional()
  @IsEnum(ExperienceLevel)
  currentLevel?: ExperienceLevel;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferredSessionTypes?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categoriesInterest?: string[];

  @IsOptional()
  @IsString()
  problemStatement?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  budgetMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  budgetMax?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  timeframeWeeks?: number;

  @IsOptional()
  @IsString()
  @IsIn(['low', 'medium', 'high'])
  urgency?: string;
}

export class RecommendationsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;
}
