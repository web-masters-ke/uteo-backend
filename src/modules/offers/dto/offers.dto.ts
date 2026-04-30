import { IsString, IsOptional, IsEnum, IsDateString, IsNumber } from 'class-validator';
import { OfferStatus } from '@prisma/client';

export class CreateOfferDto {
  @IsString() applicationId!: string;
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() bodyHtml?: string;
  @IsOptional() @IsString() termsHtml?: string;
  @IsOptional() @IsNumber() salaryAmount?: number;
  @IsOptional() @IsString() salaryCurrency?: string;
  @IsOptional() @IsString() salaryPeriod?: string;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsString() benefits?: string;
  @IsOptional() @IsDateString() expiresAt?: string;
}

export class UpdateOfferDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() bodyHtml?: string;
  @IsOptional() @IsString() termsHtml?: string;
  @IsOptional() @IsNumber() salaryAmount?: number;
  @IsOptional() @IsString() salaryCurrency?: string;
  @IsOptional() @IsString() salaryPeriod?: string;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsString() benefits?: string;
  @IsOptional() @IsDateString() expiresAt?: string;
}

export class SignOfferDto {
  @IsString() signatureName!: string;
  @IsString() signatureDataUrl!: string;
}

export class DeclineOfferDto {
  @IsOptional() @IsString() reason?: string;
}

export class ListOffersDto {
  @IsOptional() @IsEnum(OfferStatus) status?: OfferStatus;
  @IsOptional() @IsString() applicationId?: string;
  @IsOptional() @IsString() jobId?: string;
  @IsOptional() @IsString() companyId?: string;
  @IsOptional() @IsString() candidateId?: string;
}
