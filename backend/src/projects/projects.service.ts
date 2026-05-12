import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Vérifie si l'utilisateur a le droit d'accéder ou modifier le projet
   */
  private async checkAccess(projectId: string, userId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { organisation: { include: { members: true } } },
    });
    if (!project) throw new NotFoundException('Projet introuvable');
    
    // Propriétaire direct
    if (project.owner_user_id === userId) return project;
    
    // Membre de l'organisation avec statut actif
    if (project.organisation?.members.some(m => m.user_id === userId && m.statut === 'ACTIF')) {
      return project;
    }
    
    throw new ForbiddenException('Accès refusé à ce projet');
  }

  /**
   * Création d'un projet individuel (Sprint 1.2: Dates verrouillées)
   */
  async createProject(data: any, userId: string) {
    if (data.end_date) {
      throw new BadRequestException('La date de clôture ne peut pas être définie à la création.');
    }

    const project = await this.prisma.project.create({
      data: {
        nom: data.nom,
        description: data.description,
        monitoring_type: data.monitoring_type || 'TECHNOLOGICAL',
        keywords: data.keywords || [],
        frequency: data.frequency || 'DAILY',
        // start_date est auto-généré par @default(now()) dans Prisma
        end_date: null, 
        folder_id: data.folder_id || null,
        owner_user_id: userId,
      },
    });
    await this.logActivity(userId, 'CREATE_PROJECT', 'project', project.id);
    return project;
  }

  /**
   * Création d'un projet d'organisation
   */
  async createOrgProject(data: any, userId: string, organisationId: string) {
    const membre = await this.prisma.membreOrganisation.findFirst({
      where: { 
        organisation_id: organisationId, 
        user_id: userId, 
        role: { in: ['PROPRIETAIRE', 'MANAGER'] }, 
        statut: 'ACTIF' 
      },
    });
    if (!membre) throw new ForbiddenException('Accès insuffisant pour créer un projet d\'organisation');

    if (data.end_date) {
      throw new BadRequestException('La date de clôture ne peut pas être définie à la création.');
    }

    const project = await this.prisma.project.create({
      data: {
        nom: data.nom,
        description: data.description,
        monitoring_type: data.monitoring_type || 'TECHNOLOGICAL',
        keywords: data.keywords || [],
        frequency: data.frequency || 'DAILY',
        end_date: null,
        folder_id: data.folder_id || null,
        organisation_id: organisationId,
      },
    });
    await this.logActivity(userId, 'CREATE_PROJECT', 'project', project.id);
    return project;
  }


  async getMyProjects(userId: string) {
    const commonFilter = { is_deleted: false, isActive: true };

    const individualProjects = await this.prisma.project.findMany({
      where: { ...commonFilter, owner_user_id: userId },
      include: { 
        folder: true, 
        objectives: { include: { axes: { include: { hypotheses: true } } } } 
      },
    });

    const memberships = await this.prisma.membreOrganisation.findMany({
      where: { user_id: userId, statut: 'ACTIF' },
      select: { organisation_id: true },
    });
    const orgIds = memberships.map(m => m.organisation_id);

    const orgProjects = orgIds.length > 0
      ? await this.prisma.project.findMany({
          where: { ...commonFilter, organisation_id: { in: orgIds } },
          include: { 
            folder: true, 
            organisation: { select: { nom: true } }, 
            objectives: { include: { axes: { include: { hypotheses: true } } } } 
          },
        })
      : [];

    return { individual: individualProjects, organisation: orgProjects };
  }

/**
   * Détail complet d'un projet
   */
  async getProject(id: string, userId: string) {
  await this.checkAccess(id, userId);
  return this.prisma.project.findUnique({
    where: { id },
    include: {
      sources: true,
      folder: true,
      // CORRECTIF : On récupère tous les périmètres (GEOGRAPHIC et SECTORAL)
      // sans chercher de parentId ou de children car ils sont désormais au même niveau.
      perimeters: true, 
      organisation: { select: { nom: true } },
      objectives: {
        include: {
          axes: {
            include: {
              hypotheses: {
                include: {
                  collection_plans: { 
                    include: { sources: true, keywords: true } 
                  },
                  // Rappel : l'inclusion de perimeters ici a été supprimée
                  // pour éviter l'erreur de type sur ProjectHypothesis.
                },
              },
            },
          },
        },
        orderBy: { priority: 'asc' },
      },
      stakeholders: { 
        include: { user: { select: { id: true, nom: true, email: true } } } 
      },
    },
  });
}

  /**
   * Mise à jour    */
  async updateProject(id: string, userId: string, data: any) {
    const project = await this.checkAccess(id, userId);

    if (data.end_date) {
      const newEndDate = new Date(data.end_date);
      // Comparaison avec la date de début réelle du projet
      if (newEndDate < project.start_date) {
        throw new BadRequestException('La date de fin ne peut pas être antérieure à la date de début.');
      }
    }

    const updated = await this.prisma.project.update({
      where: { id },
      data: {
        nom: data.nom,
        description: data.description,
        monitoring_type: data.monitoring_type,
        keywords: data.keywords,
        frequency: data.frequency,
        end_date: data.end_date ? new Date(data.end_date) : undefined,
        folder_id: data.folder_id,
      },
    });
    await this.logActivity(userId, 'UPDATE_PROJECT', 'project', id);
    return updated;
  }

  /**
   * Clôture formelle 
   */
  async closeProject(id: string, userId: string) {
    await this.checkAccess(id, userId);
    const closed = await this.prisma.project.update({
      where: { id },
      data: { 
        isActive: false, 
        end_date: new Date() 
      },
    });
    await this.logActivity(userId, 'CLOSE_PROJECT', 'project', id);
    return closed;
  }

  /**
   * Archive un projet sans le supprimer
   */
  async archiveProject(id: string, userId: string) {
    await this.checkAccess(id, userId);
    const archived = await this.prisma.project.update({
      where: { id },
      data: { isActive: false },
    });
    await this.logActivity(userId, 'ARCHIVE_PROJECT', 'project', id);
    return { message: 'Projet archivé', project: archived };
  }

  /**
   * Soft Delete 
   */
  async deleteProject(id: string, userId: string) {
    await this.checkAccess(id, userId);
    await this.prisma.project.update({ 
      where: { id }, 
      data: { 
        is_deleted: true,
        deleted_at: new Date() 
      } 
    });
    await this.logActivity(userId, 'DELETE_PROJECT', 'project', id);
    return { message: 'Projet supprimé avec succès' };
  }

  async getArchivedProjects(userId: string) {
    return this.prisma.project.findMany({
      where: { owner_user_id: userId, isActive: false, is_deleted: false },
    });
  }

  private async logActivity(userId: string, action: string, entityType: string, entityId: string) {
    try {
      await this.prisma.userActivityLog.create({ 
        data: { user_id: userId, action, entityType, entityId } 
      });
    } catch {}
  }
}
