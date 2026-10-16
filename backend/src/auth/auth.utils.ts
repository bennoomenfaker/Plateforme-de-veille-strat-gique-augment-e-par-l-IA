import { BadRequestException } from '@nestjs/common';
import { COMMON_PASSWORDS } from './common-passwords';

/**
 * Longueur minimale d'un mot de passe.
 *
 * NIST SP 800-63B-4 §3.1.1.1 recommande :
 *  - 8 caractères minimum si le mot de passe fait partie d'une authentification
 *    multifacteur (MFA) ;
 *  - 15 caractères minimum s'il s'agit d'un facteur unique.
 * Cette application n'a pas de MFA : on retient donc une valeur intermédiaire
 * (12) qui reste raisonnable pour l'utilisateur tout en étant nettement plus
 * solide qu'un minimum de 8.
 */
export const PASSWORD_MIN_LENGTH = 12;

/**
 * Coût (work factor) bcrypt. OWASP recommande un minimum de 10 ; on retient 12,
 * valeur courante aujourd'hui (2048 itérations supplémentaires par rapport à 10).
 *
 * ⚠️ Un mot de passe déjà haché avec un coût de 10 reste valide : bcrypt stocke le
 * coût DANS le hash. Changer cette constante n'affecte donc que les NOUVEAUX
 * hachages — aucun ancien mot de passe n'est invalidé.
 */
export const BCRYPT_ROUNDS = 12;

/**
 * bcrypt n'utilise que les 72 premiers octets d'un mot de passe : au-delà, le
 * surplus est silencieusement ignoré. On refuse donc toute saisie dépassant
 * cette limite pour qu'un mot de passe long ne soit jamais tronqué à l'insu
 * de l'utilisateur (piège classique de bcrypt).
 */
export const BCRYPT_MAX_BYTES = 72;

/**
 * Normalise un email : suppression des espaces superflus + passage en minuscules.
 *
 * Pourquoi normaliser l'email ?
 * - Un email est insensible à la casse en pratique (RFC 5321 §2.3.11 : le domaine
 *   est insensible à la casse ; l'usage courant étend cela à la partie locale).
 * - PostgreSQL est, lui, sensible à la casse par défaut.
 * Sans normalisation, "User@Mail.com" et "user@mail.com" créent deux comptes
 * distincts et la connexion échoue si la casse saisie diffère de celle stockée.
 *
 * ⚠️ Ne JAMAIS appliquer ce type de normalisation à un mot de passe.
 */
export function normalizeEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export interface PasswordContext {
  email?: string;
  nom?: string;
}

/**
 * Valide un mot de passe AVANT hachage, selon les bonnes pratiques NIST/OWASP.
 *
 * Principe (NIST SP 800-63B-4 §3.1.1.1 et OWASP) :
 *  - AUCUNE contrainte de composition : on n'exige ni majuscule, ni chiffre, ni
 *    caractère spécial, ni minuscule. La force vient de la LONGUEUR.
 *  - On refuse les mots de passe trop courts.
 *  - On compare le mot de passe à une liste noire de mots de passe courants /
 *    compromis (§3.1.1.2).
 *  - On refuse un mot de passe contenant le nom ou l'email de l'utilisateur.
 *  - On ne transforme JAMAIS le mot de passe : bcrypt est sensible à la casse,
 *    "Faker" et "faker" restent deux mots de passe différents.
 */
export function assertValidPassword(
  password: unknown,
  context?: PasswordContext,
): string {
  if (typeof password !== 'string' || password.length === 0) {
    throw new BadRequestException('Mot de passe requis');
  }

  if (password.length < PASSWORD_MIN_LENGTH) {
    throw new BadRequestException(
      `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères (une phrase de passe est recommandée)`,
    );
  }

  if (Buffer.byteLength(password, 'utf8') > BCRYPT_MAX_BYTES) {
    throw new BadRequestException(
      `Le mot de passe ne doit pas dépasser ${BCRYPT_MAX_BYTES} octets`,
    );
  }

  // Comparaison à la liste noire (NIST SP 800-63B §3.1.1.2).
  const normalized = password.trim().toLowerCase();
  if (COMMON_PASSWORDS.has(normalized)) {
    throw new BadRequestException(
      'Ce mot de passe est trop courant ou a déjà été compromis. Choisissez-en un autre.',
    );
  }

  // Refus des mots de passe contenant les informations personnelles de l'utilisateur.
  if (context) {
    const tokens = [
      context.email ? context.email.split('@')[0] : '',
      context.nom ?? '',
    ]
      .map((token) => token.trim().toLowerCase())
      .filter((token) => token.length >= 4);

    for (const token of tokens) {
      if (normalized.includes(token)) {
        throw new BadRequestException(
          'Le mot de passe ne doit pas contenir votre nom ni votre adresse email.',
        );
      }
    }
  }

  return password;
}
