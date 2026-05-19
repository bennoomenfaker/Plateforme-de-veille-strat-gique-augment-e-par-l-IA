import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RssService } from './connectors/rss.service';
import { WebService } from './connectors/web.service';
import { PdfScraperService } from './connectors/pdf-scraper.service';
import { KeywordFilter } from './filters/keyword.filter';
import * as crypto from 'crypto';

@Injectable()
export class CollectionManager {
  private readonly logger = new Logger(CollectionManager.name);

  constructor(
    private prisma: PrismaService,
    private rssService: RssService,
    private webService: WebService,
    private pdfScraperService: PdfScraperService,
    private keywordFilter: KeywordFilter,
  ) {}

  // Legacy ETL
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
            create: { ...item, projectId: project.id, sourceId: source.id },
          });
          totalCollected++;
        } catch {}
      }
    }
    return { collected: totalCollected };
  }

  //  Collecte via CollectionPlan 
  async runCollectionPlan(
    planId: string,
    userId: string,
    triggerType: 'MANUAL' | 'SCHEDULED' = 'MANUAL',
  ) {
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

    // Vérification accès multi-tenant
    const hasAccess =
      project.owner_user_id === userId ||
      project.organisation?.members.some(
        (m) => m.user_id === userId && m.statut === 'ACTIF',
      );
    if (!hasAccess) throw new ForbiddenException('Accès refusé');

    //  Créer le job en PENDING d'abord
    const job = await this.prisma.collectionJob.create({
      data: {
        collection_plan_id: planId,
        status: 'PENDING',
        trigger_type: triggerType, //  trigger_type dynamique
      },
    });

   
    await this.prisma.collectionJob.update({
      where: { id: job.id },
      data: {
        status: 'RUNNING',
        started_at: new Date(),
      },
    });

    // Préparer keywords
    const includeKeywords = plan.keywords
      .filter(
        (k) => k.keyword_type === 'INCLUDE' || k.keyword_type === 'PRINCIPAL',
      )
      .map((k) => k.keyword);

    const excludeKeywords = plan.keywords
      .filter((k) => k.keyword_type === 'EXCLUDE')
      .map((k) => k.keyword.toLowerCase());

    let collected = 0;
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
        const sourceType = source.source_type?.toUpperCase();

        // ── Connecteurs selon source_type ──
        try {
          if (sourceType === 'RSS') {
            rawItems = await this.rssService.fetch(source.source_url);

          } else if (sourceType === 'WEB') {
            rawItems = await this.webService.fetch(source.source_url);

          } else if (sourceType === 'PDF') {
            rawItems = await this.pdfScraperService.fetchPdfLinks(
              source.source_url,
            );

          } else if (sourceType === 'UPLOAD') {
            
            this.logger.log(
              `Source UPLOAD ignorée dans le run automatique (déjà traitée via /uploads/pdf)`,
            );
            logs.push(sourceLog);
            continue;

          } else {
            this.logger.warn(
              `Type source inconnu: ${source.source_type} — ignoré`,
            );
            logs.push(sourceLog);
            continue;
          }
        } catch (connectorErr) {
          
          this.logger.warn(
            `Erreur connecteur ${sourceType}, retry dans 3s... : ${connectorErr.message}`,
          );
          await this.sleep(3000);
          try {
            if (sourceType === 'RSS') {
              rawItems = await this.rssService.fetch(source.source_url);
            } else if (sourceType === 'WEB') {
              rawItems = await this.webService.fetch(source.source_url);
            } else if (sourceType === 'PDF') {
              rawItems = await this.pdfScraperService.fetchPdfLinks(source.source_url);
            }
          } catch (retryErr) {
            this.logger.error(
              `Echec retry source ${source.source_label}: ${retryErr.message}`,
            );
            sourceLog.errors++;
            logs.push(sourceLog);
            continue;
          }
        }

       
        let filtered =
          includeKeywords.length > 0
            ? this.keywordFilter.filterInclude(rawItems, includeKeywords)
            : rawItems;

        
        if (excludeKeywords.length > 0) {
          filtered = this.keywordFilter.filterExclude(filtered, excludeKeywords);
        }

        // Stocker les items
        for (const item of filtered) {
          try {
            let filePath: string | null = null;

            if (sourceType === 'PDF' && item.isPdf && item.url) {
              const filename = `${crypto.randomUUID()}.pdf`;
              filePath = await this.pdfScraperService.downloadPdf(
                item.url,
                filename,
              );
            }

            await this.prisma.rawItem.create({
              data: {
                project_id: project.id,
                collection_plan_id: planId,
                source_type: sourceType,
                source_name: source.source_label,
                source_url: source.source_url,
                article_url: item.url || null,
                file_path: filePath,
                title: item.title || null,
                content_raw: item.content || null,
                published_at: item.publishedAt || new Date(),
                hash: item.contentHash,
                metadata: {
                  feedTitle: item.feedTitle || null,
                  isPdf: item.isPdf || false,
                },
              },
            });
            collected++;
            sourceLog.items++;
          } catch {
            duplicates++;
          }
        }

        logs.push(sourceLog);
        this.logger.log(
          `Source ${source.source_label}: ${sourceLog.items} items collectes`,
        );
      }

      // Mettre à jour le job DONE
      await this.prisma.collectionJob.update({
        where: { id: job.id },
        data: {
          status: 'DONE',
          finished_at: new Date(),
          logs: { collected, duplicates, sources: logs },
        },
      });

      // Calculer next_run_at
      const nextRun = this.calculateNextRun(plan.frequency);
      await this.prisma.collectionPlan.update({
        where: { id: planId },
        data: {
          last_run_at: new Date(),
          next_run_at: nextRun,
        },
      });

      this.logger.log(
        `Plan ${planId} termine: ${collected} collectes, ${duplicates} doublons`,
      );

      return {
        message: 'Collecte terminee',
        job_id: job.id,
        collected,
        duplicates,
      };
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

  async getJobsByPlan(planId: string) {
    return this.prisma.collectionJob.findMany({
      where: { collection_plan_id: planId },
      orderBy: { created_at: 'desc' },
    });
  }

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
      case 'DAILY':   next.setDate(next.getDate() + 1);    break;
      case 'WEEKLY':  next.setDate(next.getDate() + 7);    break;
      case 'MONTHLY': next.setMonth(next.getMonth() + 1);  break;
      default:        next.setDate(next.getDate() + 1);
    }
    return next;
  }

  
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
