import { Module } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { PrismaService } from '../prisma/prisma.service'; // On importe le Service directement

@Module({
  providers: [SchedulerService, PrismaService], // On déclare PrismaService ici
  exports: [SchedulerService],
})
export class SchedulerModule {}
