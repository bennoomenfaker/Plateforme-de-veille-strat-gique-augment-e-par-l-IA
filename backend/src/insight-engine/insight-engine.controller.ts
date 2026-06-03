import { Controller, Get, Post, Param, Patch, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { InsightGeneratorService } from './insight-generator.service';
import { TrendDetectionService } from './trend-detection.service';
import { WeakSignalService } from './weak-signal.service';
import { AnomalyDetectionService } from './anomaly-detection.service';

@Controller('insight-engine')
@UseGuards(JwtAuthGuard)
export class InsightEngineController {
  constructor(
    private readonly insightGenerator: InsightGeneratorService,
    private readonly trendDetection: TrendDetectionService,
    private readonly weakSignal: WeakSignalService,
    private readonly anomalyDetection: AnomalyDetectionService,
  ) {}

  @Post('generate/:projectId')
  async generate(@Param('projectId') projectId: string) {
    const count = await this.insightGenerator.generateAll(projectId);
    return { generated: count, message: `${count} insight(s) généré(s)` };
  }

  @Get('insights/:projectId')
  async getInsights(
    @Param('projectId') projectId: string,
    @Query('type') type?: string,
    @Query('limit') limit = '50',
  ) {
    return this.insightGenerator.getInsights(projectId, type, parseInt(limit));
  }

  @Get('insights/:projectId/stats')
  async getStats(@Param('projectId') projectId: string) {
    return this.insightGenerator.getStats(projectId);
  }

  @Patch('insights/:id/read')
  async markRead(@Param('id') id: string) {
    return this.insightGenerator.markRead(id);
  }

  @Patch('insights/:id/dismiss')
  async dismiss(@Param('id') id: string) {
    return this.insightGenerator.dismissInsight(id);
  }

  @Post('trends/detect/:projectId')
  async detectTrends(@Param('projectId') projectId: string) {
    return this.trendDetection.detectTrends(projectId);
  }

  @Get('trends/:projectId')
  async getTrends(@Param('projectId') projectId: string, @Query('days') days = '90') {
    return this.trendDetection.getTrendHistory(projectId, parseInt(days));
  }

  @Post('weak-signals/detect/:projectId')
  async detectWeakSignals(@Param('projectId') projectId: string) {
    return this.weakSignal.detectWeakSignals(projectId);
  }

  @Get('weak-signals/:projectId')
  async getWeakSignals(@Param('projectId') projectId: string) {
    return this.weakSignal.getStoredSignals(projectId);
  }

  @Post('anomalies/detect/:projectId')
  async detectAnomalies(@Param('projectId') projectId: string) {
    return this.anomalyDetection.detectAnomalies(projectId);
  }
}
