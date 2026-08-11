export interface InviteMemberErrorPayload {
  error?: string;
  message?: string;
  stage?: string;
}

export function inviteMemberErrorMessage(
  payload: InviteMemberErrorPayload | null,
  status: number | null,
  fallback: string,
): string {
  const code = payload?.error ?? payload?.message ?? '';

  if (status === 401 || /expired JWT|Authorization Bearer/i.test(code)) {
    return 'Votre session a expiré. Reconnectez-vous puis réessayez.';
  }
  if (/duplicate_pending/i.test(code)) {
    return 'Une invitation active existe déjà pour cette adresse email.';
  }
  if (/permission_denied|can_invite/i.test(code)) {
    return "Votre compte n'a pas le droit d'inviter sur cet espace.";
  }
  if (/role_mismatch_tenant/i.test(code)) {
    return "Un rôle sélectionné n'appartient pas à cet espace. Rechargez la page.";
  }
  if (/Body invalide/i.test(code)) {
    return "Les informations de l'invitation sont invalides. Vérifiez le formulaire.";
  }
  if (code) return code;
  return fallback;
}
