/**
 * emailValidator — E6.1
 * ─────────────────────
 * Verifie qu'un email a un format valide ET qu'il est sur un domaine
 * professionnel (pas @gmail, @yahoo, @hotmail, etc.). Magrit cible un public
 * B2B exclusivement, donc les emails "perso" sont rejetes a la creation
 * d'un tenant.
 *
 * Liste non exhaustive — un domaine generique trouve dans l'email d'un
 * decideur d'imprimerie est suspect et doit etre flagge. Le support peut
 * lever l'exception manuellement si besoin.
 */

const GENERIC_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'yahoo.fr',
  'ymail.com',
  'hotmail.com',
  'hotmail.fr',
  'outlook.com',
  'outlook.fr',
  'live.com',
  'live.fr',
  'msn.com',
  'aol.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'protonmail.com',
  'proton.me',
  'orange.fr',
  'wanadoo.fr',
  'free.fr',
  'sfr.fr',
  'laposte.net',
  'bbox.fr',
  'numericable.fr',
  'gmx.com',
  'gmx.fr',
  'mail.com',
  'mailbox.org',
]);

export interface EmailValidationResult {
  ok: boolean;
  error?: string;
  /** true si l'email est syntaxiquement valide mais sur un domaine generique. */
  generic?: boolean;
}

/**
 * Valide un email pour la creation d'un tenant : format + domaine pro.
 */
export function validateProEmail(email: string): EmailValidationResult {
  const trimmed = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return { ok: false, error: 'Format d\'email invalide.' };
  }
  const domain = trimmed.split('@')[1];
  if (GENERIC_DOMAINS.has(domain)) {
    return {
      ok: false,
      generic: true,
      error: `Le domaine ${domain} est generique. Utilisez votre email professionnel pour creer un espace.`,
    };
  }
  return { ok: true };
}

export function isGenericDomain(email: string): boolean {
  const domain = email.trim().toLowerCase().split('@')[1] ?? '';
  return GENERIC_DOMAINS.has(domain);
}
