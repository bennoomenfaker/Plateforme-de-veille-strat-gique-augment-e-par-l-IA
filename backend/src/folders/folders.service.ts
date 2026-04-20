import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FoldersService {
  constructor(private prisma: PrismaService) {}

  async createFolder(userId: string, data: any) {
    return this.prisma.folder.create({
      data: {
        nom: data.nom,
        description: data.description,
        owner_user_id: data.organisation_id ? null : userId,
        organisation_id: data.organisation_id || null,
      },
    });
  }

  async getMyFolders(userId: string) {
    const memberships = await this.prisma.membreOrganisation.findMany({
      where: { user_id: userId, statut: 'ACTIF' },
      select: { organisation_id: true },
    });
    const orgIds = memberships.map(m => m.organisation_id);

    return this.prisma.folder.findMany({
      where: {
        OR: [
          { owner_user_id: userId },
          { organisation_id: { in: orgIds } },
        ],
      },
      include: { projects: { where: { is_deleted: false } } },
      orderBy: { created_at: 'desc' },
    });
  }

  async getFolder(folderId: string, userId: string) {
    const folder = await this.prisma.folder.findUnique({
      where: { id: folderId },
      include: { projects: { where: { is_deleted: false } } },
    });
    if (!folder) throw new NotFoundException('Dossier introuvable');
    return folder;
  }

  async updateFolder(folderId: string, userId: string, data: any) {
    const folder = await this.prisma.folder.findUnique({ where: { id: folderId } });
    if (!folder) throw new NotFoundException('Dossier introuvable');
    if (folder.owner_user_id !== userId) throw new ForbiddenException('Accès refusé');

    return this.prisma.folder.update({
      where: { id: folderId },
      data: { nom: data.nom, description: data.description },
    });
  }

  async deleteFolder(folderId: string, userId: string) {
    const folder = await this.prisma.folder.findUnique({ where: { id: folderId } });
    if (!folder) throw new NotFoundException('Dossier introuvable');
    if (folder.owner_user_id !== userId) throw new ForbiddenException('Accès refusé');

    await this.prisma.folder.delete({ where: { id: folderId } });
    return { message: 'Dossier supprimé' };
  }
}
