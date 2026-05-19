import { Module } from '@nestjs/common';
import { ProcessingService } from './processing.service';
import { ProcessingController } from './processing.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  providers: [ProcessingService, PrismaService],
  controllers: [ProcessingController],
  exports: [ProcessingService],
})
export class ProcessingModule {}
