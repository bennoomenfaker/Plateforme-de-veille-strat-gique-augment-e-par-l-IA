import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrgAccessService } from '../common/org-access.service';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

function generateJoinCode(): string {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

@Injectable()
export class OrganisationsService {
  constructor(
    private prisma: PrismaService,
    private orgAccess: OrgAccessService,
  ) {}

  async createOrganisation(userId: string, data: any) {
    const exists = await this.prisma.organisation.findUnique({
      where: { nom: data.nom.trim() },
    });
    if (exists) throw new ConflictException('Ce nom d\'organisation est déjà pris');

    const organisation = await this.prisma.organisation.create({
      data: {
        nom: data.nom.trim(),
        owner_id: userId,
        join_code_equipe: generateJoinCode(),
        join_code_lecteur: generateJoinCode(),
      },
    });
    await this.prisma.membreOrganisation.create({
      data: {
        organisation_id: organisation.id,
        user_id: userId,
        role: 'PROPRIETAIRE',
        statut: 'ACTIF',
      },
    });
    return organisation;
  }

  async getOrganisation(organisationId: string, userId: string) {
    const membre = await this.prisma.membreOrganisation.findFirst({
      where: { organisation_id: organisationId, user_id: userId, statut: 'ACTIF' },
    });
    if (!membre) throw new ForbiddenException('Accès refusé');

    return this.prisma.organisation.findUnique({
      where: { id: organisationId },
      include: {
        members: {
          include: { user: { select: { id: true, nom: true, email: true, statut: true, photo_url: true } } },
        },
        projects: { where: { isActive: true, is_deleted: false } },
      },
    });
  }

  async getMyOrganisation(userId: string) {
    const membre = await this.prisma.membreOrganisation.findFirst({
      where: { user_id: userId, statut: 'ACTIF' },
      include: {
        organisation: {
          include: {
            members: {
              include: { user: { select: { id: true, nom: true, email: true, statut: true, photo_url: true } } },
            },
            projects: { where: { is_deleted: false } },
          },
        },
      },
    });
    if (!membre) throw new NotFoundException('Aucune organisation trouvée');

    let org = membre.organisation;
    const isOwner = membre.role === 'PROPRIETAIRE';

    if (isOwner && (!org.join_code_equipe || !org.join_code_lecteur)) {
      org = await this.prisma.organisation.update({
        where: { id: org.id },
        data: {
          join_code_equipe: org.join_code_equipe || generateJoinCode(),
          join_code_lecteur: org.join_code_lecteur || generateJoinCode(),
        },
        include: {
          members: {
            include: { user: { select: { id: true, nom: true, email: true, statut: true, photo_url: true } } },
          },
          projects: { where: { is_deleted: false } },
        },
      });
    }

    return {
      ...org,
      my_role: membre.role,
      join_codes: isOwner
        ? {
            equipe_veille: org.join_code_equipe,
            lecteur: org.join_code_lecteur,
          }
        : undefined,
    };
  }

  async getMembers(organisationId: string, userId: string) {
    const membre = await this.prisma.membreOrganisation.findFirst({
      where: { organisation_id: organisationId, user_id: userId, statut: 'ACTIF' },
    });
    if (!membre) throw new ForbiddenException('Accès refusé');

    return this.prisma.membreOrganisation.findMany({
      where: { organisation_id: organisationId },
      include: { user: { select: { id: true, nom: true, email: true, statut: true, created_at: true } } },
    });
  }

  async regenerateJoinCodes(organisationId: string, userId: string) {
    await this.orgAccess.assertOrgOwner(organisationId, userId);
    return this.prisma.organisation.update({
      where: { id: organisationId },
      data: {
        join_code_equipe: generateJoinCode(),
        join_code_lecteur: generateJoinCode(),
      },
      select: {
        id: true,
        nom: true,
        join_code_equipe: true,
        join_code_lecteur: true,
      },
    });
  }

  async addMember(organisationId: string, userId: string, data: any) {
    await this.orgAccess.assertOrgOwner(organisationId, userId);
    if (data.role === 'PROPRIETAIRE') {
      throw new BadRequestException('Impossible d\'ajouter un second propriétaire');
    }

    let targetUser = await this.prisma.user.findUnique({ where: { email: data.email } });

    if (!targetUser) {
      const tempPassword = data.mot_de_passe || crypto.randomBytes(8).toString('hex');
      const hashedPassword = await bcrypt.hash(tempPassword, 10);
      targetUser = await this.prisma.user.create({
        data: {
          nom: data.nom,
          email: data.email,
          mot_de_passe: hashedPassword,
          type_utilisateur: 'ORGANISATION',
          statut: 'ACTIF',
        },
      });
    }

    const alreadyMember = await this.prisma.membreOrganisation.findFirst({
      where: { organisation_id: organisationId, user_id: targetUser.id },
    });
    if (alreadyMember) throw new BadRequestException('Cet utilisateur est déjà membre');

    const newMembre = await this.prisma.membreOrganisation.create({
      data: {
        organisation_id: organisationId,
        user_id: targetUser.id,
        role: data.role || 'EQUIPE_VEILLE',
        statut: 'ACTIF',
      },
    });

    await this.logActivity(userId, 'ADD_MEMBER', 'organisation', organisationId);
    return newMembre;
  }

  async inviteMember(organisationId: string, userId: string, data: any) {
    await this.orgAccess.assertOrgOwner(organisationId, userId);

    if (data.role === 'PROPRIETAIRE') {
      throw new BadRequestException('Seul le créateur est propriétaire');
    }

    const existingUser = await this.prisma.user.findUnique({ where: { email: data.email } });
    if (existingUser) {
      const alreadyMember = await this.prisma.membreOrganisation.findFirst({
        where: { organisation_id: organisationId, user_id: existingUser.id },
      });
      if (alreadyMember) throw new BadRequestException('Cet utilisateur est déjà membre');
    }

    const existingInvitation = await this.prisma.invitationOrganisation.findFirst({
      where: { organisation_id: organisationId, email: data.email, status: 'PENDING' },
    });
    if (existingInvitation) throw new BadRequestException('Une invitation est déjà en attente');

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 7 * 24 * 3600000);

    const invitation = await this.prisma.invitationOrganisation.create({
      data: {
        organisation_id: organisationId,
        email: data.email,
        role: data.role || 'EQUIPE_VEILLE',
        token,
        expires_at: expires,
      },
    });

    await this.logActivity(userId, 'INVITE_MEMBER', 'organisation', organisationId);
    return {
      message: 'Invitation envoyée',
      invitation_token: token,
      invitation_link: `/invitation/${token}`,
      email: data.email,
      role: data.role || 'EQUIPE_VEILLE',
      expires_at: expires,
      invitation,
    };
  }

  async revokeMember(organisationId: string, userId: string, memberId: string) {
    await this.orgAccess.assertOrgOwner(organisationId, userId);
    if (memberId === userId) throw new BadRequestException('Vous ne pouvez pas vous révoquer');

    const membre = await this.prisma.membreOrganisation.findFirst({
      where: { organisation_id: organisationId, user_id: memberId },
    });
    if (!membre) throw new NotFoundException('Membre introuvable');
    if (membre.role === 'PROPRIETAIRE') throw new ForbiddenException('Impossible de révoquer le propriétaire');

    await this.prisma.membreOrganisation.delete({ where: { id: membre.id } });
    await this.logActivity(userId, 'REVOKE_MEMBER', 'organisation', organisationId);
    return { message: 'Membre révoqué' };
  }

  async changeMemberRole(organisationId: string, userId: string, memberId: string, newRole: string) {
    await this.orgAccess.assertOrgOwner(organisationId, userId);
    if (memberId === userId) throw new BadRequestException('Impossible de changer votre propre rôle');
    if (newRole === 'PROPRIETAIRE') {
      throw new ForbiddenException('Un seul propriétaire par organisation');
    }

    const membre = await this.prisma.membreOrganisation.findFirst({
      where: { organisation_id: organisationId, user_id: memberId },
    });
    if (!membre) throw new NotFoundException('Membre introuvable');

    const updated = await this.prisma.membreOrganisation.update({
      where: { id: membre.id },
      data: { role: newRole as any },
    });

    await this.logActivity(userId, 'CHANGE_MEMBER_ROLE', 'organisation', organisationId);
    return { message: 'Rôle modifié', membre: updated };
  }

  async changeMemberStatus(organisationId: string, userId: string, memberId: string, newStatut: string) {
    await this.orgAccess.assertOrgOwner(organisationId, userId);
    if (memberId === userId) throw new BadRequestException('Impossible de modifier votre propre statut');

    const membre = await this.prisma.membreOrganisation.findFirst({
      where: { organisation_id: organisationId, user_id: memberId },
    });
    if (!membre) throw new NotFoundException('Membre introuvable');
    if (membre.role === 'PROPRIETAIRE') {
      throw new ForbiddenException('Impossible de modifier le statut du propriétaire');
    }

    const updated = await this.prisma.membreOrganisation.update({
      where: { id: membre.id },
      data: { statut: newStatut as any },
    });

    await this.logActivity(userId, 'CHANGE_MEMBER_STATUS', 'organisation', organisationId);
    return { message: 'Statut modifié', membre: updated };
  }

  async getInvitationsHistory(organisationId: string, userId: string) {
    await this.orgAccess.assertOrgOwner(organisationId, userId);
    return this.prisma.invitationOrganisation.findMany({
      where: { organisation_id: organisationId },
      orderBy: { created_at: 'desc' },
    });
  }

  private async logActivity(userId: string, action: string, entityType: string, entityId: string) {
    try {
      await this.prisma.userActivityLog.create({
        data: { user_id: userId, action, entityType, entityId },
      });
    } catch {}
  }
}
