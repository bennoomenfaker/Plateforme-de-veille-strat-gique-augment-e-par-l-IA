import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface Anomaly {
  type: 'VOLUME_SPIKE' | 'SENTIMENT_SHIFT' | 'VOLUME_EXPLOSION';
  title: string;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  metricValue: number;
  baselineValue: number;
  deviation: number;
  date: Date;
}

@Injectable()
export class AnomalyDetectionService {
  private readonly logger = new Logger(AnomalyDetectionService.name);
  constructor(private prisma: PrismaService) {}

  async detectAnomalies(projectId: string): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = [];

    const volumeAnomaly = await this.detectVolumeSpike(projectId);
    if (volumeAnomaly) anomalies.push(volumeAnomaly);

    const sentimentAnomaly = await this.detectSentimentShift(projectId);
    if (sentimentAnomaly) anomalies.push(sentimentAnomaly);

    const explosionAnomaly = await this.detectVolumeExplosion(projectId);
    if (explosionAnomaly) anomalies.push(explosionAnomaly);

    return anomalies;
  }

  private async detectVolumeSpike(projectId: string): Promise<Anomaly | null> {
    const now = new Date();
    const currentStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const baselineStart = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const baselineEnd = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [currentCount, baselineCount, totalDays] = await Promise.all([
      this.prisma.enrichedItem.count({
        where: { project_id: projectId, enriched_at: { gte: currentStart, lte: now } },
      }),
      this.prisma.enrichedItem.count({
        where: { project_id: projectId, enriched_at: { gte: baselineStart, lte: baselineEnd } },
      }),
      this.prisma.enrichedItem.findMany({
        where: { project_id: projectId, enriched_at: { gte: baselineStart, lte: now } },
        select: { enriched_at: true },
      }),
    ]);

    const uniqueDays = new Set(totalDays.map(d => d.enriched_at.toISOString().slice(0, 10))).size || 1;
    const dailyAvg = baselineCount / uniqueDays;
    const currentDaily = currentCount / 7;

    if (dailyAvg > 0 && currentDaily > dailyAvg * 1.5) {
      const deviation = Math.round(((currentDaily - dailyAvg) / dailyAvg) * 100);
      return {
        type: 'VOLUME_SPIKE',
        title: `Pic d'activité détecté`,
        description: `Volume en hausse de ${deviation}% cette semaine (${currentCount} articles vs ${Math.round(dailyAvg * 7)} attendus)`,
        severity: deviation > 200 ? 'HIGH' : deviation > 100 ? 'MEDIUM' : 'LOW',
        metricValue: currentCount,
        baselineValue: Math.round(dailyAvg * 7),
        deviation,
        date: now,
      };
    }
    return null;
  }

  private async detectSentimentShift(projectId: string): Promise<Anomaly | null> {
    const now = new Date();
    const currentStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const previousStart = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const previousEnd = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const [currentItems, previousItems] = await Promise.all([
      this.prisma.enrichedItem.findMany({
        where: { project_id: projectId, enriched_at: { gte: currentStart, lte: now } },
        select: { sentiment: true },
      }),
      this.prisma.enrichedItem.findMany({
        where: { project_id: projectId, enriched_at: { gte: previousStart, lte: previousEnd } },
        select: { sentiment: true },
      }),
    ]);

    const calcRatio = (items: { sentiment: string | null }[]) => {
      const total = items.length || 1;
      const neg = items.filter(i => i.sentiment === 'NEGATIF').length;
      return neg / total;
    };

    const currentRatio = calcRatio(currentItems);
    const previousRatio = calcRatio(previousItems);

    if (previousRatio > 0 && Math.abs(currentRatio - previousRatio) > 0.2) {
      const shift = Math.round((currentRatio - previousRatio) * 100);
      return {
        type: 'SENTIMENT_SHIFT',
        title: shift > 0 ? 'Dégradation du sentiment' : 'Amélioration du sentiment',
        description: shift > 0
          ? `Proportion de contenu négatif en hausse de ${shift} points`
          : `Proportion de contenu négatif en baisse de ${Math.abs(shift)} points`,
        severity: Math.abs(shift) > 30 ? 'HIGH' : 'MEDIUM',
        metricValue: Math.round(currentRatio * 100),
        baselineValue: Math.round(previousRatio * 100),
        deviation: shift,
        date: now,
      };
    }
    return null;
  }

  private async detectVolumeExplosion(projectId: string): Promise<Anomaly | null> {
    const now = new Date();
    const todayStart = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
    const yesterdayStart = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    const yesterdayEnd = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);

    const [todayCount, yesterdayCount] = await Promise.all([
      this.prisma.enrichedItem.count({
        where: { project_id: projectId, enriched_at: { gte: todayStart, lte: now } },
      }),
      this.prisma.enrichedItem.count({
        where: { project_id: projectId, enriched_at: { gte: yesterdayStart, lte: yesterdayEnd } },
      }),
    ]);

    if (yesterdayCount > 0 && todayCount > yesterdayCount * 3) {
      const deviation = Math.round(((todayCount - yesterdayCount) / yesterdayCount) * 100);
      return {
        type: 'VOLUME_EXPLOSION',
        title: 'Explosion de volume',
        description: `Volume +${deviation}% aujourd'hui (${todayCount} vs ${yesterdayCount} hier)`,
        severity: deviation > 500 ? 'HIGH' : 'MEDIUM',
        metricValue: todayCount,
        baselineValue: yesterdayCount,
        deviation,
        date: now,
      };
    }
    return null;
  }
}
