import {
  Controller,
  Get,
  Param,
  Res,
  UseGuards,
  Request,
} from '@nestjs/common';
import { Response } from 'express';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { OrgAccessService } from '../common/org-access.service';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly orgAccess: OrgAccessService,
  ) {}

  @Get('project/:projectId/html')
  async getReportHtml(
    @Param('projectId') projectId: string,
    @Request() req: any,
    @Res() res: Response,
  ) {
    await this.orgAccess.assertProjectRead(projectId, req.user.userId);
    const html = await this.reportsService.generateProjectReport(projectId);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }

  @Get('project/:projectId/download')
  async downloadReport(
    @Param('projectId') projectId: string,
    @Request() req: any,
    @Res() res: Response,
  ) {
    await this.orgAccess.assertProjectRead(projectId, req.user.userId);
    const project = await this.reportsService.getProjectName(projectId);
    const html = await this.reportsService.generateProjectReport(projectId);
    const safeName = (project?.nom || 'projet')
      .replace(/[^a-zA-Z0-9-_]/g, '-')
      .slice(0, 60);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="rapport-veille-${safeName}.html"`,
    );
    res.send(html);
  }
}
