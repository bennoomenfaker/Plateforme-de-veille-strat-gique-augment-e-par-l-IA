import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { InsightEngineController } from './insight-engine.controller';
import { InsightGeneratorService } from './insight-generator.service';
import { TrendDetectionService } from './trend-detection.service';
import { WeakSignalService } from './weak-signal.service';
import { AnomalyDetectionService } from './anomaly-detection.service';
import { HypothesisInsightService } from './hypothesis-insight.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  imports: [
    JwtModule.register({
      secret: 'SECRET_KEY_SUPER_FORTE',
      signOptions: { expiresIn: '1d' },
    }),
  ],
  controllers: [InsightEngineController],
  providers: [
    PrismaService,
    InsightGeneratorService,
    TrendDetectionService,
    WeakSignalService,
    AnomalyDetectionService,
    HypothesisInsightService,
  ],
  exports: [InsightGeneratorService, TrendDetectionService, WeakSignalService],
})
export class InsightEngineModule {}
