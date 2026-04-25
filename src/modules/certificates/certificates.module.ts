import { forwardRef, Module } from '@nestjs/common';
import { CertificatesController } from './certificates.controller';
import { CertificatesService } from './certificates.service';
import { PrismaService } from '../../common/services/prisma.service';
import { CourseMilestonesModule } from '../course-milestones/course-milestones.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [forwardRef(() => CourseMilestonesModule), NotificationsModule],
  controllers: [CertificatesController],
  providers: [CertificatesService, PrismaService],
  exports: [CertificatesService],
})
export class CertificatesModule {}
