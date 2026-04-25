import { IsString, IsOptional, IsInt, IsBoolean, IsEnum, IsUUID, Min, Max, IsNotEmpty, IsIn } from 'class-validator';
import { SlaPriority } from '@prisma/client';

const ESCALATION_ROLES = ['SUPPORT', 'ADMIN', 'FINANCE_ADMIN', 'SUPER_ADMIN'];

export class CreateSlaPolicyDto {
  @IsString() @IsNotEmpty() name: string;
  @IsOptional() @IsString() description?: string;
  @IsEnum(SlaPriority) priority: SlaPriority;
  @IsInt() @Min(1) firstResponseHours: number;
  @IsInt() @Min(1) resolutionHours: number;
  @IsOptional() @IsInt() @Min(50) @Max(99) warningPercent?: number;
  @IsOptional() @IsBoolean() autoEscalate?: boolean;
  @IsOptional() @IsIn(ESCALATION_ROLES) warningNotifyRole?: string;
  @IsOptional() @IsIn(ESCALATION_ROLES) firstResponseEscalateTo?: string;
  @IsOptional() @IsIn(ESCALATION_ROLES) resolutionEscalateTo?: string;
}

export class UpdateSlaPolicyDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsEnum(SlaPriority) priority?: SlaPriority;
  @IsOptional() @IsInt() @Min(1) firstResponseHours?: number;
  @IsOptional() @IsInt() @Min(1) resolutionHours?: number;
  @IsOptional() @IsInt() @Min(50) @Max(99) warningPercent?: number;
  @IsOptional() @IsBoolean() autoEscalate?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsIn(ESCALATION_ROLES) warningNotifyRole?: string;
  @IsOptional() @IsIn(ESCALATION_ROLES) firstResponseEscalateTo?: string;
  @IsOptional() @IsIn(ESCALATION_ROLES) resolutionEscalateTo?: string;
}

export class AssignSlaDto {
  @IsUUID() disputeId: string;
  @IsUUID() policyId: string;
}
