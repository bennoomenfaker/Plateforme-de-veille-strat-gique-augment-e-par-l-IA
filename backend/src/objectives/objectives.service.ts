import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
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
    if (project.organisation?.members.some(m => m.user_id === userId && m.statut === 'ACTIF')) return project;
    throw new ForbiddenException('Accès refusé');
  }

  async createObjective(projectId: string, userId: string, data: any) {
    await this.checkProjectAccess(projectId, userId);

    const count = await this.prisma.projectObjective.count({ where: { project_id: projectId } });
    if (count >= 5) throw new BadRequestException('Maximum 5 objectifs par projet');

    const objective = await this.prisma.projectObjective.create({
      data: {
        content: data.content,
        priority: data.priority || count + 1,
        project_id: projectId,
      },
    });

    await this.logActivity(userId, 'CREATE_OBJECTIVE', 'objective', objective.id);
    return objective;
  }

  async getObjectives(projectId: string, userId: string) {
    await this.checkProjectAccess(projectId, userId);
    return this.prisma.projectObjective.findMany({
      where: { project_id: projectId },
      include: { axes: { include: { hypotheses: true } } },
      orderBy: { priority: 'asc' },
    });
  }

  async updateObjective(objectiveId: string, userId: string, data: any) {
    const objective = await this.prisma.projectObjective.findUnique({ where: { id: objectiveId } });
    if (!objective) throw new NotFoundException('Objectif introuvable');
    await this.checkProjectAccess(objective.project_id, userId);

    return this.prisma.projectObjective.update({
      where: { id: objectiveId },
      data: { content: data.content, priority: data.priority },
    });
  }

  async deleteObjective(objectiveId: string, userId: string) {
    const objective = await this.prisma.projectObjective.findUnique({ where: { id: objectiveId } });
    if (!objective) throw new NotFoundException('Objectif introuvable');
    await this.checkProjectAccess(objective.project_id, userId);

    await this.prisma.projectObjective.delete({ where: { id: objectiveId } });
    return { message: 'Objectif supprimé' };
  }

  private async logActivity(userId: string, action: string, entityType: string, entityId: string) {
    try {
      await this.prisma.userActivityLog.create({ data: { user_id: userId, action, entityType, entityId } });
    } catch {}
  }
}
