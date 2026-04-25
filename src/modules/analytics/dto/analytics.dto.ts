import { IsOptional, IsIn, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export type Period = '7d' | '30d' | '90d' | '1y';

export class PeriodQueryDto {
  @IsOptional()
  @IsIn(['7d', '30d', '90d', '1y'])
  period?: Period = '30d';
}

export class TopTrainersQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 10;
}
