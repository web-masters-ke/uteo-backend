import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsEnum,
  Matches,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { UserRole } from '@prisma/client';

// Pan-African phone formats — accepts +XXX, 0XX, raw digits.
// Final normalisation done in service layer.
const PHONE_REGEX = /^(\+|00)?\d{7,15}$/;

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const lower = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class RegisterDto {
  @Transform(lower)
  @IsEmail({}, { message: 'Please enter a valid email address' })
  @MaxLength(255)
  email!: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Matches(PHONE_REGEX, {
    message: 'Phone must be 7-15 digits, e.g. +254712345678',
  })
  phone?: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(128)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
    message: 'Password must contain at least one letter and one number',
  })
  password!: string;

  @Transform(trim)
  @IsString()
  @MinLength(1, { message: 'First name is required' })
  @MaxLength(100)
  firstName!: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  // Trainer assignment — attach to org or mark as in-house
  @IsOptional() @IsString() firmId?: string;
  @IsOptional() @IsString() departmentId?: string;
  @IsOptional() @IsString() teamRole?: string;
  @IsOptional() isInHouse?: boolean;

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

// Login: accepts either email or phone via `identifier`. Backwards-compatible
// with `email` so existing clients keep working.
export class LoginDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  identifier?: string;

  @ValidateIf(o => !o.identifier)
  @Transform(lower)
  @IsString()
  email?: string;

  @IsString()
  @MinLength(1, { message: 'Password is required' })
  password!: string;
}

export class CheckIdentifierDto {
  @IsOptional()
  @Transform(lower)
  @IsString()
  email?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  phone?: string;
}

export class RefreshTokenDto {
  @IsString()
  refreshToken!: string;
}

export class ForgotPasswordDto {
  @Transform(lower)
  @IsEmail({}, { message: 'Please enter a valid email address' })
  email!: string;
}

export class ResetPasswordDto {
  @IsString()
  token!: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(128)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
    message: 'Password must contain at least one letter and one number',
  })
  newPassword!: string;
}
