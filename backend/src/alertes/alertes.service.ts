import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../auth-mail/mail.service';

@Injectable()
export class AlertesService {
  private readonly logger = new Logger(AlertesService.name);

  constructor(
    private prisma: PrismaService,
    private mailService: MailService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleScheduledAlerts() {
    this.logger.log('Verification automatique des alertes...');
    await this.checkAllAlerts();
  }

  async checkAllAlerts(): Promise<{ created: number }> {
    const projects = await this.prisma.project.findMany({
      where: { isActive: true, is_deleted: false },
      select: {
        id: true,
        nom: true,
        owner_user_id: true,
        organisation_id: true,
      },
    });

    let created = 0;
    for (const project of projects) {
      const count = await this.checkProjectAlerts(project);
      created += count;
    }
    this.logger.log(`Alertes créées: ${created}`);
    return { created };
  }

  private async getProjectUserId(project: any): Promise<string | null> {
    if (project.owner_user_id) return project.owner_user_id;
    if (project.organisation_id) {
      const owner = await this.prisma.membreOrganisation.findFirst({
        where: {
          organisation_id: project.organisation_id,
          role: 'PROPRIETAIRE',
          statut: 'ACTIF',
        },
        select: { user_id: true },
      });
      return owner?.user_id ?? null;
    }
    return null;
  }

  private async checkProjectAlerts(project: any): Promise<number> {
    const userId = await this.getProjectUserId(project);
    if (!userId) return 0;

    const since = new Date(Date.now() - 24 * 3600000);
    const recentItems = await this.prisma.enrichedItem.findMany({
      where: { project_id: project.id, enriched_at: { gte: since } },
    });

    let created = 0;

    for (const item of recentItems) {
      // Alerte score élevé (>= 0.8)
      if ((item.relevance_score ?? 0) >= 0.8) {
        const key = `high_score:${item.id}`;
        const exists = await this.prisma.alert.findFirst({
          where: { projectId: project.id, message: { contains: key } },
        });
        if (!exists) {
          await this.prisma.alert.create({
            data: {
              message: `Score élevé (${Math.round((item.relevance_score ?? 0) * 100)}%) détecté [${key}]`,
              projectId: project.id,
              userId,
            },
          });
          created++;

          // Envoi email pour alerte critique
          try {
            const user = await this.prisma.user.findUnique({
              where: { id: userId },
              select: { email: true },
            });
            if (user?.email) {
              const score = Math.round((item.relevance_score ?? 0) * 100);
              await this.mailService.sendAlertEmail(
                user.email,
                project.nom,
                score,
              );
            }
          } catch (err) {
            this.logger.error(
              `Échec envoi email alerte critique: ${err instanceof Error ? err.message : String(err)}`,
            );
          }
        }
      }

      // Alerte hypothèse contredite
      if (item.hypothesis_impact === 'CONTRADICTED') {
        const key = `contradicted:${item.id}`;
        const exists = await this.prisma.alert.findFirst({
          where: { projectId: project.id, message: { contains: key } },
        });
        if (!exists) {
          await this.prisma.alert.create({
            data: {
              message: `Hypothèse contredite détectée dans un article récent [${key}]`,
              projectId: project.id,
              userId,
            },
          });
          created++;
        }
      }

      // Alerte nouveau contenu pertinent (>= 0.6)
      if (
        (item.relevance_score ?? 0) >= 0.6 &&
        item.hypothesis_impact === 'SUPPORTED'
      ) {
        const key = `relevant:${item.id}`;
        const exists = await this.prisma.alert.findFirst({
          where: { projectId: project.id, message: { contains: key } },
        });
        if (!exists) {
          await this.prisma.alert.create({
            data: {
              message: `Nouveau contenu pertinent supportant une hypothèse [${key}]`,
              projectId: project.id,
              userId,
            },
          });
          created++;
        }
      }
    }

    return created;
  }

  async createAlert(data: any, userId: string) {
    return this.prisma.alert.create({
      data: { message: data.message, projectId: data.projectId, userId },
    });
  }

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

  async getProjectAlerts(projectId: string, userId: string) {
    return this.prisma.alert.findMany({
      where: { projectId, userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async markAsRead(alertId: string, userId: string) {
    return this.prisma.alert.updateMany({
      where: { id: alertId, userId },
      data: { isRead: true },
    });
  }

  async markAllAsRead(userId: string) {
    await this.prisma.alert.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return { message: 'Toutes les alertes marquées comme lues' };
  }

  async deleteAlert(alertId: string, userId: string) {
    await this.prisma.alert.deleteMany({
      where: { id: alertId, userId },
    });
    return { message: 'Alerte supprimée' };
  }

  async countUnread(userId: string) {
    const count = await this.prisma.alert.count({
      where: { userId, isRead: false },
    });
    return { unread: count };
  }
}
