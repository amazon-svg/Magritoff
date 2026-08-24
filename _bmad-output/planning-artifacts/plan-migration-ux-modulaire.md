---
title: Plan de migration UX modulaire
date: 2026-08-24
status: done
depends_on: [spec-migration-ux-modulaire]
---

# Plan — Migration UX modulaire

## 1. Principe de livraison

La migration est réalisée par tranches verticales indépendantes. Chaque tranche
laisse le dépôt livrable et réduit une baseline mesurée. Aucun lot ne consiste
uniquement à déplacer des fichiers sans fermer les dépendances vers `app`.

## 2. Séquencement BMAD

| Story | Statut | Périmètre | Résultat vérifiable | Dépend de |
|---|---|---|---|---|
| MUX0 | livré | Socle et frontières | `shared/ui`, convention d'injection, tests bloquants | — |
| MUX1 | livré | Pilote `members` | UX Utilisateurs entièrement possédée par le module | MUX0 |
| MUX2 | livré | Workspace commercial | `orders`, `quotes`, `quote-templates`, `commercial` | MUX1 |
| MUX3 | livré | Workspace catalogue | `shops`, `catalog`, `libraries`, `mockups` | MUX1 |
| MUX4 | livré | Workspace plateforme | `account`, `tenants`, `conversations`, `machine-parks`, `plans` | MUX1 |
| MUX5 | livré | Storefront et portail | UX distribuée entre `shops`, `catalog`, `orders`, `shop-customers`, `account` | MUX2, MUX3 |
| MUX6 | livré | Fermeture brownfield | suppression des chemins métier `app/components`, baseline à zéro | MUX4, MUX5 |

MUX2, MUX3 et MUX4 peuvent être développées en parallèle après validation du
pilote. Elles ne doivent pas modifier les mêmes shells globaux.

## 3. Matrice de propriété cible

### 3.1 Workspace

| UX actuelle | Module propriétaire | Cible indicative |
|---|---|---|
| `DashboardUsers`, invitation, options | `members` | `modules/members/ui/workspace` |
| `DashboardOrders` | `orders` | `modules/orders/ui/workspace` |
| `DashboardQuotes*` | `quotes` | `modules/quotes/ui/workspace` |
| `DashboardQuoteTemplates` | `quote-templates` | `modules/quote-templates/ui/workspace` |
| `DashboardShops`, éditeur boutique | `shops` | `modules/shops/ui/workspace` |
| comptes clients dans l'éditeur | `shop-customers` | composant public intégré par `shops` |
| `DashboardTenantGammes`, PIM | `catalog` | `modules/catalog/ui/workspace` |
| bibliothèques et détail | `libraries` | `modules/libraries/ui/workspace` |
| prix et marges | `commercial` | `modules/commercial/ui/workspace` |
| mockups administratifs | `mockups` | `modules/mockups/ui/workspace` |
| compte utilisateur | `account` | `modules/account/ui/workspace` |
| réglages et sous-espaces | `tenants` | `modules/tenants/ui/workspace` |
| historique de conversations | `conversations` | `modules/conversations/ui/workspace` |
| parc machine | `machine-parks` | `modules/machine-parks/ui/workspace` |
| choix du plan | `plans` | `modules/plans/ui/workspace` |

`DashboardLayout`, les boundaries d'erreur et les gates de capability restent
des shells de surface dans `app`, puis sont renommés vers `app/layouts` ou
`app/surfaces`.

### 3.2 Storefront et portail client

| UX actuelle | Module propriétaire | Remarque |
|---|---|---|
| chargement et shell de boutique | `shops` | entrée de surface storefront |
| catalogue, gamme, fiche produit | `catalog` | consomme la vue boutique publique |
| panier, checkout, commandes, audit | `orders` | distinction storefront/customer-portal |
| connexion, activation, reset, délégation | `shop-customers` | identité boutique isolée |
| hub et profil du compte | `account` | sans rôle Magrit |
| mockup produit | `mockups` | composant public réutilisable |

Les composants `Portal*` ne forment pas un module autonome : leur propriétaire
est déterminé par la capability et le contrat API utilisés.

## 4. Détail des vagues

### MUX0 — Socle et frontières

- choisir et créer `src/shared/ui` ;
- déplacer les primitives génériques sans changement d'API ;
- ajouter l'alias d'import stable si nécessaire ;
- définir le contrat d'entrée UI publique d'un module ;
- choisir le mécanisme d'injection des clients et du scope courant ;
- ajouter les tests interdisant `modules -> app`, fournisseurs dans l'UI et
  imports profonds inter-modules ;
- ajouter une baseline décroissante des composants métier encore sous `app`.

Sortie : aucune fonctionnalité n'a changé, mais toute nouvelle dette devient
impossible.

### MUX1 — Pilote Members

- déplacer la page Utilisateurs, les dialogues et leurs helpers ;
- faire appartenir le contrôleur de page à `members/ui` ;
- consommer `invitations` et `roles` uniquement par leurs façades publiques ;
- injecter acteur, tenant et clients sans dépendance vers `app/contexts` ;
- charger `members.workspace.list` depuis l'entrée UI publique du module ;
- conserver profil Admin/Utilisateur, options UM1 et protection du dernier
  administrateur ;
- déplacer ou adapter tous les tests concernés.

Sortie : première tranche de référence, documentée pour les vagues suivantes.

### MUX2 à MUX4 — Workspace

Chaque module est migré séparément avec la même checklist que MUX1. Les
composants partagés entre deux domaines sont soit publiés par leur propriétaire,
soit décomposés en primitive neutre et composant métier. Aucun répertoire
`app/components/dashboard/<domaine>` intermédiaire n'est créé.

### MUX5 — Storefront et portail

- répartir les composants par capability plutôt que par ancien emplacement ;
- conserver les composition roots storefront et workspace séparés ;
- garantir qu'aucun client workspace n'est accessible depuis l'UX storefront ;
- préserver les cookies HttpOnly et l'isolation des identités boutique ;
- conserver les routes publiques et les temps de chargement lazy.

### MUX6 — Fermeture

- supprimer les shims et chemins brownfield ;
- déplacer les derniers shells autorisés vers `app/layouts` ou `app/surfaces` ;
- faire passer à zéro la baseline des composants métier dans `app/components` ;
- mettre à jour `docs/REGLES_ARCHITECTURE.md`, les exemples BMAD et les guides
  de contribution ;
- réaliser l'audit final des dépendances et du bundle.

## 5. Checklist obligatoire par module

- [x] Le propriétaire fonctionnel de chaque composant est explicite.
- [x] La page et ses composants métier sont sous `modules/<id>/ui`.
- [x] L'entrée publique du module exporte uniquement les éléments nécessaires.
- [x] Aucun import depuis `app`, `adapters`, Supabase ou un fournisseur.
- [x] Aucun import interne non publié vers un autre module.
- [x] Route, capability, navigation et test IDs inchangés.
- [x] Chargement lazy conservé.
- [x] Tests unitaires/helpers déplacés avec le module.
- [x] Tests de parcours et d'architecture verts.
- [x] Ancien chemin supprimé, sans shim permanent.
- [x] Baseline brownfield diminuée et enregistrée à zéro.

## 6. Validation à chaque story

- `pnpm run typecheck` ;
- `pnpm test:architecture` ;
- tests ciblés du ou des modules ;
- `pnpm test` ;
- `pnpm run build` ;
- contrôle du graphe d'imports et du maintien des chunks lazy.

## 7. Risques et mesures

| Risque | Mesure |
|---|---|
| déplacement massif difficile à relire | une story et un commit cohérent par module |
| cycles entre modules UI | consommation exclusive des entrées publiques, testée en CI |
| déplacement de contexts sans clarification | figer l'injection dans MUX0 puis réutiliser le patron |
| régression de routes ou permissions | conserver les contributions et tester les IDs/capabilities |
| faux partage dans `shared/ui` | interdire tout vocabulaire métier et toute dépendance module |
| hausse du bundle initial | conserver les imports dynamiques et comparer la sortie Vite |
| mélange d'identités storefront/workspace | garder les composition roots et clients séparés |

## 8. Definition of Done de la migration

La migration est terminée lorsque toutes les routes actives chargent une entrée
UI appartenant à un module, que `app` ne possède plus de composant métier, que
les règles sont bloquées par la CI et que les parcours fonctionnels restent
équivalents à la baseline précédant MUX0.

État au 24 août 2026 : critères atteints. La preuve d'exécution et le détail des
modules figurent dans `implementation-artifacts/story-MUX2-MUX6-migration-ux-modulaire.md`.
