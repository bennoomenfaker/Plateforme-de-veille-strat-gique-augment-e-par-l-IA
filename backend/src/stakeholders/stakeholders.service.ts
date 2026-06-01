import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StakeholdersService {
  constructor(private prisma: PrismaService) {}

  async addStakeholder(projectId: string, userId: string, data: any) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { organisation: { include: { members: true } } },
    });
    if (!project) throw new NotFoundException('Projet introuvable');
    if (!project.organisation_id)
      throw new BadRequestException(
        'Les stakeholders sont uniquement pour les projets organisation',
      );
    if (
      project.owner_user_id !== userId &&
      !project.organisation?.members.some(
        (m) => m.user_id === userId && m.role === 'PROPRIETAIRE',
      )
    ) {
      throw new ForbiddenException(
        'Seul le propriétaire peut gérer les stakeholders',
      );
    }

    const isMember = project.organisation?.members.some(
      (m) => m.user_id === data.user_id,
    );
    if (!isMember)
      throw new BadRequestException(
        'L utilisateur doit être membre de l organisation',
      );

    const existing = await this.prisma.projectStakeholder.findFirst({
      where: { project_id: projectId, user_id: data.user_id },
    });
    if (existing)
      throw new BadRequestException('Cet utilisateur est déjà stakeholder');

    return this.prisma.projectStakeholder.create({
      data: {
        project_id: projectId,
        user_id: data.user_id,
        role: data.role || 'OBSERVATEUR',
      },
      include: { user: { select: { id: true, nom: true, email: true } } },
    });
  }

  async getStakeholders(projectId: string, userId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { organisation: { include: { members: true } } },
    });
    if (!project) throw new NotFoundException('Projet introuvable');

    return this.prisma.projectStakeholder.findMany({
      where: { project_id: projectId },
      include: { user: { select: { id: true, nom: true, email: true } } },
    });
  }

  async removeStakeholder(stakeholderId: string, userId: string) {
    const stakeholder = await this.prisma.projectStakeholder.findUnique({
      where: { id: stakeholderId },
    });
    if (!stakeholder) throw new NotFoundException('Stakeholder introuvable');
    await this.prisma.projectStakeholder.delete({
      where: { id: stakeholderId },
    });
    return { message: 'Stakeholder supprimé' };
  }
}
