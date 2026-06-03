import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface TopicFreq {
  name: string;
  type: 'TOPIC' | 'ENTITY';
  currentFreq: number;
  previousFreq: number;
  variation: number;
  variationPercent: number;
  sourceCount: number;
  isEmerging: boolean;
}

@Injectable()
export class TrendDetectionService {
  private readonly logger = new Logger(TrendDetectionService.name);
  constructor(private prisma: PrismaService) {}

  async detectTrends(projectId: string): Promise<TrendDetectionResult> {
    const now = new Date();
    const currentStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const previousStart = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const previousEnd = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const enrichedItems = await this.prisma.enrichedItem.findMany({
      where: { project_id: projectId, enriched_at: { gte: previousStart, lte: now } },
    });

    const topics: Record<string, { name: string; type: 'TOPIC' | 'ENTITY'; dates: Date[]; sources: Set<string>; items: string[] }> = {};

    for (const item of enrichedItems) {
      const ts = new Date(item.enriched_at).getTime();
      const isCurrent = ts >= currentStart.getTime() && ts <= now.getTime();

      if (Array.isArray(item.topics)) {
        for (const t of item.topics as string[]) {
          if (!topics[t]) topics[t] = { name: t, type: 'TOPIC', dates: [], sources: new Set(), items: [] };
          if (isCurrent) { topics[t].dates.push(item.enriched_at); topics[t].items.push(item.id); }
        }
      }
      if (Array.isArray(item.entities)) {
        for (const e of item.entities as string[]) {
          if (!topics[e]) topics[e] = { name: e, type: 'ENTITY', dates: [], sources: new Set(), items: [] };
          if (isCurrent) { topics[e].dates.push(item.enriched_at); topics[e].items.push(item.id); }
        }
      }
    }

    const fetchSources = async (itemIds: string[]) => {
      if (!itemIds.length) return 0;
      const procs = await this.prisma.processedItem.findMany({
        where: { id: { in: itemIds } },
        select: { id: true, source_name: true },
      });
      return new Set(procs.map(p => p.source_name).filter(Boolean)).size;
    };

    const results: TopicFreq[] = [];
    for (const [name, data] of Object.entries(topics)) {
      const currentItems = enrichedItems.filter(
        i => tsInRange(i.enriched_at, currentStart, now) && (
          (Array.isArray(i.topics) && (i.topics as string[]).includes(name)) ||
          (Array.isArray(i.entities) && (i.entities as string[]).includes(name))
        ),
      );
      const previousItems = enrichedItems.filter(
        i => tsInRange(i.enriched_at, previousStart, previousEnd) && (
          (Array.isArray(i.topics) && (i.topics as string[]).includes(name)) ||
          (Array.isArray(i.entities) && (i.entities as string[]).includes(name))
        ),
      );
      const currentFreq = currentItems.length;
      const previousFreq = previousItems.length;
      const variation = currentFreq - previousFreq;
      const variationPercent = previousFreq > 0
        ? Math.round((variation / previousFreq) * 10000) / 100
        : currentFreq > 0 ? 100 : 0;
      const sourceCount = await fetchSources(currentItems.map(i => i.processed_item_id));
      const isEmerging = previousFreq === 0 && currentFreq > 0;

      if (currentFreq > 0) {
        results.push({ name, type: data.type, currentFreq, previousFreq, variation, variationPercent, sourceCount, isEmerging });
      }
    }

    const sorted = results.sort((a, b) => b.variationPercent - a.variationPercent);

    await this.saveTrendPoints(projectId, results);

    return {
      trendingUp: sorted.filter(t => t.variationPercent > 20).slice(0, 10),
      trendingDown: sorted.filter(t => t.variationPercent < -20).slice(0, 10),
      emerging: sorted.filter(t => t.isEmerging).slice(0, 10),
      topGrowing: sorted.filter(t => t.currentFreq >= 2).slice(0, 5),
    };
  }

  private async saveTrendPoints(projectId: string, topics: TopicFreq[]) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upserts = topics.map(t =>
      this.prisma.trendPoint.upsert({
        where: {
          project_id_entity_name_date: {
            project_id: projectId,
            entity_name: t.name,
            date: today,
          },
        },
        update: { frequency: t.currentFreq, source_count: t.sourceCount },
        create: {
          project_id: projectId,
          entity_name: t.name,
          entity_type: t.type,
          date: today,
          frequency: t.currentFreq,
          source_count: t.sourceCount,
        },
      }),
    );
    await this.prisma.$transaction(upserts);
  }

  async getTrendHistory(projectId: string, days = 90) {
    const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return this.prisma.trendPoint.findMany({
      where: { project_id: projectId, date: { gte: start } },
      orderBy: { date: 'asc' },
    });
  }
}

function tsInRange(d: Date, start: Date, end: Date): boolean {
  const t = new Date(d).getTime();
  return t >= start.getTime() && t <= end.getTime();
}

export interface TrendDetectionResult {
  trendingUp: TopicFreq[];
  trendingDown: TopicFreq[];
  emerging: TopicFreq[];
  topGrowing: TopicFreq[];
}
