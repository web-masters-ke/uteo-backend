import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  IsDateString,
  IsBoolean,
  IsEnum,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../../common/dto/pagination.dto';

class LineItemDto {
  @IsString() description: string;
  @Type(() => Number) @IsNumber() @Min(0) qty: number;
  @Type(() => Number) @IsNumber() @Min(0) unitPrice: number;
  @Type(() => Number) @IsNumber() @Min(0) total: number;
}

export class CreateInvoiceDto {
  @IsString() recipientId: string;
  @Type(() => Number) @IsNumber() @Min(0) amount: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) tax?: number;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() bookingId?: string;
  @IsOptional() @IsString() courseId?: string;
  @IsOptional() @IsString() subscriptionId?: string;
  @IsOptional() @IsDateString() dueDate?: string;
  @IsOptional() @IsBoolean() includeTax?: boolean;

  @IsOptional()
  
  
  
  lineItems?: any[];
}

export class ListInvoicesDto extends PaginationDto {
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsDateString() dateFrom?: string;
  @IsOptional() @IsDateString() dateTo?: string;
}

export class AdminListInvoicesDto extends ListInvoicesDto {
  @IsOptional() @IsString() issuerId?: string;
  @IsOptional() @IsString() recipientId?: string;
}
