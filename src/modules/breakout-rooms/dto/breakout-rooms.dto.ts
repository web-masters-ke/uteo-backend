import { IsArray, IsOptional, IsString, ArrayMaxSize, ArrayNotEmpty, MaxLength, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateBreakoutRoomDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  participantUserIds: string[];

  @IsOptional()
  @IsString()
  hostUserId?: string;
}

export class UpdateBreakoutParticipantsDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  add?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  remove?: string[];
}

export class AssignHostDto {
  @IsString()
  hostUserId: string;
}

/** Move a single participant from one room to another atomically. */
export class MoveParticipantDto {
  @IsString()
  userId: string;

  @IsOptional()
  @IsString()
  fromRoomId?: string;
}

/** Provision N named breakout rooms under this booking's main room. */
export class ProvisionRoomsDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  count: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(10)
  names?: string[];
}
