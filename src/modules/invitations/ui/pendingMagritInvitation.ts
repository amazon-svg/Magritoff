export const PENDING_MAGRIT_INVITATION_KEY = 'magrit:pending-invitation';

const PENDING_INVITATION_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const INVITATION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,512}$/;

type PendingInvitationStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

type PendingInvitationRecord = {
  token: string;
  savedAt: number;
};

export function rememberPendingMagritInvitation(
  storage: PendingInvitationStorage,
  token: string,
  now = Date.now(),
): void {
  if (!INVITATION_TOKEN_PATTERN.test(token)) return;
  const record: PendingInvitationRecord = { token, savedAt: now };
  storage.setItem(PENDING_MAGRIT_INVITATION_KEY, JSON.stringify(record));
}

/**
 * Lit puis supprime l'intention de navigation, même si elle est invalide.
 * Une invitation en attente ne doit jamais devenir une redirection permanente.
 */
export function consumePendingMagritInvitation(
  storage: PendingInvitationStorage,
  now = Date.now(),
): string | null {
  const raw = storage.getItem(PENDING_MAGRIT_INVITATION_KEY);
  storage.removeItem(PENDING_MAGRIT_INVITATION_KEY);
  if (!raw) return null;

  try {
    const record = JSON.parse(raw) as Partial<PendingInvitationRecord>;
    const age = now - (record.savedAt ?? 0);
    return typeof record.token === 'string'
      && INVITATION_TOKEN_PATTERN.test(record.token)
      && Number.isFinite(record.savedAt)
      && age >= 0
      && age <= PENDING_INVITATION_MAX_AGE_MS
      ? record.token
      : null;
  } catch {
    // Les anciennes valeurs stockaient le token brut et pouvaient survivre
    // indéfiniment. Elles sont volontairement supprimées sans redirection.
    return null;
  }
}

export function clearPendingMagritInvitation(storage: PendingInvitationStorage): void {
  storage.removeItem(PENDING_MAGRIT_INVITATION_KEY);
}
