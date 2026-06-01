import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrgRole } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';

const WRITE_ROLES: OrgRole[] = ['PROPRIETAIRE', 'MANAGER', 'EQUIPE_VEILLE'];

@Injectable()
export class OrgAccessService {
  constructor(private prisma: PrismaService) {}

  canWrite(role: OrgRole | null | undefined): boolean {
    return !!role && WRITE_ROLES.includes(role);
  }

  isReader(role: OrgRole | null | undefined): boolean {
    return role === 'LECTEUR';
  }

  isOwner(role: OrgRole | null | undefined): boolean {
    return role === 'PROPRIETAIRE';
  }

  async getProjectWithAccess(projectId: string, userId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { organisation: { include: { members: true } } },
    });
    if (!project) throw new NotFoundException('Projet introuvable');

    if (project.owner_user_id === userId) {
      return { project, orgRole: null as OrgRole | null, canWrite: true };
    }

    if (project.organisation_id) {
      const member = project.organisation?.members.find(
        (m) => m.user_id === userId && m.statut === 'ACTIF',
      );
      if (member) {
        return {
          project,
          orgRole: member.role,
          canWrite: this.canWrite(member.role),
        };
      }
    }

    throw new ForbiddenException('Accès refusé à ce projet');
  }

  async assertProjectRead(projectId: string, userId: string) {
    return this.getProjectWithAccess(projectId, userId);
  }

  async assertProjectWrite(projectId: string, userId: string) {
    const access = await this.getProjectWithAccess(projectId, userId);
    if (!access.canWrite) {
      throw new ForbiddenException(
        'Accès en lecture seule — modification non autorisée pour votre rôle',
      );
    }
    return access;
  }

  async getOrgMemberRole(
    organisationId: string,
    userId: string,
  ): Promise<OrgRole | null> {
    const membre = await this.prisma.membreOrganisation.findFirst({
      where: {
        organisation_id: organisationId,
        user_id: userId,
        statut: 'ACTIF',
      },
    });
    return membre?.role ?? null;
  }

  async assertOrgOwner(organisationId: string, userId: string) {
    const role = await this.getOrgMemberRole(organisationId, userId);
    if (role !== 'PROPRIETAIRE') {
      throw new ForbiddenException(
        "Accès réservé au propriétaire de l'organisation",
      );
    }
  }
}
