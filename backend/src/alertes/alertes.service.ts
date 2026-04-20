import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AlertesService {
  private readonly logger = new Logger(AlertesService.name);

  constructor(private prisma: PrismaService) {}

  // ─── CRON : toutes les heures ────────────────────────────────────────────────
  @Cron(CronExpression.EVERY_HOUR)
  async handleScheduledAlerts() {
    this.logger.log('Verification automatique des alertes...');
    await this.checkAllAlerts();
  }

  // ─── Vérifier toutes les alertes ─────────────────────────────────────────────
  async checkAllAlerts(): Promise<{ created: number }> {
    const projects = await this.prisma.project.findMany({
      where: { isActive: true },
      include: {
        sources: true,
        alerts: true,
      },
    });

    let created = 0;

    for (const project of projects) {
      const count = await this.checkProjectAlerts(project);
      created += count;
    }

    this.logger.log(`Alertes creees: ${created}`);
    return { created };
  }

  // ─── Vérifier les alertes d'un projet ────────────────────────────────────────
  private async checkProjectAlerts(project: any): Promise<number> {
    const keywords = project.keywords as string[];
    if (!keywords || keywords.length === 0) return 0;

    // Récupérer les WatchResults récents non alertés
    const recentResults = await this.prisma.watchResult.findMany({
      where: {
        projectId: project.id,
        createdAt: { gte: new Date(Date.now() - 24 * 3600000) },
      },
    });

    let created = 0;

    for (const result of recentResults) {
      // Alerte si sentiment négatif
      if (result.sentiment === 'NEGATIF') {
        const existing = await this.prisma.alert.findFirst({
          where: {
            projectId: project.id,
            message: { contains: result.id },
          },
        });

        if (!existing) {
          const userId = project.owner_user_id;
          if (userId) {
            await this.prisma.alert.create({
              data: {
                message: `Sentiment negatif detecte: "${result.title}" [${result.id}]`,
                projectId: project.id,
                userId,
              },
            });
            created++;
          }
        }
      }

      // Alerte si mot-clé critique trouvé
      const resultKeywords = result.keywords as string[] || [];
      const criticalMatch = keywords.some(kw =>
        resultKeywords.some(rk => rk.toLowerCase().includes(kw.toLowerCase()))
      );

      if (criticalMatch) {
        const existing = await this.prisma.alert.findFirst({
          where: {
            projectId: project.id,
            message: { contains: `keyword:${result.id}` },
          },
        });

        if (!existing) {
          const userId = project.owner_user_id;
          if (userId) {
            await this.prisma.alert.create({
              data: {
                message: `Mot-cle detecte dans: "${result.title}" [keyword:${result.id}]`,
                projectId: project.id,
                userId,
              },
            });
            created++;
          }
        }
      }
    }

    return created;
  }

  // ─── Créer une alerte manuelle ────────────────────────────────────────────────
  async createAlert(data: any, userId: string) {
    return this.prisma.alert.create({
      data: {
        message: data.message,
        projectId: data.projectId,
        userId,
      },
    });
  }

  // ─── Récupérer mes alertes ────────────────────────────────────────────────────
  async getMyAlerts(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.alert.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: { project: { select: { nom: true } } },
      }),
      this.prisma.alert.count({ where: { userId } }),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ─── Récupérer alertes d'un projet ───────────────────────────────────────────
  async getProjectAlerts(projectId: string, userId: string) {
    return this.prisma.alert.findMany({
      where: { projectId, userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── Marquer comme lu ────────────────────────────────────────────────────────
  async markAsRead(alertId: string, userId: string) {
    return this.prisma.alert.update({
      where: { id: alertId },
      data: { isRead: true },
    });
  }

  // ─── Marquer toutes comme lues ───────────────────────────────────────────────
  async markAllAsRead(userId: string) {
    await this.prisma.alert.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return { message: 'Toutes les alertes marquees comme lues' };
  }

  // ─── Supprimer une alerte ────────────────────────────────────────────────────
  async deleteAlert(alertId: string, userId: string) {
    await this.prisma.alert.delete({ where: { id: alertId } });
    return { message: 'Alerte supprimee' };
  }

  // ─── Compter alertes non lues ─────────────────────────────────────────────────
  async countUnread(userId: string) {
    const count = await this.prisma.alert.count({
      where: { userId, isRead: false },
    });
    return { unread: count };
  }
}
