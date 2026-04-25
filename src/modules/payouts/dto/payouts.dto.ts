import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class RequestPayoutDto {
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  amount: number;

  @IsEnum(['MPESA', 'BANK_TRANSFER'], {
    message: 'method must be MPESA or BANK_TRANSFER',
  })
  method: 'MPESA' | 'BANK_TRANSFER';

  @IsString()
  destination: string; // phone or bank account number
}

export class ListPayoutsDto extends PaginationDto {
  @IsOptional() @IsString() status?: string;
}

export class AdminListPayoutsDto extends ListPayoutsDto {
  @IsOptional() @IsString() userId?: string;
  @IsOptional() @IsString() method?: string;
}

export class RejectPayoutDto {
  @IsString() reason: string;
}

export class CompletePayoutDto {
  @IsOptional() @IsString() reference?: string;
}
