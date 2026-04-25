import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { IsInt, Min, Max } from 'class-validator';

export class ListMyCertificatesDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number = 20;
}

export class IssueCertificateDto {
  // If true, issue even when the grading check hasn't passed (admin/trainer override).
  @IsOptional() @IsBoolean() force?: boolean;
}

export class RevokeCertificateDto {
  @IsString() @MaxLength(2000) reason: string;
}
