import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TrendDetectionService } from './trend-detection.service';
import { WeakSignalService } from './weak-signal.service';
import { AnomalyDetectionService } from './anomaly-detection.service';
import { HypothesisInsightService } from './hypothesis-insight.service';

interface GeneratedInsight {
  type: 'TREND' | 'ANOMALY' | 'COMPETITOR' | 'HYPOTHESIS' | 'WEAK_SIGNAL';
  title: string;
  description: string;
  confidence: number;
  evidenceCount: number;
  metadata?: Record<string, any>;
}

@Injectable()
export class InsightGeneratorService {
  private readonly logger = new Logger(InsightGeneratorService.name);
  constructor(
    private prisma: PrismaService,
    private trendDetection: TrendDetectionService,
    private weakSignal: WeakSignalService,
    private anomalyDetection: AnomalyDetectionService,
    private hypothesisInsight: HypothesisInsightService,
  ) {}

  async generateAll(projectId: string): Promise<number> {
    const insights: GeneratedInsight[] = [];

    const trendResult = await this.trendDetection.detectTrends(projectId);
    for (const t of trendResult.trendingUp) {
      insights.push({
        type: 'TREND',
        title: `Hausse du sujet « ${t.name} »`,
        description: `Le sujet "${t.name}" augmente de ${t.variationPercent}% (${t.currentFreq} occurrences, ${t.sourceCount} sources).`,
        confidence: Math.min(1, t.currentFreq / 20),
        evidenceCount: t.currentFreq,
        metadata: { entityName: t.name, entityType: t.type, variation: t.variationPercent, currentFreq: t.currentFreq, sourceCount: t.sourceCount },
      });
    }
    for (const t of trendResult.trendingDown) {
      insights.push({
        type: 'TREND',
        title: `Baisse du sujet « ${t.name} »`,
        description: `Le sujet "${t.name}" diminue de ${Math.abs(t.variationPercent)}% (${t.currentFreq} occurrences récentes).`,
        confidence: Math.min(1, t.currentFreq / 10),
        evidenceCount: t.currentFreq,
        metadata: { entityName: t.name, entityType: t.type, variation: t.variationPercent, currentFreq: t.currentFreq },
      });
    }
    for (const t of trendResult.emerging) {
      insights.push({
        type: 'TREND',
        title: `Émergence du sujet « ${t.name} »`,
        description: `Le sujet "${t.name}" est nouveau et apparaît ${t.currentFreq} fois sur ${t.sourceCount} source(s).`,
        confidence: 0.5,
        evidenceCount: t.currentFreq,
        metadata: { entityName: t.name, entityType: t.type, sourceCount: t.sourceCount, currentFreq: t.currentFreq },
      });
    }

    const anomalies = await this.anomalyDetection.detectAnomalies(projectId);
    for (const a of anomalies) {
      insights.push({
        type: 'ANOMALY',
        title: a.title,
        description: a.description,
        confidence: a.severity === 'HIGH' ? 0.9 : 0.6,
        evidenceCount: Math.round(a.metricValue),
        metadata: { severity: a.severity, deviation: a.deviation, metricValue: a.metricValue, baselineValue: a.baselineValue },
      });
    }

    const weakSignals = await this.weakSignal.detectWeakSignals(projectId);
    for (const s of weakSignals.slice(0, 5)) {
      insights.push({
        type: 'WEAK_SIGNAL',
        title: `Signal faible : ${s.name}`,
        description: s.sourceNames.length > 0
          ? `"${s.name}" émerge avec un score de ${s.score} — croissance +${s.growthRate}%, présent sur ${s.sourceCount} sources (${s.sourceNames.slice(0, 3).join(', ')}).`
          : `"${s.name}" émerge avec un score de ${s.score} — croissance +${s.growthRate}%, ${s.sourceCount} source(s).`,
        confidence: s.score,
        evidenceCount: s.mentionCount,
        metadata: { entityName: s.name, entityType: s.entityType, score: s.score, growthRate: s.growthRate, sourceCount: s.sourceCount },
      });
    }

    const hypothesisResults = await this.hypothesisInsight.analyzeHypotheses(projectId);
    for (const h of hypothesisResults) {
      if (h.insight) {
        insights.push({
          type: 'HYPOTHESIS',
          title: `Mise à jour hypothèse : ${h.hypothesisContent.slice(0, 60)}...`,
          description: h.insight,
          confidence: h.confidence,
          evidenceCount: h.evidenceCount,
          metadata: { hypothesisId: h.hypothesisId, supportCount: h.supportCount, againstCount: h.againstCount },
        });
      }
    }

    await this.persistInsights(projectId, insights);
    return insights.length;
  }

  private async persistInsights(projectId: string, insights: GeneratedInsight[]) {
    await this.prisma.insight.createMany({
      data: insights.map(i => ({
        project_id: projectId,
        type: i.type,
        title: i.title,
        description: i.description,
        confidence: i.confidence,
        evidence_count: i.evidenceCount,
        metadata: i.metadata || undefined,
      })),
    });
  }

  async getInsights(projectId: string, type?: string, limit = 50) {
    const where: any = { project_id: projectId, is_dismissed: false };
    if (type) where.type = type;
    return this.prisma.insight.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: limit,
    });
  }

  async dismissInsight(insightId: string) {
    return this.prisma.insight.update({
      where: { id: insightId },
      data: { is_dismissed: true },
    });
  }

  async markRead(insightId: string) {
    return this.prisma.insight.update({
      where: { id: insightId },
      data: { is_read: true },
    });
  }

  async getStats(projectId: string) {
    const [total, byType, unread] = await Promise.all([
      this.prisma.insight.count({ where: { project_id: projectId, is_dismissed: false } }),
      this.prisma.insight.groupBy({
        by: ['type'],
        where: { project_id: projectId, is_dismissed: false },
        _count: { id: true },
      }),
      this.prisma.insight.count({ where: { project_id: projectId, is_dismissed: false, is_read: false } }),
    ]);
    return { total, unread, byType: byType.reduce((acc, t) => ({ ...acc, [t.type]: t._count.id }), {}) };
  }
}
