import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HypothesesService {
  constructor(private prisma: PrismaService) {}

  private async checkAxisAccess(axisId: string, userId: string) {
    const axis = await this.prisma.projectAxis.findUnique({
      where: { id: axisId },
      include: {
        objective: {
          include: {
            project: {
              include: { organisation: { include: { members: true } } },
            },
          },
        },
      },
    });
    if (!axis) throw new NotFoundException('Axe introuvable');
    const project = axis.objective.project;
    if (project.owner_user_id === userId) return axis;
    if (
      project.organisation?.members.some(
        (m) => m.user_id === userId && m.statut === 'ACTIF',
      )
    )
      return axis;
    throw new ForbiddenException('Accès refusé');
  }

  async createHypothesis(axisId: string, userId: string, data: any) {
    await this.checkAxisAccess(axisId, userId);
    const count = await this.prisma.projectHypothesis.count({
      where: { axis_id: axisId },
    });

    const hypothesis = await this.prisma.projectHypothesis.create({
      data: {
        content: data.content,
        priority: data.priority || count + 1,
        statut: data.statut || 'OPEN',
        axis_id: axisId,
      },
    });

    await this.logActivity(
      userId,
      'CREATE_HYPOTHESIS',
      'hypothesis',
      hypothesis.id,
    );
    return hypothesis;
  }

  async getHypotheses(axisId: string, userId: string) {
    await this.checkAxisAccess(axisId, userId);
    return this.prisma.projectHypothesis.findMany({
      where: { axis_id: axisId },
      include: {
        collection_plans: { include: { sources: true, keywords: true } },
        hypothesis_perimeters: { include: { perimeter: true } },
      },
      orderBy: { priority: 'asc' },
    });
  }

  /**
   * Point 5 : CRUD Complet (Update & Réaffectation)
   */
  async updateHypothesis(hypothesisId: string, userId: string, data: any) {
    const hypothesis = await this.prisma.projectHypothesis.findUnique({
      where: { id: hypothesisId },
    });
    if (!hypothesis) throw new NotFoundException('Hypothèse introuvable');

    // Vérifier l'accès à l'axe actuel
    await this.checkAxisAccess(hypothesis.axis_id, userId);

    // Point 4.1 : Si on change d'axe (réaffectation), vérifier l'accès au nouvel axe
    if (data.axis_id && data.axis_id !== hypothesis.axis_id) {
      await this.checkAxisAccess(data.axis_id, userId);
    }

    const updated = await this.prisma.projectHypothesis.update({
      where: { id: hypothesisId },
      data: {
        content: data.content,
        priority: data.priority,
        statut: data.statut,
        axis_id: data.axis_id, // Support de la réaffectation
      },
    });

    await this.logActivity(
      userId,
      'UPDATE_HYPOTHESIS',
      'hypothesis',
      hypothesisId,
    );
    return updated;
  }

  /**
   * Point 5 : CRUD Complet (Delete)
   */
  async deleteHypothesis(hypothesisId: string, userId: string) {
    const hypothesis = await this.prisma.projectHypothesis.findUnique({
      where: { id: hypothesisId },
    });
    if (!hypothesis) throw new NotFoundException('Hypothèse introuvable');

    await this.checkAxisAccess(hypothesis.axis_id, userId);

    // La suppression supprimera automatiquement les plans de collecte liés (Cascade)
    await this.prisma.projectHypothesis.delete({ where: { id: hypothesisId } });

    await this.logActivity(
      userId,
      'DELETE_HYPOTHESIS',
      'hypothesis',
      hypothesisId,
    );
    return { message: 'Hypothèse supprimée avec succès' };
  }

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
