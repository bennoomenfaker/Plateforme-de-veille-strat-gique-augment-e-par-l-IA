import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Request,
  BadRequestException,
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { UploadService } from './upload.service';

@Controller('uploads')
@UseGuards(JwtAuthGuard)
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('pdf')
  @UseInterceptors(FileInterceptor('file'))
  async uploadPdf(
    @UploadedFile() file: any,
    @Body('plan_id') planId: string,
    @Request() req: any,
  ) {
    if (!file) throw new BadRequestException('Aucun fichier envoyé');
    if (!planId) throw new BadRequestException('plan_id obligatoire');
    return this.uploadService.uploadPdf(file, planId, req.user.userId);
  }

  @Get('plan/:planId')
  async getByPlan(@Param('planId') planId: string, @Request() req: any) {
    return this.uploadService.getUploadsByPlan(planId, req.user.userId);
  }

  @Delete('raw-item/:rawItemId')
  async deleteUpload(
    @Param('rawItemId') rawItemId: string,
    @Request() req: any,
  ) {
    return this.uploadService.deleteUpload(rawItemId, req.user.userId);
  }
}
