import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ObjectivesService } from './objectives.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Controller('projects/:projectId/objectives')
@UseGuards(JwtAuthGuard)
export class ObjectivesController {
  constructor(private readonly objectivesService: ObjectivesService) {}

  @Post()
  create(@Param('projectId') projectId: string, @Body() body: any, @Request() req: any) {
    return this.objectivesService.createObjective(projectId, req.user.userId, body);
  }

  @Get()
  findAll(@Param('projectId') projectId: string, @Request() req: any) {
    return this.objectivesService.getObjectives(projectId, req.user.userId);
  }

  @Put(':objectiveId')
  update(@Param('objectiveId') objectiveId: string, @Body() body: any, @Request() req: any) {
    return this.objectivesService.updateObjective(objectiveId, req.user.userId, body);
  }

  @Delete(':objectiveId')
  remove(@Param('objectiveId') objectiveId: string, @Request() req: any) {
    return this.objectivesService.deleteObjective(objectiveId, req.user.userId);
  }
}
