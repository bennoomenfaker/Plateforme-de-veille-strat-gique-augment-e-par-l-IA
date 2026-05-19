import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { CollectionManager } from '../collection-engine/collection.manager';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private prisma: PrismaService,
    private collectionManager: CollectionManager,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleCron() {
    this.logger.log('Verification des plans de collecte...');

    const now = new Date();

    const plansToExecute = await this.prisma.collectionPlan.findMany({
      where: {
        is_active: true,
        frequency: { not: 'ON_DEMAND' },
        next_run_at: { lte: now },
      },
      include: {
        hypothesis: {
          include: {
            axis: {
              include: {
                objective: {
                  include: {
                    project: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (plansToExecute.length === 0) {
      this.logger.debug('Aucun plan a executer.');
      return;
    }

    this.logger.log(`${plansToExecute.length} plan(s) a executer`);

    for (const plan of plansToExecute) {
      try {
        const project = plan.hypothesis.axis.objective.project;
        const ownerId = project.owner_user_id;

        if (!ownerId) {
          this.logger.warn(`Plan ${plan.id} ignore : pas de owner_user_id`);
          continue;
        }

        this.logger.log(`Lancement collecte plan: ${plan.id}`);

        // ✅ CORRECTION 4 : passer SCHEDULED comme trigger_type
        await this.collectionManager.runCollectionPlan(
          plan.id,
          ownerId,
          'SCHEDULED', // trigger_type correct
        );

      } catch (error) {
        this.logger.error(`Erreur plan ${plan.id}: ${error.message}`);
      }
    }
  }
}
