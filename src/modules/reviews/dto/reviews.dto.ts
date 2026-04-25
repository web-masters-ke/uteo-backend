import { IsString,IsOptional,IsInt,Min,Max,MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationDto } from '../../../common/dto/pagination.dto';
export class CreateReviewDto { @IsString() bookingId: string; @Type(()=>Number) @IsInt() @Min(1) @Max(5) rating: number; @IsOptional() @IsString() @MaxLength(2000) comment?: string; }
export class UpdateReviewDto { @IsOptional() @Type(()=>Number) @IsInt() @Min(1) @Max(5) rating?: number; @IsOptional() @IsString() @MaxLength(2000) comment?: string; }
export class ListReviewsDto extends PaginationDto { @IsOptional() @IsString() trainerId?: string; @IsOptional() @Type(()=>Number) @IsInt() @Min(1) @Max(5) rating?: number; @IsOptional() @IsString() reviewerId?: string; @IsOptional() @IsString() isVisible?: string; }
