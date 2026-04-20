import { Controller, Get, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { SourcesService } from './sources.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Controller('sources')
@UseGuards(JwtAuthGuard)
export class SourcesController {
  constructor(private readonly sourcesService: SourcesService) {}

  @Post()
  async create(@Body() body: any) {
    return this.sourcesService.createSource(body);
  }

  @Get('project/:projectId')
  async findByProject(@Param('projectId') projectId: string) {
    return this.sourcesService.getSourcesByProject(projectId);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.sourcesService.deleteSource(id);
  }
}
