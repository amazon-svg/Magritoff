# Story S7.10 — AccountHub `/account/*` (Epic 7, Sprint V2-C)

> **Statut** : en cours — 2026-07-26
> **Agent** : Amelia (bmad-dev-story)
> **Spec UX** : Custom Component n°8 — fonctions portail relocalisées sous
> « Mon compte » (décision Arnaud) : commandes, devis, validations, profil.

## Décisions d'implémentation

1. **Routes** : `/account/orders` (PortalOrders 4 tabs — les validations
   workflow SONT ces tabs role-driven S-ORDER-ROLES), `/account/quotes`
   (mes devis, lecture via QuotesContext scope mine), `/account/profile`
   (email, boutique, espace, déconnexion). `/account` → `/account/orders`.
2. **Alias legacy** : `/orders` (S7.1) redirige vers `/account/orders` en
   **préservant `?tab=`** (le redirect canonique de PublicShop conserve
   désormais la query string — fix générique).
3. **Nav header** : « Mes commandes » devient « Mon compte » (AccountHub).
4. **Devis** : liste lecture seule (référence, produit, statut FR, total) —
   chip « Devis en attente » du ResumeBanner S7.9 branché sur la même donnée
   (statuts groupe en cours) — complète la spec D3.
5. **Budget** : NON affiché (le bloc budget actuel est un mock — pas de
   section sans donnée réelle ; reviendra avec un vrai backend budget).
6. **Profil** : infos réelles (email, boutique, tenant) + bouton Se
   déconnecter (`supabase.auth.signOut` + retour home boutique).

## Acceptance Criteria

- **AC1** : `/account/orders?tab=to-validate` rend les 4 tabs PortalOrders,
  bon tab actif ; `/orders?tab=…` (legacy) y redirige query préservée.
- **AC2** : `/account/quotes` liste les devis de l'utilisateur (statut FR),
  état vide propre ; anonyme → invite à se connecter.
- **AC3** : `/account/profile` affiche email + contexte réels et permet la
  déconnexion.
- **AC4** : nav header « Mon compte » actif sur toutes les sous-routes ;
  ResumeBanner « Suivre ma dernière commande » → `/account/orders`.
- **AC5** : tests routes mis à jour (alias orders) ; a11y scan +1 route ;
  0 régression.

## Fichiers

- `src/app/components/shop/portal/AccountHub.tsx` (nouveau)
- `shopPortalRoutes.ts` (+sections, alias, tests) · `types.ts` (+'account')
- `PublicShop.tsx` (branche + redirect query-safe) · `ShopLayout.tsx` (nav)
- `testIds.ts` · `scripts/a11y-scan.sh`

## TF Notion — créé directement dans la DB (TF-S7.10)
