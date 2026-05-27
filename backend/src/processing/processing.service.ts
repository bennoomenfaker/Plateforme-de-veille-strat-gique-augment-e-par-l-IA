import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as cheerio from 'cheerio';

@Injectable()
export class ProcessingService {
  private readonly logger = new Logger(ProcessingService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Nettoyage HTML ───────────────────────────────────────────────────────
  private cleanHtml(raw: string): string {
    if (!raw) return '';
    try {
      const $ = cheerio.load(raw);
      $('script, style, nav, footer, header, aside, iframe, noscript').remove();
      let text = $('body').text();
      if (!text || text.trim().length < 50) {
        text = $.root().text();
      }
      return text
        .replace(/\s+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    } catch {
      return raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    }
  }

  // ─── Détection langue ─────────────────────────────────────────────────────
  private detectLanguage(text: string): string {
    if (!text || text.length < 20) return 'und';
    try {
      const sample = text.toLowerCase().slice(0, 500);
      const arabicChars = (sample.match(/[\u0600-\u06FF]/g) || []).length;
      if (arabicChars > sample.length * 0.2) return 'ar';

      const patterns: Record<string, RegExp> = {
        fr: /\b(le|la|les|de|du|des|et|est|un|une|pour|dans|avec|sur|par|au|aux|qui|que|pas|plus|bien|tout|mais|comme|sont|cette|ces|nous|vous|ils|très)\b/g,
        en: /\b(the|is|are|was|were|have|has|had|will|would|could|should|and|or|but|in|on|at|to|for|of|with|by|from|this|that|these|those|it|he|she|we|they)\b/g,
        es: /\b(el|la|los|las|de|del|en|con|por|para|que|es|son|un|una|como|pero|más|muy|todo|también|se|su|al|lo)\b/g,
        de: /\b(der|die|das|den|dem|des|ein|eine|und|ist|sind|war|haben|werden|ich|sie|er|wir|mit|für|auf|von|zu)\b/g,
      };

      let maxCount = 0;
      let detectedLang = 'und';
      for (const [lang, pattern] of Object.entries(patterns)) {
        const matches = sample.match(pattern);
        const count = matches ? matches.length : 0;
        if (count > maxCount) {
          maxCount = count;
          detectedLang = lang;
        }
      }
      return maxCount >= 3 ? detectedLang : 'und';
    } catch {
      return 'und';
    }
  }

  // ─── Extraire extrait ─────────────────────────────────────────────────────
  private extractExcerpt(text: string, maxLength = 500): string {
    if (!text) return '';
    const clean = text.replace(/\s+/g, ' ').trim();
    if (clean.length <= maxLength) return clean;
    const truncated = clean.slice(0, maxLength);
    const lastDot = Math.max(
      truncated.lastIndexOf('. '),
      truncated.lastIndexOf('! '),
      truncated.lastIndexOf('? '),
    );
    if (lastDot > maxLength * 0.6) return truncated.slice(0, lastDot + 1);
    return truncated + '...';
  }

  // ─── Traiter un item ──────────────────────────────────────────────────────
  private async processOneItem(rawItem: any): Promise<{
    status: 'done' | 'skipped' | 'failed';
    reason?: string;
  }> {
    // Vérifier si déjà traité
    const existing = await this.prisma.processedItem.findUnique({
      where: { raw_item_id: rawItem.id },
    });
    if (existing) return { status: 'skipped', reason: 'already_processed' };

    try {
      const rawContent = rawItem.content_raw || '';
      const contentClean = this.cleanHtml(rawContent);

      // Contenu trop court → SKIPPED (seuil bas pour ne pas skipper les titres RSS)
      if (contentClean.length < 10 && !rawItem.file_path && !rawItem.title) {
        await this.prisma.processedItem.create({
          data: {
            raw_item_id: rawItem.id,
            project_id: rawItem.project_id,
            collection_plan_id: rawItem.collection_plan_id,
            title: rawItem.title,
            content_clean: null,
            content_excerpt: null,
            language: 'und',
            word_count: 0,
            char_count: 0,
            source_type: rawItem.source_type,
            source_name: rawItem.source_name,
            source_url: rawItem.source_url,
            article_url: rawItem.article_url,
            published_at: rawItem.published_at,
            processing_status: 'SKIPPED',
            error_message: 'content_too_short',
          },
        });
        return { status: 'skipped', reason: 'content_too_short' };
      }

      // Utiliser le titre comme contenu si le corps est vide (cas RSS snippet)
      const effectiveContent = contentClean.length > 50 ? contentClean : (rawItem.title || contentClean);
      const language = this.detectLanguage(effectiveContent);
      const wordCount = effectiveContent ? effectiveContent.split(/\s+/).filter(Boolean).length : 0;
      const charCount = effectiveContent ? effectiveContent.length : 0;
      const excerpt = this.extractExcerpt(effectiveContent);

      await this.prisma.processedItem.create({
        data: {
          raw_item_id: rawItem.id,
          project_id: rawItem.project_id,
          collection_plan_id: rawItem.collection_plan_id,
          title: rawItem.title,
          content_clean: effectiveContent.slice(0, 50000),
          content_excerpt: excerpt,
          language,
          word_count: wordCount,
          char_count: charCount,
          source_type: rawItem.source_type,
          source_name: rawItem.source_name,
          source_url: rawItem.source_url,
          article_url: rawItem.article_url,
          published_at: rawItem.published_at,
          processing_status: 'DONE',
        },
      });

      return { status: 'done' };
    } catch (err) {
      this.logger.error(`Erreur processing item ${rawItem.id}: ${err.message}`);
      try {
        await this.prisma.processedItem.create({
          data: {
            raw_item_id: rawItem.id,
            project_id: rawItem.project_id,
            collection_plan_id: rawItem.collection_plan_id ?? null,
            title: rawItem.title,
            source_type: rawItem.source_type,
            processing_status: 'FAILED',
            error_message: err.message?.slice(0, 255),
          },
        });
      } catch {}
      return { status: 'failed', reason: err.message };
    }
  }

  // ─── Traiter tous les raw_items d'un projet ───────────────────────────────
  async processProject(projectId: string): Promise<{
    processed: number;
    skipped: number;
    failed: number;
    total: number;
  }> {
    this.logger.log(`[Processing] Démarrage projet ${projectId}`);

    const job = await this.prisma.processingJob.create({
      data: {
        project_id: projectId,
        status: 'RUNNING',
        trigger_type: 'MANUAL',
        started_at: new Date(),
      },
    });

    // ✅ Syntaxe correcte pour "pas encore traité"
    const rawItems = await this.prisma.rawItem.findMany({
      where: {
        project_id: projectId,
        processed_item: { is: null },
      },
      take: 200,
    });

    this.logger.log(`[Processing] ${rawItems.length} items à traiter`);

    let processed = 0, skipped = 0, failed = 0;
    for (const item of rawItems) {
      const result = await this.processOneItem(item);
      if (result.status === 'done') processed++;
      else if (result.status === 'skipped') skipped++;
      else failed++;
    }

    await this.prisma.processingJob.update({
      where: { id: job.id },
      data: {
        status: failed === rawItems.length && rawItems.length > 0 ? 'FAILED' : 'DONE',
        finished_at: new Date(),
        total: rawItems.length,
        processed,
        skipped,
        failed,
      },
    });

    this.logger.log(
      `[Processing] Terminé: ${processed} traités, ${skipped} ignorés, ${failed} erreurs`,
    );
    return { processed, skipped, failed, total: rawItems.length };
  }

  // ─── Traiter les raw_items d'un plan ─────────────────────────────────────
  async processByPlan(planId: string): Promise<{
    processed: number;
    skipped: number;
    failed: number;
    total: number;
  }> {
    const rawItems = await this.prisma.rawItem.findMany({
      where: {
        collection_plan_id: planId,
        processed_item: { is: null },
      },
      take: 100,
    });

    let processed = 0, skipped = 0, failed = 0;
    for (const item of rawItems) {
      const result = await this.processOneItem(item);
      if (result.status === 'done') processed++;
      else if (result.status === 'skipped') skipped++;
      else failed++;
    }
    return { processed, skipped, failed, total: rawItems.length };
  }

  // ─── Récupérer processed items d'un projet ───────────────────────────────
  async getByProject(
    projectId: string,
    page = 1,
    limit = 20,
    language?: string,
    sourceType?: string,
  ) {
    const skip = (page - 1) * limit;
    const where: any = { project_id: projectId };
    if (language) where.language = language;
    if (sourceType) where.source_type = sourceType;

    const [data, total] = await Promise.all([
      this.prisma.processedItem.findMany({
        where,
        orderBy: { processed_at: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          title: true,
          content_excerpt: true,
          language: true,
          word_count: true,
          char_count: true,
          source_type: true,
          source_name: true,
          source_url: true,
          article_url: true,
          published_at: true,
          processed_at: true,
          processing_status: true,
        },
      }),
      this.prisma.processedItem.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ─── Récupérer processed items d'un plan ─────────────────────────────────
  async getByPlan(planId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where = { collection_plan_id: planId };

    const [data, total] = await Promise.all([
      this.prisma.processedItem.findMany({
        where,
        orderBy: { processed_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.processedItem.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ─── Statistiques projet ──────────────────────────────────────────────────
  async getStats(projectId: string) {
    const [totalRaw, totalProcessed, byLanguage, bySourceType] =
      await Promise.all([
        this.prisma.rawItem.count({ where: { project_id: projectId } }),
        this.prisma.processedItem.count({
          where: { project_id: projectId, processing_status: 'DONE' },
        }),
        this.prisma.processedItem.groupBy({
          by: ['language'],
          where: { project_id: projectId, processing_status: 'DONE' },
          _count: { language: true },
          orderBy: { _count: { language: 'desc' } },
        }),
        this.prisma.processedItem.groupBy({
          by: ['source_type'],
          where: { project_id: projectId },
          _count: { source_type: true },
        }),
      ]);

    const pending = totalRaw - totalProcessed;
    const completionRate =
      totalRaw > 0 ? Math.round((totalProcessed / totalRaw) * 100) : 0;

    return {
      total_raw: totalRaw,
      total_processed: totalProcessed,
      pending: Math.max(0, pending),
      completion_rate: completionRate,
      by_language: byLanguage.map((l) => ({
        language: l.language,
        count: l._count.language,
      })),
      by_source_type: bySourceType.map((s) => ({
        source_type: s.source_type,
        count: s._count.source_type,
      })),
    };
  }

  // ─── Détail d'un item ─────────────────────────────────────────────────────
  async getById(id: string) {
    return this.prisma.processedItem.findUnique({
      where: { id },
      include: { raw_item: true },
    });
  }
}
