import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

  private async checkAccess(projectId: string, userId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { organisation: { include: { members: true } } },
    });
    if (!project) throw new NotFoundException('Projet introuvable');
    if (project.owner_user_id === userId) return project;
    if (project.organisation?.members.some(m => m.user_id === userId && m.statut === 'ACTIF')) return project;
    throw new ForbiddenException('Accès refusé à ce projet');
  }

  async createProject(data: any, userId: string) {
    const project = await this.prisma.project.create({
      data: {
        nom: data.nom,
        description: data.description,
        veille_type: data.veille_type || 'RSS',
        keywords: data.keywords || [],
        frequency: data.frequency || 'DAILY',
        start_date: data.start_date ? new Date(data.start_date) : null,
        end_date: data.end_date ? new Date(data.end_date) : null,
        folder_id: data.folder_id || null,
        owner_user_id: userId,
      },
    });
    await this.logActivity(userId, 'CREATE_PROJECT', 'project', project.id);
    return project;
  }

  async createOrgProject(data: any, userId: string, organisationId: string) {
    const membre = await this.prisma.membreOrganisation.findFirst({
      where: { organisation_id: organisationId, user_id: userId, role: { in: ['PROPRIETAIRE', 'MANAGER'] }, statut: 'ACTIF' },
    });
    if (!membre) throw new ForbiddenException('Accès insuffisant pour créer un projet');

    const project = await this.prisma.project.create({
      data: {
        nom: data.nom,
        description: data.description,
        veille_type: data.veille_type || 'RSS',
        keywords: data.keywords || [],
        frequency: data.frequency || 'DAILY',
        start_date: data.start_date ? new Date(data.start_date) : null,
        end_date: data.end_date ? new Date(data.end_date) : null,
        folder_id: data.folder_id || null,
        organisation_id: organisationId,
      },
    });
    await this.logActivity(userId, 'CREATE_PROJECT', 'project', project.id);
    return project;
  }

  async getMyProjects(userId: string) {
    const individualProjects = await this.prisma.project.findMany({
      where: { owner_user_id: userId, isActive: true, is_deleted: false },
      include: { sources: true, folder: true, objectives: { include: { axes: { include: { hypotheses: true } } } } },
    });

    const memberships = await this.prisma.membreOrganisation.findMany({
      where: { user_id: userId, statut: 'ACTIF' },
      select: { organisation_id: true },
    });
    const orgIds = memberships.map(m => m.organisation_id);

    const orgProjects = orgIds.length > 0
      ? await this.prisma.project.findMany({
          where: { organisation_id: { in: orgIds }, isActive: true, is_deleted: false },
          include: { sources: true, folder: true, organisation: { select: { nom: true } }, objectives: { include: { axes: { include: { hypotheses: true } } } } },
        })
      : [];

    return { individual: individualProjects, organisation: orgProjects };
  }

  async getProject(id: string, userId: string) {
    const project = await this.checkAccess(id, userId);
    return this.prisma.project.findUnique({
      where: { id },
      include: {
        sources: true,
        folder: true,
        organisation: { select: { nom: true } },
        objectives: {
          include: {
            axes: {
              include: {
                hypotheses: {
                  include: {
                    collection_plans: { include: { sources: true, keywords: true } },
                    hypothesis_perimeters: { include: { perimeter: true } },
                  },
                },
              },
            },
          },
          orderBy: { priority: 'asc' },
        },
        perimeters: { where: { parent_id: null }, include: { children: true } },
        stakeholders: { include: { user: { select: { id: true, nom: true, email: true } } } },
      },
    });
  }

  async updateProject(id: string, userId: string, data: any) {
    await this.checkAccess(id, userId);
    const updated = await this.prisma.project.update({
      where: { id },
      data: {
        nom: data.nom,
        description: data.description,
        veille_type: data.veille_type,
        keywords: data.keywords,
        frequency: data.frequency,
        start_date: data.start_date ? new Date(data.start_date) : undefined,
        end_date: data.end_date ? new Date(data.end_date) : undefined,
        folder_id: data.folder_id,
      },
    });
    await this.logActivity(userId, 'UPDATE_PROJECT', 'project', id);
    return updated;
  }

  async archiveProject(id: string, userId: string) {
    await this.checkAccess(id, userId);
    const archived = await this.prisma.project.update({
      where: { id },
      data: { isActive: false },
    });
    await this.logActivity(userId, 'ARCHIVE_PROJECT', 'project', id);
    return { message: 'Projet archivé', project: archived };
  }

  async deleteProject(id: string, userId: string) {
    await this.checkAccess(id, userId);
    await this.prisma.project.update({ where: { id }, data: { is_deleted: true } });
    await this.logActivity(userId, 'DELETE_PROJECT', 'project', id);
    return { message: 'Projet supprimé' };
  }

  async getArchivedProjects(userId: string) {
    return this.prisma.project.findMany({
      where: { owner_user_id: userId, isActive: false, is_deleted: false },
    });
  }

  private async logActivity(userId: string, action: string, entityType: string, entityId: string) {
    try {
      await this.prisma.userActivityLog.create({ data: { user_id: userId, action, entityType, entityId } });
    } catch {}
  }
}
