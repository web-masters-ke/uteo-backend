import { IsOptional,IsString,IsNumber,IsBoolean,IsArray,IsInt,Min,Max,IsEnum,MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { SessionType, TrainerTier, TrainerType, CredentialType, VerificationStatus } from '@prisma/client';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class CreateTrainerProfileDto {
  @IsOptional() @IsString() @MaxLength(2000) bio?: string;
  @IsOptional() @Type(()=>Number) @IsNumber() @Min(0) hourlyRate?: number;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @Type(()=>Number) @IsInt() @Min(0) experience?: number;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() county?: string;
  @IsOptional() @IsString() specialization?: string;
  @IsOptional() @IsArray() @IsString({each:true}) languages?: string[];
  @IsOptional() @IsBoolean() availableForOnline?: boolean;
  @IsOptional() @IsBoolean() availableForPhysical?: boolean;
  @IsOptional() @IsBoolean() availableForHybrid?: boolean;
  @IsOptional() @IsString() portfolioUrl?: string;
  @IsOptional() @IsString() linkedinUrl?: string;
  @IsOptional() @IsString() websiteUrl?: string;
  @IsOptional() @IsEnum(TrainerTier) tier?: TrainerTier;
  @IsOptional() @IsEnum(TrainerType) trainerType?: TrainerType;
  @IsOptional() @IsString() categoryId?: string;
}
export class UpdateTrainerProfileDto extends CreateTrainerProfileDto {}

export class ListTrainersDto extends PaginationDto {
  @IsOptional() @IsString() skill?: string;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsString() county?: string;
  @IsOptional() @Type(()=>Number) @IsNumber() @Min(0) minPrice?: number;
  @IsOptional() @Type(()=>Number) @IsNumber() @Min(0) maxPrice?: number;
  @IsOptional() @Type(()=>Number) @IsNumber() @Min(0) @Max(5) minRating?: number;
  @IsOptional() @IsEnum(SessionType) sessionType?: SessionType;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsEnum(TrainerTier) tier?: TrainerTier;
  @IsOptional() @IsEnum(TrainerType) trainerType?: TrainerType;
  @IsOptional() @IsEnum(VerificationStatus) verificationStatus?: VerificationStatus;
  @IsOptional() @IsEnum(CredentialType) credentialType?: CredentialType;
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @Type(()=>Boolean) @IsBoolean() isOrganization?: boolean;
}

export class AddSkillsDto { @IsArray() @IsString({each:true}) skillIds: string[]; }

export class AddCertificationDto {
  @IsString() @MaxLength(200) name: string;
  @IsString() @MaxLength(200) issuer: string;
  @Type(()=>Number) @IsInt() @Min(1950) @Max(2030) yearObtained: number;
  @IsOptional() @IsString() documentUrl?: string;
  @IsOptional() @IsEnum(CredentialType) credentialType?: CredentialType;
}

export class AvailabilitySlotDto {
  @Type(()=>Number) @IsInt() @Min(0) @Max(6) dayOfWeek: number;
  @IsString() startTime: string;
  @IsString() endTime: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsString() consultantId?: string;
  @IsOptional() @IsString() departmentId?: string;
}
export class SetAvailabilityDto { @IsArray() slots: AvailabilitySlotDto[]; }
