import { IsString,IsOptional,IsEnum,IsNumber,IsInt,IsDateString,Min,Max,MaxLength,IsBoolean,IsArray,ValidateNested,IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { BookingStatus, SessionType } from '@prisma/client';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class BreakoutRoomOptionsDto {
  @Type(() => Number) @IsInt() @Min(2) @Max(10) count: number;
  @IsOptional() @IsIn(['auto', 'manual']) assignMode?: 'auto' | 'manual';
}

export class CreateBookingDto { @IsString() trainerId: string; @IsOptional() @IsString() clientId?: string; @IsOptional() @IsString() clientName?: string; @IsOptional() @IsString() clientEmail?: string; @IsOptional() @IsString() clientPhone?: string; @Type(()=>Number) @IsNumber() @Min(0) amount: number; @IsOptional() @IsString() currency?: string; @IsEnum(SessionType) sessionType: SessionType; @IsDateString() scheduledAt: string; @Type(()=>Number) @IsInt() @Min(15) duration: number; @IsOptional() @IsString() @MaxLength(500) location?: string; @IsOptional() @IsString() meetingLink?: string; @IsOptional() @IsString() @MaxLength(1000) notes?: string; @IsOptional() @IsString() courseId?: string; @IsOptional() @IsString() lessonId?: string; @IsOptional() @IsString() timezone?: string; @IsOptional() @IsArray() @IsString({ each: true }) reminders?: string[]; @IsOptional() @IsBoolean() recordSession?: boolean; @IsOptional() @IsBoolean() isGroupSession?: boolean; @IsOptional() @Type(() => Number) @IsInt() @Min(2) @Max(50) maxParticipants?: number; @IsOptional() @ValidateNested() @Type(() => BreakoutRoomOptionsDto) breakoutRooms?: BreakoutRoomOptionsDto; }
export class UpdateBookingStatusDto { @IsEnum(BookingStatus) status: BookingStatus; @IsOptional() @IsString() @MaxLength(500) reason?: string; }
export class ListBookingsDto extends PaginationDto { @IsOptional() @IsEnum(BookingStatus) status?: BookingStatus; @IsOptional() @IsString() trainerId?: string; @IsOptional() @IsString() clientId?: string; @IsOptional() @IsDateString() dateFrom?: string; @IsOptional() @IsDateString() dateTo?: string; }
