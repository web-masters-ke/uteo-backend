import { IsString, IsOptional, IsNumber, IsBoolean, IsInt, Min, Max, MaxLength, IsObject, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class CreatePlanDto {
  @IsString() @MaxLength(100) name: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @Type(() => Number) @IsNumber() @Min(0) price: number;
  @IsOptional() @IsString() currency?: string;
  @Type(() => Number) @IsInt() @Min(1) durationDays: number;
  @IsOptional() @IsString() @IsIn(['monthly', 'quarterly', 'yearly', 'custom']) billingCycle?: string;
  @IsOptional() features?: any;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) maxBookings?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) maxTeamMembers?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(1) commissionRate?: number;
  @IsOptional() @IsString() @IsIn(['PROFESSIONAL', 'VOCATIONAL', 'BOTH']) trainerType?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsBoolean() isGlobal?: boolean;
  @IsOptional() @IsString() orgId?: string;
  @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
}

export class UpdatePlanDto {
  @IsOptional() @IsString() @MaxLength(100) name?: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) price?: number;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) durationDays?: number;
  @IsOptional() @IsString() @IsIn(['monthly', 'quarterly', 'yearly', 'custom']) billingCycle?: string;
  @IsOptional() features?: any;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) maxBookings?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) maxTeamMembers?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(1) commissionRate?: number;
  @IsOptional() @IsString() @IsIn(['PROFESSIONAL', 'VOCATIONAL', 'BOTH']) trainerType?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsBoolean() isGlobal?: boolean;
  @IsOptional() @IsString() orgId?: string;
  @IsOptional() @Type(() => Number) @IsInt() sortOrder?: number;
}

export class SubscribeDto {
  @IsString() planId: string;
  @IsOptional() @IsBoolean() autoRenew?: boolean;
}

export class ListSubscriptionsDto extends PaginationDto {}

export class ListPlansQueryDto {
  @IsOptional() @IsString() trainerType?: string;
  @IsOptional() @IsString() orgId?: string;
}
