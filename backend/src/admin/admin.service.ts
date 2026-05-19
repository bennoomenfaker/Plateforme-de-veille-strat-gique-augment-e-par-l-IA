import { Injectable } from '@nestjs/common';
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
      totalRawData,
      totalAlerts,
      recentUsers,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.organisation.count(),
      this.prisma.project.count(),
      this.prisma.source.count(),
      this.prisma.rawData.count(),
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
        totalRawData,
        totalAlerts,
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
          statut: true,           // ✅ CORRECTION #7 : était manquant
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

  // ✅ méthode deleteUser — était manquante ou mal déclarée
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

    const active   = projects.filter(p => p.isActive).length;
    const archived = projects.filter(p => !p.isActive).length;

    return {
      projects,
      stats: { total: projects.length, active, archived },
    };
  }

  // ─── Supervision pipeline ETL ─────────────────────────────────────────────
  async getPipelineStatus() {
    const [totalRaw, last24h, totalResults, pendingAnalysis] = await Promise.all([
      this.prisma.rawData.count(),
      this.prisma.rawData.count({
        where: { createdAt: { gte: new Date(Date.now() - 24 * 3600000) } },
      }),
      this.prisma.watchResult.count(),
      this.prisma.rawData.count({ where: { watchResult: null } }),
    ]);

    return {
      pipeline: {
        totalRawData:      totalRaw,
        collectedLast24h:  last24h,
        totalAnalysed:     totalResults,
        pendingAnalysis,
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
