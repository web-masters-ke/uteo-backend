import { IsString } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class AddFavoriteDto {
  @IsString() trainerId: string;
}

export class ListFavoritesDto extends PaginationDto {}
