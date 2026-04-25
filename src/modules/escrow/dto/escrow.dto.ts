import { IsString,IsOptional,MaxLength } from 'class-validator';
export class FundEscrowDto { @IsString() bookingId: string; }
export class ReleaseEscrowDto { @IsString() bookingId: string; @IsOptional() @IsString() @MaxLength(500) reason?: string; }
export class RefundEscrowDto { @IsString() bookingId: string; @IsOptional() @IsString() @MaxLength(500) reason?: string; }
export class FreezeEscrowDto { @IsString() bookingId: string; @IsOptional() @IsString() @MaxLength(500) reason?: string; }
