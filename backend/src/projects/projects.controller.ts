import { Controller, Get, Post, Put, Patch, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  // POST /projects → projet individuel
  @Post()
  async create(@Body() body: any, @Request() req: any) {
    return this.projectsService.createProject(body, req.user.userId);
  }

  // POST /projects/organisation/:orgId → projet d'organisation
  @Post('organisation/:orgId')
  async createOrgProject(@Param('orgId') orgId: string, @Body() body: any, @Request() req: any) {
    return this.projectsService.createOrgProject(body, req.user.userId, orgId);
  }

  // GET /projects → mes projets (individuels + organisations)
  @Get()
  async findAll(@Request() req: any) {
    return this.projectsService.getMyProjects(req.user.userId);
  }

  // GET /projects/archived → projets archivés
  @Get('archived')
  async getArchived(@Request() req: any) {
    return this.projectsService.getArchivedProjects(req.user.userId);
  }

  // GET /projects/:id → détail projet
  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req: any) {
    return this.projectsService.getProject(id, req.user.userId);
  }

  // PUT /projects/:id → modifier paramètres
  @Put(':id')
  async update(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    return this.projectsService.updateProject(id, req.user.userId, body);
  }

  // PATCH /projects/:id/archive → archiver
  @Patch(':id/archive')
  async archive(@Param('id') id: string, @Request() req: any) {
    return this.projectsService.archiveProject(id, req.user.userId);
  }

  // DELETE /projects/:id → supprimer
  @Delete(':id')
  async remove(@Param('id') id: string, @Request() req: any) {
    return this.projectsService.deleteProject(id, req.user.userId);
  }
}
