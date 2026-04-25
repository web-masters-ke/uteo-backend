import { IsString,IsOptional,IsNumber,IsEnum,Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentProvider, PaymentStatus } from '@prisma/client';
import { PaginationDto } from '../../../common/dto/pagination.dto';
export class InitiateMpesaDto { @Type(()=>Number) @IsNumber() @Min(1) amount: number; @IsString() phone: string; @IsOptional() @IsString() accountReference?: string; @IsOptional() @IsString() description?: string; }
export class MpesaWebhookDto { @IsOptional() Body?: any; }
export class ListPaymentsDto extends PaginationDto { @IsOptional() @IsEnum(PaymentStatus) status?: PaymentStatus; @IsOptional() @IsEnum(PaymentProvider) provider?: PaymentProvider; }
