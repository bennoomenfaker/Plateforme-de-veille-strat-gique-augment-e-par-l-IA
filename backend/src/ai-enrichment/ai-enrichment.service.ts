import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LlmProviderService } from './llm-provider.service';
import { buildEnrichmentPrompt } from './prompt-templates/enrichment.prompt';

@Injectable()
export class AiEnrichmentService {
  private readonly logger = new Logger(AiEnrichmentService.name);

  constructor(
    private prisma: PrismaService,
    private llm: LlmProviderService,
  ) {}

  async enrichProject(projectId: string): Promise<any> {
    const job = await this.prisma.aiEnrichmentJob.create({
      data: { project_id: projectId, status: 'RUNNING', started_at: new Date() },
    });

    const items = await this.prisma.processedItem.findMany({
      where: { project_id: projectId },
      include: {
        raw_item: {
          select: { collection_plan_id: true },
        },
      },
    });

    let processed = 0, skipped = 0, failed = 0;

    for (const item of items) {
      try {
        const existing = await this.prisma.enrichedItem.findUnique({
          where: { processed_item_id: item.id },
        });
        if (existing) { skipped++; continue; }

        const planId = item.raw_item?.collection_plan_id || item.collection_plan_id;
        let question = 'Quelle est la pertinence de cet article ?';
        let hypothesis = '';
        let perimeters: string[] = [];

        if (planId) {
          const plan = await this.prisma.collectionPlan.findUnique({
            where: { id: planId },
            include: {
              hypothesis: {
                include: {
                  axis: { include: { objective: { include: { project: { include: { perimeters: true } } } } } },
                },
              },
            },
          });
          if (plan) {
            question = plan.question;
            hypothesis = plan.hypothesis?.content || '';
            perimeters = plan.hypothesis?.axis?.objective?.project?.perimeters?.map(p => p.name || '').filter(Boolean) || [];
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

        if (!parsed) { failed++; continue; }

        await this.prisma.enrichedItem.create({
          data: {
            processed_item_id: item.id,
            project_id: projectId,
            collection_plan_id: planId || null,
            hypothesis_id: null,
            answer: parsed.answer || null,
            summary: parsed.summary || null,
            entities: parsed.entities || [],
            topics: parsed.topics || [],
            sentiment: parsed.sentiment || 'NEUTRE',
            relevance_score: parsed.relevance_score || null,
            hypothesis_impact: parsed.hypothesis_impact || 'OPEN',
            confidence_score: parsed.confidence_score || null,
            raw_response: parsed,
            model_used: process.env.OLLAMA_MODEL || 'mistral',
            prompt_version: '1.0',
          },
        });

        if (planId) {
          const plan = await this.prisma.collectionPlan.findUnique({
            where: { id: planId },
            select: { hypothesis_id: true },
          });
          if (plan?.hypothesis_id) {
            await this.updateHypothesisEvaluation(plan.hypothesis_id, projectId, parsed.hypothesis_impact);
          }
        }

        processed++;
      } catch (err) {
        this.logger.error(`Error enriching item ${item.id}: ${err.message}`);
        failed++;
      }
    }

    await this.prisma.aiEnrichmentJob.update({
      where: { id: job.id },
      data: { status: 'DONE', finished_at: new Date(), total: items.length, processed, skipped, failed },
    });

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

    let processed = 0, skipped = 0, failed = 0;

    for (const raw of rawItems) {
      if (!raw.processed_item) { skipped++; continue; }
      const item = raw.processed_item;

      try {
        const existing = await this.prisma.enrichedItem.findUnique({ where: { processed_item_id: item.id } });
        if (existing) { skipped++; continue; }

        const prompt = buildEnrichmentPrompt({
          question: plan.question,
          hypothesis: plan.hypothesis?.content || '',
          perimeters: [],
          content: item.content_clean || item.content_excerpt || '',
          title: item.title || '',
        });

        const rawResp = await this.llm.generate(prompt);
        const parsed = this.llm.parseJsonResponse(rawResp);
        if (!parsed) { failed++; continue; }

        await this.prisma.enrichedItem.create({
          data: {
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
            model_used: process.env.OLLAMA_MODEL || 'mistral',
            prompt_version: '1.0',
          },
        });

        if (plan.hypothesis_id) {
          await this.updateHypothesisEvaluation(plan.hypothesis_id, item.project_id, parsed.hypothesis_impact);
        }

        processed++;
      } catch (err) {
        failed++;
      }
    }

    await this.prisma.aiEnrichmentJob.update({
      where: { id: job.id },
      data: { status: 'DONE', finished_at: new Date(), total: rawItems.length, processed, skipped, failed },
    });

    return { job_id: job.id, processed, skipped, failed };
  }

  async getEnrichedItems(projectId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.enrichedItem.findMany({
        where: { project_id: projectId },
        orderBy: { enriched_at: 'desc' },
        skip, take: limit,
      }),
      this.prisma.enrichedItem.count({ where: { project_id: projectId } }),
    ]);
    return { data, total, page, limit };
  }

  async getHypothesisEvaluations(projectId: string) {
    return this.prisma.hypothesisEvaluation.findMany({
      where: { project_id: projectId },
      orderBy: { last_evaluated: 'desc' },
    });
  }

  async getEnrichmentStats(projectId: string) {
    const items = await this.prisma.enrichedItem.findMany({ where: { project_id: projectId } });
    const total = items.length;
    const sentiments = { POSITIF: 0, NEGATIF: 0, NEUTRE: 0 };
    const impacts: Record<string, number> = {};
    let totalRelevance = 0;

    for (const item of items) {
      if (item.sentiment && sentiments[item.sentiment] !== undefined) sentiments[item.sentiment]++;
      if (item.hypothesis_impact) impacts[item.hypothesis_impact] = (impacts[item.hypothesis_impact] || 0) + 1;
      if (item.relevance_score) totalRelevance += item.relevance_score;
    }

    return { total, sentiments, impacts, avg_relevance: total > 0 ? totalRelevance / total : 0 };
  }

  private async updateHypothesisEvaluation(hypothesisId: string, projectId: string, impact: string) {
    const existing = await this.prisma.hypothesisEvaluation.findUnique({ where: { hypothesis_id: hypothesisId } });
    const enriched = await this.prisma.enrichedItem.findMany({ where: { hypothesis_id: hypothesisId } });

    const support_count = enriched.filter(e => e.hypothesis_impact === 'SUPPORTED').length;
    const against_count = enriched.filter(e => e.hypothesis_impact === 'CONTRADICTED').length;
    const neutral_count = enriched.filter(e => ['OPEN', 'NEEDS_MORE_RESEARCH'].includes(e.hypothesis_impact || '')).length;
    const evidence_count = enriched.length;

    let status = 'OPEN';
    if (evidence_count > 0) {
      const ratio = support_count / evidence_count;
      if (ratio > 0.6) status = 'SUPPORTED';
      else if (ratio > 0.3) status = 'PARTIALLY_SUPPORTED';
      else if (against_count > support_count) status = 'CONTRADICTED';
      else status = 'NEEDS_MORE_RESEARCH';
    }

    const avgConf = enriched.reduce((acc, e) => acc + (e.confidence_score || 0), 0) / (evidence_count || 1);

    if (existing) {
      await this.prisma.hypothesisEvaluation.update({
        where: { hypothesis_id: hypothesisId },
        data: { status: status as any, confidence: avgConf, evidence_count, support_count, against_count, neutral_count, last_evaluated: new Date() },
      });
    } else {
      await this.prisma.hypothesisEvaluation.create({
        data: { hypothesis_id: hypothesisId, project_id: projectId, status: status as any, confidence: avgConf, evidence_count, support_count, against_count, neutral_count },
      });
    }
  }
}
