import { IsDateString } from 'class-validator';

export class ReconciliationQueryDto {
  @IsDateString()
  from: string;

  @IsDateString()
  to: string;
}
