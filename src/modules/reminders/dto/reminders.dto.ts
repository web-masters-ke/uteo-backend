import { IsString, IsOptional, IsEnum, IsDateString, IsObject, MaxLength } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export enum ReminderTypeEnum {
  BOOKING_REMINDER = 'BOOKING_REMINDER',
  FOLLOW_UP = 'FOLLOW_UP',
  PAYMENT_DUE = 'PAYMENT_DUE',
  REVIEW_REQUEST = 'REVIEW_REQUEST',
  CUSTOM = 'CUSTOM',
}

export enum ReminderChannelEnum {
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  PUSH = 'PUSH',
  IN_APP = 'IN_APP',
}

export enum ReminderStatusEnum {
  SCHEDULED = 'SCHEDULED',
  SENT = 'SENT',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export class CreateReminderDto {
  @IsEnum(ReminderTypeEnum) type: ReminderTypeEnum;
  @IsEnum(ReminderChannelEnum) channel: ReminderChannelEnum;
  @IsString() @MaxLength(300) title: string;
  @IsString() @MaxLength(2000) message: string;
  @IsDateString() scheduledAt: string;
  @IsOptional() @IsObject() metadata?: Record<string, any>;
}

export class ListRemindersDto extends PaginationDto {
  @IsOptional() @IsEnum(ReminderStatusEnum) status?: ReminderStatusEnum;
  @IsOptional() @IsEnum(ReminderTypeEnum) type?: ReminderTypeEnum;
}
