import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnalyseService {
  private readonly logger = new Logger(AnalyseService.name);

  constructor(private prisma: PrismaService) {}

  // ─── CRON : toutes les 2 heures ──────────────────────────────────────────────
  @Cron(CronExpression.EVERY_2_HOURS)
  async handleScheduledAnalysis() {
    this.logger.log('Declenchement automatique de l analyse...');
    await this.analyseAllPending();
  }

  // ─── Analyser tous les RawData non traités ────────────────────────────────────
  async analyseAllPending(): Promise<{ analysed: number; errors: number }> {
    // Récupérer les RawData qui n'ont pas encore de WatchResult
    const analysedIds = await this.prisma.watchResult.findMany({
      select: { rawDataId: true },
      where: { rawDataId: { not: null } },
    });

    const analysedSet = new Set(analysedIds.map(r => r.rawDataId));

    const rawItems = await this.prisma.rawData.findMany({
      where: { id: { notIn: [...analysedSet] as string[] } },
      take: 100,
      orderBy: { createdAt: 'asc' },
    });

    let analysed = 0;
    let errors = 0;

    for (const item of rawItems) {
      try {
        await this.analyseRawData(item);
        analysed++;
      } catch (err) {
        this.logger.error(`Erreur analyse ${item.id}: ${err.message}`);
        errors++;
      }
    }

    this.logger.log(`Analyse terminee: ${analysed} traites, ${errors} erreurs`);
    return { analysed, errors };
  }

  // ─── Analyser un RawData spécifique ──────────────────────────────────────────
  async analyseRawData(rawData: any): Promise<any> {
    const sentiment = this.analyseSentiment(rawData.content || rawData.title);
    const trend = this.detectTrend(rawData.content || rawData.title);
    const summary = this.generateSummary(rawData.content || rawData.title);
    const keywords = this.extractKeywords(rawData.content || rawData.title);

    const result = await this.prisma.watchResult.create({
      data: {
        title: rawData.title,
        summary,
        sentiment,
        trend,
        keywords,
        projectId: rawData.projectId,
        rawDataId: rawData.id,
        sourceUrl: rawData.url,
      },
    });

    return result;
  }

  // ─── Analyser un projet entier ────────────────────────────────────────────────
  async analyseProject(projectId: string): Promise<{ analysed: number; errors: number }> {
    const rawItems = await this.prisma.rawData.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    let analysed = 0;
    let errors = 0;

    for (const item of rawItems) {
      try {
        const existing = await this.prisma.watchResult.findFirst({
          where: { rawDataId: item.id },
        });
        if (existing) continue;

        await this.analyseRawData(item);
        analysed++;
      } catch (err) {
        errors++;
      }
    }

    return { analysed, errors };
  }

  // ─── Récupérer les résultats d'un projet ──────────────────────────────────────
  async getResults(projectId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.watchResult.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.watchResult.count({ where: { projectId } }),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ─── Stats sentiment d'un projet ─────────────────────────────────────────────
  async getSentimentStats(projectId: string) {
    const results = await this.prisma.watchResult.findMany({
      where: { projectId },
      select: { sentiment: true },
    });

    const stats = { POSITIF: 0, NEGATIF: 0, NEUTRE: 0, total: results.length };
    results.forEach(r => {
      if (r.sentiment === 'POSITIF') stats.POSITIF++;
      else if (r.sentiment === 'NEGATIF') stats.NEGATIF++;
      else stats.NEUTRE++;
    });

    return stats;
  }

  // ─── ANALYSE SENTIMENT (simple, sans IA externe) ─────────────────────────────
  private analyseSentiment(text: string): string {
    if (!text) return 'NEUTRE';
    const lower = text.toLowerCase();

    const positiveWords = ['excellent', 'bon', 'bien', 'super', 'great', 'success',
      'innov', 'croissance', 'hausse', 'progres', 'amelior', 'opportunit',
      'profit', 'winner', 'leader', 'avance', 'positif', 'record'];

    const negativeWords = ['mauvais', 'echec', 'crise', 'chute', 'baisse', 'perte',
      'risque', 'danger', 'probleme', 'deficit', 'faillite', 'fraude',
      'scandale', 'negatif', 'recul', 'declin', 'fail', 'crash'];

    let score = 0;
    positiveWords.forEach(w => { if (lower.includes(w)) score++; });
    negativeWords.forEach(w => { if (lower.includes(w)) score--; });

    if (score > 0) return 'POSITIF';
    if (score < 0) return 'NEGATIF';
    return 'NEUTRE';
  }

  // ─── DÉTECTION TENDANCE ───────────────────────────────────────────────────────
  private detectTrend(text: string): string {
    if (!text) return 'STABLE';
    const lower = text.toLowerCase();

    const trendingUp = ['hausse', 'augmentation', 'croissance', 'montee', 'record',
      'boom', 'surge', 'rise', 'growth', 'increase'];
    const trendingDown = ['baisse', 'chute', 'recul', 'declin', 'diminution',
      'fall', 'drop', 'decline', 'decrease'];

    let score = 0;
    trendingUp.forEach(w => { if (lower.includes(w)) score++; });
    trendingDown.forEach(w => { if (lower.includes(w)) score--; });

    if (score > 0) return 'HAUSSE';
    if (score < 0) return 'BAISSE';
    return 'STABLE';
  }

  // ─── GÉNÉRATION RÉSUMÉ ────────────────────────────────────────────────────────
  private generateSummary(text: string): string {
    if (!text) return '';
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
    return sentences.slice(0, 2).join('. ').trim().substring(0, 300);
  }

  // ─── EXTRACTION MOTS-CLÉS ────────────────────────────────────────────────────
  private extractKeywords(text: string): string[] {
    if (!text) return [];
    const stopWords = ['le', 'la', 'les', 'de', 'du', 'des', 'un', 'une', 'et',
      'est', 'en', 'au', 'aux', 'the', 'a', 'an', 'is', 'in', 'of', 'to'];
    const words = text.toLowerCase()
      .replace(/[^a-zA-ZÀ-ÿ\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 4 && !stopWords.includes(w));

    const freq: Record<string, number> = {};
    words.forEach(w => { freq[w] = (freq[w] || 0) + 1; });

    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word);
  }
}
