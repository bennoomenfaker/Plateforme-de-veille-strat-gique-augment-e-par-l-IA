import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AxesService {
  constructor(private prisma: PrismaService) {}

  private async checkObjectiveAccess(objectiveId: string, userId: string) {
    const objective = await this.prisma.projectObjective.findUnique({
      where: { id: objectiveId },
      include: {
        project: { include: { organisation: { include: { members: true } } } },
      },
    });
    if (!objective) throw new NotFoundException('Objectif introuvable');
    const project = objective.project;
    if (project.owner_user_id === userId) return objective;
    if (
      project.organisation?.members.some(
        (m) => m.user_id === userId && m.statut === 'ACTIF',
      )
    )
      return objective;
    throw new ForbiddenException('Accès refusé');
  }

  async createAxis(objectiveId: string, userId: string, data: any) {
    await this.checkObjectiveAccess(objectiveId, userId);

    const count = await this.prisma.projectAxis.count({
      where: { objective_id: objectiveId },
    });
    if (count >= 5)
      throw new BadRequestException('Maximum 5 axes par objectif');

    return this.prisma.projectAxis.create({
      data: {
        name: data.name,
        description: data.description,
        priority: data.priority || count + 1,
        objective_id: objectiveId,
      },
    });
  }

  async getAxes(objectiveId: string, userId: string) {
    await this.checkObjectiveAccess(objectiveId, userId);
    return this.prisma.projectAxis.findMany({
      where: { objective_id: objectiveId },
      include: {
        hypotheses: {
          include: { collection_plans: true },
        },
      },
      orderBy: { priority: 'asc' },
    });
  }

  async updateAxis(axisId: string, userId: string, data: any) {
    const axis = await this.prisma.projectAxis.findUnique({
      where: { id: axisId },
    });
    if (!axis) throw new NotFoundException('Axe introuvable');

    // Vérifier l'accès à l'objectif actuel
    await this.checkObjectiveAccess(axis.objective_id, userId);

    // Si on veut changer l'objectif (réaffectation), vérifier l'accès au nouvel objectif
    if (data.objective_id && data.objective_id !== axis.objective_id) {
      await this.checkObjectiveAccess(data.objective_id, userId);
    }

    return this.prisma.projectAxis.update({
      where: { id: axisId },
      data: {
        name: data.name,
        description: data.description,
        priority: data.priority,
        objective_id: data.objective_id, // Permet la réaffectation
      },
    });
  }

  async deleteAxis(axisId: string, userId: string) {
    const axis = await this.prisma.projectAxis.findUnique({
      where: { id: axisId },
    });
    if (!axis) throw new NotFoundException('Axe introuvable');
    await this.checkObjectiveAccess(axis.objective_id, userId);

    await this.prisma.projectAxis.delete({ where: { id: axisId } });
    return { message: 'Axe supprimé' };
  }
}
