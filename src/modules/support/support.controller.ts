import { Controller, Get, Post, Patch, Param, Body } from '@nestjs/common';
import { SupportService } from './support.service';
import { CreateTicketDto, UpdateTicketDto, ReplyTicketDto } from './dto/support.dto';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';

@Controller('support/tickets')
export class SupportController {
  constructor(private readonly svc: SupportService) {}

  @Post()
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateTicketDto) {
    return this.svc.create(user.id, dto);
  }

  @Get()
  list(@CurrentUser() user: JwtUser) {
    return this.svc.list(user.id, user.role);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.svc.findOne(id, user.id, user.role);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: UpdateTicketDto,
  ) {
    return this.svc.update(id, user.id, dto, user.role);
  }

  @Post(':id/replies')
  reply(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: ReplyTicketDto,
  ) {
    return this.svc.reply(id, user.id, dto, user.role);
  }
}
