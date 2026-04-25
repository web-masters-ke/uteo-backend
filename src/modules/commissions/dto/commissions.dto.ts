import { IsString, IsOptional, IsNumber, IsBoolean, IsDateString, Min, Max, MaxLength, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class CreateCommissionRuleDto {
  @IsString() @MaxLength(100) name: string;
  @Type(() => Number) @IsNumber() @Min(0) minAmount: number;
  @Type(() => Number) @IsNumber() @Min(0) maxAmount: number;
  @Type(() => Number) @IsNumber() @Min(0) @Max(1) commissionRate: number;
  @IsOptional() @IsString() subscriptionTier?: string;
  @IsOptional() @IsString() @IsIn(['PROFESSIONAL', 'VOCATIONAL', 'BOTH']) trainerType?: string;
  @IsOptional() @IsString() orgId?: string;
  @IsOptional() @IsBoolean() isGlobal?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateCommissionRuleDto {
  @IsOptional() @IsString() @MaxLength(100) name?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) minAmount?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) maxAmount?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(1) commissionRate?: number;
  @IsOptional() @IsString() subscriptionTier?: string;
  @IsOptional() @IsString() @IsIn(['PROFESSIONAL', 'VOCATIONAL', 'BOTH']) trainerType?: string;
  @IsOptional() @IsString() orgId?: string;
  @IsOptional() @IsBoolean() isGlobal?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class ListCommissionRecordsDto extends PaginationDto {}

export class SetTrainerRateDto {
  @Type(() => Number) @IsNumber() @Min(0) @Max(1) rate: number;
}

export class WaiveTrainerCommissionDto {
  @IsDateString() until: string;
}

export class CreateCommissionOverrideDto {
  @IsString() trainerId: string;
  @Type(() => Number) @IsNumber() @Min(0) @Max(1) customRate: number;
  @IsOptional() @IsString() reason?: string;
  @IsOptional() @IsDateString() validUntil?: string;
}

export class UpdateCommissionOverrideDto {
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(1) customRate?: number;
  @IsOptional() @IsString() reason?: string;
  @IsOptional() @IsDateString() validUntil?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class CreateOrgCommissionOverrideDto {
  @Type(() => Number) @IsNumber() @Min(0) @Max(1) customRate: number;
  @IsOptional() @IsString() reason?: string;
  @IsOptional() @IsDateString() validUntil?: string;
}
