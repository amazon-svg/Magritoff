# Story S7.9 — ResumeBanner riche + rappel compact (Epic 7, Sprint V2-B)

> **Statut** : en cours — 2026-07-26
> **Agent** : Amelia (bmad-dev-story)
> **Spec UX** : Custom Component n°3 + décision D3 (bandeau Reprendre riche sur
> la home, rappel compact sur les pages gammes). Principe : « le récurrent est
> prioritaire sur le nouveau ».

## Décisions d'implémentation

1. **Chips DÉRIVÉS de la donnée réelle, disparaissent si vides** :
   - « Reprendre mon panier · X € » (état local + montant, remplace le bloc
     S2.16 de la home — supprimé de PortalHome pour éviter le doublon) ;
   - « Renouveler la commande du JJ/MM · X € » (dernière `tenant_orders` v1_1
     de l'acheteur sur la boutique, réutilise `handleRenewOrder` S3.3) ;
   - « Suivre ma dernière commande (statut) » → vue commandes.
   - **Chip « Devis en attente » REPORTÉ à S7.10 (AccountHub)** : les devis
     sont aujourd'hui une donnée dashboard (S-QUOTES), non exposée côté
     portail acheteur — pas de chip sans donnée réelle (pas d'invention).
2. **`buildResumeChips`** pur (testé) + composant `ResumeBanner` variants
   `rich` (home, nav landmark aria-label « Reprendre ») / `compact` (1 ligne
   discrète sous le header des pages gammes).
3. **Fetch dernière commande** : requête légère dans PublicShop (user loggé
   uniquement, `created_by = user.id`, RLS existante), best-effort silencieux.
4. Anonyme ou aucun état → bandeau absent (pas de bloc vide).

## Acceptance Criteria

- **AC1** : acheteur loggé avec panier + commande passée → bandeau riche sur
  la home avec chips panier (montant), renouveler (date + montant), suivi
  (statut) ; clics fonctionnels (drawer / renew S3.3 / vue commandes).
- **AC2** : pages gammes → variante compacte 1 ligne ; home anonyme → rien.
- **AC3** : plus de doublon avec le bloc panier S2.16 (retiré).
- **AC4** : helpers testés ; 0 régression.

## Fichiers

- `src/app/components/shop/portal/ResumeBanner.tsx` + helpers + tests
- `src/app/components/shop/PublicShop.tsx` (fetch + wiring)
- `src/app/components/shop/portal/PortalHome.tsx` (retrait bloc S2.16)
- `src/app/lib/testIds.ts`

## TF Notion (copy-paste)

**TF-S7.9 — Bandeau Reprendre riche et rappel compact**
- **Parcours** : P09 · **Persona** : Acheteur shop_only · **Type** : IA Chrome
- **Précondition** : acheteur loggé avec ≥ 1 commande passée sur la boutique ;
  ajouter 1 article au panier.
- **Étapes** : (1) Home boutique → bandeau « Reprendre » : chips panier avec
  montant + « Renouveler » + « Suivre ». (2) Clic chip panier → drawer ouvert.
  (3) Clic « Renouveler » → panier pré-rempli (warnings S3.3 le cas échéant).
  (4) Ouvrir une page gamme → rappel compact 1 ligne. (5) Se déconnecter →
  aucun bandeau.
- **Hints DOM** : `shop-resume-banner`, `shop-resume-chip-cart`,
  `shop-resume-chip-renew`, `shop-resume-chip-track`.
