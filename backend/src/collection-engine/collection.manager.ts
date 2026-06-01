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
import { OrgAccessService } from '../common/org-access.service';
import * as crypto from 'crypto';
import axios from 'axios';

@Injectable()
export class CollectionManager {
  private readonly logger = new Logger(CollectionManager.name);

  constructor(
    private prisma: PrismaService,
    private rssService: RssService,
    private webService: WebService,
    private pdfScraperService: PdfScraperService,
    private keywordFilter: KeywordFilter,
    private orgAccess: OrgAccessService,
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
      const filteredItems = this.keywordFilter.filter(
        rawItems,
        project.keywords,
      );
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
            hypothesis_perimeters: { include: { perimeter: true } },
            axis: {
              include: {
                objective: {
                  include: {
                    project: {
                      include: {
                        perimeters: true,
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

    await this.orgAccess.assertProjectWrite(project.id, userId);

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

    // Préparer keywords (plan + périmètres + objectifs du projet)
    const contextTerms = this.buildContextKeywords(plan, project);
    const includeKeywords = [
      ...plan.keywords
        .filter(
          (k) => k.keyword_type === 'INCLUDE' || k.keyword_type === 'PRINCIPAL',
        )
        .map((k) => k.keyword),
      ...contextTerms,
    ].filter((k, i, arr) => k && arr.indexOf(k) === i);

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
          } else if (sourceType === 'UPLOAD' || sourceType === 'DOCUMENT') {
            this.logger.log(
              `Source ${sourceType} ignorée dans le run automatique (ajout manuel / upload)`,
            );
            logs.push(sourceLog);
            continue;
          } else if (sourceType === 'API') {
            rawItems = await this.fetchApiSource(source);
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
              rawItems = await this.pdfScraperService.fetchPdfLinks(
                source.source_url,
              );
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
          filtered = this.keywordFilter.filterExclude(
            filtered,
            excludeKeywords,
          );
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
      case 'DAILY':
        next.setDate(next.getDate() + 1);
        break;
      case 'WEEKLY':
        next.setDate(next.getDate() + 7);
        break;
      case 'MONTHLY':
        next.setMonth(next.getMonth() + 1);
        break;
      default:
        next.setDate(next.getDate() + 1);
    }
    return next;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private buildContextKeywords(plan: any, project: any): string[] {
    const terms: string[] = [];

    if (project.keywords?.length) {
      terms.push(...project.keywords);
    }

    for (const p of project.perimeters || []) {
      if (p.value) terms.push(p.value);
      if (p.name) terms.push(p.name);
    }

    for (const hp of plan.hypothesis?.hypothesis_perimeters || []) {
      if (hp.perimeter?.value) terms.push(hp.perimeter.value);
      if (hp.perimeter?.name) terms.push(hp.perimeter.name);
    }

    const objective = plan.hypothesis?.axis?.objective;
    if (objective?.content) {
      objective.content
        .split(/\s+/)
        .filter((w: string) => w.length > 4)
        .slice(0, 5)
        .forEach((w: string) => terms.push(w));
    }

    return terms.filter(Boolean);
  }

  private async fetchApiSource(source: any): Promise<any[]> {
    const meta = (source.metadata as Record<string, any>) || {};
    const method = (meta.api_method || 'GET').toUpperCase();
    const headers: Record<string, string> =
      typeof meta.api_headers === 'object' && meta.api_headers
        ? meta.api_headers
        : {};

    if (meta.api_key) {
      headers.Authorization = headers.Authorization || `Bearer ${meta.api_key}`;
    }

    const response = await axios.request({
      url: source.source_url,
      method,
      headers,
      timeout: 30000,
    });

    const payload = response.data;
    const items = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.items)
        ? payload.items
        : Array.isArray(payload?.data)
          ? payload.data
          : [payload];

    return items.map((item: any, index: number) => {
      const title =
        item.title || item.name || item.headline || `API item ${index + 1}`;
      const content =
        item.content ||
        item.description ||
        item.summary ||
        JSON.stringify(item);
      const url = item.url || item.link || source.source_url;
      const contentHash = crypto
        .createHash('sha256')
        .update(`${title}${content}${url}`)
        .digest('hex');

      return {
        title,
        content,
        url,
        contentHash,
        publishedAt: item.publishedAt ? new Date(item.publishedAt) : new Date(),
      };
    });
  }
}
