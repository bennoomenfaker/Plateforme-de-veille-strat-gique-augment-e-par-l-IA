import {
  Controller,
  Get,
  Post,
  Put,
  Patch, // ← AJOUTÉ
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { CollectionPlansService } from './collection-plans.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

@Controller()
@UseGuards(JwtAuthGuard)
export class CollectionPlansController {
  constructor(
    private readonly collectionPlansService: CollectionPlansService,
  ) {}

  // ── Plans ──────────────────────────────────────────────────────────────────

  @Post('hypotheses/:hypothesisId/collection-plans')
  create(
    @Param('hypothesisId') hypothesisId: string,
    @Body() body: any,
    @Request() req: any,
  ) {
    return this.collectionPlansService.createCollectionPlan(
      hypothesisId,
      req.user.userId,
      body,
    );
  }

  @Get('hypotheses/:hypothesisId/collection-plans')
  findAll(@Param('hypothesisId') hypothesisId: string, @Request() req: any) {
    return this.collectionPlansService.getCollectionPlans(
      hypothesisId,
      req.user.userId,
    );
  }

  @Get('collection-plans/:planId')
  findOne(@Param('planId') planId: string, @Request() req: any) {
    return this.collectionPlansService.getPlanById(planId, req.user.userId);
  }

  @Put('collection-plans/:planId')
  update(
    @Param('planId') planId: string,
    @Body() body: any,
    @Request() req: any,
  ) {
    return this.collectionPlansService.updateCollectionPlan(
      planId,
      req.user.userId,
      body,
    );
  }

  @Delete('collection-plans/:planId')
  remove(@Param('planId') planId: string, @Request() req: any) {
    return this.collectionPlansService.deleteCollectionPlan(
      planId,
      req.user.userId,
    );
  }

  // ── Sources ────────────────────────────────────────────────────────────────

  @Post('collection-plans/:planId/sources')
  addSource(
    @Param('planId') planId: string,
    @Body() body: any,
    @Request() req: any,
  ) {
    return this.collectionPlansService.addSource(planId, req.user.userId, body);
  }

  // ✅ CORRECTION #5 : Route manquante — modifier une source
  @Patch('collection-plans/:planId/sources/:sourceId')
  updateSource(
    @Param('planId') planId: string,
    @Param('sourceId') sourceId: string,
    @Body() body: any,
    @Request() req: any,
  ) {
    return this.collectionPlansService.updateSource(
      planId,
      sourceId,
      req.user.userId,
      body,
    );
  }

  @Delete('collection-plans/sources/:sourceId')
  removeSource(@Param('sourceId') sourceId: string, @Request() req: any) {
    return this.collectionPlansService.removeSource(sourceId, req.user.userId);
  }

  // ── Keywords ───────────────────────────────────────────────────────────────

  @Post('collection-plans/:planId/keywords')
  addKeyword(
    @Param('planId') planId: string,
    @Body() body: any,
    @Request() req: any,
  ) {
    return this.collectionPlansService.addKeyword(
      planId,
      req.user.userId,
      body,
    );
  }

  @Delete('collection-plans/keywords/:keywordId')
  removeKeyword(@Param('keywordId') keywordId: string, @Request() req: any) {
    return this.collectionPlansService.removeKeyword(
      keywordId,
      req.user.userId,
    );
  }
}
