import { Controller, Post, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AiEnrichmentService } from './ai-enrichment.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Controller()
@UseGuards(JwtAuthGuard)
export class AiEnrichmentController {
  constructor(private readonly aiService: AiEnrichmentService) {}

  @Post('projects/:projectId/enrich')
  enrichProject(@Param('projectId') projectId: string) {
    return this.aiService.enrichProject(projectId);
  }

  @Post('collection-plans/:planId/enrich')
  enrichPlan(@Param('planId') planId: string) {
    return this.aiService.enrichPlan(planId);
  }

  @Get('projects/:projectId/enriched-items')
  getEnrichedItems(
    @Param('projectId') projectId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('hypothesis_id') hypothesisId?: string,
    @Query('impact') impact?: string,
    @Query('min_score') minScore?: string,
  ) {
    return this.aiService.getEnrichedItems(
      projectId,
      parseInt(page),
      parseInt(limit),
      {
        hypothesis_id: hypothesisId,
        impact,
        min_score: minScore != null ? parseFloat(minScore) : undefined,
      },
    );
  }

  @Get('projects/:projectId/enrichment-jobs')
  getEnrichmentJobs(
    @Param('projectId') projectId: string,
    @Query('limit') limit = '10',
  ) {
    return this.aiService.getEnrichmentJobs(projectId, parseInt(limit, 10));
  }

  @Get('projects/:projectId/enrichment-stats')
  getStats(@Param('projectId') projectId: string) {
    return this.aiService.getEnrichmentStats(projectId);
  }

  @Get('projects/:projectId/hypothesis-evaluations')
  getHypothesisEvals(@Param('projectId') projectId: string) {
    return this.aiService.getHypothesisEvaluations(projectId);
  }
}
