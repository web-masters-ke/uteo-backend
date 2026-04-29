import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsDateString,
  IsInt,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TaskType, TaskStatus, TaskPriority } from '@prisma/client';

export class CreateTaskDto {
  @IsString() title!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsEnum(TaskType) type?: TaskType;
  @IsOptional() @IsEnum(TaskPriority) priority?: TaskPriority;
  @IsOptional() @IsDateString() dueDate?: string;
  @IsOptional() @IsString() jobId?: string;
  @IsOptional() @IsString() applicationId?: string;
  @IsOptional() @IsString() companyId?: string;
  @IsOptional() @IsString() assignedToId?: string;
}

export class UpdateTaskDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsEnum(TaskType) type?: TaskType;
  @IsOptional() @IsEnum(TaskStatus) status?: TaskStatus;
  @IsOptional() @IsEnum(TaskPriority) priority?: TaskPriority;
  @IsOptional() @IsDateString() dueDate?: string | null;
  @IsOptional() @IsString() assignedToId?: string | null;
}

export class ListTasksDto {
  @IsOptional() @IsEnum(TaskStatus) status?: TaskStatus;
  @IsOptional() @IsEnum(TaskType) type?: TaskType;
  @IsOptional() @IsEnum(TaskPriority) priority?: TaskPriority;
  @IsOptional() @IsString() jobId?: string;
  @IsOptional() @IsString() applicationId?: string;
  @IsOptional() @IsString() companyId?: string;
  @IsOptional() @IsString() assignedToId?: string;
  @IsOptional() @IsString() createdById?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsBoolean() @Type(() => Boolean) overdue?: boolean;
  @IsOptional() @IsBoolean() @Type(() => Boolean) mine?: boolean;
  @IsOptional() @IsInt() @Min(1) @Type(() => Number) page?: number = 1;
  @IsOptional() @IsInt() @Min(1) @Type(() => Number) limit?: number = 20;
}
