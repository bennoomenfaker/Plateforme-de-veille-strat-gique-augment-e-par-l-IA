import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PerimetersService {
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

  async createPerimeter(projectId: string, userId: string, data: any) {
    await this.checkProjectAccess(projectId, userId);

    if (data.parent_id) {
      const parent = await this.prisma.projectPerimeter.findUnique({ where: { id: data.parent_id } });
      if (!parent) throw new NotFoundException('Périmètre parent introuvable');
      if (parent.type !== data.type) throw new BadRequestException('Le parent doit être du même type');
      if (parent.project_id !== projectId) throw new BadRequestException('Le parent doit appartenir au même projet');
    }

    return this.prisma.projectPerimeter.create({
      data: {
        name: data.name,
        type: data.type,
        parent_id: data.parent_id || null,
        project_id: projectId,
      },
    });
  }

  async getPerimeters(projectId: string, userId: string) {
    await this.checkProjectAccess(projectId, userId);
    return this.prisma.projectPerimeter.findMany({
      where: { project_id: projectId, parent_id: null },
      include: { children: { include: { children: true } } },
    });
  }

  async assignToHypothesis(hypothesisId: string, perimeterId: string, userId: string) {
    const hypothesis = await this.prisma.projectHypothesis.findUnique({
      where: { id: hypothesisId },
      include: { axis: { include: { objective: { include: { project: true } } } } },
    });
    if (!hypothesis) throw new NotFoundException('Hypothèse introuvable');

    const existing = await this.prisma.hypothesisPerimeter.findFirst({
      where: { hypothesis_id: hypothesisId, perimeter_id: perimeterId },
    });
    if (existing) throw new BadRequestException('Périmètre déjà assigné');

    return this.prisma.hypothesisPerimeter.create({
      data: { hypothesis_id: hypothesisId, perimeter_id: perimeterId },
    });
  }

  async removeFromHypothesis(hypothesisId: string, perimeterId: string, userId: string) {
    await this.prisma.hypothesisPerimeter.deleteMany({
      where: { hypothesis_id: hypothesisId, perimeter_id: perimeterId },
    });
    return { message: 'Périmètre retiré de l hypothèse' };
  }

  async deletePerimeter(perimeterId: string, userId: string) {
    const perimeter = await this.prisma.projectPerimeter.findUnique({ where: { id: perimeterId } });
    if (!perimeter) throw new NotFoundException('Périmètre introuvable');
    await this.checkProjectAccess(perimeter.project_id, userId);
    await this.prisma.projectPerimeter.delete({ where: { id: perimeterId } });
    return { message: 'Périmètre supprimé' };
  }
}
