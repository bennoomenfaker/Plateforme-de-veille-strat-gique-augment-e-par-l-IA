import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { EtlService } from './etl.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Controller('etl')
@UseGuards(JwtAuthGuard)
export class EtlController {
  constructor(private readonly etlService: EtlService) {}

  @Post('collect')
  @HttpCode(HttpStatus.OK)
  async collectAll() {
    const result = await this.etlService.collectAllSources();
    return { message: 'Collecte terminee', ...result };
  }

  @Post('collect/project/:projectId')
  @HttpCode(HttpStatus.OK)
  async collectByProject(@Param('projectId') projectId: string) {
    const result = await this.etlService.collectByProject(projectId);
    return { message: 'Collecte terminee', ...result };
  }

  @Post('collect/:sourceId')
  @HttpCode(HttpStatus.OK)
  async collectOne(@Param('sourceId') sourceId: string) {
    const result = await this.etlService.collectSource(sourceId);
    return { message: `Collecte terminee`, ...result };
  }

  @Get('raw-data/:projectId')
  async getRawData(
    @Param('projectId') projectId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.etlService.getRawDataByProject(
      projectId,
      parseInt(page),
      parseInt(limit),
    );
  }
}
