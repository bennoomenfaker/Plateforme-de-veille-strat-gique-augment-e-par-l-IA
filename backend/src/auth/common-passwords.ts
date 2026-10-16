import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Liste noire des mots de passe les plus courants / compromis.
 *
 * Références :
 *  - NIST SP 800-63B-4 §3.1.1.2 : « verifiers SHALL compare the prospective
 *    secret against a blocklist that contains known commonly used, expected, or
 *    compromised passwords ».
 *  - OWASP : refuser les mots de passe présents dans les fuites connues.
 *
 * La liste principale provient du registre public international de référence
 * « SecLists » (danielmiessler/SecLists), fichier
 * `Passwords/Common-Credentials/10k-most-common.txt` — les 10 000 mots de passe
 * les plus utilisés au monde, classés par fréquence. Elle est stockée dans
 * `data/common-passwords.txt` (une entrée par ligne, en minuscules).
 *
 * Performance : la recherche se fait dans un `Set<string>`, donc en O(1) —
 * 10 000 entrées représentent ~72 Ko en mémoire, ce qui est négligeable.
 *
 * En production on pourrait brancher un corpus plus large (ex. SecLists
 * « 10-million-password-list-top-1000000.txt ») ou l'API Have I Been Pwned
 * (k-anonymity) sans changer le code : il suffit d'enrichir le fichier.
 */

/**
 * Termes propres à l'application (NIST : la liste peut inclure « specific words
 * (e.g., the name of the service itself) »). Ajoutés à la liste principale.
 */
const APP_SPECIFIC_PASSWORDS = [
  'veille',
  'veilleai',
  'veille123',
  'veille2024',
  'veille2025',
  'veille2026',
  'plateforme',
  'plateforme123',
  'intelligence',
  'strategie',
  'strategique',
  'veillestrategique',
];

/**
 * Repli minimal si le fichier de données n'est pas déployé (assets manquants).
 * Évite un crash au démarrage tout en conservant une protection de base.
 */
const FALLBACK_PASSWORDS = [
  'password',
  'password1234',
  '123456',
  '12345678',
  '123456789',
  'qwerty',
  'azerty',
  'motdepasse',
  'motdepasse123',
  'letmein',
  'admin',
  'administrateur',
];

function loadCommonPasswords(): Set<string> {
  const words = new Set<string>(APP_SPECIFIC_PASSWORDS);

  try {
    const filePath = join(__dirname, 'data', 'common-passwords.txt');
    const content = readFileSync(filePath, 'utf8');
    for (const line of content.split('\n')) {
      const word = line.trim().toLowerCase();
      if (word) words.add(word);
    }
  } catch {
    console.warn(
      '[security] Liste noire de mots de passe introuvable (data/common-passwords.txt). Repli sur une liste minimale.',
    );
    for (const word of FALLBACK_PASSWORDS) words.add(word);
  }

  return words;
}

export const COMMON_PASSWORDS = loadCommonPasswords();
