---
id: MUX2-MUX6
epic: UX-MODULARISATION
status: done-code
branch: migrate-modular-ux
depends_on: [MUX0, MUX1]
date: 2026-08-24
---

# MUX2 à MUX6 — Migration complète de l’UX modulaire

## Objectif

Faire posséder chaque expérience fonctionnelle par son module, conserver `app`
comme composition root uniquement et fermer intégralement le brownfield
`src/app/components` sans refonte fonctionnelle ou visuelle.

## Résultat par vague

### MUX2 — Workspace commercial

Les pages, contrôleurs et modèles de présentation de `orders`, `quotes`,
`quote-templates` et `commercial` résident désormais sous leurs répertoires
`ui`. Les appels passent par leurs clients API publics obtenus depuis le port
runtime workspace.

### MUX3 — Workspace catalogue

Les UX `shops`, `catalog`, `libraries` et `mockups`, y compris l’éditeur de
boutique et ses composants inter-domaines, sont possédées par les modules. Les
compositions avec `shop-customers` et `clariprint` passent par des entrées UI
publiques.

### MUX4 — Workspace plateforme

Les UX `account`, `tenants`, `conversations`, `machine-parks`, `plans`, ainsi
que les compléments `roles`, `session`, `invitations` et `diagnostics`, sont
distribuées dans leurs modules. Les shells transverses ont été déplacés dans
`src/app/layouts`.

### MUX5 — Storefront et portail client

Le chargement et le shell boutique appartiennent à `shops`, le catalogue et le
configurateur à `catalog`/`clariprint`, le panier et les commandes à `orders`,
et l’identité boutique à `shop-customers`. Un port `StorefrontUiRuntime`
anonyme et isolé remplace les anciens contexts storefront de `app`.

### MUX6 — Fermeture brownfield

- baseline `src/app/components` : 0 fichier ;
- design system : 49 primitives sous `src/shared/ui` ;
- suppression des anciens contexts de registres clients/services ;
- routes workspace et storefront chargées en lazy depuis les entrées UI ;
- imports `modules -> app`, fournisseurs dans l’UI et imports internes
  inter-modules bloqués par les tests d’architecture ;
- maintien du chunk principal autour de 381 kB avant compression.

## API et contrats

Aucun contrat HTTP ni modèle de données n’a été modifié pour cette migration.
La composition React utilise deux ports techniques neutres :

- `WorkspaceUiRuntime` pour l’acteur, le tenant, les clients authentifiés et
  les services navigateur du workspace ;
- `StorefrontUiRuntime` pour le client HTTP anonyme et les services boutique.

Les modules construisent leurs façades publiques via `useWorkspaceApi` ou
`useStorefrontApi`; ils ne connaissent pas les composition roots de `app`.

## Dérogations R5

Aucune dérogation permanente. Les chemins historiques, shims et anciens
contexts devenus inutiles ont été supprimés dans la même migration.

## Validation

- typecheck TypeScript strict : vert ;
- architecture : 30 fichiers, 119 tests verts ;
- suite complète avec Supabase local : 177 fichiers, 1 184 tests verts et 36
  scénarios explicitement ignorés ;
- build Vite : vert, sans avertissement de cycle de chunks ;
- environnement Supabase local arrêté proprement après validation.
