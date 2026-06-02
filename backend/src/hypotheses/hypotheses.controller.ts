import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { HypothesesService } from './hypotheses.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Controller('axes/:axisId/hypotheses')
@UseGuards(JwtAuthGuard)
export class HypothesesController {
  constructor(private readonly hypothesesService: HypothesesService) {}

  @Post()
  create(
    @Param('axisId') axisId: string,
    @Body() body: any,
    @Request() req: any,
  ) {
    return this.hypothesesService.createHypothesis(
      axisId,
      req.user.userId,
      body,
    );
  }

  @Get()
  findAll(@Param('axisId') axisId: string, @Request() req: any) {
    return this.hypothesesService.getHypotheses(axisId, req.user.userId);
  }

  @Put('reorder')
  reorder(@Param('axisId') axisId: string, @Body() body: any, @Request() req: any) {
    return this.hypothesesService.reorderHypotheses(axisId, req.user.userId, body.orderedIds);
  }

  @Put(':hypothesisId')
  update(
    @Param('hypothesisId') id: string,
    @Body() body: any,
    @Request() req: any,
  ) {
    return this.hypothesesService.updateHypothesis(id, req.user.userId, body);
  }

  @Delete(':hypothesisId')
  remove(@Param('hypothesisId') id: string, @Request() req: any) {
    return this.hypothesesService.deleteHypothesis(id, req.user.userId);
  }
}
