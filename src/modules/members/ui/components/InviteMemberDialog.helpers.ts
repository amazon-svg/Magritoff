export function invitationApiProblemMessage(code: string, detail?: string): string {
  if (code === 'identity.authentication_required' || code === 'invitations.authentication_required') {
    return 'Votre session a expiré. Reconnectez-vous puis réessayez.';
  }
  if (code === 'invitations.duplicate_pending') {
    return 'Une invitation active existe déjà pour cette adresse email.';
  }
  if (code === 'invitations.permission_denied') {
    return "Votre compte n'a pas le droit d'inviter sur cet espace.";
  }
  if (code === 'invitations.role_mismatch_tenant') {
    return "Un rôle sélectionné n'appartient pas à cet espace. Rechargez la page.";
  }
  if (code === 'invitations.invalid_request' || code === 'api.validation_failed') {
    return "Les informations de l'invitation sont invalides. Vérifiez le formulaire.";
  }
  return detail || 'Invitation impossible.';
}
