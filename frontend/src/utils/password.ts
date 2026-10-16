/**
 * Politique de mot de passe côté client (doit rester alignée avec le backend :
 * backend/src/auth/auth.utils.ts).
 *
 * Principe NIST/OWASP : la force vient de la LONGUEUR. On n'impose AUCUNE
 * contrainte de composition (pas de majuscule, chiffre ou symbole obligatoire).
 */
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_BYTES = 72;

export const PASSWORD_HELP =
  `Au moins ${PASSWORD_MIN_LENGTH} caractères. Une phrase de passe longue est recommandée — aucun caractère spécial obligatoire.`;

/** Renvoie un message d'erreur si le mot de passe est invalide, sinon null. */
export function passwordError(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères`;
  }
  if (new TextEncoder().encode(password).length > PASSWORD_MAX_BYTES) {
    return `Le mot de passe ne doit pas dépasser ${PASSWORD_MAX_BYTES} octets`;
  }
  return null;
}
