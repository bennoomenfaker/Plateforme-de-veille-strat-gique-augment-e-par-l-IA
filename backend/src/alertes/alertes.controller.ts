import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { AlertesService } from './alertes.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Controller('alertes')
@UseGuards(JwtAuthGuard)
export class AlertesController {
  constructor(private readonly alertesService: AlertesService) {}

  // POST /alertes/check → vérification manuelle
  @Post('check')
  async checkAll() {
    return this.alertesService.checkAllAlerts();
  }

  // POST /alertes → créer alerte manuelle
  @Post()
  async create(@Body() body: any, @Request() req: any) {
    return this.alertesService.createAlert(body, req.user.userId);
  }

  // GET /alertes → mes alertes
  @Get()
  async getMyAlerts(
    @Request() req: any,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.alertesService.getMyAlerts(req.user.userId, parseInt(page), parseInt(limit));
  }

  // GET /alertes/unread → compter non lues
  @Get('unread')
  async countUnread(@Request() req: any) {
    return this.alertesService.countUnread(req.user.userId);
  }

  // GET /alertes/project/:projectId → alertes d'un projet
  @Get('project/:projectId')
  async getProjectAlerts(@Param('projectId') projectId: string, @Request() req: any) {
    return this.alertesService.getProjectAlerts(projectId, req.user.userId);
  }

  // PATCH /alertes/:id/read → marquer comme lu
  @Patch(':id/read')
  async markAsRead(@Param('id') id: string, @Request() req: any) {
    return this.alertesService.markAsRead(id, req.user.userId);
  }

  // PATCH /alertes/read-all → tout marquer comme lu
  @Patch('read-all/all')
  async markAllAsRead(@Request() req: any) {
    return this.alertesService.markAllAsRead(req.user.userId);
  }

  // DELETE /alertes/:id → supprimer
  @Delete(':id')
  async delete(@Param('id') id: string, @Request() req: any) {
    return this.alertesService.deleteAlert(id, req.user.userId);
  }
}
