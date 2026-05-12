import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { AxesService } from './axes.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Controller('objectives/:objectiveId/axes')
@UseGuards(JwtAuthGuard)
export class AxesController {
  constructor(private readonly axesService: AxesService) {}

  @Post()
  create(@Param('objectiveId') objectiveId: string, @Body() body: any, @Request() req: any) {
    return this.axesService.createAxis(objectiveId, req.user.userId, body);
  }

  @Get()
  findAll(@Param('objectiveId') objectiveId: string, @Request() req: any) {
    return this.axesService.getAxes(objectiveId, req.user.userId);
  }

  @Put(':axisId')
  update(@Param('axisId') axisId: string, @Body() body: any, @Request() req: any) {
    return this.axesService.updateAxis(axisId, req.user.userId, body);
  }

  @Delete(':axisId')
  remove(@Param('axisId') axisId: string, @Request() req: any) {
    return this.axesService.deleteAxis(axisId, req.user.userId);
  }
}
