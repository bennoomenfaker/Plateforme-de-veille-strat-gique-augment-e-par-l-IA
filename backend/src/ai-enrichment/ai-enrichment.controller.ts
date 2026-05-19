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
  ) {
    return this.aiService.getEnrichedItems(projectId, parseInt(page), parseInt(limit));
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
