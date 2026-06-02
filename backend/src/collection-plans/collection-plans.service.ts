import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrgAccessService } from '../common/org-access.service';

// ─── Helper validation URL ────────────────────────────────────────────────────
function isValidUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function validateSourcePayload(data: any) {
  const type = (data.source_type || 'RSS').toUpperCase();
  const metadata = data.metadata || {};

  if (type === 'DOCUMENT' || type === 'UPLOAD') {
    if (!data.source_label?.trim()) {
      throw new BadRequestException(
        'Le libellé est obligatoire pour une source document',
      );
    }
    return { type, metadata, url: data.source_url?.trim() || null };
  }

  if (type === 'API') {
    if (!data.source_url?.trim()) {
      throw new BadRequestException("L'URL de l'endpoint API est obligatoire");
    }
    if (!isValidUrl(data.source_url.trim())) {
      throw new BadRequestException('URL API invalide');
    }
    return {
      type,
      url: data.source_url.trim(),
      metadata: {
        api_key: data.api_key || metadata.api_key || null,
        api_method: data.api_method || metadata.api_method || 'GET',
        api_headers: data.api_headers || metadata.api_headers || null,
      },
    };
  }

  if (!data.source_url?.trim()) {
    throw new BadRequestException(
      "L'URL est obligatoire pour ce type de source",
    );
  }
  if (!isValidUrl(data.source_url.trim())) {
    throw new BadRequestException(
      "L'URL doit être valide et commencer par http:// ou https://",
    );
  }
  return { type, url: data.source_url.trim(), metadata: metadata || {} };
}

@Injectable()
export class CollectionPlansService {
  constructor(
    private prisma: PrismaService,
    private orgAccess: OrgAccessService,
  ) {}

  // ── Vérification accès hypothèse ─────────────────────────────────────────
  private async loadHypothesisContext(hypothesisId: string) {
    const hypothesis = await this.prisma.projectHypothesis.findUnique({
      where: { id: hypothesisId },
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
    });
    if (!hypothesis) throw new NotFoundException('Hypothèse introuvable');
    return { hypothesis, project: hypothesis.axis.objective.project };
  }

  private async checkHypothesisAccess(
    hypothesisId: string,
    userId: string,
    write = false,
  ) {
    const { hypothesis, project } =
      await this.loadHypothesisContext(hypothesisId);
    if (write) {
      await this.orgAccess.assertProjectWrite(project.id, userId);
    } else {
      await this.orgAccess.assertProjectRead(project.id, userId);
    }
    return { hypothesis, project };
  }

  // ── Helper : comparaison date sans heure ──────────────────────────────────
  private toDateOnly(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  // ════════════════════════════════════════════════════════════════════════════
  // COLLECTION PLANS — CRUD
  // ════════════════════════════════════════════════════════════════════════════

  async createCollectionPlan(hypothesisId: string, userId: string, data: any) {
    const { project } = await this.checkHypothesisAccess(
      hypothesisId,
      userId,
      true,
    );

    if (!data.question)
      throw new BadRequestException('La question est obligatoire');
    if (!data.frequency)
      throw new BadRequestException('La fréquence est obligatoire');

    const startDate = data.collection_start_date
      ? new Date(data.collection_start_date)
      : new Date();
    const endDate = data.collection_end_date
      ? new Date(data.collection_end_date)
      : null;

    // Validation : fin >= début
    if (endDate && endDate < startDate) {
      throw new BadRequestException(
        'La date de fin de collecte ne peut pas être antérieure au début.',
      );
    }

    // Validation : fin <= fin projet
    if (endDate && project.end_date && endDate > new Date(project.end_date)) {
      throw new BadRequestException(
        'La date de fin de collecte doit être inférieure ou égale à celle du projet.',
      );
    }

    // Validation : début >= début projet
    const startDateOnly = this.toDateOnly(startDate);
    const projectStartOnly = this.toDateOnly(new Date(project.start_date));
    if (startDateOnly < projectStartOnly) {
      throw new BadRequestException(
        'La date de début de collecte doit être supérieure ou égale à celle du projet.',
      );
    }

    const plan = await this.prisma.collectionPlan.create({
      data: {
        question: data.question,
        frequency: data.frequency,
        collection_start_date: startDate,
        collection_end_date: endDate,
        hypothesis_id: hypothesisId,
        next_run_at: new Date(),
      },
    });

    await this.logActivity(
      userId,
      'CREATE_COLLECTION_PLAN',
      'collection_plan',
      plan.id,
    );
    return plan;
  }

  async getCollectionPlans(hypothesisId: string, userId: string) {
    await this.checkHypothesisAccess(hypothesisId, userId);
    return this.prisma.collectionPlan.findMany({
      where: { hypothesis_id: hypothesisId },
      include: { sources: true, keywords: true },
      orderBy: { created_at: 'asc' },
    });
  }

  async getPlanById(planId: string, userId: string) {
    const plan = await this.prisma.collectionPlan.findUnique({
      where: { id: planId },
      include: { sources: true, keywords: true, hypothesis: true },
    });
    if (!plan) throw new NotFoundException('Plan introuvable');
    await this.checkHypothesisAccess(plan.hypothesis_id, userId);
    return plan;
  }

  async updateCollectionPlan(planId: string, userId: string, data: any) {
    const plan = await this.prisma.collectionPlan.findUnique({
      where: { id: planId },
      include: {
        hypothesis: {
          include: {
            axis: {
              include: {
                objective: { include: { project: true } },
              },
            },
          },
        },
      },
    });

    if (!plan) throw new NotFoundException('Plan de collecte introuvable');
    await this.checkHypothesisAccess(plan.hypothesis_id, userId, true);

    const project = plan.hypothesis.axis.objective.project;
    const newStartDate = data.collection_start_date
      ? new Date(data.collection_start_date)
      : plan.collection_start_date;
    const newEndDate = data.collection_end_date
      ? new Date(data.collection_end_date)
      : plan.collection_end_date;

    // Validation : fin >= début
    if (
      newEndDate &&
      newStartDate &&
      new Date(newEndDate) < new Date(newStartDate)
    ) {
      throw new BadRequestException(
        'La date de fin de collecte ne peut pas être antérieure au début.',
      );
    }

    // Validation : fin <= fin projet
    if (
      newEndDate &&
      project.end_date &&
      new Date(newEndDate) > new Date(project.end_date)
    ) {
      throw new BadRequestException(
        'La date de fin de collecte dépasse la fin du projet.',
      );
    }

    const updated = await this.prisma.collectionPlan.update({
      where: { id: planId },
      data: {
        question: data.question,
        frequency: data.frequency,
        collection_start_date: data.collection_start_date
          ? new Date(data.collection_start_date)
          : undefined,
        collection_end_date: data.collection_end_date
          ? new Date(data.collection_end_date)
          : undefined,
        next_run_at: data.frequency ? new Date() : undefined,
      },
    });

    await this.logActivity(
      userId,
      'UPDATE_COLLECTION_PLAN',
      'collection_plan',
      planId,
    );
    return updated;
  }

  async deleteCollectionPlan(planId: string, userId: string) {
    const plan = await this.prisma.collectionPlan.findUnique({
      where: { id: planId },
    });
    if (!plan) throw new NotFoundException('Plan de collecte introuvable');
    await this.checkHypothesisAccess(plan.hypothesis_id, userId, true);
    await this.prisma.collectionPlan.delete({ where: { id: planId } });
    return { message: 'Plan de collecte supprimé' };
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SOURCES
  // ════════════════════════════════════════════════════════════════════════════

  async addSource(planId: string, userId: string, data: any) {
    const plan = await this.prisma.collectionPlan.findUnique({
      where: { id: planId },
    });
    if (!plan) throw new NotFoundException('Plan introuvable');
    await this.checkHypothesisAccess(plan.hypothesis_id, userId, true);

    const validated = validateSourcePayload(data);

    return this.prisma.collectionPlanSource.create({
      data: {
        source_type: validated.type,
        source_label: data.source_label?.trim() || validated.url || 'Document',
        source_url: validated.url,
        frequency: data.frequency || 'DAILY',
        metadata: validated.metadata,
        collection_plan_id: planId,
      },
    });
  }

  async updateSource(
    planId: string,
    sourceId: string,
    userId: string,
    data: any,
  ) {
    // Vérifier accès au plan
    const plan = await this.prisma.collectionPlan.findUnique({
      where: { id: planId },
    });
    if (!plan) throw new NotFoundException('Plan introuvable');
    await this.checkHypothesisAccess(plan.hypothesis_id, userId, true);

    // Vérifier que la source existe et appartient au plan
    const source = await this.prisma.collectionPlanSource.findUnique({
      where: { id: sourceId },
    });
    if (!source) throw new NotFoundException('Source introuvable');
    if (source.collection_plan_id !== planId) {
      throw new ForbiddenException(
        "Cette source n'appartient pas à ce plan de collecte",
      );
    }

    const merged = {
      ...source,
      ...data,
      source_type: data.source_type ?? source.source_type,
    };
    const validated = validateSourcePayload(merged);

    const updated = await this.prisma.collectionPlanSource.update({
      where: { id: sourceId },
      data: {
        source_type: validated.type,
        source_label: data.source_label ?? source.source_label,
        source_url: validated.url,
        frequency: data.frequency ?? source.frequency,
        metadata: validated.metadata,
      },
    });

    await this.logActivity(
      userId,
      'UPDATE_SOURCE',
      'collection_plan_source',
      sourceId,
    );
    return updated;
  }

  async removeSource(sourceId: string, userId: string) {
    const source = await this.prisma.collectionPlanSource.findUnique({
      where: { id: sourceId },
    });
    if (!source) throw new NotFoundException('Source introuvable');

    // Vérifier accès via le plan
    const plan = await this.prisma.collectionPlan.findUnique({
      where: { id: source.collection_plan_id },
    });
    if (plan) {
      await this.checkHypothesisAccess(plan.hypothesis_id, userId, true);
    }

    await this.prisma.collectionPlanSource.delete({ where: { id: sourceId } });
    return { message: 'Source supprimée' };
  }

  // ════════════════════════════════════════════════════════════════════════════
  // KEYWORDS
  // ════════════════════════════════════════════════════════════════════════════

  async addKeyword(planId: string, userId: string, data: any) {
    const plan = await this.prisma.collectionPlan.findUnique({
      where: { id: planId },
    });
    if (!plan) throw new NotFoundException('Plan introuvable');
    await this.checkHypothesisAccess(plan.hypothesis_id, userId, true);

    if (!data.keyword || data.keyword.trim() === '') {
      throw new BadRequestException('Le mot-clé est obligatoire');
    }

    return this.prisma.collectionPlanKeyword.create({
      data: {
        keyword: data.keyword.trim(),
        keyword_type: data.keyword_type || 'PRINCIPAL',
        collection_plan_id: planId,
      },
    });
  }

  async removeKeyword(keywordId: string, userId: string) {
    const keyword = await this.prisma.collectionPlanKeyword.findUnique({
      where: { id: keywordId },
    });
    if (!keyword) throw new NotFoundException('Mot-clé introuvable');

    // Vérifier accès via le plan
    const plan = await this.prisma.collectionPlan.findUnique({
      where: { id: keyword.collection_plan_id },
    });
    if (plan) {
      await this.checkHypothesisAccess(plan.hypothesis_id, userId, true);
    }

    await this.prisma.collectionPlanKeyword.delete({
      where: { id: keywordId },
    });
    return { message: 'Mot-clé supprimé' };
  }

  // ─── Logger ───────────────────────────────────────────────────────────────
  private async logActivity(
    userId: string,
    action: string,
    entityType: string,
    entityId: string,
  ) {
    try {
      await this.prisma.userActivityLog.create({
        data: { user_id: userId, action, entityType, entityId },
      });
    } catch {}
  }
}
