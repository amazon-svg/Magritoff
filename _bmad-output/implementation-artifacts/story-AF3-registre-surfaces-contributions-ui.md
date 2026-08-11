---
id: AF3
epic: EPIC-8-API-FIRST
sprint: AF-A
priority: P0
effort: M
status: review
branch: refactor/api-first-foundation
depends_on: [AF2]
unblocks: [AF4]
---

# AF3 — Registre des surfaces et contributions UI

## User story

En tant qu équipe Magrit, nous voulons déclarer séparément les fonctionnalités métier et leurs contributions aux surfaces, afin qu un module puisse servir storefront, portail client, workspace et back-office sans centraliser toutes les routes et tous les menus dans les composants racine.

## Critères d acceptation

1. Quatre identifiants et composition roots existent : `storefront`, `customer-portal`, `workspace`, `backoffice`.
2. Un manifeste module décrit uniquement identifiant, fonctionnalités, capabilities et surfaces ; il n importe ni React, ni React Router, ni icône UI.
3. Routes et navigation sont des contributions séparées, liées par des identifiants stables de module et de fonctionnalité.
4. Le registre rejette les doublons, les références à une fonctionnalité inconnue et les contributions vers une surface non déclarée.
5. Les écrans enregistrés par une surface restent chargés avec `React.lazy` et ne sont pas importés eager dans `routes.tsx`.
6. Le module témoin `account` contribue au workspace et décrit également sa présence dans le portail client.
7. La route workspace `account` et son item de navigation « Mon compte » proviennent du registre sans changement d URL, libellé, icône, testId ou rendu.
8. L écran témoin sépare son rendu UI des adaptateurs Auth/Preferences brownfield.
9. Les surfaces non encore migrées gardent leur comportement actuel ; aucune réécriture globale du routeur n est faite dans AF3.
10. Tests unitaires du registre, tests d architecture et build sont verts.

## Tasks

- [x] Définir les contrats purs manifeste, feature, capability, route et navigation.
- [x] Implémenter un registre validé sans dépendance UI.
- [x] Créer les quatre composition roots de surfaces.
- [x] Déclarer le module témoin `account` sur workspace et customer-portal.
- [x] Ajouter le runtime lazy workspace et brancher `routes.tsx`.
- [x] Dériver l item « Mon compte » de la contribution de navigation.
- [x] Séparer la vue Account des contexts et de Supabase Auth.
- [x] Ajouter tests registre, composition et frontières.
- [x] Préparer le TF AF3 et mettre à jour le handoff.

## Plan de test

- `pnpm typecheck`
- tests ciblés `tests/surfaces` et `tests/modules/account`
- `pnpm test:architecture`
- `pnpm test`
- `pnpm build`

## Résultat de validation

- `pnpm typecheck` : vert sur le périmètre strict modulaire.
- Tests du registre : 4/4 verts.
- Tests d architecture : 9/9 verts.
- Régression complète : 787 tests verts, 87 ignorés.
- Build Vite : vert ; `DashboardAccount` reste un chunk lazy distinct.
- UX témoin conservée : `/t/:tenantSlug/dashboard/account`, libellé « Mon compte », icône User et testId `nav-sidebar-profile-link`.
- Baseline Supabase UI : 43 → 42 fichiers importeurs ; 70 références directes inchangées, l appel profil étant centralisé dans la dérogation Auth existante.

## Limite volontaire

AF3 ne migre pas toutes les routes historiques. Le registre accepte leur migration incrémentale ; seul Account sert de preuve verticale. Le portail client reste hébergé par `PublicShop`, donc sa contribution Account est déclarée avec `mount: host` sans modifier son routeur interne.
