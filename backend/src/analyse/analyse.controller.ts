import { Controller, Get, Post, Param, Query, UseGuards } from '@nestjs/common';
import { AnalyseService } from './analyse.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Controller('analyse')
@UseGuards(JwtAuthGuard)
export class AnalyseController {
  constructor(private readonly analyseService: AnalyseService) {}

  // POST /analyse/run → lancer analyse manuelle globale
  @Post('run')
  async runAll() {
    return this.analyseService.analyseAllPending();
  }

  // POST /analyse/project/:projectId → analyser un projet
  @Post('project/:projectId')
  async analyseProject(@Param('projectId') projectId: string) {
    return this.analyseService.analyseProject(projectId);
  }

  // GET /analyse/results/:projectId → résultats d'un projet
  @Get('results/:projectId')
  async getResults(
    @Param('projectId') projectId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.analyseService.getResults(projectId, parseInt(page), parseInt(limit));
  }

  // GET /analyse/stats/:projectId → stats sentiment
  @Get('stats/:projectId')
  async getStats(@Param('projectId') projectId: string) {
    return this.analyseService.getSentimentStats(projectId);
  }
}
