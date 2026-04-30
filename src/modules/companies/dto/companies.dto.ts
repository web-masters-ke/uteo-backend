import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsEmail,
  MaxLength,
  IsNotEmpty,
} from 'class-validator';
import { CompanySize, RecruiterRole } from '@prisma/client';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class CreateCompanyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  ownerId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  industry?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  website?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsEnum(CompanySize)
  size?: CompanySize;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;

  @IsOptional() @IsString() @MaxLength(100) linkedinHandle?: string;
  @IsOptional() @IsString() @MaxLength(500) linkedinPageUrl?: string;
  @IsOptional() @IsString() @MaxLength(100) twitterHandle?: string;
  @IsOptional() @IsString() @MaxLength(500) facebookPageUrl?: string;
  @IsOptional() @IsString() @MaxLength(100) instagramHandle?: string;
}

export class UpdateCompanyDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  industry?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  website?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsEnum(CompanySize)
  size?: CompanySize;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;

  @IsOptional()
  @IsBoolean()
  isVerified?: boolean;

  @IsOptional() @IsString() @MaxLength(100) linkedinHandle?: string;
  @IsOptional() @IsString() @MaxLength(500) linkedinPageUrl?: string;
  @IsOptional() @IsString() @MaxLength(100) twitterHandle?: string;
  @IsOptional() @IsString() @MaxLength(500) facebookPageUrl?: string;
  @IsOptional() @IsString() @MaxLength(100) instagramHandle?: string;
}

export class ListCompaniesDto extends PaginationDto {
  @IsOptional()
  @IsString()
  industry?: string;

  @IsOptional()
  @IsEnum(CompanySize)
  size?: CompanySize;

  @IsOptional()
  @IsString()
  location?: string;
}

export class AddRecruiterDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  title?: string;

  @IsOptional()
  @IsEnum(RecruiterRole)
  role?: RecruiterRole;
}

export class UpdateRecruiterDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  title?: string;

  @IsOptional()
  @IsEnum(RecruiterRole)
  role?: RecruiterRole;
}
