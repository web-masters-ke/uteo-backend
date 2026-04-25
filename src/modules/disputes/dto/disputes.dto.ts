import { IsString,IsOptional,IsEnum,IsIn,IsNotEmpty,MaxLength } from 'class-validator';
import { DisputeStatus, DisputeCategory } from '@prisma/client';
import { PaginationDto } from '../../../common/dto/pagination.dto';
export class CreateDisputeDto {
  @IsString() bookingId: string;
  @IsOptional() @IsEnum(DisputeCategory) category?: DisputeCategory;
  @IsString() @MaxLength(500) reason: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
}
export class ResolveDisputeDto { @IsEnum(DisputeStatus) status: DisputeStatus; @IsOptional() @IsString() @MaxLength(2000) resolution?: string; }
export class ListDisputesDto extends PaginationDto { @IsOptional() @IsEnum(DisputeStatus) status?: DisputeStatus; }
export class EscalateDisputeDto {
  @IsString() @IsNotEmpty() @MaxLength(2000) note!: string;
  @IsOptional() @IsIn(['FINANCE_ADMIN', 'SUPER_ADMIN']) escalateTo?: string;
}
