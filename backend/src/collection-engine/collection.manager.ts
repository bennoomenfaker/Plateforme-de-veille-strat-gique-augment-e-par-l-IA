import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RssService } from './connectors/rss.service';
import { KeywordFilter } from './filters/keyword.filter';

@Injectable()
export class CollectionManager {
  private readonly logger = new Logger(CollectionManager.name);

  constructor(
    private prisma: PrismaService,
    private rssService: RssService,
    private keywordFilter: KeywordFilter,
  ) {}

  // ─── Collecte via project (ancien ETL - legacy) ───────────────────────────
  async startCollection(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { sources: true },
    });
    if (!project) throw new NotFoundException('Projet introuvable');

    let totalCollected = 0;
    for (const source of project.sources) {
      if (!source.url) continue;
      const rawItems = await this.rssService.fetch(source.url);
      const filteredItems = this.keywordFilter.filter(rawItems, project.keywords);
      for (const item of filteredItems) {
        try {
          await this.prisma.rawData.upsert({
            where: { contentHash: item.contentHash },
            update: {},
            create: {
              ...item,
              projectId: project.id,
              sourceId: source.id,
            },
          });
          totalCollected++;
        } catch {}
      }
    }
    return { collected: totalCollected };
  }

  // ─── Collecte via CollectionPlan (Sprint 3) ───────────────────────────────
  async runCollectionPlan(planId: string, userId: string) {
    const plan = await this.prisma.collectionPlan.findUnique({
      where: { id: planId },
      include: {
        sources: true,
        keywords: true,
        hypothesis: {
          include: {
            axis: {
              include: {
                objective: {
                  include: {
                    project: {
                      include: {
                        organisation: { include: { members: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!plan) throw new NotFoundException('Plan de collecte introuvable');

    const project = plan.hypothesis.axis.objective.project;

    // Vérification accès
    const hasAccess =
      project.owner_user_id === userId ||
      project.organisation?.members.some(
        m => m.user_id === userId && m.statut === 'ACTIF',
      );
    if (!hasAccess) throw new ForbiddenException('Accès refusé');

    // Créer le job
    const job = await this.prisma.collectionJob.create({
      data: {
        collection_plan_id: planId,
        status: 'RUNNING',
        trigger_type: 'MANUAL',
        started_at: new Date(),
      },
    });

    // Mots-clés INCLUDE seulement pour le filtre
    const includeKeywords = plan.keywords
      .filter(k => k.keyword_type === 'INCLUDE' || k.keyword_type === 'PRINCIPAL')
      .map(k => k.keyword);

    // Mots-clés EXCLUDE
    const excludeKeywords = plan.keywords
      .filter(k => k.keyword_type === 'EXCLUDE')
      .map(k => k.keyword.toLowerCase());

    let collected = 0;
    let skipped = 0;
    let duplicates = 0;
    const logs: any[] = [];

    try {
      for (const source of plan.sources) {
        const sourceLog: any = {
          source: source.source_label,
          type: source.source_type,
          url: source.source_url,
          items: 0,
          errors: 0,
        };

        let rawItems: any[] = [];

        if (source.source_type === 'RSS') {
          rawItems = await this.rssService.fetch(source.source_url);
        } else {
          this.logger.log(`Source type ${source.source_type} — RSS uniquement en Sprint 3`);
        }

        // Filtrage keywords INCLUDE
        let filtered = includeKeywords.length > 0
          ? this.keywordFilter.filter(rawItems, includeKeywords)
          : rawItems;

        // Filtrage keywords EXCLUDE
        if (excludeKeywords.length > 0) {
          filtered = filtered.filter(item => {
            const text = `${item.title} ${item.content}`.toLowerCase();
            return !excludeKeywords.some(kw => text.includes(kw));
          });
        }

        for (const item of filtered) {
          try {
            await this.prisma.rawItem.create({
              data: {
                project_id: project.id,
                collection_plan_id: planId,
                source_type: source.source_type,
                source_name: source.source_label,
                source_url: source.source_url,
                article_url: item.url || null,
                title: item.title,
                content_raw: item.content || null,
                published_at: item.publishedAt || new Date(),
                hash: item.contentHash,
                metadata: { feedTitle: item.feedTitle || null },
              },
            });
            collected++;
            sourceLog.items++;
          } catch {
            duplicates++;
          }
        }

        logs.push(sourceLog);
        this.logger.log(`Source ${source.source_label}: ${sourceLog.items} items collectés`);
      }

      // Mise à jour du job
      await this.prisma.collectionJob.update({
        where: { id: job.id },
        data: {
          status: 'DONE',
          finished_at: new Date(),
          logs: { collected, skipped, duplicates, sources: logs },
        },
      });

      // Mise à jour next_run_at du plan
      const nextRun = this.calculateNextRun(plan.frequency);
      await this.prisma.collectionPlan.update({
        where: { id: planId },
        data: {
          last_run_at: new Date(),
          next_run_at: nextRun,
        },
      });

      this.logger.log(`Plan ${planId} terminé: ${collected} collectés, ${duplicates} doublons`);
      return { message: 'Collecte terminée', job_id: job.id, collected, skipped, duplicates };
    } catch (err) {
      await this.prisma.collectionJob.update({
        where: { id: job.id },
        data: {
          status: 'FAILED',
          finished_at: new Date(),
          logs: { error: err.message },
        },
      });
      throw err;
    }
  }

  // ─── Récupérer les jobs d'un plan ─────────────────────────────────────────
  async getJobsByPlan(planId: string) {
    return this.prisma.collectionJob.findMany({
      where: { collection_plan_id: planId },
      orderBy: { created_at: 'desc' },
    });
  }

  // ─── Récupérer les raw items d'un plan ────────────────────────────────────
  async getRawItemsByPlan(planId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.rawItem.findMany({
        where: { collection_plan_id: planId },
        orderBy: { fetched_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.rawItem.count({ where: { collection_plan_id: planId } }),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ─── Récupérer les raw items d'un projet ──────────────────────────────────
  async getRawItemsByProject(projectId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.rawItem.findMany({
        where: { project_id: projectId },
        orderBy: { fetched_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.rawItem.count({ where: { project_id: projectId } }),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  private calculateNextRun(frequency: string): Date {
    const next = new Date();
    switch (frequency?.toUpperCase()) {
      case 'DAILY': next.setDate(next.getDate() + 1); break;
      case 'WEEKLY': next.setDate(next.getDate() + 7); break;
      case 'MONTHLY': next.setMonth(next.getMonth() + 1); break;
      default: next.setDate(next.getDate() + 1);
    }
    return next;
  }
}
