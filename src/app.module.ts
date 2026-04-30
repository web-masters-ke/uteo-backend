import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';

import { PrismaModule } from './prisma/prisma.module';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { HttpExceptionFilterGlobal } from './common/filters/http-exception.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';

import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { TrainersModule } from './modules/trainers/trainers.module';
import { SkillsModule } from './modules/skills/skills.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { EscrowModule } from './modules/escrow/escrow.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { CommissionsModule } from './modules/commissions/commissions.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { ChatModule } from './modules/chat/chat.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { MediaModule } from './modules/media/media.module';
import { AdminModule } from './modules/admin/admin.module';
import { DisputesModule } from './modules/disputes/disputes.module';
import { VerificationModule } from './modules/verification/verification.module';
import { TeamModule } from './modules/team/team.module';
import { DepartmentsModule } from './modules/departments/departments.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { FavoritesModule } from './modules/favorites/favorites.module';
import { FollowsModule } from './modules/follows/follows.module';
import { CoursesModule } from './modules/courses/courses.module';
import { CourseMilestonesModule } from './modules/course-milestones/course-milestones.module';
import { CertificatesModule } from './modules/certificates/certificates.module';
import { AffiliationsModule } from './modules/affiliations/affiliations.module';
import { RemindersModule } from './modules/reminders/reminders.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { PayoutsModule } from './modules/payouts/payouts.module';
import { ReportsModule } from './modules/reports/reports.module';
import { HealthModule } from './modules/health/health.module';
import { MilestonesModule } from './modules/milestones/milestones.module';
import { NeedsProfileModule } from './modules/needs-profile/needs-profile.module';
import { PerformanceModule } from './modules/performance/performance.module';
import { BreakoutRoomsModule } from './modules/breakout-rooms/breakout-rooms.module';
import { TranscriptsModule } from './modules/transcripts/transcripts.module';
import { SessionRecordingsModule } from './modules/session-recordings/session-recordings.module';
import { ReconciliationModule } from './modules/reconciliation/reconciliation.module';
import { SlaModule } from './modules/sla/sla.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { ApplicationsModule } from './modules/applications/applications.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { OffersModule } from './modules/offers/offers.module';
import { SupportModule } from './modules/support/support.module';
import { FeedModule } from './modules/feed/feed.module';
import { ProfileModule } from './modules/profile/profile.module';
import { AiModule } from './modules/ai/ai.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    HealthModule,
    AuthModule,
    UsersModule,
    TrainersModule,
    SkillsModule,
    CategoriesModule,
    BookingsModule,
    WalletModule,
    EscrowModule,
    PaymentsModule,
    SubscriptionsModule,
    CommissionsModule,
    ReviewsModule,
    ChatModule,
    NotificationsModule,
    MediaModule,
    AdminModule,
    DisputesModule,
    VerificationModule,
    TeamModule,
    DepartmentsModule,
    AnalyticsModule,
    FavoritesModule,
    FollowsModule,
    CoursesModule,
    CourseMilestonesModule,
    CertificatesModule,
    AffiliationsModule,
    RemindersModule,
    InvoicesModule,
    PayoutsModule,
    ReportsModule,
    MilestonesModule,
    NeedsProfileModule,
    PerformanceModule,
    BreakoutRoomsModule,
    TranscriptsModule,
    SessionRecordingsModule,
    ReconciliationModule,
    CompaniesModule,
    JobsModule,
    ApplicationsModule,
    TasksModule,
    OffersModule,
    SupportModule,
    FeedModule,
    ProfileModule,
    AiModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: HttpExceptionFilterGlobal },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
