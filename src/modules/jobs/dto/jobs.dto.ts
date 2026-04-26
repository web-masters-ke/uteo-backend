import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsArray,
  IsNotEmpty,
  MaxLength,
  IsDateString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type as CvType } from 'class-transformer';
import { Type } from 'class-transformer';
import { JobType, JobStatus } from '@prisma/client';

export class HiringStageDto {
  @IsNumber()
  order: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class CreateJobDto {
  @IsString()
  @IsNotEmpty()
  companyId: string;

  @IsOptional()
  @IsString()
  postedById?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsOptional()
  @IsString()
  requirements?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;

  @IsOptional()
  @IsEnum(JobType)
  jobType?: JobType;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  salaryMin?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  salaryMax?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsEnum(JobStatus)
  status?: JobStatus;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skillIds?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @CvType(() => HiringStageDto)
  hiringStages?: HiringStageDto[];
}

export class UpdateJobDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  requirements?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;

  @IsOptional()
  @IsEnum(JobType)
  jobType?: JobType;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  salaryMin?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  salaryMax?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsEnum(JobStatus)
  status?: JobStatus;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skillIds?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @CvType(() => HiringStageDto)
  hiringStages?: HiringStageDto[];
}

export class JobFilterDto extends PaginationDto {
  // Accept a single type OR a comma-separated list e.g. "FULL_TIME,REMOTE,HYBRID"
  @IsOptional()
  @IsString()
  jobType?: string;

  @IsOptional()
  @IsString()
  declare search?: string;

  // Alias sent by the browse-jobs page
  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  salaryMin?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  salaryMax?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skillIds?: string[];

  @IsOptional()
  @IsEnum(JobStatus)
  status?: JobStatus;

  @IsOptional()
  @IsString()
  companyId?: string;
}

export class InteractJobDto {
  @IsString()
  @IsNotEmpty()
  action: string; // view | click | save | apply | skip
}
