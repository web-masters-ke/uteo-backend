import { IsString, IsOptional, IsNumber, IsEnum, IsArray, IsBoolean, IsInt, Min, Max, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class CreateCourseDto {
  @IsString() @MaxLength(200) title: string;
  @IsOptional() @IsString() @MaxLength(5000) description?: string;
  @IsOptional() @IsString() thumbnail?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) price?: number;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() level?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) duration?: number;
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() instructorId?: string;
  @IsOptional() settings?: Record<string, any>;
  @IsOptional() certConfig?: Record<string, any>;
}

export class UpdateCourseDto {
  @IsOptional() @IsString() @MaxLength(200) title?: string;
  @IsOptional() @IsString() @MaxLength(5000) description?: string;
  @IsOptional() @IsString() thumbnail?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) price?: number;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() level?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) duration?: number;
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
  @IsOptional() @IsString() status?: string;
  @IsOptional() settings?: Record<string, any>;
  @IsOptional() certConfig?: Record<string, any>;
}

export class ListCoursesDto extends PaginationDto {
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() instructorId?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() level?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) minPrice?: number;
  @IsOptional() @Type(() => Number) @IsNumber() maxPrice?: number;
}

export class CreateLessonDto {
  @IsString() @MaxLength(200) title: string;
  @IsOptional() @IsString() @MaxLength(5000) description?: string;
  @IsOptional() @IsString() videoUrl?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) duration?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) sortOrder?: number;
  @IsOptional() @IsBoolean() isFree?: boolean;
  @IsOptional() @IsString() contentType?: string;
  @IsOptional() @IsString() textContent?: string;
  @IsOptional() episodeNumber?: number;
  @IsOptional() @IsString() milestoneId?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) timeLimitMin?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) maxAttempts?: number;
}

export class UpdateLessonDto {
  @IsOptional() @IsString() @MaxLength(200) title?: string;
  @IsOptional() @IsString() @MaxLength(5000) description?: string;
  @IsOptional() @IsString() videoUrl?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) duration?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) sortOrder?: number;
  @IsOptional() @IsBoolean() isFree?: boolean;
  @IsOptional() @IsString() contentType?: string;
  @IsOptional() @IsString() textContent?: string;
  @IsOptional() episodeNumber?: number;
  @IsOptional() @IsString() milestoneId?: string | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) timeLimitMin?: number | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) maxAttempts?: number | null;
}

export class UpdateProgressDto {
  @Type(() => Number) @IsInt() @Min(0) @Max(100) progress: number;
}
