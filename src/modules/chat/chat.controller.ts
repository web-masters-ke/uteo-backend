import { Controller, Get, Post, Patch, Delete, Param, Body, Query } from '@nestjs/common';
import { ChatService } from './chat.service';
import { CreateConversationDto, SendMessageDto, UpdateMessageFileDto, ListConversationsDto, ListMessagesDto, DeleteMessageDto } from './dto/chat.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
@Controller('conversations')
export class ChatController {
  constructor(private readonly svc: ChatService) {}
  @Post() createOrGet(@CurrentUser('id') uid: string, @Body() dto: CreateConversationDto) { return this.svc.createOrGet(uid, dto); }
  @Get() list(@CurrentUser('id') uid: string, @Query() dto: ListConversationsDto) { return this.svc.listConversations(uid, dto); }
  @Get(':id') get(@Param('id') id: string, @CurrentUser('id') uid: string) { return this.svc.getConversation(id, uid); }
  @Post(':id/messages') send(@Param('id') id: string, @CurrentUser('id') uid: string, @Body() dto: SendMessageDto) { return this.svc.sendMessage(id, uid, dto); }
  @Get(':id/messages') messages(@Param('id') id: string, @CurrentUser('id') uid: string, @Query() dto: ListMessagesDto) { return this.svc.getMessages(id, uid, dto); }
  @Patch('messages/:id/file') updateFile(@Param('id') id: string, @CurrentUser('id') uid: string, @Body() dto: UpdateMessageFileDto) { return this.svc.updateMessageFile(id, uid, dto); }
  @Patch('messages/:id/read') markRead(@Param('id') id: string, @CurrentUser('id') uid: string) { return this.svc.markAsRead(id, uid); }
  @Delete('messages/:id') deleteMessage(@Param('id') id: string, @CurrentUser('id') uid: string, @Body() dto: DeleteMessageDto) { return this.svc.deleteMessage(id, uid, dto.scope); }
}
