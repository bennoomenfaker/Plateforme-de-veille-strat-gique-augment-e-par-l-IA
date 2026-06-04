import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LlmProviderService } from './llm-provider.service';
import { buildEnrichmentPrompt } from './prompt-templates/enrichment.prompt';

@Injectable()
export class AiEnrichmentService implements OnModuleInit {
  private readonly logger = new Logger(AiEnrichmentService.name);

  constructor(
    private prisma: PrismaService,
    private llm: LlmProviderService,
  ) {}

  async onModuleInit() {
    const stale = await this.prisma.aiEnrichmentJob.updateMany({
      where: { status: 'RUNNING' },
      data: {
        status: 'FAILED',
        error: 'Serveur redémarré — enrichissement interrompu',
        finished_at: new Date(),
      },
    });
    if (stale.count > 0) {
      this.logger.warn(`${stale.count} job(s) RUNNING marqués FAILED (redémarrage serveur)`);
    }
  }

  async enrichProject(projectId: string, force = false): Promise<any> {
    if (force) {
      await this.prisma.enrichedItem.deleteMany({
        where: { project_id: projectId },
      });
    }

    const items = await this.prisma.processedItem.findMany({
      where: { project_id: projectId },
      include: { raw_item: { select: { collection_plan_id: true } } },
    });

    const job = await this.prisma.aiEnrichmentJob.create({
      data: {
        project_id: projectId,
        status: 'RUNNING',
        started_at: new Date(),
        total: items.length,
      },
    });

    let processed = 0,
      skipped = 0,
      failed = 0;

    const updateJob = () =>
      this.prisma.aiEnrichmentJob.update({
        where: { id: job.id },
        data: { processed, skipped, failed },
      });

    // Traitement par lots de 5 pour éviter le timeout
    const BATCH_SIZE = 5;
      for (let i = 0; i < items.length; i += BATCH_SIZE) {
        const batch = items.slice(i, i + BATCH_SIZE);
        for (const item of batch) {
          try {
            if (!force) {
              const existing = await this.prisma.enrichedItem.findUnique({
                where: { processed_item_id: item.id },
              });
              if (existing) {
                skipped++;
                continue;
              }
            }

            const planId =
              item.raw_item?.collection_plan_id || item.collection_plan_id;
            let question = 'Quelle est la pertinence de cet article ?';
            let hypothesis = '';
            let perimeters: string[] = [];

            if (planId) {
              const plan = await this.prisma.collectionPlan.findUnique({
                where: { id: planId },
                include: {
                  hypothesis: {
                    include: {
                      axis: {
                        include: {
                          objective: {
                            include: {
                              project: { include: { perimeters: true } },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              });
              if (plan) {
                question = plan.question;
                hypothesis = plan.hypothesis?.content || '';
                perimeters =
                  plan.hypothesis?.axis?.objective?.project?.perimeters
                    ?.map((p) => p.name || '')
                    .filter(Boolean) || [];
              }
            }

            const prompt = buildEnrichmentPrompt({
              question,
              hypothesis,
              perimeters,
              content: item.content_clean || item.content_excerpt || '',
              title: item.title || '',
            });

            const raw = await this.llm.generate(prompt);
            const parsed = this.llm.parseJsonResponse(raw);
            if (!parsed) {
              failed++;
              continue;
            }

            const data = {
              processed_item_id: item.id,
              project_id: projectId,
              collection_plan_id: planId || null,
              hypothesis_id: null,
              answer: parsed.answer || null,
              summary: parsed.summary || null,
              entities: parsed.entities || [],
              topics: parsed.topics || [],
              sentiment: (() => {
                const s = (parsed.sentiment || 'NEUTRE').toUpperCase();
                if (s.includes('POSIT')) return 'POSITIF';
                if (s.includes('NEGAT')) return 'NEGATIF';
                return 'NEUTRE';
              })(),
              relevance_score: parsed.relevance_score || null,
              hypothesis_impact: parsed.hypothesis_impact || 'OPEN',
              confidence_score: parsed.confidence_score || null,
              raw_response: parsed,
              model_used: this.llm.primaryModel,
              prompt_version: '1.0',
            };

            await this.prisma.enrichedItem.upsert({
              where: { processed_item_id: item.id },
              create: data,
              update: data,
            });

          if (planId) {
            const plan = await this.prisma.collectionPlan.findUnique({
              where: { id: planId },
              select: { hypothesis_id: true },
            });
            if (plan?.hypothesis_id) {
              await this.updateHypothesisEvaluation(
                plan.hypothesis_id,
                projectId,
              );
            }
          }

          processed++;
          this.logger.log(`Enrichi ${processed}/${items.length - skipped}`);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          this.logger.error(`Error item ${item.id}: ${message}`);
          failed++;
        }
      }
      this.logger.log(
        `Batch ${Math.floor(i / BATCH_SIZE) + 1} terminé — ${processed} traités`,
      );
      await updateJob();
    }

    await this.prisma.aiEnrichmentJob.update({
      where: { id: job.id },
      data: {
        status: 'DONE',
        finished_at: new Date(),
        processed,
        skipped,
        failed,
      },
    });

    this.logger.log(`Job ${job.id} terminé — ${processed} enrichis, ${skipped} ignorés, ${failed} erreurs`);

    return { job_id: job.id, total: items.length, processed, skipped, failed };
  }

  async enrichPlan(planId: string): Promise<any> {
    const plan = await this.prisma.collectionPlan.findUnique({
      where: { id: planId },
      include: { hypothesis: true },
    });
    if (!plan) throw new Error('Plan introuvable');

    const job = await this.prisma.aiEnrichmentJob.create({
      data: { plan_id: planId, status: 'RUNNING', started_at: new Date() },
    });

    const rawItems = await this.prisma.rawItem.findMany({
      where: { collection_plan_id: planId },
      include: { processed_item: true },
    });

    let processed = 0,
      skipped = 0,
      failed = 0;

    for (const raw of rawItems) {
      if (!raw.processed_item) {
        skipped++;
        continue;
      }
      const item = raw.processed_item;

      try {
        const existing = await this.prisma.enrichedItem.findUnique({
          where: { processed_item_id: item.id },
        });
        if (existing) {
          skipped++;
          continue;
        }

        const prompt = buildEnrichmentPrompt({
          question: plan.question,
          hypothesis: plan.hypothesis?.content || '',
          perimeters: [],
          content: item.content_clean || item.content_excerpt || '',
          title: item.title || '',
        });

        const rawResp = await this.llm.generate(prompt);
        const parsed = this.llm.parseJsonResponse(rawResp);
        if (!parsed) {
          failed++;
          continue;
        }

        const data = {
          processed_item_id: item.id,
          project_id: item.project_id,
          collection_plan_id: planId,
          answer: parsed.answer || null,
          summary: parsed.summary || null,
          entities: parsed.entities || [],
          topics: parsed.topics || [],
          sentiment: parsed.sentiment || 'NEUTRE',
          relevance_score: parsed.relevance_score || null,
          hypothesis_impact: parsed.hypothesis_impact || 'OPEN',
          confidence_score: parsed.confidence_score || null,
          raw_response: parsed,
          model_used: this.llm.primaryModel,
          prompt_version: '1.0',
        };

        await this.prisma.enrichedItem.upsert({
          where: { processed_item_id: item.id },
          create: data,
          update: data,
        });

        if (plan.hypothesis_id) {
          await this.updateHypothesisEvaluation(
            plan.hypothesis_id,
            item.project_id,
          );
        }
        processed++;
      } catch (error) {
        this.logger.error(
          `Error enriching item ${item.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
        failed++;
      }
    }

    await this.prisma.aiEnrichmentJob.update({
      where: { id: job.id },
      data: {
        status: 'DONE',
        finished_at: new Date(),
        total: rawItems.length,
        processed,
        skipped,
        failed,
      },
    });

    return { job_id: job.id, processed, skipped, failed };
  }

  async getEnrichedItems(
    projectId: string,
    page = 1,
    limit = 20,
    filters?: { hypothesis_id?: string; impact?: string; min_score?: number },
  ) {
    const skip = (page - 1) * limit;
    const where: any = { project_id: projectId };
    if (filters?.hypothesis_id) where.hypothesis_id = filters.hypothesis_id;
    if (filters?.impact) where.hypothesis_impact = filters.impact;
    if (filters?.min_score != null) {
      where.relevance_score = { gte: filters.min_score };
    }

    const [items, total] = await Promise.all([
      this.prisma.enrichedItem.findMany({
        where,
        orderBy: { enriched_at: 'desc' },
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
            source_url: true,
            article_url: true,
            content_excerpt: true,
          },
        })
      : [];
    const processedMap = Object.fromEntries(
      processedItems.map((p) => [p.id, p]),
    );

    const data = items.map((item) => ({
      ...item,
      title: processedMap[item.processed_item_id]?.title ?? null,
      source_type: processedMap[item.processed_item_id]?.source_type ?? null,
      source_name: processedMap[item.processed_item_id]?.source_name ?? null,
      processed_item: processedMap[item.processed_item_id] ?? null,
    }));

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async getEnrichmentJobs(projectId: string, limit = 10) {
    return this.prisma.aiEnrichmentJob.findMany({
      where: { project_id: projectId },
      orderBy: { created_at: 'desc' },
      take: limit,
    });
  }

  async getJobById(jobId: string) {
    return this.prisma.aiEnrichmentJob.findUnique({
      where: { id: jobId },
    });
  }

  async cancelJob(jobId: string) {
    const job = await this.prisma.aiEnrichmentJob.findUnique({ where: { id: jobId } });
    if (!job) throw new Error('Job introuvable');
    return this.prisma.aiEnrichmentJob.update({
      where: { id: jobId },
      data: { status: 'CANCELLED', finished_at: new Date() },
    });
  }

  async getHypothesisEvaluations(projectId: string) {
    return this.prisma.hypothesisEvaluation.findMany({
      where: { project_id: projectId },
      orderBy: { last_evaluated: 'desc' },
    });
  }

  async getEnrichmentStats(projectId: string) {
    const items = await this.prisma.enrichedItem.findMany({
      where: { project_id: projectId },
    });
    const total = items.length;
    const sentiments = { POSITIF: 0, NEGATIF: 0, NEUTRE: 0 };
    const impacts: Record<string, number> = {};
    let totalRelevance = 0;
    let totalConfidence = 0;
    let confidenceCount = 0;

    for (const item of items) {
      if (item.sentiment && sentiments[item.sentiment] !== undefined)
        sentiments[item.sentiment]++;
      if (item.hypothesis_impact)
        impacts[item.hypothesis_impact] =
          (impacts[item.hypothesis_impact] || 0) + 1;
      if (item.relevance_score) totalRelevance += item.relevance_score;
      if (item.confidence_score != null) {
        totalConfidence += item.confidence_score;
        confidenceCount++;
      }
    }

    const hypothesisEvaluations =
      await this.prisma.hypothesisEvaluation.findMany({
        where: { project_id: projectId },
      });

    return {
      total,
      total_enriched: total,
      avg_relevance:
        total > 0 ? Math.round((totalRelevance / total) * 100) / 100 : 0,
      avg_confidence:
        confidenceCount > 0
          ? Math.round((totalConfidence / confidenceCount) * 100) / 100
          : 0,
      hypotheses_evaluated: hypothesisEvaluations.length,
      model_used: process.env.OLLAMA_MODEL || 'mistral',
      sentiments,
      impacts,
      by_impact: impacts,
      hypothesis_evaluations: hypothesisEvaluations,
    };
  }

  private async updateHypothesisEvaluation(
    hypothesisId: string,
    projectId: string,
  ) {
    const enriched = await this.prisma.enrichedItem.findMany({
      where: { hypothesis_id: hypothesisId },
    });
    const support_count = enriched.filter(
      (e) => e.hypothesis_impact === 'SUPPORTED',
    ).length;
    const against_count = enriched.filter(
      (e) => e.hypothesis_impact === 'CONTRADICTED',
    ).length;
    const neutral_count = enriched.filter((e) =>
      ['OPEN', 'NEEDS_MORE_RESEARCH'].includes(e.hypothesis_impact || ''),
    ).length;
    const evidence_count = enriched.length;

    let status = 'OPEN';
    if (evidence_count > 0) {
      const ratio = support_count / evidence_count;
      if (ratio > 0.6) status = 'SUPPORTED';
      else if (ratio > 0.3) status = 'PARTIALLY_SUPPORTED';
      else if (against_count > support_count) status = 'CONTRADICTED';
      else status = 'NEEDS_MORE_RESEARCH';
    }

    const avgConf =
      enriched.reduce((acc, e) => acc + (e.confidence_score || 0), 0) /
      (evidence_count || 1);

    const existing = await this.prisma.hypothesisEvaluation.findUnique({
      where: { hypothesis_id: hypothesisId },
    });
    if (existing) {
      await this.prisma.hypothesisEvaluation.update({
        where: { hypothesis_id: hypothesisId },
        data: {
          status: status as any,
          confidence: avgConf,
          evidence_count,
          support_count,
          against_count,
          neutral_count,
          last_evaluated: new Date(),
        },
      });
    } else {
      await this.prisma.hypothesisEvaluation.create({
        data: {
          hypothesis_id: hypothesisId,
          project_id: projectId,
          status: status as any,
          confidence: avgConf,
          evidence_count,
          support_count,
          against_count,
          neutral_count,
        },
      });
    }
  }
}
