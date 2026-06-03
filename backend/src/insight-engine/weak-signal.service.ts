import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface WeakSignalCandidate {
  name: string;
  entityType: 'ENTITY' | 'TOPIC';
  currentCount: number;
  previousCount: number;
  growthRate: number;
  sourceCount: number;
  sourceNames: string[];
  firstSeenDays: number;
  mentionCount: number;
  score: number;
  subScores: {
    novelty: number;
    growth: number;
    crossSource: number;
    frequency: number;
  };
}

@Injectable()
export class WeakSignalService {
  private readonly logger = new Logger(WeakSignalService.name);
  constructor(private prisma: PrismaService) {}

  async detectWeakSignals(projectId: string): Promise<WeakSignalCandidate[]> {
    const now = new Date();
    const currentStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const previousStart = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const previousEnd = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const lookbackStart = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    const enrichedItems = await this.prisma.enrichedItem.findMany({
      where: { project_id: projectId, enriched_at: { gte: lookbackStart, lte: now } },
    });

    const allItemIds = enrichedItems.map(i => i.processed_item_id);
    const processedItems = allItemIds.length
      ? await this.prisma.processedItem.findMany({
          where: { id: { in: allItemIds } },
          select: { id: true, source_name: true },
        })
      : [];
    const itemSource = new Map(processedItems.map(p => [p.id, p.source_name]));

    type EntityAccum = { current: number; previous: number; firstSeen: Date; sources: Set<string>; allItemIds: string[] };
    const entityData = new Map<string, EntityAccum>();

    const track = (name: string, type: 'ENTITY' | 'TOPIC', enrichedAt: Date, processedId: string) => {
      if (!entityData.has(name)) {
        entityData.set(name, { current: 0, previous: 0, firstSeen: enrichedAt, sources: new Set(), allItemIds: [] });
      }
      const d = entityData.get(name)!;
      const ts = enrichedAt.getTime();
      if (ts >= currentStart.getTime() && ts <= now.getTime()) d.current++;
      else if (ts >= previousStart.getTime() && ts <= previousEnd.getTime()) d.previous++;
      if (ts < d.firstSeen.getTime()) d.firstSeen = enrichedAt;
      const src = itemSource.get(processedId);
      if (src) d.sources.add(src);
      d.allItemIds.push(enrichedAt.toISOString());
    };

    for (const item of enrichedItems) {
      const ts = new Date(item.enriched_at);
      if (Array.isArray(item.topics)) {
        for (const t of item.topics as string[]) track(t, 'TOPIC', ts, item.processed_item_id);
      }
      if (Array.isArray(item.entities)) {
        for (const e of item.entities as string[]) track(e, 'ENTITY', ts, item.processed_item_id);
      }
    }

    const nowMs = now.getTime();
    const twoWeeksMs = 14 * 24 * 60 * 60 * 1000;

    const candidates: WeakSignalCandidate[] = [];

    for (const [name, data] of entityData.entries()) {
      const currentCount = data.current;
      const previousCount = data.previous;
      const growthRate = previousCount > 0 ? (currentCount - previousCount) / previousCount : (currentCount > 0 ? 2 : 0);
      const sourceCount = data.sources.size;
      const firstSeenMs = data.firstSeen.getTime();
      const firstSeenDays = Math.round((nowMs - firstSeenMs) / (24 * 60 * 60 * 1000));
      const mentionCount = data.allItemIds.length;
      const entityType = entityData.get(name)?.current !== undefined ? (data.allItemIds.length > 0 ? 'TOPIC' as const : 'ENTITY' as const) : 'ENTITY' as const;

      if (currentCount < 1) continue;

      const noveltyScore = Math.min(1, Math.max(0, 1 - firstSeenDays / 90));
      const growthScore = Math.min(1, Math.max(0, growthRate / 5));
      const crossSourceScore = Math.min(1, sourceCount / 5);
      const frequencyScore = Math.min(1, currentCount / 10);

      const score = noveltyScore * 0.3 + growthScore * 0.3 + crossSourceScore * 0.25 + frequencyScore * 0.15;

      if (score >= 0.3) {
        candidates.push({
          name,
          entityType,
          currentCount,
          previousCount,
          growthRate: Math.round(growthRate * 100),
          sourceCount,
          sourceNames: [...data.sources],
          firstSeenDays,
          mentionCount,
          score: Math.round(score * 100) / 100,
          subScores: {
            novelty: Math.round(noveltyScore * 100) / 100,
            growth: Math.round(growthScore * 100) / 100,
            crossSource: Math.round(crossSourceScore * 100) / 100,
            frequency: Math.round(frequencyScore * 100) / 100,
          },
        });
      }
    }

    const sorted = candidates.sort((a, b) => b.score - a.score);
    await this.persistWeakSignals(projectId, sorted.slice(0, 20));
    return sorted;
  }

  private async persistWeakSignals(projectId: string, signals: WeakSignalCandidate[]) {
    await this.prisma.weakSignal.deleteMany({ where: { project_id: projectId } });

    if (!signals.length) return;

    await this.prisma.weakSignal.createMany({
      data: signals.map(s => ({
        project_id: projectId,
        entity_name: s.name,
        entity_type: s.entityType,
        score: s.score,
        novelty_score: s.subScores.novelty,
        growth_score: s.subScores.growth,
        cross_source_score: s.subScores.crossSource,
        frequency_score: s.subScores.frequency,
        explanation: this.buildExplanation(s),
        source_count: s.sourceCount,
        mention_count: s.mentionCount,
        first_seen_at: new Date(Date.now() - s.firstSeenDays * 24 * 60 * 60 * 1000),
        last_seen_at: new Date(),
      })),
    });
  }

  private buildExplanation(s: WeakSignalCandidate): string {
    const parts: string[] = [];
    if (s.entityType === 'ENTITY') parts.push(`Entité "${s.name}"`);
    else parts.push(`Sujet "${s.name}"`);

    if (s.subScores.novelty > 0.5) parts.push('récemment apparu(e)');
    if (s.subScores.growth > 0.5) parts.push(`en forte croissance (+${s.growthRate}%)`);
    if (s.subScores.crossSource > 0.5) parts.push(`présent sur ${s.sourceCount} sources`);
    parts.push(`(score: ${s.score})`);

    return parts.join(' — ');
  }

  async getStoredSignals(projectId: string) {
    return this.prisma.weakSignal.findMany({
      where: { project_id: projectId },
      orderBy: { score: 'desc' },
    });
  }
}
