import { Controller, Get, Post, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { StakeholdersService } from './stakeholders.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Controller('projects/:projectId/stakeholders')
@UseGuards(JwtAuthGuard)
export class StakeholdersController {
  constructor(private readonly stakeholdersService: StakeholdersService) {}

  @Post()
  add(@Param('projectId') projectId: string, @Body() body: any, @Request() req: any) {
    return this.stakeholdersService.addStakeholder(projectId, req.user.userId, body);
  }

  @Get()
  findAll(@Param('projectId') projectId: string, @Request() req: any) {
    return this.stakeholdersService.getStakeholders(projectId, req.user.userId);
  }

  @Delete(':stakeholderId')
  remove(@Param('stakeholderId') stakeholderId: string, @Request() req: any) {
    return this.stakeholdersService.removeStakeholder(stakeholderId, req.user.userId);
  }
}
