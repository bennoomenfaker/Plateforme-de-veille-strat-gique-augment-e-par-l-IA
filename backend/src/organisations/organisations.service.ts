import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class OrganisationsService {
  constructor(private prisma: PrismaService) {}

  private async checkOwnerOrManager(organisationId: string, userId: string) {
    const membre = await this.prisma.membreOrganisation.findFirst({
      where: {
        organisation_id: organisationId,
        user_id: userId,
        role: { in: ['PROPRIETAIRE', 'MANAGER'] },
        statut: 'ACTIF',
      },
    });
    if (!membre) throw new ForbiddenException('Accès réservé au propriétaire ou manager');
    return membre;
  }

  private async checkOwner(organisationId: string, userId: string) {
    const membre = await this.prisma.membreOrganisation.findFirst({
      where: { organisation_id: organisationId, user_id: userId, role: 'PROPRIETAIRE', statut: 'ACTIF' },
    });
    if (!membre) throw new ForbiddenException('Accès réservé au propriétaire');
    return membre;
  }

  // ─── Créer une organisation ───────────────────────────────────────────────────
  async createOrganisation(userId: string, data: any) {
    const organisation = await this.prisma.organisation.create({
      data: { nom: data.nom, owner_id: userId },
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

  // ─── Obtenir une organisation par ID ──────────────────────────────────────────
  async getOrganisation(organisationId: string, userId: string) {
    const membre = await this.prisma.membreOrganisation.findFirst({
      where: { organisation_id: organisationId, user_id: userId, statut: 'ACTIF' },
    });
    if (!membre) throw new ForbiddenException('Accès refusé');

    return this.prisma.organisation.findUnique({
      where: { id: organisationId },
      include: {
        members: {
          include: { user: { select: { id: true, nom: true, email: true, statut: true } } },
        },
        projects: { where: { isActive: true } },
      },
    });
  }

  // ─── Mon organisation ─────────────────────────────────────────────────────────
  async getMyOrganisation(userId: string) {
    const membre = await this.prisma.membreOrganisation.findFirst({
      where: { user_id: userId, statut: 'ACTIF' },
      include: {
        organisation: {
          include: {
            members: {
              include: { user: { select: { id: true, nom: true, email: true, statut: true } } },
            },
            projects: true,
          },
        },
      },
    });
    if (!membre) throw new NotFoundException('Aucune organisation trouvée');
    return membre.organisation;
  }

  // ─── Lister les membres ───────────────────────────────────────────────────────
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

  // ─── Ajouter un membre directement ───────────────────────────────────────────
  async addMember(organisationId: string, userId: string, data: any) {
    await this.checkOwnerOrManager(organisationId, userId);

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

  // ─── Inviter un collaborateur ────────────────────────────────────────────────
  async inviteMember(organisationId: string, userId: string, data: any) {
    await this.checkOwnerOrManager(organisationId, userId);

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
      email: data.email,
      role: data.role || 'EQUIPE_VEILLE',
      expires_at: expires,
    };
  }

  // ─── Révoquer un membre ──────────────────────────────────────────────────────
  async revokeMember(organisationId: string, userId: string, memberId: string) {
    await this.checkOwner(organisationId, userId);
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

  // ─── Changer le rôle ─────────────────────────────────────────────────────────
  async changeMemberRole(organisationId: string, userId: string, memberId: string, newRole: string) {
    await this.checkOwner(organisationId, userId);
    if (memberId === userId) throw new BadRequestException('Impossible de changer votre propre rôle');
    if (newRole === 'PROPRIETAIRE') throw new ForbiddenException('Impossible d\'assigner le rôle PROPRIETAIRE');

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

  // ─── Changer le statut d'un membre ───────────────────────────────────────────
  async changeMemberStatus(organisationId: string, userId: string, memberId: string, newStatut: string) {
    await this.checkOwnerOrManager(organisationId, userId);
    if (memberId === userId) throw new BadRequestException('Impossible de modifier votre propre statut');

    const membre = await this.prisma.membreOrganisation.findFirst({
      where: { organisation_id: organisationId, user_id: memberId },
    });
    if (!membre) throw new NotFoundException('Membre introuvable');
    if (membre.role === 'PROPRIETAIRE') throw new ForbiddenException('Impossible de modifier le statut du propriétaire');

    const updated = await this.prisma.membreOrganisation.update({
      where: { id: membre.id },
      data: { statut: newStatut as any },
    });

    await this.logActivity(userId, 'CHANGE_MEMBER_STATUS', 'organisation', organisationId);
    return { message: 'Statut modifié', membre: updated };
  }

  // ─── Historique invitations ───────────────────────────────────────────────────
  async getInvitationsHistory(organisationId: string, userId: string) {
    await this.checkOwnerOrManager(organisationId, userId);
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
