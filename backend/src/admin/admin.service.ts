import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  // ─── Dashboard global ─────────────────────────────────────────────────────
  async getDashboard() {
    const [
      totalUsers,
      totalOrgs,
      totalProjects,
      totalSources,
      totalRawItems,
      totalProcessed,
      totalEnriched,
      totalAlerts,
      recentUsers,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.organisation.count(),
      this.prisma.project.count(),
      this.prisma.source.count(),
      this.prisma.rawItem.count(),
      this.prisma.processedItem.count({ where: { processing_status: 'DONE' } }),
      this.prisma.enrichedItem.count(),
      this.prisma.alert.count(),
      this.prisma.user.findMany({
        orderBy: { created_at: 'desc' },
        take: 5,
        select: {
          id: true,
          nom: true,
          email: true,
          type_utilisateur: true,
          created_at: true,
        },
      }),
    ]);

    const individuels = await this.prisma.user.count({
      where: { type_utilisateur: 'INDIVIDUEL' },
    });
    const organisations = await this.prisma.user.count({
      where: { type_utilisateur: 'ORGANISATION' },
    });

    return {
      stats: {
        totalUsers,
        individuels,
        organisations,
        totalOrgs,
        totalProjects,
        totalSources,
        totalRawItems,
        totalProcessed,
        totalEnriched,
        totalAlerts,
        // Legacy (anciens projets ETL)
        totalRawData: totalRawItems,
      },
      recentUsers,
    };
  }

  // ─── Gestion des utilisateurs ─────────────────────────────────────────────
  async getAllUsers(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          nom: true,
          email: true,
          type_utilisateur: true,
          statut: true, // ✅ CORRECTION #7 : était manquant
          created_at: true,
          memberships: {
            select: {
              role: true,
              organisation: { select: { nom: true } },
            },
          },
        },
      }),
      this.prisma.user.count(),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async updateUser(
    userId: string,
    data: {
      nom?: string;
      email?: string;
      statut?: string;
      type_utilisateur?: string;
    },
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.nom !== undefined ? { nom: data.nom } : {}),
        ...(data.email !== undefined ? { email: data.email } : {}),
        ...(data.statut !== undefined ? { statut: data.statut as any } : {}),
        ...(data.type_utilisateur !== undefined
          ? { type_utilisateur: data.type_utilisateur as any }
          : {}),
      },
      select: {
        id: true,
        nom: true,
        email: true,
        type_utilisateur: true,
        statut: true,
        created_at: true,
      },
    });
    return updated;
  }

  async suspendUser(userId: string) {
    return this.updateUser(userId, { statut: 'SUSPENDU' });
  }

  async deleteUser(userId: string) {
    await this.prisma.user.delete({ where: { id: userId } });
    return { message: 'Utilisateur supprimé' };
  }

  // ─── Gestion des organisations ────────────────────────────────────────────
  async getAllOrganisations(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.organisation.findMany({
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          owner: { select: { nom: true, email: true } },
          _count: { select: { members: true, projects: true } },
        },
      }),
      this.prisma.organisation.count(),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getOrganisation(orgId: string) {
    const org = await this.prisma.organisation.findUnique({
      where: { id: orgId },
      include: {
        owner: { select: { id: true, nom: true, email: true } },
        members: {
          include: {
            user: {
              select: { id: true, nom: true, email: true, statut: true },
            },
          },
        },
        _count: { select: { projects: true } },
      },
    });
    if (!org) throw new NotFoundException('Organisation introuvable');
    return org;
  }

  async updateOrganisation(orgId: string, data: { nom?: string }) {
    const org = await this.prisma.organisation.findUnique({
      where: { id: orgId },
    });
    if (!org) throw new NotFoundException('Organisation introuvable');
    return this.prisma.organisation.update({
      where: { id: orgId },
      data: { ...(data.nom !== undefined ? { nom: data.nom.trim() } : {}) },
    });
  }

  async updateOrganisationMemberRole(
    orgId: string,
    memberUserId: string,
    role: string,
  ) {
    if (role === 'PROPRIETAIRE') {
      throw new BadRequestException(
        "Impossible d'assigner le rôle propriétaire via cette action",
      );
    }
    const membre = await this.prisma.membreOrganisation.findFirst({
      where: { organisation_id: orgId, user_id: memberUserId },
    });
    if (!membre) throw new NotFoundException('Membre introuvable');
    return this.prisma.membreOrganisation.update({
      where: { id: membre.id },
      data: { role: role as any },
    });
  }

  async removeOrganisationMember(orgId: string, memberUserId: string) {
    const org = await this.prisma.organisation.findUnique({
      where: { id: orgId },
    });
    if (!org) throw new NotFoundException('Organisation introuvable');
    if (org.owner_id === memberUserId) {
      throw new NotFoundException('Impossible de supprimer le propriétaire');
    }
    const membre = await this.prisma.membreOrganisation.findFirst({
      where: { organisation_id: orgId, user_id: memberUserId },
    });
    if (!membre) throw new NotFoundException('Membre introuvable');
    await this.prisma.membreOrganisation.delete({ where: { id: membre.id } });
    return { message: 'Membre retiré' };
  }

  async deleteOrganisation(orgId: string) {
    await this.prisma.organisation.delete({ where: { id: orgId } });
    return { message: 'Organisation supprimée' };
  }

  // ─── Logs d'activités ─────────────────────────────────────────────────────
  async getActivityLogs(page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.userActivityLog.findMany({
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          user: { select: { nom: true, email: true } },
        },
      }),
      this.prisma.userActivityLog.count(),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ─── Supervision projets ──────────────────────────────────────────────────
  async getProjectsSupervision() {
    const projects = await this.prisma.project.findMany({
      include: {
        _count: {
          select: {
            sources: true,
            rawData: true,
            results: true,
            alerts: true,
          },
        },
        owner_user: { select: { nom: true, email: true } },
        organisation: { select: { nom: true } },
      },
      orderBy: { created_at: 'desc' },
    });

    const active = projects.filter((p) => p.isActive).length;
    const archived = projects.filter((p) => !p.isActive).length;

    return {
      projects,
      stats: { total: projects.length, active, archived },
    };
  }

  // ─── Supervision pipeline (collecte → traitement → enrichissement IA) ───────
  async getPipelineStatus() {
    const since24h = new Date(Date.now() - 24 * 3600000);

    const [
      totalRawItems,
      collectedLast24h,
      totalProcessed,
      pendingProcessing,
      totalEnriched,
      pendingEnrichment,
      activeJobs,
      failedJobs24h,
    ] = await Promise.all([
      this.prisma.rawItem.count(),
      this.prisma.rawItem.count({ where: { fetched_at: { gte: since24h } } }),
      this.prisma.processedItem.count({ where: { processing_status: 'DONE' } }),
      this.prisma.rawItem.count({ where: { processed_item: null } }),
      this.prisma.enrichedItem.count(),
      (async () => {
        const enrichedIds = await this.prisma.enrichedItem.findMany({
          select: { processed_item_id: true },
        });
        const ids = enrichedIds.map((e) => e.processed_item_id);
        return this.prisma.processedItem.count({
          where: {
            processing_status: 'DONE',
            ...(ids.length > 0 ? { id: { notIn: ids } } : {}),
          },
        });
      })(),
      this.prisma.collectionJob.count({ where: { status: 'RUNNING' } }),
      this.prisma.collectionJob.count({
        where: { status: 'FAILED', created_at: { gte: since24h } },
      }),
    ]);

    const completionRate =
      totalRawItems > 0
        ? Math.round((totalProcessed / totalRawItems) * 100)
        : 0;
    const enrichmentRate =
      totalProcessed > 0
        ? Math.round((totalEnriched / totalProcessed) * 100)
        : 0;

    return {
      pipeline: {
        totalRawItems,
        collectedLast24h,
        totalProcessed,
        pendingProcessing,
        totalEnriched,
        pendingEnrichment,
        activeJobs,
        failedJobs24h,
        completionRate,
        enrichmentRate,
        // Alias legacy pour compatibilité UI
        totalRawData: totalRawItems,
        totalAnalysed: totalEnriched,
        pendingAnalysis: pendingEnrichment,
      },
    };
  }

  // ─── Gestion des quotas ───────────────────────────────────────────────────
  async getQuotas() {
    const usersWithProjects = await this.prisma.user.findMany({
      select: {
        id: true,
        nom: true,
        email: true,
        type_utilisateur: true,
        _count: { select: { individual_projects: true } },
      },
    });

    const orgsWithProjects = await this.prisma.organisation.findMany({
      select: {
        id: true,
        nom: true,
        _count: { select: { projects: true, members: true } },
      },
    });

    return { users: usersWithProjects, organisations: orgsWithProjects };
  }
}
