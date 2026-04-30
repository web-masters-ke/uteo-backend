import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { OffersService } from './offers.service';
import {
  CreateOfferDto,
  UpdateOfferDto,
  SignOfferDto,
  DeclineOfferDto,
  ListOffersDto,
} from './dto/offers.dto';
import { CurrentUser, JwtUser } from '../../common/decorators/current-user.decorator';

function getIp(req: Request): string {
  const xff = (req.headers['x-forwarded-for'] as string) || '';
  return xff.split(',')[0]?.trim() || (req.ip ?? '');
}

@Controller('offers')
export class OffersController {
  constructor(private readonly svc: OffersService) {}

  @Post()
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateOfferDto) {
    return this.svc.create(user.id, user.role, dto);
  }

  @Get()
  findAll(@CurrentUser() user: JwtUser, @Query() dto: ListOffersDto) {
    return this.svc.findAll(user.id, user.role, dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: JwtUser, @Req() req: Request) {
    return this.svc.findOne(id, user.id, user.role, getIp(req), req.headers['user-agent']);
  }

  @Patch(':id')
  update(@Param('id') id: string, @CurrentUser() user: JwtUser, @Body() dto: UpdateOfferDto) {
    return this.svc.update(id, user.id, user.role, dto);
  }

  @Post(':id/send')
  send(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.svc.send(id, user.id, user.role);
  }

  @Post(':id/sign')
  sign(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: SignOfferDto,
    @Req() req: Request,
  ) {
    return this.svc.sign(id, user.id, dto, getIp(req), req.headers['user-agent']);
  }

  @Post(':id/decline')
  decline(@Param('id') id: string, @CurrentUser() user: JwtUser, @Body() dto: DeclineOfferDto) {
    return this.svc.decline(id, user.id, dto);
  }

  @Post(':id/revoke')
  revoke(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.svc.revoke(id, user.id, user.role);
  }
}
