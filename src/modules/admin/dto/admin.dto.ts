import { IsOptional,IsString,IsDateString,IsEnum } from 'class-validator';
import { VerificationStatus } from '@prisma/client';
import { PaginationDto } from '../../../common/dto/pagination.dto';
export class ListAuditLogsDto extends PaginationDto { @IsOptional() @IsString() action?: string; @IsOptional() @IsString() resource?: string; @IsOptional() @IsString() userId?: string; @IsOptional() @IsDateString() dateFrom?: string; @IsOptional() @IsDateString() dateTo?: string; }
export class VerifyTrainerDto { @IsEnum(VerificationStatus) status: VerificationStatus; @IsOptional() @IsString() note?: string; }
export class AnalyticsQueryDto { @IsOptional() @IsDateString() dateFrom?: string; @IsOptional() @IsDateString() dateTo?: string; }
