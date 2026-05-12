import { Controller, Get, Delete, Param, Query, UseGuards, Request } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { SuperAdminGuard } from '../auth/super-admin.guard';

@Controller('admin')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // GET /admin/dashboard → stats globales
  @Get('dashboard')
  async getDashboard() {
    return this.adminService.getDashboard();
  }

  // GET /admin/users → tous les utilisateurs
  @Get('users')
  async getUsers(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.adminService.getAllUsers(parseInt(page), parseInt(limit));
  }

  // DELETE /admin/users/:id → supprimer utilisateur
  @Delete('users/:id')
  async deleteUser(@Param('id') id: string) {
    return this.adminService.deleteUser(id);
  }

  // GET /admin/organisations → toutes les organisations
  @Get('organisations')
  async getOrganisations(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.adminService.getAllOrganisations(parseInt(page), parseInt(limit));
  }

  // DELETE /admin/organisations/:id → supprimer organisation
  @Delete('organisations/:id')
  async deleteOrganisation(@Param('id') id: string) {
    return this.adminService.deleteOrganisation(id);
  }

  // GET /admin/logs → logs d'activités
  @Get('logs')
  async getLogs(
    @Query('page') page = '1',
    @Query('limit') limit = '50',
  ) {
    return this.adminService.getActivityLogs(parseInt(page), parseInt(limit));
  }

  // GET /admin/projects → supervision projets
  @Get('projects')
  async getProjects() {
    return this.adminService.getProjectsSupervision();
  }

  // GET /admin/pipeline → supervision ETL
  @Get('pipeline')
  async getPipeline() {
    return this.adminService.getPipelineStatus();
  }

  // GET /admin/quotas → gestion quotas
  @Get('quotas')
  async getQuotas() {
    return this.adminService.getQuotas();
  }
}
