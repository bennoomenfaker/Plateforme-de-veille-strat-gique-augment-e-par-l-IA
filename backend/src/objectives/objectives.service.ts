import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ObjectivesService {
  constructor(private prisma: PrismaService) {}

  private async checkProjectAccess(projectId: string, userId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { organisation: { include: { members: true } } },
    });
    if (!project) throw new NotFoundException('Projet introuvable');
    if (project.owner_user_id === userId) return project;
    if (
      project.organisation?.members.some(
        (m) => m.user_id === userId && m.statut === 'ACTIF',
      )
    )
      return project;
    throw new ForbiddenException('Accès refusé');
  }

  async createObjective(projectId: string, userId: string, data: any) {
    await this.checkProjectAccess(projectId, userId);

    const count = await this.prisma.projectObjective.count({
      where: { project_id: projectId },
    });
    if (count >= 5)
      throw new BadRequestException('Maximum 5 objectifs par projet');

    const objective = await this.prisma.projectObjective.create({
      data: {
        content: data.content,
        priority: data.priority || count + 1,
        project_id: projectId,
      },
    });

    await this.logActivity(
      userId,
      'CREATE_OBJECTIVE',
      'objective',
      objective.id,
    );
    return objective;
  }

  async getObjectives(projectId: string, userId: string) {
    await this.checkProjectAccess(projectId, userId);
    return this.prisma.projectObjective.findMany({
      where: { project_id: projectId },
      // Point 4.2 : On inclut les axes pour permettre le filtrage côté front si besoin
      include: {
        axes: {
          orderBy: { created_at: 'asc' },
        },
      },
      orderBy: { priority: 'asc' },
    });
  }

  async updateObjective(objectiveId: string, userId: string, data: any) {
    const objective = await this.prisma.projectObjective.findUnique({
      where: { id: objectiveId },
    });
    if (!objective) throw new NotFoundException('Objectif introuvable');
    await this.checkProjectAccess(objective.project_id, userId);

    const updated = await this.prisma.projectObjective.update({
      where: { id: objectiveId },
      data: {
        content: data.content !== undefined ? data.content : objective.content,
        priority:
          data.priority !== undefined ? data.priority : objective.priority,
      },
    });

    await this.logActivity(
      userId,
      'UPDATE_OBJECTIVE',
      'objective',
      objectiveId,
    );
    return updated;
  }

  async deleteObjective(objectiveId: string, userId: string) {
    const objective = await this.prisma.projectObjective.findUnique({
      where: { id: objectiveId },
      include: { axes: true },
    });

    if (!objective) throw new NotFoundException('Objectif introuvable');
    await this.checkProjectAccess(objective.project_id, userId);

    // Sécurité métier : On peut empêcher la suppression s'il y a des axes liés
    // Ou laisser Prisma gérer via onDelete: Cascade (déjà configuré normalement)

    await this.prisma.projectObjective.delete({ where: { id: objectiveId } });

    await this.logActivity(
      userId,
      'DELETE_OBJECTIVE',
      'objective',
      objectiveId,
    );
    return { message: 'Objectif supprimé avec succès' };
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
    } catch (e) {
      // On ne bloque pas l'exécution si le log échoue
    }
  }
}
