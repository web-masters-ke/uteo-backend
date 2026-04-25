import { Controller, Get, Post, Delete, Param, Body, Query } from '@nestjs/common';
import { FavoritesService } from './favorites.service';
import { AddFavoriteDto, ListFavoritesDto } from './dto/favorites.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('favorites')
export class FavoritesController {
  constructor(private readonly svc: FavoritesService) {}

  @Post()
  add(@CurrentUser('id') uid: string, @Body() dto: AddFavoriteDto) {
    return this.svc.add(uid, dto);
  }

  @Delete(':trainerId')
  remove(@CurrentUser('id') uid: string, @Param('trainerId') trainerId: string) {
    return this.svc.remove(uid, trainerId);
  }

  @Get()
  findAll(@CurrentUser('id') uid: string, @Query() dto: ListFavoritesDto) {
    return this.svc.findAll(uid, dto);
  }

  @Get('check/:trainerId')
  check(@CurrentUser('id') uid: string, @Param('trainerId') trainerId: string) {
    return this.svc.check(uid, trainerId);
  }
}
