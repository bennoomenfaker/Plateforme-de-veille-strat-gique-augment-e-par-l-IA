import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
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

@Module({
  imports: [
    ScheduleModule.forRoot(),
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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
