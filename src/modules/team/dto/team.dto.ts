import { IsString, IsOptional, IsEnum, IsBoolean, IsUUID } from 'class-validator';
import { TeamMemberRole } from '@prisma/client';

export class InviteDto {
  @IsString()
  email: string;

  @IsEnum(TeamMemberRole)
  role: TeamMemberRole;

  @IsOptional()
  @IsString()
  title?: string;
}

export class UpdateMemberDto {
  @IsOptional()
  @IsEnum(TeamMemberRole)
  role?: TeamMemberRole;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  specialization?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class AssignBookingDto {
  @IsUUID()
  bookingId: string;
}
