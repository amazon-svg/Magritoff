// ============================================================================
// Reponse generique pour les routes legacy retirees (410 Gone)
// ============================================================================
//
// Decision Arnaud, 2026-09-15. Deux routes de l edge function legacy
// `make-server-e3db71a4` sont retirees (410 Gone), sans appelant connu :
//
// - `POST /make-server-e3db71a4/save-product` : ecriture arbitraire dans le
//   KV store partage, appelable avec la seule cle anonyme Supabase, sans
//   verification d autorisation au-dela du JWT anon.
// - `POST /make-server-e3db71a4/send-invitation-email` : le flux courant
//   passe par `POST /api/v1/invitations` (magrit-api) ; cette route legacy
//   n a plus d appelant (`invite-member` ne la cite qu en commentaire). Sa
//   gravite est HAUTE : en production `mailer_autoconfirm = true`, et cette
//   route renvoyait le lien/jeton d invitation pour tout `invitationId`
//   fourni, sans verifier que l appelant est l invite -- un identifiant
//   d invitation ayant fuite permettait de creer un compte avec l e-mail de
//   la cible et de rejoindre son espace. `baseUrl` etant choisi par
//   l appelant, la route se pretait aussi a l hameconnage.
//
// Les deux handlers ne font plus que renvoyer ce corps generique : aucune
// lecture du corps de requete, aucun acces au KV store, a la base, a Resend
// ni aux variables d environnement.
export interface RouteGoneBody {
  success: false;
  error: string;
}

export function buildRouteGoneBody(): RouteGoneBody {
  return { success: false, error: "Route retiree" };
}
