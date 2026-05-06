/**
 * Feature flags Magrit B4
 * ━━━━━━━━━━━━━━━━━━━━━━━
 * Centralise les fonctionnalites qu'on souhaite toggler entre beta et prod.
 *
 * Pour la prod : passer ces booleens a `true`. Le code des validations reste
 * en place (lib/sirenValidator, lib/emailValidator) — seul le BLOCAGE UI est
 * conditionnel a ces flags. On evite ainsi du code mort.
 *
 * En cas d'envie d'ouvrir/fermer dynamiquement (ex: par tenant ou par variable
 * d'environnement Vite), basculer sur `import.meta.env.VITE_*` ou un fetch
 * d'une table `feature_flags` en DB.
 */

/**
 * E6.1 — Si true, refuse la creation d'un tenant tant que l'email du user
 * connecte est sur un domaine generique (gmail/yahoo/hotmail/orange/...).
 *
 * Beta 4 : false (on teste avec des emails perso).
 * Prod   : true (cible B2B exclusive).
 */
export const REQUIRE_PRO_EMAIL = false;

/**
 * E6.1 — Si true, le SIREN est obligatoire ET doit etre verifie (mock INSEE
 * en attendant le compte reel) pour pouvoir creer un tenant.
 *
 * Beta 4 : false (le SIREN reste un champ saisissable et verifiable, mais
 *          n'empeche pas la creation s'il est vide ou non verifie).
 * Prod   : true (verification INSEE obligatoire, badge 'Entreprise verifiee'
 *          conditionne).
 */
export const REQUIRE_VERIFIED_SIREN = false;

/**
 * E3.1 + E3.2 — Si true, le ChatInterface utilise la route streaming SSE
 * (claude-proxy-stream) au lieu de l'appel JSON synchrone classique. La
 * reponse de Claude est affichee progressivement (token par token) avec
 * un indicateur "Marguerite redige... [N tokens]" pendant la generation.
 *
 * Beta 4 : false par defaut. Mettre a true pour tester en local : le chat
 *          appelle alors `/claude-proxy-stream` et l'edge function pipe les
 *          SSE chunks d'Anthropic. Le parse JSON / extraction Clariprint
 *          reste fait cote edge a la fin du stream, dans un evenement
 *          terminal `done` portant le resultat structure final.
 *
 * Bascule recommandee : flip a true puis validation manuelle dans le
 * browser sur quelques scenarios (mode open + mode strict + question
 * pedagogique). Si OK, garder a true en beta jusqu'a prod.
 */
export const ENABLE_STREAMING_CHAT = true;
