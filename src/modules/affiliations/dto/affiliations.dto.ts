import { IsString, IsOptional, IsBoolean, IsDateString, MaxLength } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class CreateAffiliationDto {
  @IsString() @MaxLength(300) institutionName: string;
  @IsOptional() @IsString() @MaxLength(200) role?: string;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() endDate?: string;
  @IsOptional() @IsBoolean() isCurrent?: boolean;
  @IsOptional() @IsString() documentUrl?: string;
}

export class UpdateAffiliationDto {
  @IsOptional() @IsString() @MaxLength(300) institutionName?: string;
  @IsOptional() @IsString() @MaxLength(200) role?: string;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() endDate?: string;
  @IsOptional() @IsBoolean() isCurrent?: boolean;
  @IsOptional() @IsString() documentUrl?: string;
}

export class ListAffiliationsDto extends PaginationDto {}
