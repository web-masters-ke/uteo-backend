import { IsString,IsOptional,IsEnum,IsArray,IsObject,MaxLength } from 'class-validator';
import { NotificationChannel } from '@prisma/client';
import { PaginationDto } from '../../../common/dto/pagination.dto';
export class SendNotificationDto { @IsString() userId: string; @IsOptional() @IsString() type?: string; @IsEnum(NotificationChannel) channel: NotificationChannel; @IsString() @MaxLength(200) title: string; @IsString() @MaxLength(2000) message: string; @IsOptional() @IsObject() metadata?: Record<string,any>; }
export class BulkNotificationDto { @IsOptional() @IsArray() @IsString({each:true}) userIds?: string[]; @IsOptional() @IsString() role?: string; @IsOptional() @IsString() type?: string; @IsEnum(NotificationChannel) channel: NotificationChannel; @IsString() @MaxLength(200) title: string; @IsString() @MaxLength(2000) message: string; @IsOptional() @IsObject() metadata?: Record<string,any>; }
export class ListNotificationsDto extends PaginationDto { @IsOptional() @IsString() type?: string; @IsOptional() @IsEnum(NotificationChannel) channel?: NotificationChannel; }
