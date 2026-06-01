import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { CollectionManager } from './collection.manager';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Controller()
export class CollectionController {
  constructor(private readonly collectionManager: CollectionManager) {}

  // ─── Legacy ETL (Sprint 1/2) ──────────────────────────────────────────────
  @Post('etl/collect/project/:id')
  async runCollection(@Param('id') projectId: string) {
    const stats = await this.collectionManager.startCollection(projectId);
    return { message: 'Collecte terminée avec succès', ...stats };
  }

  // ─── Sprint 3 — Lancer collecte via collection plan ───────────────────────
  @Post('collection-plans/:planId/run')
  @UseGuards(JwtAuthGuard)
  async runPlan(@Param('planId') planId: string, @Request() req: any) {
    return this.collectionManager.runCollectionPlan(planId, req.user.userId);
  }

  // ─── Sprint 3 — Voir les jobs d'un plan ───────────────────────────────────
  @Get('collection-plans/:planId/jobs')
  @UseGuards(JwtAuthGuard)
  async getJobs(@Param('planId') planId: string) {
    return this.collectionManager.getJobsByPlan(planId);
  }

  // ─── Sprint 3 — Voir les raw items d'un plan ──────────────────────────────
  @Get('collection-plans/:planId/raw-items')
  @UseGuards(JwtAuthGuard)
  async getRawByPlan(
    @Param('planId') planId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.collectionManager.getRawItemsByPlan(
      planId,
      parseInt(page),
      parseInt(limit),
    );
  }

  // ─── Sprint 3 — Voir les raw items d'un projet ────────────────────────────
  @Get('projects/:projectId/raw-items')
  @UseGuards(JwtAuthGuard)
  async getRawByProject(
    @Param('projectId') projectId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.collectionManager.getRawItemsByProject(
      projectId,
      parseInt(page),
      parseInt(limit),
    );
  }
}
