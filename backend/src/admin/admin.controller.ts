import {
  Controller,
  Get,
  Delete,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { SuperAdminGuard } from '../auth/super-admin.guard';

@Controller('admin')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  async getDashboard() {
    return this.adminService.getDashboard();
  }

  @Get('users')
  async getUsers(@Query('page') page = '1', @Query('limit') limit = '20') {
    return this.adminService.getAllUsers(parseInt(page), parseInt(limit));
  }

  @Patch('users/:id')
  async updateUser(@Param('id') id: string, @Body() body: any) {
    return this.adminService.updateUser(id, body);
  }

  @Patch('users/:id/suspend')
  async suspendUser(@Param('id') id: string) {
    return this.adminService.suspendUser(id);
  }

  @Delete('users/:id')
  async deleteUser(@Param('id') id: string) {
    return this.adminService.deleteUser(id);
  }

  @Get('organisations')
  async getOrganisations(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.adminService.getAllOrganisations(
      parseInt(page),
      parseInt(limit),
    );
  }

  @Get('organisations/:id')
  async getOrganisation(@Param('id') id: string) {
    return this.adminService.getOrganisation(id);
  }

  @Patch('organisations/:id')
  async updateOrganisation(
    @Param('id') id: string,
    @Body() body: { nom?: string },
  ) {
    return this.adminService.updateOrganisation(id, body);
  }

  @Patch('organisations/:orgId/members/:memberId/role')
  async updateMemberRole(
    @Param('orgId') orgId: string,
    @Param('memberId') memberId: string,
    @Body() body: { role: string },
  ) {
    return this.adminService.updateOrganisationMemberRole(
      orgId,
      memberId,
      body.role,
    );
  }

  @Delete('organisations/:orgId/members/:memberId')
  async removeMember(
    @Param('orgId') orgId: string,
    @Param('memberId') memberId: string,
  ) {
    return this.adminService.removeOrganisationMember(orgId, memberId);
  }

  @Delete('organisations/:id')
  async deleteOrganisation(@Param('id') id: string) {
    return this.adminService.deleteOrganisation(id);
  }

  @Get('logs')
  async getLogs(@Query('page') page = '1', @Query('limit') limit = '50') {
    return this.adminService.getActivityLogs(parseInt(page), parseInt(limit));
  }

  @Get('projects')
  async getProjects() {
    return this.adminService.getProjectsSupervision();
  }

  @Get('pipeline')
  async getPipeline() {
    return this.adminService.getPipelineStatus();
  }

  @Get('quotas')
  async getQuotas() {
    return this.adminService.getQuotas();
  }
}
