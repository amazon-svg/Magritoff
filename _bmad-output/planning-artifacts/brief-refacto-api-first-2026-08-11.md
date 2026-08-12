---
title: Brief de refactorisation API-first et modulaire
date: 2026-08-11
source_branch: main@eea7f56
delivery_branch: refactor/api-first-foundation
status: en_cours
owners: [AGE Développement, Expert Solutions]
---

# Brief — Refactorisation API-first et modulaire

## Problème à résoudre

Magrit possède des domaines fonctionnels identifiables, mais le navigateur connaît encore directement Supabase : tables, RPC, Auth, Storage, Edge Functions et URL fournisseur. La baseline au démarrage de cette initiative compte 45 fichiers UI important un SDK ou utilitaire Supabase, dont 42 le client de données, et 83 références `supabase.*` dans `src/app`.

L'ancien Epic Refacto 1 a stabilisé ce fonctionnement. Son ADR-R3 autorisait les lectures `from()` directes côté navigateur. Cette décision est désormais remplacée par la règle R1 de `docs/REGLES_ARCHITECTURE.md` : toute interaction passe par une API métier contractuelle.

## Résultat produit attendu

- Le navigateur consomme uniquement des contrats Magrit versionnés sous `/api/v1`.
- Supabase reste le premier adaptateur serveur, sans être l'API publique du produit.
- Les règles métier sont partagées entre les surfaces et ne sont pas réimplémentées dans React.
- Les migrations sont verticales, testables et sans interruption fonctionnelle.

## Surfaces de sortie

| Surface | Routes actuelles | Responsabilité |
|---|---|---|
| `storefront` | `/shop/:slug` | vitrine et catalogue public |
| `customer-portal` | `/shop/:slug/account/*`, checkout | compte acheteur, commandes et devis |
| `workspace` | `/t/:tenantSlug` | configurateur et travail courant |
| `backoffice` | `/t/:tenantSlug/dashboard/*` | administration et exploitation du tenant |

Les surfaces ne possèdent pas la logique métier. Un module peut publier plusieurs adaptateurs UI qui consomment les mêmes cas d'usage et contrats HTTP.

## Architecture cible

```text
Surfaces React
  -> clients API Magrit typés
    -> /api/v1
      -> handlers du module
        -> services applicatifs
          -> ports
            -> adaptateurs Supabase / Clariprint / Anthropic / Resend
```

Structure indicative :

```text
src/
  kernel/
  platform/
    identity/
    tenant/
    access/
    entitlements/
  modules/
    orders/
    quotes/
    catalog/
    shops/
    commercial-pricing/
    production/
    conversations/
  surfaces/
    storefront/
    customer-portal/
    workspace/
    backoffice/
  server/
    composition/
    infrastructure/
```

## Invariants

1. `domain`, `application`, `api` et `ui` n'importent aucun fournisseur.
2. Les opérations critiques sont atomiques côté serveur.
3. La RLS reste une barrière finale, même derrière l'API.
4. Les contrats HTTP ne réexportent jamais les types générés de PostgreSQL.
5. Le manifeste métier et les contributions UI sont séparés pour ne pas introduire React côté serveur.
6. Toute migration réduit la baseline Supabase ; aucune story ne peut l'augmenter.
7. La suppression de Supabase Auth du navigateur intervient après la façade de données et la stabilisation des sessions.

## Séquencement BMAD

### Sprint AF-A — Fondation, 4 stories

- AF0 : kernel minimal, baseline et tests de frontières.
- AF1 : conventions HTTP `/api/v1`, enveloppes d'erreur et composition serveur.
- AF2 : API de bootstrap session/tenant/préférences et migration des providers globaux.
- AF3 : registre des quatre surfaces, routes et navigation déclaratives.

### Sprint AF-B — Module pilote Orders, 4 stories

- AF4 : contrats de lecture Orders et repository serveur.
- AF5 : commandes et transitions atomiques côté serveur.
- AF6 : migration storefront/portail/back-office vers le client Orders.
- AF7 : suppression des dépendances Supabase Orders dans `src/app` et baisse de baseline.

### Vagues suivantes

`quotes` → `shops/catalog` → `commercial-pricing` → assets/événements → conversations/IA → BFF d'identité.

### Extension AF-C — Identité et invitations

- AF7.1 : verrouillage des boutiques `invite_only` et rattachement contrôlé en
  `self_signup` — livré ;
- AF7.2 : rafraîchissement explicite de session avant invitation — livré ;
- AF8 : contrat et commande `POST /api/v1/invitations`, identité de l’invitant
  dérivée côté serveur — livré ;
- AF9 : options, liste des invitations en attente, révocation et renvoi via
  l’API Magrit — livré ;
- AF10 : liste, rôles, droits et retrait des membres via l’API ; sortie complète
  de `DashboardUsers` hors Supabase — livré ;
- AF11.1 : renvoi d’invitation directement via un port email et l’adaptateur
  Resend, sans Edge Function imbriquée — livré ;
- AF11.2 : création initiale via une commande SQL sécurisée puis port Resend,
  sans `invite-member` ni service-role dans l’API — livré ;
- AF12.1 : catalogue, matrice et assignations des rôles via l’API Magrit ;
  `DashboardRolesSection` et `EditUserRolesModal` sortent de Supabase — livré ;
- AF12.2 : édition, archivage et réordonnancement atomique des définitions de
  rôles via l’API ; `RoleEditorDialog` et `OrderRoleAdminPage` sortent de
  Supabase — livré ;
- AF13.1 : CRUD tenant des boutiques et produits manuels via l’API ;
  `ShopsContext` sort de Supabase — livré ;
- AF13.2 : sonde publique minimale et catalogue autorisé via l’API ;
  `PublicShop` sort de Supabase — livré ;
- AF13.3a : lecture et écriture des prix négociés via l’API — livré ;
- AF13.3b : upload multipart des logos et visuels hero via l’API ; l’éditeur
  de boutique ne connaît plus Supabase — livré ;
- suite : migrer les autres
  contributions catalogue/portail, en conservant la revue
  fonctionnelle invitations/membres/rôles comme chantier produit distinct.

## Critères de succès

- `pnpm test:architecture` est requis en CI.
- Aucune nouvelle dépendance Supabase n'entre dans l'UI.
- Une migration de fournisseur ne change ni les composants ni les contrats `/api/v1`.
- Le chargement initial ne déclenche plus de requêtes PostgREST depuis le navigateur après AF2.
- Les trois surfaces Orders utilisent le même service après AF7.
