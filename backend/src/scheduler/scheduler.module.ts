// backend/src/scheduler/scheduler.module.ts
import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SchedulerService } from './scheduler.service';
import { PrismaService } from '../prisma/prisma.service';
import { CollectionEngineModule } from '../collection-engine/collection-engine.module';

@Module({
  imports: [ScheduleModule.forRoot(), CollectionEngineModule],
  providers: [SchedulerService, PrismaService],
})
export class SchedulerModule {}
