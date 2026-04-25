import { IsString,IsOptional,IsNumber,IsEnum,Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentProvider } from '@prisma/client';
import { PaginationDto } from '../../../common/dto/pagination.dto';
export class DepositDto { @Type(()=>Number) @IsNumber() @Min(1) amount: number; @IsOptional() @IsString() currency?: string; @IsEnum(PaymentProvider) provider: PaymentProvider; @IsOptional() @IsString() phone?: string; }
export class WithdrawDto { @Type(()=>Number) @IsNumber() @Min(1) amount: number; @IsOptional() @IsString() currency?: string; @IsEnum(PaymentProvider) provider: PaymentProvider; @IsOptional() @IsString() phone?: string; @IsOptional() @IsString() accountNumber?: string; }
export class ListTransactionsDto extends PaginationDto {
  @IsOptional() @IsString() referenceType?: string;
  @IsOptional() @IsString() type?: string; // CREDIT | DEBIT
  @IsOptional() @IsString() dateFrom?: string; // ISO date
  @IsOptional() @IsString() dateTo?: string;
  @IsOptional() @IsString() minAmount?: string;
  @IsOptional() @IsString() maxAmount?: string;
}
