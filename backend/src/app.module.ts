import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { OrganisationsModule } from './organisations/organisations.module';
import { ProjectsModule } from './projects/projects.module';
import { SourcesModule } from './sources/sources.module';
import { EtlModule } from './etl/etl.module';
import { AnalyseModule } from './analyse/analyse.module';
import { AlertesModule } from './alertes/alertes.module';
import { AdminModule } from './admin/admin.module';
import { FoldersModule } from './folders/folders.module';
import { ObjectivesModule } from './objectives/objectives.module';
import { AxesModule } from './axes/axes.module';
import { HypothesesModule } from './hypotheses/hypotheses.module';
import { PerimetersModule } from './perimeters/perimeters.module';
import { CollectionPlansModule } from './collection-plans/collection-plans.module';
import { StakeholdersModule } from './stakeholders/stakeholders.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { AiEnrichmentModule } from './ai-enrichment/ai-enrichment.module';
import { AiCopilotModule } from './ai-copilot/ai-copilot.module';
import { CollectionEngineModule } from './collection-engine/collection-engine.module';
import { UploadModule } from './upload/upload.module'; // ← AJOUTÉ
import { ProcessingModule } from './processing/processing.module';
import { CommonModule } from './common/common.module';
import { ReportsModule } from './reports/reports.module';
import { InsightEngineModule } from './insight-engine/insight-engine.module';

@Module({
  imports: [
    CommonModule,
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'auth', ttl: 60000, limit: 20 }],
      errorMessage: 'Too many requests, try again later',
    }),
    AuthModule,
    OrganisationsModule,
    ProjectsModule,
    SourcesModule,
    EtlModule,
    AnalyseModule,
    AlertesModule,
    AdminModule,
    FoldersModule,
    ObjectivesModule,
    AxesModule,
    HypothesesModule,
    PerimetersModule,
    CollectionPlansModule,
    StakeholdersModule,
    SchedulerModule,
    CollectionEngineModule,
    AiEnrichmentModule,
    AiCopilotModule,
    UploadModule,
    ProcessingModule,
    ReportsModule,
    InsightEngineModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
