import { IsString,IsOptional,IsArray,IsEnum,MaxLength } from 'class-validator';
import { ConversationType } from '@prisma/client';
import { PaginationDto } from '../../../common/dto/pagination.dto';
export class CreateConversationDto { @IsEnum(ConversationType) type: ConversationType; @IsArray() @IsString({each:true}) participantIds: string[]; @IsOptional() @IsString() bookingId?: string; }
export class SendMessageDto { @IsString() @MaxLength(5000) content: string; @IsOptional() @IsString() messageType?: string; @IsOptional() @IsString() fileUrl?: string; @IsOptional() @IsString() replyToId?: string; }
export class DeleteMessageDto { @IsOptional() @IsString() scope?: 'me' | 'everyone'; }
export class UpdateMessageFileDto { @IsString() fileUrl: string; }
export class ListConversationsDto extends PaginationDto {}
export class ListMessagesDto extends PaginationDto {}
