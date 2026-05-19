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
      this.prisma.hypothesisEvaluation.findMany({ where: { project_id: projectId } }),
      this.prisma.project.findUnique({
        where: { id: projectId },
        include: {
          objectives: {
            include: {
              axes: {
                include: {
                  hypotheses: {
                    include: { collection_plans: { include: { sources: true, keywords: true } } },
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
      if (item.sentiment && sentiments[item.sentiment] !== undefined) sentiments[item.sentiment]++;
      if (item.hypothesis_impact) impacts[item.hypothesis_impact] = (impacts[item.hypothesis_impact] || 0) + 1;
      if (item.relevance_score) { totalRelevance += item.relevance_score; relevanceCount++; }
      if (Array.isArray(item.entities)) {
        for (const e of item.entities as string[]) entityMap[e] = (entityMap[e] || 0) + 1;
      }
      if (Array.isArray(item.topics)) {
        for (const t of item.topics as string[]) topicMap[t] = (topicMap[t] || 0) + 1;
      }
      
    }

    const topEntities = Object.entries(entityMap).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, count]) => ({ name, count }));
    const topTopics = Object.entries(topicMap).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, count]) => ({ name, count }));
    const topSources = Object.entries(sourceMap).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count }));

    // Hypotheses avec évaluations
    const hypothesesWithEval = project?.objectives?.flatMap(obj =>
      obj.axes?.flatMap(axe =>
        axe.hypotheses?.map(hyp => {
          const eval_ = hypothesisEvals.find(e => e.hypothesis_id === hyp.id);
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
        }) || []
      ) || []
    ) || [];

    // Items enrichis avec answers
    const insightsWithAnswers = enrichedItems
      .filter(i => i.answer)
      .slice(0, 20)
      .map(i => ({
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
        avg_relevance: relevanceCount > 0 ? Math.round((totalRelevance / relevanceCount) * 100) / 100 : 0,
        hypotheses_count: hypothesesWithEval.length,
        supported_hypotheses: hypothesesWithEval.filter(h => h.status === 'SUPPORTED').length,
        contradicted_hypotheses: hypothesesWithEval.filter(h => h.status === 'CONTRADICTED').length,
      },
      sentiments,
      impacts,
      top_entities: topEntities,
      top_topics: topTopics,
      top_sources: topSources,
      hypotheses: hypothesesWithEval,
      insights: insightsWithAnswers,
      timeline: rawItemsByDate.slice(-30).map(d => ({
        date: d.fetched_at,
        count: d._count.id,
      })),
    };
  }

  async getResults(projectId: string, page = 1, limit = 20, filters: any = {}) {
    const skip = (page - 1) * limit;
    const where: any = { project_id: projectId };
    if (filters.sentiment) where.sentiment = filters.sentiment;
    if (filters.minRelevance) where.relevance_score = { gte: parseFloat(filters.minRelevance) };
    if (filters.impact) where.hypothesis_impact = filters.impact;

    const [data, total] = await Promise.all([
      this.prisma.enrichedItem.findMany({
        where,
        orderBy: { relevance_score: 'desc' },
        skip, take: limit,
      }),
      this.prisma.enrichedItem.count({ where }),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getStats(projectId: string) {
    const items = await this.prisma.enrichedItem.findMany({ where: { project_id: projectId } });
    const total = items.length;
    const sentiments = { POSITIF: 0, NEGATIF: 0, NEUTRE: 0 };
    let totalRel = 0;
    for (const i of items) {
      if (i.sentiment && sentiments[i.sentiment] !== undefined) sentiments[i.sentiment]++;
      if (i.relevance_score) totalRel += i.relevance_score;
    }
    return { total, ...sentiments, avg_relevance: total > 0 ? totalRel / total : 0 };
  }

  async analyseProject(projectId: string) {
    const rawItems = await this.prisma.rawData.findMany({ where: { projectId: projectId } });
    let analysed = 0;
    for (const item of rawItems) {
      const existing = await this.prisma.watchResult.findUnique({ where: { rawDataId: item.id } });
      if (existing) continue;
      const sentiment = this.detectSentiment(item.content);
      const trend = this.detectTrend(item.content);
      const keywords = this.extractKeywords(item.content);
      await this.prisma.watchResult.create({
        data: {
          title: item.title,
          summary: item.content.substring(0, 300),
          sentiment, trend, keywords,
          sourceUrl: item.url,
          rawDataId: item.id,
          projectId: item.projectId,
        },
      });
      analysed++;
    }
    return { analysed };
  }

  private detectSentiment(text: string): string {
    const pos = ['croissance', 'succès', 'innovation', 'hausse', 'progression', 'positif', 'avancée', 'opportunité'];
    const neg = ['crise', 'baisse', 'problème', 'échec', 'risque', 'menace', 'déclin', 'perte'];
    const lower = text.toLowerCase();
    const posCount = pos.filter(w => lower.includes(w)).length;
    const negCount = neg.filter(w => lower.includes(w)).length;
    if (posCount > negCount) return 'POSITIF';
    if (negCount > posCount) return 'NEGATIF';
    return 'NEUTRE';
  }

  private detectTrend(text: string): string {
    const lower = text.toLowerCase();
    if (['augmente', 'croît', 'hausse', 'progression', 'monte'].some(w => lower.includes(w))) return 'HAUSSE';
    if (['diminue', 'baisse', 'décline', 'chute', 'recul'].some(w => lower.includes(w))) return 'BAISSE';
    return 'STABLE';
  }

  private extractKeywords(text: string): string[] {
    const stopWords = ['le', 'la', 'les', 'de', 'du', 'des', 'un', 'une', 'et', 'en', 'à', 'que', 'qui', 'pour', 'par'];
    const words = text.toLowerCase().replace(/[^a-zA-ZÀ-ÿ\s]/g, '').split(/\s+/)
      .filter(w => w.length > 4 && !stopWords.includes(w));
    const freq: Record<string, number> = {};
    for (const w of words) freq[w] = (freq[w] || 0) + 1;
    return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([w]) => w);
  }
}
