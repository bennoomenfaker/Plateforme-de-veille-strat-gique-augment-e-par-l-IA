import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';
import * as fs from 'fs';

@Injectable()
export class UploadService {
  constructor(private prisma: PrismaService) {}

  async uploadPdf(file: any, planId: string, userId: string) {
    const plan = await this.prisma.collectionPlan.findUnique({
      where: { id: planId },
      include: {
        hypothesis: {
          include: {
            axis: {
              include: {
                objective: {
                  include: {
                    project: {
                      include: {
                        organisation: { include: { members: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!plan) throw new NotFoundException('Plan de collecte introuvable');

    const project = plan.hypothesis.axis.objective.project;
    const hasAccess =
      project.owner_user_id === userId ||
      project.organisation?.members.some(
        (m) => m.user_id === userId && m.statut === 'ACTIF',
      );
    if (!hasAccess) throw new ForbiddenException('Accès refusé');

    // Hash du fichier pour déduplication
    const fileBuffer = fs.readFileSync(file.path);
    const hash = crypto
      .createHash('sha256')
      .update(fileBuffer)
      .digest('hex');

    // Vérifier doublon
    const existing = await this.prisma.rawItem.findUnique({
      where: { hash },
    });
    if (existing) {
      return {
        message: 'Ce fichier existe déjà',
        raw_item_id: existing.id,
        duplicate: true,
      };
    }

    const rawItem = await this.prisma.rawItem.create({
      data: {
        project_id: project.id,
        collection_plan_id: planId,
        source_type: 'UPLOAD',
        source_name: 'Upload utilisateur',
        source_url: null,
        article_url: null,
        file_path: file.path,
        title: file.originalname,
        content_raw: null,
        published_at: new Date(),
        hash,
        metadata: {
          originalName: file.originalname,
          size: file.size,
          mimetype: file.mimetype,
        },
      },
    });

    return {
      message: 'PDF uploadé avec succès',
      raw_item_id: rawItem.id,
      file_path: file.path,
      duplicate: false,
    };
  }

  async getUploadsByPlan(planId: string, userId: string) {
    return this.prisma.rawItem.findMany({
      where: {
        collection_plan_id: planId,
        source_type: 'UPLOAD',
      },
      orderBy: { fetched_at: 'desc' },
    });
  }
}
