import { Controller, Get, Post, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { PerimetersService } from './perimeters.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Controller()
@UseGuards(JwtAuthGuard)
export class PerimetersController {
  constructor(private readonly perimetersService: PerimetersService) {}

  @Post('projects/:projectId/perimeters')
  create(@Param('projectId') projectId: string, @Body() body: any, @Request() req: any) {
    return this.perimetersService.createPerimeter(projectId, req.user.userId, body);
  }

  @Get('projects/:projectId/perimeters')
  findAll(@Param('projectId') projectId: string, @Request() req: any) {
    return this.perimetersService.getPerimeters(projectId, req.user.userId);
  }

  @Post('hypotheses/:hypothesisId/perimeters/:perimeterId')
  assign(@Param('hypothesisId') hypothesisId: string, @Param('perimeterId') perimeterId: string, @Request() req: any) {
    return this.perimetersService.assignToHypothesis(hypothesisId, perimeterId, req.user.userId);
  }

  @Delete('hypotheses/:hypothesisId/perimeters/:perimeterId')
  removeFromHypothesis(@Param('hypothesisId') hypothesisId: string, @Param('perimeterId') perimeterId: string, @Request() req: any) {
    return this.perimetersService.removeFromHypothesis(hypothesisId, perimeterId, req.user.userId);
  }

  @Delete('perimeters/:perimeterId')
  remove(@Param('perimeterId') perimeterId: string, @Request() req: any) {
    return this.perimetersService.deletePerimeter(perimeterId, req.user.userId);
  }
}
