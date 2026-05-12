import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  // ─── REGISTER INDIVIDUEL ─────────────────────────────────────────────────────
  async register(data: any) {
    const existing = await this.prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new ConflictException('Email déjà utilisé');

    const hashedPassword = await bcrypt.hash(data.mot_de_passe, 10);
    const user = await this.prisma.user.create({
      data: {
        nom: data.nom,
        email: data.email,
        mot_de_passe: hashedPassword,
        type_utilisateur: 'INDIVIDUEL',
        statut: 'ACTIF',
      },
    });

    await this.logActivity(user.id, 'REGISTER', 'user', user.id);
    const { mot_de_passe, ...result } = user;
    return result;
  }

  // ─── REGISTER ORGANISATION ───────────────────────────────────────────────────
  async registerOrganisation(data: any) {
    const existing = await this.prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new ConflictException('Email déjà utilisé');

    const hashedPassword = await bcrypt.hash(data.mot_de_passe, 10);

    const user = await this.prisma.user.create({
      data: {
        nom: data.nom,
        email: data.email,
        mot_de_passe: hashedPassword,
        type_utilisateur: 'ORGANISATION',
        statut: 'ACTIF',
      },
    });

    const organisation = await this.prisma.organisation.create({
      data: {
        nom: data.nom_organisation,
        owner_id: user.id,
      },
    });

    await this.prisma.membreOrganisation.create({
      data: {
        organisation_id: organisation.id,
        user_id: user.id,
        role: 'PROPRIETAIRE',
        statut: 'ACTIF',
      },
    });

    await this.logActivity(user.id, 'REGISTER_ORGANISATION', 'organisation', organisation.id);
    const { mot_de_passe, ...userResult } = user;
    return { user: userResult, organisation };
  }

  // ─── VALIDER TOKEN INVITATION ────────────────────────────────────────────────
  async validateInvitation(token: string, data: any) {
    const invitation = await this.prisma.invitationOrganisation.findUnique({
      where: { token },
      include: { organisation: true },
    });

    if (!invitation) throw new BadRequestException('Token invalide');
    if (invitation.status !== 'PENDING') throw new BadRequestException('Invitation déjà utilisée ou expirée');
    if (invitation.expires_at < new Date()) {
      await this.prisma.invitationOrganisation.update({
        where: { token },
        data: { status: 'EXPIRED' },
      });
      throw new BadRequestException('Token expiré');
    }

    let user = await this.prisma.user.findUnique({ where: { email: invitation.email } });

    if (!user) {
      if (!data.mot_de_passe) throw new BadRequestException('Mot de passe requis');
      const hashedPassword = await bcrypt.hash(data.mot_de_passe, 10);
      user = await this.prisma.user.create({
        data: {
          nom: data.nom,
          email: invitation.email,
          mot_de_passe: hashedPassword,
          type_utilisateur: 'ORGANISATION',
          statut: 'ACTIF',
        },
      });
    }

    await this.prisma.membreOrganisation.create({
      data: {
        organisation_id: invitation.organisation_id,
        user_id: user.id,
        role: invitation.role,
        statut: 'ACTIF',
      },
    });

    await this.prisma.invitationOrganisation.update({
      where: { token },
      data: { status: 'ACCEPTED' },
    });

    await this.logActivity(user.id, 'ACCEPT_INVITATION', 'organisation', invitation.organisation_id);
    const { mot_de_passe, ...userResult } = user;
    return {
      message: 'Invitation acceptée',
      user: userResult,
      organisation: invitation.organisation,
      role: invitation.role,
    };
  }

  // ─── LOGIN ───────────────────────────────────────────────────────────────────
  async login(data: any) {
    const user = await this.prisma.user.findUnique({
      where: { email: data.email },
      include: {
        memberships: {
          include: { organisation: true },
        },
      },
    });

    if (!user) throw new UnauthorizedException('Email ou mot de passe incorrect');
    if (user.statut === 'SUSPENDU') throw new UnauthorizedException('Compte suspendu');
    if (user.statut === 'INACTIF') throw new UnauthorizedException('Compte inactif');

    const isValid = await bcrypt.compare(data.mot_de_passe, user.mot_de_passe);
    if (!isValid) throw new UnauthorizedException('Email ou mot de passe incorrect');

    const payload = {
      sub: user.id,
      email: user.email,
      type: user.type_utilisateur,
    };
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = await this.generateRefreshToken(user.id);

    await this.logActivity(user.id, 'LOGIN', 'user', user.id);

    const { mot_de_passe, ...userResult } = user;
    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: userResult,
    };
  }

  // ─── GET ME ──────────────────────────────────────────────────────────────────
  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          include: {
            organisation: true,
          },
        },
        individual_projects: {
          where: { isActive: true },
          select: { id: true, nom: true, frequency: true },
        },
      },
    });

    if (!user) throw new UnauthorizedException('Utilisateur introuvable');
    const { mot_de_passe, ...result } = user;
    return result;
  }

  // ─── LOGIN SUPER ADMIN ───────────────────────────────────────────────────────
  async loginSuperAdmin(data: any) {
    const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || 'admin@veille.com';
    const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin2024!';

    if (data.email !== SUPER_ADMIN_EMAIL) throw new UnauthorizedException('Accès refusé');
    if (data.password !== SUPER_ADMIN_PASSWORD) throw new UnauthorizedException('Accès refusé');

    const payload = { sub: 'super-admin', email: SUPER_ADMIN_EMAIL, role: 'SUPER_ADMIN' };
    const accessToken = this.jwtService.sign(payload, { expiresIn: '8h' });
    return { access_token: accessToken, role: 'SUPER_ADMIN' };
  }

  // ─── REFRESH TOKEN ───────────────────────────────────────────────────────────
  async refreshToken(token: string) {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!stored) throw new UnauthorizedException('Refresh token invalide');
    if (stored.expires_at < new Date()) {
      await this.prisma.refreshToken.delete({ where: { token } });
      throw new UnauthorizedException('Refresh token expiré');
    }

    const payload = { sub: stored.user.id, email: stored.user.email, type: stored.user.type_utilisateur };
    const newAccessToken = this.jwtService.sign(payload);
    const newRefreshToken = await this.generateRefreshToken(stored.user.id);
    await this.prisma.refreshToken.delete({ where: { token } });
    return { access_token: newAccessToken, refresh_token: newRefreshToken };
  }

  // ─── LOGOUT ──────────────────────────────────────────────────────────────────
  async logout(token: string, userId: string) {
    await this.prisma.refreshToken.deleteMany({ where: { token } });
    await this.logActivity(userId, 'LOGOUT', 'user', userId);
    return { message: 'Déconnexion réussie' };
  }

  // ─── FORGOT PASSWORD ─────────────────────────────────────────────────────────
  async requestPasswordReset(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return { message: 'Si cet email existe, un lien a été envoyé' };
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 3600000);
    await this.prisma.refreshToken.create({
      data: { user_id: user.id, token: `reset_${resetToken}`, expires_at: expires },
    });
    return { message: 'Token généré', reset_token: resetToken };
  }

  // ─── RESET PASSWORD ──────────────────────────────────────────────────────────
  async resetPassword(token: string, newPassword: string) {
    const stored = await this.prisma.refreshToken.findUnique({
      where: { token: `reset_${token}` },
    });
    if (!stored) throw new UnauthorizedException('Token invalide');
    if (stored.expires_at < new Date()) {
      await this.prisma.refreshToken.delete({ where: { token: `reset_${token}` } });
      throw new UnauthorizedException('Token expiré');
    }
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: stored.user_id },
      data: { mot_de_passe: hashedPassword },
    });
    await this.prisma.refreshToken.delete({ where: { token: `reset_${token}` } });
    return { message: 'Mot de passe réinitialisé avec succès' };
  }

  // ─── HELPERS ─────────────────────────────────────────────────────────────────
  private async generateRefreshToken(userId: string): Promise<string> {
    const token = crypto.randomBytes(64).toString('hex');
    const expires = new Date(Date.now() + 7 * 24 * 3600000);
    await this.prisma.refreshToken.create({
      data: { user_id: userId, token, expires_at: expires },
    });
    return token;
  }

  private async logActivity(userId: string, action: string, entityType: string, entityId: string) {
    try {
      await this.prisma.userActivityLog.create({
        data: { user_id: userId, action, entityType, entityId },
      });
    } catch {}
  }
}
