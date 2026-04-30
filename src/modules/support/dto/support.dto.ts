import { IsString, IsOptional, IsEnum, MaxLength, IsNotEmpty } from 'class-validator';
import { SupportPriority, SupportStatus } from '@prisma/client';

export class CreateTicketDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  subject: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string;

  @IsOptional()
  @IsEnum(SupportPriority)
  priority?: SupportPriority;
}

export class UpdateTicketDto {
  @IsOptional()
  @IsEnum(SupportStatus)
  status?: SupportStatus;

  @IsOptional()
  @IsEnum(SupportPriority)
  priority?: SupportPriority;
}

export class ReplyTicketDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  body: string;
}
