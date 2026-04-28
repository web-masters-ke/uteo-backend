import { Module } from '@nestjs/common';
import { CoursesController } from './courses.controller';
import { LessonsController, SubmissionsController } from './lessons.controller';
import { CoursesService } from './courses.service';
import { WalletModule } from '../wallet/wallet.module';
import { S3Service } from '../../common/services/s3.service';

@Module({
  imports: [WalletModule],
  controllers: [CoursesController, LessonsController, SubmissionsController],
  providers: [CoursesService, S3Service],
  exports: [CoursesService],
})
export class CoursesModule {}
