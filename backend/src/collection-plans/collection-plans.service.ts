import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CollectionPlansService {
  constructor(private prisma: PrismaService) {}

  private async checkHypothesisAccess(hypothesisId: string, userId: string) {
    const hypothesis = await this.prisma.projectHypothesis.findUnique({
      where: { id: hypothesisId },
      include: {
        axis: {
          include: {
            objective: {
              include: {
                project: { include: { organisation: { include: { members: true } } } },
              },
            },
          },
        },
      },
    });
    if (!hypothesis) throw new NotFoundException('Hypothèse introuvable');
    const project = hypothesis.axis.objective.project;
    if (project.owner_user_id === userId) return { hypothesis, project };
    if (project.organisation?.members.some(m => m.user_id === userId && m.statut === 'ACTIF')) return { hypothesis, project };
    throw new ForbiddenException('Accès refusé');
  }

  async createCollectionPlan(hypothesisId: string, userId: string, data: any) {
    const { hypothesis, project } = await this.checkHypothesisAccess(hypothesisId, userId);

    if (!data.question) throw new BadRequestException('La question est obligatoire');
    if (!data.frequency) throw new BadRequestException('La fréquence est obligatoire');

    if (data.collection_end_date && project.end_date) {
      if (new Date(data.collection_end_date) > new Date(project.end_date)) {
        throw new BadRequestException('collection_end_date doit être <= project.end_date');
      }
    }
    if (data.collection_start_date && project.start_date) {
      if (new Date(data.collection_start_date) < new Date(project.start_date)) {
        throw new BadRequestException('collection_start_date doit être >= project.start_date');
      }
    }

    const plan = await this.prisma.collectionPlan.create({
      data: {
        question: data.question,
        frequency: data.frequency,
        collection_start_date: data.collection_start_date ? new Date(data.collection_start_date) : null,
        collection_end_date: data.collection_end_date ? new Date(data.collection_end_date) : null,
        hypothesis_id: hypothesisId,
      },
    });

    await this.logActivity(userId, 'CREATE_COLLECTION_PLAN', 'collection_plan', plan.id);
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

  async updateCollectionPlan(planId: string, userId: string, data: any) {
    const plan = await this.prisma.collectionPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException('Plan de collecte introuvable');
    await this.checkHypothesisAccess(plan.hypothesis_id, userId);

    return this.prisma.collectionPlan.update({
      where: { id: planId },
      data: {
        question: data.question,
        frequency: data.frequency,
        collection_start_date: data.collection_start_date ? new Date(data.collection_start_date) : undefined,
        collection_end_date: data.collection_end_date ? new Date(data.collection_end_date) : undefined,
      },
    });
  }

  async deleteCollectionPlan(planId: string, userId: string) {
    const plan = await this.prisma.collectionPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException('Plan de collecte introuvable');
    await this.checkHypothesisAccess(plan.hypothesis_id, userId);
    await this.prisma.collectionPlan.delete({ where: { id: planId } });
    return { message: 'Plan de collecte supprimé' };
  }

  async addSource(planId: string, userId: string, data: any) {
    const plan = await this.prisma.collectionPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException('Plan introuvable');
    await this.checkHypothesisAccess(plan.hypothesis_id, userId);

    return this.prisma.collectionPlanSource.create({
      data: {
        source_type: data.source_type || 'RSS',
        source_label: data.source_label,
        source_url: data.source_url,
        collection_plan_id: planId,
      },
    });
  }

  async removeSource(sourceId: string, userId: string) {
    const source = await this.prisma.collectionPlanSource.findUnique({ where: { id: sourceId } });
    if (!source) throw new NotFoundException('Source introuvable');
    await this.prisma.collectionPlanSource.delete({ where: { id: sourceId } });
    return { message: 'Source supprimée' };
  }

  async addKeyword(planId: string, userId: string, data: any) {
    const plan = await this.prisma.collectionPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException('Plan introuvable');
    await this.checkHypothesisAccess(plan.hypothesis_id, userId);

    return this.prisma.collectionPlanKeyword.create({
      data: {
        keyword: data.keyword,
        keyword_type: data.keyword_type || 'PRINCIPAL',
        collection_plan_id: planId,
      },
    });
  }

  async removeKeyword(keywordId: string, userId: string) {
    const keyword = await this.prisma.collectionPlanKeyword.findUnique({ where: { id: keywordId } });
    if (!keyword) throw new NotFoundException('Mot-clé introuvable');
    await this.prisma.collectionPlanKeyword.delete({ where: { id: keywordId } });
    return { message: 'Mot-clé supprimé' };
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

  private async logActivity(userId: string, action: string, entityType: string, entityId: string) {
    try {
      await this.prisma.userActivityLog.create({ data: { user_id: userId, action, entityType, entityId } });
    } catch {}
  }
}
