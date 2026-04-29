import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsEnum,
  Matches,
} from 'class-validator';
import { UserRole } from '@prisma/client';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  @Matches(/^$|^(\+?254|0)\d{9}$/, { message: 'Invalid Kenyan phone number' })
  phone?: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  // Trainer assignment — attach to org or mark as in-house
  @IsOptional() @IsString() firmId?: string;          // Attach trainer to this org
  @IsOptional() @IsString() departmentId?: string;    // Assign to department within org
  @IsOptional() @IsString() teamRole?: string;        // CONSULTANT, ASSOCIATE, etc.
  @IsOptional() isInHouse?: boolean;                  // In-house Uteo trainer

  // Client assignment — attach to specific trainer
  @IsOptional() @IsString() assignedTrainerId?: string;

  // Trainer profile fields
  @IsOptional() @IsString() firmName?: string;
  @IsOptional() @IsString() trainerType?: string;
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsString() specialization?: string;
  @IsOptional() @IsString() bio?: string;
  @IsOptional() hourlyRate?: number;
  @IsOptional() experience?: number;
  @IsOptional() @IsString() county?: string;
  @IsOptional() @IsString() location?: string;

  // Skills and credentials (for admin-created trainers)
  @IsOptional() skills?: string[];
  @IsOptional() credentials?: { type: string; name: string; issuer?: string; year?: string; documentUrl?: string }[];
}

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(1)
  password: string;
}

export class RefreshTokenDto {
  @IsString()
  refreshToken: string;
}

export class ForgotPasswordDto {
  @IsEmail()
  email: string;
}

export class ResetPasswordDto {
  @IsString()
  token: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword: string;
}
