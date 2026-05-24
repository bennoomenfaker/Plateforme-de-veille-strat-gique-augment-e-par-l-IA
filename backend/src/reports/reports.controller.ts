import { Controller, Get, Param, Res, UseGuards, Request } from '@nestjs/common';
import { Response } from 'express';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('project/:projectId/html')
  async getReportHtml(
    @Param('projectId') projectId: string,
    @Res() res: Response,
  ) {
    const html = await this.reportsService.generateProjectReport(projectId);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }

  @Get('project/:projectId/download')
  async downloadReport(
    @Param('projectId') projectId: string,
    @Res() res: Response,
  ) {
    const html = await this.reportsService.generateProjectReport(projectId);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="rapport-veille-${projectId}.html"`);
    res.send(html);
  }
}
