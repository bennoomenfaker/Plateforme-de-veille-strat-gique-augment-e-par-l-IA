import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendWelcomeEmail(
    to: string,
    name: string,
    resetToken?: string,
  ): Promise<void> {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetLink = resetToken
      ? `${frontendUrl}/reset-password/${resetToken}`
      : undefined;
    const subject = 'Bienvenue sur VeilleAI';
    const html = this.welcomeTemplate(name, resetLink);
    await this.send(to, subject, html);
  }

  async sendInvitationEmail(
    to: string,
    token: string,
    orgName: string,
    role: string,
  ): Promise<void> {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const inviteLink = `${frontendUrl}/invitation/${token}`;
    const subject = `Invitation à rejoindre ${orgName} sur VeilleAI`;
    const html = this.invitationTemplate(inviteLink, orgName, role);
    await this.send(to, subject, html);
  }

  async sendAlertEmail(
    to: string,
    projectName: string,
    score: number,
  ): Promise<void> {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const subject = `🚨 Alerte critique - Score élevé (${score}%) sur "${projectName}"`;
    const html = `
      <div style="max-width:600px;margin:0 auto;font-family:system-ui,sans-serif;background:#0f1117;color:#e2e8f0;border-radius:12px;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#ef4444,#dc2626);padding:32px;text-align:center;">
          <h1 style="margin:0;font-size:24px;color:#fff;">🚨 Alerte Critique</h1>
          <p style="margin:8px 0 0;color:#fecaca;font-size:14px;">VeilleAI - Détection de score élevé</p>
        </div>
        <div style="padding:32px;">
          <h2 style="font-size:20px;margin:0 0 16px;">Un élément pertinent a été détecté</h2>
          <p style="font-size:14px;line-height:1.6;color:#94a3b8;">
            Un article récent avec un score de pertinence de <strong style="color:#fbbf24;font-size:18px;">${score}%</strong>
            a été trouvé dans le projet <strong style="color:#e2e8f0;">"${projectName}"</strong>.
          </p>
          <div style="text-align:center;margin:28px 0;">
            <a href="${frontendUrl}/projects" style="display:inline-block;padding:12px 32px;background:linear-gradient(135deg,#3b82f6,#6366f1);color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">Voir le projet</a>
          </div>
          <div style="margin-top:24px;padding:16px;background:#1e293b;border-radius:8px;font-size:13px;color:#94a3b8;">
            <p style="margin:0;">Connectez-vous à VeilleAI pour consulter les détails et analyser les résultats.</p>
          </div>
        </div>
        <div style="padding:16px 32px;text-align:center;border-top:1px solid #1e293b;font-size:12px;color:#475569;">
          &copy; ${new Date().getFullYear()} VeilleAI. Tous droits réservés.
        </div>
      </div>
    `;
    await this.send(to, subject, html);
  }

  async sendPasswordResetEmail(to: string, token: string): Promise<void> {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetLink = `${frontendUrl}/reset-password/${token}`;
    const subject = 'Réinitialisation de votre mot de passe VeilleAI';
    const html = this.resetPasswordTemplate(resetLink);
    await this.send(to, subject, html);
  }

  private async send(
    to: string,
    subject: string,
    html: string,
    retries = 3,
  ): Promise<void> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        await this.transporter.sendMail({
          from: `"VeilleAI" <${process.env.SMTP_USER}>`,
          to,
          subject,
          html,
        });
        this.logger.log(`Email sent to ${to} — ${subject}`);
        return;
      } catch (err) {
        this.logger.error(
          `Email attempt ${attempt}/${retries} failed for ${to}: ${err instanceof Error ? err.message : String(err)}`,
        );
        if (attempt === retries) throw err;
        await new Promise((r) => setTimeout(r, 2000 * attempt));
      }
    }
  }

  private welcomeTemplate(name: string, resetLink?: string): string {
    const resetSection = resetLink
      ? `
       
      <div style="text-align:center;margin:24px 0;">
        <a href="${resetLink}" style="display:inline-block;padding:12px 32px;background:linear-gradient(135deg,#3b82f6,#6366f1);color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">Définir mon mot de passe</a>
        <p style="font-size:12px;color:#64748b;margin-top:8px;">Ce lien est valable 1 heure</p>
      </div>`
      : '';

    return `
      <div style="max-width:600px;margin:0 auto;font-family:system-ui,sans-serif;background:#0f1117;color:#e2e8f0;border-radius:12px;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#3b82f6,#6366f1);padding:32px;text-align:center;">
          <h1 style="margin:0;font-size:24px;color:#fff;">VeilleAI</h1>
          <p style="margin:8px 0 0;color:#bfdbfe;font-size:14px;">Plateforme de veille stratégique augmentée par l'IA</p>
        </div>
        <div style="padding:32px;">
          <h2 style="font-size:20px;margin:0 0 16px;">Bienvenue ${name} !</h2>
          <p style="font-size:14px;line-height:1.6;color:#94a3b8;">Votre compte VeilleAI a été créé avec succès.</p>
          <p style="font-size:14px;line-height:1.6;color:#94a3b8;">Vous pouvez dès à présent vous connecter et commencer à configurer vos projets de veille.</p>
          ${resetSection}
          <div style="margin-top:24px;padding:16px;background:#1e293b;border-radius:8px;font-size:13px;color:#94a3b8;">
            <p style="margin:0 0 8px;"><strong style="color:#e2e8f0;">🔒 Sécurité :</strong> Ne partagez jamais votre mot de passe.</p>
            <p style="margin:0;">Si vous n'avez pas créé ce compte, ignorez cet email.</p>
          </div>
        </div>
        <div style="padding:16px 32px;text-align:center;border-top:1px solid #1e293b;font-size:12px;color:#475569;">
          &copy; ${new Date().getFullYear()} VeilleAI. Tous droits réservés.
        </div>
      </div>
    `;
  }

  private invitationTemplate(
    inviteLink: string,
    orgName: string,
    role: string,
  ): string {
    const roleLabels: Record<string, string> = {
      PROPRIETAIRE: 'Propriétaire',
      MANAGER: 'Manager',
      EQUIPE_VEILLE: 'Équipe de veille',
      LECTEUR: 'Lecteur',
    };
    const roleLabel = roleLabels[role] || role;
    return `
      <div style="max-width:600px;margin:0 auto;font-family:system-ui,sans-serif;background:#0f1117;color:#e2e8f0;border-radius:12px;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#3b82f6,#6366f1);padding:32px;text-align:center;">
          <h1 style="margin:0;font-size:24px;color:#fff;">VeilleAI</h1>
          <p style="margin:8px 0 0;color:#bfdbfe;font-size:14px;">Invitation à rejoindre une organisation</p>
        </div>
        <div style="padding:32px;">
          <h2 style="font-size:20px;margin:0 0 16px;">Vous êtes invité !</h2>
          <p style="font-size:14px;line-height:1.6;color:#94a3b8;">
            Vous avez été invité à rejoindre <strong style="color:#e2e8f0;">${orgName}</strong> sur VeilleAI avec le rôle <strong style="color:#e2e8f0;">${roleLabel}</strong>.
          </p>
          <div style="text-align:center;margin:28px 0;">
            <a href="${inviteLink}" style="display:inline-block;padding:12px 32px;background:linear-gradient(135deg,#3b82f6,#6366f1);color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">Accepter l'invitation</a>
          </div>
          <p style="font-size:13px;color:#94a3b8;">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :</p>
          <p style="font-size:12px;color:#64748b;word-break:break-all;background:#1e293b;padding:12px;border-radius:6px;">${inviteLink}</p>
          <div style="margin-top:24px;padding:16px;background:#1e293b;border-radius:8px;font-size:13px;color:#94a3b8;">
            <p style="margin:0 0 8px;"><strong style="color:#e2e8f0;">⏰ Expiration :</strong> Cette invitation expire dans 7 jours.</p>
            <p style="margin:0;"><strong style="color:#e2e8f0;">🔒 Sécurité :</strong> Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
          </div>
        </div>
        <div style="padding:16px 32px;text-align:center;border-top:1px solid #1e293b;font-size:12px;color:#475569;">
          &copy; ${new Date().getFullYear()} VeilleAI. Tous droits réservés.
        </div>
      </div>
    `;
  }

  private resetPasswordTemplate(resetLink: string): string {
    return `
      <div style="max-width:600px;margin:0 auto;font-family:system-ui,sans-serif;background:#0f1117;color:#e2e8f0;border-radius:12px;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#3b82f6,#6366f1);padding:32px;text-align:center;">
          <h1 style="margin:0;font-size:24px;color:#fff;">VeilleAI</h1>
          <p style="margin:8px 0 0;color:#bfdbfe;font-size:14px;">Réinitialisation de mot de passe</p>
        </div>
        <div style="padding:32px;">
          <h2 style="font-size:20px;margin:0 0 16px;">Demande de réinitialisation</h2>
          <p style="font-size:14px;line-height:1.6;color:#94a3b8;">Vous recevez cet email suite à une demande de réinitialisation de mot de passe sur VeilleAI.</p>
          <div style="text-align:center;margin:28px 0;">
            <a href="${resetLink}" style="display:inline-block;padding:12px 32px;background:linear-gradient(135deg,#3b82f6,#6366f1);color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">Réinitialiser mon mot de passe</a>
          </div>
          <p style="font-size:13px;color:#94a3b8;">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :</p>
          <p style="font-size:12px;color:#64748b;word-break:break-all;background:#1e293b;padding:12px;border-radius:6px;">${resetLink}</p>
          <div style="margin-top:24px;padding:16px;background:#1e293b;border-radius:8px;font-size:13px;color:#94a3b8;">
            <p style="margin:0 0 8px;"><strong style="color:#e2e8f0;">⏰ Expiration :</strong> Ce lien est valable 1 heure.</p>
            <p style="margin:0;"><strong style="color:#e2e8f0;">🔒 Sécurité :</strong> Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
          </div>
        </div>
        <div style="padding:16px 32px;text-align:center;border-top:1px solid #1e293b;font-size:12px;color:#475569;">
          &copy; ${new Date().getFullYear()} VeilleAI. Tous droits réservés.
        </div>
      </div>
    `;
  }
}
