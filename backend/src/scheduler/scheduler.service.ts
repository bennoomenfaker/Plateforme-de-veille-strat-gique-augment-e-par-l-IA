import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(private prisma: PrismaService) {}

  // S'exécute au début de chaque heure
  @Cron(CronExpression.EVERY_HOUR)
  async handleCron() {
    this.logger.log('Démarrage de la vérification des collectes...');

    const now = new Date();

    // 1. Trouver les plans actifs dont la date next_run_at est passée
    const plansToExecute = await this.prisma.collectionPlan.findMany({
      where: {
        is_active: true,
        next_run_at: { lte: now }, // lte = Less Than or Equal (Date passée ou maintenant)
      },
    });

    if (plansToExecute.length === 0) {
      this.logger.debug('Aucune collecte à exécuter pour le moment.');
      return;
    }

    for (const plan of plansToExecute) {
      try {
        this.logger.log(`Exécution de la collecte pour le plan: ${plan.id}`);

        // --- ICI : Tu appelleras ton futur service de scraping/RSS ---
        // await this.scraperService.run(plan.id);

        // 2. Calculer la prochaine date d'exécution
        const nextDate = this.calculateNextRun(plan.frequency);

        // 3. Mettre à jour le plan dans la DB
        await this.prisma.collectionPlan.update({
          where: { id: plan.id },
          data: {
            last_run_at: now,
            next_run_at: nextDate,
          },
        });

      } catch (error) {
        this.logger.error(`Erreur lors du plan ${plan.id}:`, error);
      }
    }
  }

  private calculateNextRun(frequency: string): Date {
    const next = new Date();
    switch (frequency.toUpperCase()) {
      case 'DAILY':
        next.setDate(next.getDate() + 1);
        break;
      case 'WEEKLY':
        next.setDate(next.getDate() + 7);
        break;
      case 'MONTHLY':
        next.setMonth(next.getMonth() + 1);
        break;
      default:
        next.setDate(next.getDate() + 1); // Par défaut 24h
    }
    return next;
  }
}
