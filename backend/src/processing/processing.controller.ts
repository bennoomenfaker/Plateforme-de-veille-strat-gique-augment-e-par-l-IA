import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ProcessingService } from './processing.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Controller()
@UseGuards(JwtAuthGuard)
export class ProcessingController {
  constructor(private readonly processingService: ProcessingService) {}

  @Post('projects/:id/process')
  @HttpCode(HttpStatus.OK)
  async processProject(@Param('id') projectId: string) {
    const result = await this.processingService.processProject(projectId);
    return { message: 'Processing terminé', ...result };
  }

  @Post('collection-plans/:id/process')
  @HttpCode(HttpStatus.OK)
  async processByPlan(@Param('id') planId: string) {
    const result = await this.processingService.processByPlan(planId);
    return { message: 'Processing terminé', ...result };
  }

  @Get('projects/:id/processed-items')
  async getByProject(
    @Param('id') projectId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('language') language?: string,
    @Query('source_type') sourceType?: string,
  ) {
    return this.processingService.getByProject(
      projectId,
      parseInt(page),
      parseInt(limit),
      language,
      sourceType,
    );
  }

  @Get('collection-plans/:id/processed-items')
  async getByPlan(
    @Param('id') planId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.processingService.getByPlan(
      planId,
      parseInt(page),
      parseInt(limit),
    );
  }

  @Get('projects/:id/processing-stats')
  async getStats(@Param('id') projectId: string) {
    return this.processingService.getStats(projectId);
  }

  @Get('processed-items/:id')
  async getById(@Param('id') id: string) {
    return this.processingService.getById(id);
  }
}
