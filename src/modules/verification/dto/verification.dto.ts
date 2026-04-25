import { IsString, IsOptional, IsEnum, MaxLength } from 'class-validator';
import { VerificationRequestStatus } from '@prisma/client';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class CreateVerificationRequestDto {
  @IsString() @MaxLength(100) documentType: string;
  @IsString() documentUrl: string;
}

export class ReviewVerificationDto {
  @IsEnum(VerificationRequestStatus) status: VerificationRequestStatus;
  @IsOptional() @IsString() @MaxLength(1000) reviewNote?: string;
}

export class ListVerificationRequestsDto extends PaginationDto {
  @IsOptional() @IsEnum(VerificationRequestStatus) status?: VerificationRequestStatus;
}

export class SubmitCredentialVerificationDto {
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
}

export class ReviewCredentialDto {
  @IsEnum(VerificationRequestStatus) status: VerificationRequestStatus;
  @IsOptional() @IsString() @MaxLength(1000) reviewNote?: string;
  @IsOptional() @IsString() @MaxLength(1000) rejectedReason?: string;
}
