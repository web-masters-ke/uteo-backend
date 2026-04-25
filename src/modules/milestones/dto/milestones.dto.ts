import {
  IsString,
  IsOptional,
  IsNumber,
  IsInt,
  IsDateString,
  IsArray,
  IsEnum,
  Min,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PresenceStatus } from '@prisma/client';

export class CreateMilestoneDto {
  @IsString()
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  orderIndex?: number;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

export class UpdateMilestoneDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  orderIndex?: number;
}

export class DisputeMilestoneDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class AttendanceEntryDto {
  @IsString()
  userId: string;

  @IsOptional()
  @IsEnum(PresenceStatus)
  presenceStatus?: PresenceStatus;

  @IsOptional()
  @IsDateString()
  checkedInAt?: string;

  @IsOptional()
  @IsDateString()
  checkedOutAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class RecordAttendanceDto {
  @IsOptional()
  @IsString()
  milestoneId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttendanceEntryDto)
  entries: AttendanceEntryDto[];
}
