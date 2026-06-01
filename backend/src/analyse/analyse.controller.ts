import { Controller, Get, Post, Param, Query, UseGuards } from '@nestjs/common';
import { AnalyseService } from './analyse.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Controller('analyse')
@UseGuards(JwtAuthGuard)
export class AnalyseController {
  constructor(private readonly analyseService: AnalyseService) {}

  @Post('project/:id')
  analyseProject(@Param('id') id: string) {
    return this.analyseService.analyseProject(id);
  }

  @Get('results/:id')
  getResults(
    @Param('id') id: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('sentiment') sentiment?: string,
    @Query('minRelevance') minRelevance?: string,
    @Query('impact') impact?: string,
  ) {
    return this.analyseService.getResults(id, parseInt(page), parseInt(limit), {
      sentiment,
      minRelevance,
      impact,
    });
  }

  @Get('stats/:id')
  getStats(@Param('id') id: string) {
    return this.analyseService.getStats(id);
  }

  @Get('dashboard/:id')
  getDashboard(@Param('id') id: string) {
    return this.analyseService.getProjectDashboard(id);
  }
}
