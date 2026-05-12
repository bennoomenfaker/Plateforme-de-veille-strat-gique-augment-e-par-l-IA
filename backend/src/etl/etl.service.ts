import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import * as Parser from 'rss-parser';
import * as crypto from 'crypto';

@Injectable()
export class EtlService {
  private readonly logger = new Logger(EtlService.name);
  private readonly parser = new Parser({
    timeout: 10000,
    headers: { 'User-Agent': 'VeilleStrategique/1.0' },
  });

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleScheduledCollection() {
    this.logger.log('Declenchement automatique de la collecte RSS...');
    await this.collectAllSources();
  }

  async collectAllSources(): Promise<{ collected: number; skipped: number; errors: number }> {
    const sources = await this.prisma.source.findMany({
      include: { project: true },
    });
    let collected = 0, skipped = 0, errors = 0;
    for (const source of sources) {
      try {
        const result = await this.collectSource(source.id);
        collected += result.collected;
        skipped += result.skipped;
      } catch (err) {
        this.logger.error(`Erreur source ${source.id}: ${err.message}`);
        errors++;
      }
    }
    return { collected, skipped, errors };
  }

  async collectByProject(projectId: string): Promise<{ collected: number; skipped: number; errors: number }> {
    const sources = await this.prisma.source.findMany({
      where: { projectId },
      include: { project: true },
    });
    let collected = 0, skipped = 0, errors = 0;
    for (const source of sources) {
      try {
        const result = await this.collectSourceForProject(source, projectId);
        collected += result.collected;
        skipped += result.skipped;
      } catch (err) {
        this.logger.error(`Erreur source ${source.id}: ${err.message}`);
        errors++;
      }
    }
    return { collected, skipped, errors };
  }

  private async collectSourceForProject(source: any, projectId: string): Promise<{ collected: number; skipped: number }> {
    this.logger.log(`Collecte de: ${source.url} pour projet ${projectId}`);
    let feed;
    try {
      feed = await this.parser.parseURL(source.url);
    } catch (err) {
      throw new Error(`Impossible de parser le flux RSS: ${err.message}`);
    }

    let collected = 0, skipped = 0;
    for (const item of feed.items) {
      // Hash unique par projet + lien pour éviter les doublons inter-projets
      const hashInput = `${projectId}_${item.link || item.title || item.guid || ''}`;
      const hash = this.generateHash(hashInput);

      const existing = await this.prisma.rawData.findFirst({
        where: { contentHash: hash },
      });

      if (existing) { skipped++; continue; }

      const projectKeywords: string[] = (source.project as any)?.keywords ?? [];
      const isRelevant = this.checkKeywordRelevance(
        (item.title || '') + ' ' + (item.contentSnippet || item.content || ''),
        projectKeywords,
      );

      await this.prisma.rawData.create({
        data: {
          sourceId: source.id,
          projectId,
          title: item.title || 'Sans titre',
          url: item.link || '',
          content: item.contentSnippet || item.content || item.summary || '',
          publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
          contentHash: hash,
          metadata: {
            feedTitle: feed.title,
            author: item.creator || item.author || null,
            categories: item.categories || [],
            isRelevant,
          },
        },
      });
      collected++;
    }

    await this.logActivity(source.project as any, source.id, collected);
    return { collected, skipped };
  }

  async collectSource(sourceId: string): Promise<{ collected: number; skipped: number }> {
    const source = await this.prisma.source.findUnique({
      where: { id: sourceId },
      include: { project: true },
    });
    if (!source) throw new Error(`Source ${sourceId} introuvable`);
    return this.collectSourceForProject(source, source.projectId);
  }

  private generateHash(input: string): string {
    return crypto.createHash('sha256').update(input).digest('hex');
  }

  private checkKeywordRelevance(text: string, keywords: string[]): boolean {
    if (!keywords || keywords.length === 0) return true;
    const lowerText = text.toLowerCase();
    return keywords.some((kw) => lowerText.includes(kw.toLowerCase()));
  }

  private async logActivity(project: any, sourceId: string, count: number) {
    if (!project) return;
    const ownerId = project.owner_user_id || null;
    if (!ownerId) return;
    try {
      await this.prisma.userActivityLog.create({
        data: { user_id: ownerId, action: 'RSS_COLLECT', entityType: 'source', entityId: sourceId },
      });
    } catch {}
  }

  async getRawDataByProject(projectId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.rawData.findMany({
        where: { projectId },
        orderBy: { publishedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.rawData.count({ where: { projectId } }),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}
