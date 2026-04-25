import { IsString, IsOptional, MaxLength } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class CreateSkillDto {
  @IsString() @MaxLength(100) name: string;
  @IsOptional() @IsString() @MaxLength(100) category?: string;
  @IsOptional() @IsString() trainerType?: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsString() icon?: string;
  @IsOptional() @IsString() level?: string;
  @IsOptional() isActive?: boolean;
  @IsOptional() @IsString() demand?: string;
  @IsOptional() tags?: string[];
}

export class UpdateSkillDto {
  @IsOptional() @IsString() @MaxLength(100) name?: string;
  @IsOptional() @IsString() @MaxLength(100) category?: string;
  @IsOptional() @IsString() trainerType?: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string;
  @IsOptional() @IsString() icon?: string;
  @IsOptional() @IsString() level?: string;
  @IsOptional() isActive?: boolean;
  @IsOptional() @IsString() demand?: string;
  @IsOptional() tags?: string[];
}

export class ListSkillsDto extends PaginationDto {
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() trainerType?: string;
}
