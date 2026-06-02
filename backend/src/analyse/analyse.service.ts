import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnalyseService {
  private readonly logger = new Logger(AnalyseService.name);
  constructor(private prisma: PrismaService) {}

  async getProjectDashboard(projectId: string) {
    const [
      rawItemsCount,
      processedItemsCount,
      enrichedItemsCount,
      enrichedItems,
      hypothesisEvals,
      project,
    ] = await Promise.all([
      this.prisma.rawItem.count({ where: { project_id: projectId } }),
      this.prisma.processedItem.count({ where: { project_id: projectId } }),
      this.prisma.enrichedItem.count({ where: { project_id: projectId } }),
      this.prisma.enrichedItem.findMany({
        where: { project_id: projectId },
        orderBy: { enriched_at: 'desc' },
        take: 100,
      }),
      this.prisma.hypothesisEvaluation.findMany({
        where: { project_id: projectId },
      }),
      this.prisma.project.findUnique({
        where: { id: projectId },
        include: {
          objectives: {
            include: {
              axes: {
                include: {
                  hypotheses: {
                    include: {
                      collection_plans: {
                        include: { sources: true, keywords: true },
                      },
                    },
                  },
                },
              },
            },
          },
          perimeters: true,
        },
      }),
    ]);

    // Sentiments
    const sentiments = { POSITIF: 0, NEGATIF: 0, NEUTRE: 0 };
    const impacts: Record<string, number> = {};
    const entityMap: Record<string, number> = {};
    const topicMap: Record<string, number> = {};
    const sourceMap: Record<string, number> = {};
    let totalRelevance = 0;
    let relevanceCount = 0;

    for (const item of enrichedItems) {
      if (item.sentiment && sentiments[item.sentiment] !== undefined)
        sentiments[item.sentiment]++;
      if (item.hypothesis_impact)
        impacts[item.hypothesis_impact] =
          (impacts[item.hypothesis_impact] || 0) + 1;
      if (item.relevance_score) {
        totalRelevance += item.relevance_score;
        relevanceCount++;
      }
      if (Array.isArray(item.entities)) {
        for (const e of item.entities as string[])
          entityMap[e] = (entityMap[e] || 0) + 1;
      }
      if (Array.isArray(item.topics)) {
        for (const t of item.topics as string[])
          topicMap[t] = (topicMap[t] || 0) + 1;
      }
    }

    const processedForSources = enrichedItems.length
      ? await this.prisma.processedItem.findMany({
          where: { id: { in: enrichedItems.map((i) => i.processed_item_id) } },
          select: { id: true, source_name: true, source_type: true },
        })
      : [];
    const processedById = Object.fromEntries(
      processedForSources.map((p) => [p.id, p]),
    );
    for (const item of enrichedItems) {
      const proc = processedById[item.processed_item_id];
      const src = proc?.source_name || proc?.source_type || 'Inconnu';
      sourceMap[src] = (sourceMap[src] || 0) + 1;
    }

    const topEntities = Object.entries(entityMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));
    const topTopics = Object.entries(topicMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name, count }));
    const topSources = Object.entries(sourceMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    // Hypotheses avec évaluations
    const hypothesesWithEval =
      project?.objectives?.flatMap(
        (obj) =>
          obj.axes?.flatMap(
            (axe) =>
              axe.hypotheses?.map((hyp) => {
                const eval_ = hypothesisEvals.find(
                  (e) => e.hypothesis_id === hyp.id,
                );
                return {
                  id: hyp.id,
                  content: hyp.content,
                  objective: obj.content,
                  axe: axe.name,
                  status: eval_?.status || 'OPEN',
                  confidence: eval_?.confidence || 0,
                  evidence_count: eval_?.evidence_count || 0,
                  support_count: eval_?.support_count || 0,
                  against_count: eval_?.against_count || 0,
                };
              }) || [],
          ) || [],
      ) || [];

    // Items enrichis avec answers
    const insightsWithAnswers = enrichedItems
      .filter((i) => i.answer)
      .slice(0, 20)
      .map((i) => ({
        id: i.id,
        answer: i.answer,
        summary: i.summary,
        sentiment: i.sentiment,
        relevance_score: i.relevance_score,
        hypothesis_impact: i.hypothesis_impact,
        confidence_score: i.confidence_score,
        enriched_at: i.enriched_at,
        topics: i.topics,
      }));

    // Données graphiques timeline (par semaine)
    const rawItemsByDate = await this.prisma.rawItem.groupBy({
      by: ['fetched_at'],
      where: { project_id: projectId },
      _count: { id: true },
      orderBy: { fetched_at: 'asc' },
    });

    return {
      overview: {
        raw_items: rawItemsCount,
        processed_items: processedItemsCount,
        enriched_items: enrichedItemsCount,
        avg_relevance:
          relevanceCount > 0
            ? Math.round((totalRelevance / relevanceCount) * 100) / 100
            : 0,
        hypotheses_count: hypothesesWithEval.length,
        supported_hypotheses: hypothesesWithEval.filter(
          (h) => h.status === 'SUPPORTED',
        ).length,
        contradicted_hypotheses: hypothesesWithEval.filter(
          (h) => h.status === 'CONTRADICTED',
        ).length,
      },
      sentiments,
      impacts,
      top_entities: topEntities,
      top_topics: topTopics,
      top_sources: topSources,
      hypotheses: hypothesesWithEval,
      insights: insightsWithAnswers,
      timeline: rawItemsByDate.slice(-30).map((d) => ({
        date: d.fetched_at,
        count: d._count.id,
      })),
    };
  }

  async getResults(projectId: string, page = 1, limit = 20, filters: any = {}) {
    const skip = (page - 1) * limit;
    const where: any = { project_id: projectId };
    if (filters.sentiment) where.sentiment = filters.sentiment;
    if (filters.minRelevance)
      where.relevance_score = { gte: parseFloat(filters.minRelevance) };
    if (filters.impact) where.hypothesis_impact = filters.impact;

    const [items, total] = await Promise.all([
      this.prisma.enrichedItem.findMany({
        where,
        orderBy: { relevance_score: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.enrichedItem.count({ where }),
    ]);

    const processedIds = items.map((i) => i.processed_item_id);
    const processedItems = processedIds.length
      ? await this.prisma.processedItem.findMany({
          where: { id: { in: processedIds } },
          select: {
            id: true,
            title: true,
            source_type: true,
            source_name: true,
            article_url: true,
          },
        })
      : [];
    const processedMap = Object.fromEntries(
      processedItems.map((p) => [p.id, p]),
    );

    const data = items.map((item) => {
      const proc = processedMap[item.processed_item_id];
      return {
        ...item,
        title: proc?.title ?? 'Sans titre',
        source_type: proc?.source_type,
        source_name: proc?.source_name,
        processed_item: proc ?? null,
      };
    });

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async getStats(projectId: string) {
    const items = await this.prisma.enrichedItem.findMany({
      where: { project_id: projectId },
    });
    const total = items.length;
    const sentiments = { POSITIF: 0, NEGATIF: 0, NEUTRE: 0 };
    const impacts: Record<string, number> = {};
    let totalRel = 0;
    for (const i of items) {
      if (i.sentiment && sentiments[i.sentiment] !== undefined)
        sentiments[i.sentiment]++;
      if (i.hypothesis_impact)
        impacts[i.hypothesis_impact] = (impacts[i.hypothesis_impact] || 0) + 1;
      if (i.relevance_score) totalRel += i.relevance_score;
    }
    return {
      total,
      total_enriched: total,
      POSITIF: sentiments.POSITIF,
      NEGATIF: sentiments.NEGATIF,
      NEUTRE: sentiments.NEUTRE,
      sentiments,
      by_impact: impacts,
      avg_relevance: total > 0 ? Math.round((totalRel / total) * 100) / 100 : 0,
    };
  }

  async analyseProject(projectId: string) {
    const enrichedIds = await this.prisma.enrichedItem.findMany({
      select: { processed_item_id: true },
    });
    const ids = enrichedIds.map((e) => e.processed_item_id);

    const pendingEnrichment = await this.prisma.processedItem.count({
      where: {
        project_id: projectId,
        processing_status: 'DONE',
        ...(ids.length > 0 ? { id: { notIn: ids } } : {}),
      },
    });

    return {
      analysed: 0,
      pending_enrichment: pendingEnrichment,
      message:
        pendingEnrichment > 0
          ? `${pendingEnrichment} item(s) en attente d'enrichissement IA — utilisez « Enrichissement IA »`
          : 'Aucun item en attente — consultez les insights enrichis',
    };
  }

  async getUserDashboard(
    userId: string,
    period = '30d',
    startDate?: string,
    endDate?: string,
    compareStart?: string,
    compareEnd?: string,
  ) {
    const now = endDate ? new Date(endDate) : new Date();
    let currentStart: Date;

    if (period === 'custom' && startDate) {
      currentStart = new Date(startDate);
    } else {
      const days = period === '7d' ? 7 : period === '90d' ? 90 : 30;
      currentStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    }

    const projectIds = await this.getUserProjectIds(userId);
    const current = await this.computeDashboardData(projectIds, currentStart, now);

    let previous = null;
    if (compareStart && compareEnd) {
      previous = await this.computeDashboardData(
        projectIds,
        new Date(compareStart),
        new Date(compareEnd),
      );
    }

    return { current, previous, period, startDate, endDate };
  }

  private async getUserProjectIds(userId: string): Promise<string[]> {
    const individual = await this.prisma.project.findMany({
      where: { owner_user_id: userId, is_deleted: false, isActive: true },
      select: { id: true },
    });
    const memberships = await this.prisma.membreOrganisation.findMany({
      where: { user_id: userId, statut: 'ACTIF' },
      select: { organisation_id: true },
    });
    let org: { id: string }[] = [];
    if (memberships.length) {
      org = await this.prisma.project.findMany({
        where: {
          organisation_id: { in: memberships.map((m) => m.organisation_id) },
          is_deleted: false,
          isActive: true,
        },
        select: { id: true },
      });
    }
    return [...individual, ...org].map((p) => p.id);
  }

  private async computeDashboardData(projectIds: string[], start: Date, end: Date) {
    const enrichedItems = await this.prisma.enrichedItem.findMany({
      where: {
        project_id: { in: projectIds },
        enriched_at: { gte: start, lte: end },
      },
    });

    const sentiments = { POSITIF: 0, NEGATIF: 0, NEUTRE: 0 };
    const entityFreq: Record<string, number> = {};
    const topicFreq: Record<string, number> = {};
    const entityItems: Record<string, Set<string>> = {};
    let totalRelevance = 0;

    for (const item of enrichedItems) {
      if (item.sentiment && sentiments[item.sentiment] !== undefined)
        sentiments[item.sentiment]++;

      if (item.relevance_score) totalRelevance += item.relevance_score;

      if (Array.isArray(item.entities)) {
        for (const e of item.entities as string[]) {
          entityFreq[e] = (entityFreq[e] || 0) + 1;
          if (!entityItems[e]) entityItems[e] = new Set();
          entityItems[e].add(item.id);
        }
      }
      if (Array.isArray(item.topics)) {
        for (const t of item.topics as string[]) {
          topicFreq[t] = (topicFreq[t] || 0) + 1;
        }
      }
    }

    const wordCloud = [
      ...Object.entries(entityFreq).map(([text, value]) => ({ text, value })),
      ...Object.entries(topicFreq).map(([text, value]) => ({ text, value })),
    ]
      .sort((a, b) => b.value - a.value)
      .slice(0, 50);

    const entityNames = Object.keys(entityFreq);
    const entityNodes = entityNames.slice(0, 30).map((name, i) => ({
      id: `e-${i}`,
      name,
      count: entityFreq[name],
    }));

    const topEntitySet = new Set(entityNodes.map((n) => n.name));
    const entityEdges: { source: string; target: string; weight: number }[] = [];
    const topNames = entityNodes.map((n) => n.name);
    for (let i = 0; i < topNames.length; i++) {
      for (let j = i + 1; j < topNames.length; j++) {
        const a = topNames[i];
        const b = topNames[j];
        const shared = [...(entityItems[a] || [])].filter((id) =>
          (entityItems[b] || new Set()).has(id),
        ).length;
        if (shared > 0) {
          entityEdges.push({
            source: `e-${i}`,
            target: `e-${j}`,
            weight: shared,
          });
        }
      }
    }

    const enrichedCount = enrichedItems.length;
    const avgRelevance = enrichedCount > 0 ? totalRelevance / enrichedCount : 0;

    return {
      overview: {
        total_enriched: enrichedCount,
        avg_relevance: Math.round(avgRelevance * 100) / 100,
        unique_entities: entityNames.length,
        sentiments_total: sentiments.POSITIF + sentiments.NEGATIF + sentiments.NEUTRE,
      },
      sentiments,
      wordCloud,
      entityNetwork: { nodes: entityNodes, edges: entityEdges },
    };
  }

  private detectSentiment(text: string): string {
    const pos = [
      'croissance',
      'succès',
      'innovation',
      'hausse',
      'progression',
      'positif',
      'avancée',
      'opportunité',
    ];
    const neg = [
      'crise',
      'baisse',
      'problème',
      'échec',
      'risque',
      'menace',
      'déclin',
      'perte',
    ];
    const lower = text.toLowerCase();
    const posCount = pos.filter((w) => lower.includes(w)).length;
    const negCount = neg.filter((w) => lower.includes(w)).length;
    if (posCount > negCount) return 'POSITIF';
    if (negCount > posCount) return 'NEGATIF';
    return 'NEUTRE';
  }

  private detectTrend(text: string): string {
    const lower = text.toLowerCase();
    if (
      ['augmente', 'croît', 'hausse', 'progression', 'monte'].some((w) =>
        lower.includes(w),
      )
    )
      return 'HAUSSE';
    if (
      ['diminue', 'baisse', 'décline', 'chute', 'recul'].some((w) =>
        lower.includes(w),
      )
    )
      return 'BAISSE';
    return 'STABLE';
  }

  private extractKeywords(text: string): string[] {
    const stopWords = [
      'le',
      'la',
      'les',
      'de',
      'du',
      'des',
      'un',
      'une',
      'et',
      'en',
      'à',
      'que',
      'qui',
      'pour',
      'par',
    ];
    const words = text
      .toLowerCase()
      .replace(/[^a-zA-ZÀ-ÿ\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 4 && !stopWords.includes(w));
    const freq: Record<string, number> = {};
    for (const w of words) freq[w] = (freq[w] || 0) + 1;
    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([w]) => w);
  }
}
