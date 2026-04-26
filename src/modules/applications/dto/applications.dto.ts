import {
  IsString,
  IsOptional,
  IsEnum,
  IsNotEmpty,
} from 'class-validator';
import { ApplicationStatus } from '@prisma/client';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class CreateApplicationDto {
  @IsString()
  @IsNotEmpty()
  jobId: string;

  @IsOptional()
  @IsString()
  coverLetter?: string;

  @IsOptional()
  @IsString()
  resumeUrl?: string;
}

export class UpdateApplicationStatusDto {
  @IsEnum(ApplicationStatus)
  status: ApplicationStatus;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  scheduledAt?: string;

  @IsOptional()
  @IsString()
  meetingLink?: string;
}

export class CreateManualApplicationDto {
  @IsString()
  @IsNotEmpty()
  candidateEmail: string;

  @IsString()
  @IsNotEmpty()
  candidateFirstName: string;

  @IsOptional()
  @IsString()
  candidateLastName?: string;

  @IsOptional()
  @IsString()
  candidatePhone?: string;

  @IsOptional()
  @IsString()
  candidatePassword?: string;

  @IsOptional()
  @IsString()
  jobId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ListApplicationsDto extends PaginationDto {
  @IsOptional()
  @IsString()
  jobId?: string;

  @IsOptional()
  @IsEnum(ApplicationStatus)
  status?: ApplicationStatus;

  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;
}
