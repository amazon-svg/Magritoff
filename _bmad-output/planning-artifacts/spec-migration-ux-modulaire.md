---
title: Spécification de migration vers une UX modulaire
date: 2026-08-24
source_branch: main@037be90
delivery_branch: migrate-modular-ux
status: implemented
owners: [AGE Développement, Expert Solutions]
---

# Spécification — Migration vers une UX modulaire

## 1. Problème à résoudre

Magrit possède déjà des modules métier sous `src/modules`, des manifestes et des
contributions de surface déclaratives. Cependant, l'implémentation React des
fonctionnalités reste majoritairement centralisée sous `src/app/components`.

Baseline initiale au 24 août 2026 :

- 183 fichiers sous `src/app/components` ;
- 48 primitives sous `src/app/components/ui` ;
- aucun fichier React `.tsx` sous `src/modules` ;
- le registre workspace déclare les routes par module, mais
  `src/app/surfaces/workspaceRuntimeRoutes.tsx` résout encore toutes les pages
  vers `src/app/components/dashboard`.

L'architecture est donc modulaire pour les contrats, les cas d'usage et les
métadonnées de navigation, mais pas encore pour la présentation fonctionnelle.
Une évolution d'un domaine impose de parcourir le module, les contexts et hooks
de l'application, le chargeur de routes et plusieurs répertoires de composants.
Cette dispersion contrevient à l'intention de R2 dans
`docs/REGLES_ARCHITECTURE.md`.

## 2. Résultat attendu

Chaque module possède l'UX métier de ses fonctionnalités : pages, composants,
modèles de présentation, hooks de contrôleur et tests associés. L'application
ne possède plus les écrans métier ; elle compose les modules dans les surfaces
et fournit les dépendances runtime communes.

Le résultat doit permettre de comprendre ou modifier une fonctionnalité en
ouvrant principalement un seul répertoire de module, sans changer les routes,
les comportements utilisateurs ni les contrats HTTP existants.

## 3. Architecture cible

```text
src/
  app/
    routes.tsx                  # composition des surfaces
    providers/                  # composition roots React
    layouts/                    # shells globaux sans métier
    surfaces/                   # résolution runtime des contributions

  shared/
    ui/                         # primitives du design system
    presentation/               # utilitaires visuels réellement transverses

  modules/
    members/
      api/
      application/
      ui/
        workspace/
          MembersPage.tsx
        components/
          InviteMemberDialog.tsx
          EditMemberOptionsDialog.tsx
        hooks/
          useMembersWorkspace.ts
        index.ts
      manifest.ts
      surface-contributions.ts
      index.ts

  surfaces/
    registry/                   # contrats déclaratifs sans React
    workspace/
    storefront/
    customer-portal/
    backoffice/
```

Le nom `shared/ui` est la cible retenue dans cette spécification. Il pourra être
remplacé par `design-system` avant MUX0 si l'équipe le préfère, mais une seule
racine neutre doit être choisie.

## 4. Responsabilités

### 4.1 `src/modules/<module>/ui`

Possède :

- les pages métier publiées sur une ou plusieurs surfaces ;
- les composants spécifiques au domaine ;
- les modèles de présentation et helpers purs ;
- les hooks qui orchestrent les clients publics du module ;
- les tests unitaires et de comportement de cette UX.

Peut importer :

- React et les bibliothèques de rendu approuvées ;
- `shared/ui` et les tokens de design ;
- le contrat API et la façade publique de son propre module ;
- la façade publique d'un autre module lorsque l'écran compose réellement
  plusieurs domaines ;
- les types et services neutres publiés par `kernel` ou `platform`.

Ne peut pas importer :

- `src/adapters`, Supabase ou une URL fournisseur ;
- un fichier interne d'un autre module ;
- `src/app/contexts`, `src/app/hooks` ou `src/app/components` ;
- le routeur global ou un provider technique non injecté par la composition.

### 4.2 `src/app`

Possède uniquement :

- le démarrage de l'application ;
- les composition roots et providers globaux ;
- les shells et layouts communs aux modules ;
- le montage des routes déclarées ;
- les boundaries de chargement, d'erreur, d'authentification et de capability.

`src/app` peut importer les entrées publiques des modules. Les modules ne
peuvent jamais importer `src/app`.

### 4.3 `src/shared/ui`

Possède les primitives sans vocabulaire métier : bouton, champ, dialogue,
table, badge, squelette, pagination, tooltip et composition de formulaire.

Une primitive partagée :

- ne connaît aucun module ;
- ne déclenche aucun appel réseau ;
- ne lit aucun contexte métier ;
- expose une API de présentation réutilisable ;
- respecte les tokens Magrit `ink`, `paper`, `line` et `brand`.

Un composant nommé `OrderHistoryTable`, `InviteUserModal` ou `ShopProductCard`
n'est pas une primitive partagée : il appartient à un module métier.

### 4.4 Contributions de surface

`manifest.ts` et `surface-contributions.ts` restent indépendants de React. Ils
déclarent l'identité de la route, son chemin, sa surface, sa navigation et ses
capabilities, mais pas le composant React lui-même.

La composition runtime associe chaque identifiant de route à une entrée UI
publique chargée paresseusement depuis son module.

## 5. Règles de dépendance

```text
app -> modules/*/ui -> modules/*/api
app -> shared/ui <- modules/*/ui
modules/A/ui -> modules/B (entrée publique seulement)
modules -> kernel/platform

Interdit : modules -> app
Interdit : shared -> modules/app
Interdit : modules/*/ui -> adapters/fournisseurs
Interdit : module A -> fichiers internes du module B
```

Les écrans qui composent plusieurs domaines ont un module propriétaire unique.
Par exemple, l'administration de l'équipe appartient à `members`, même si elle
consomme les façades publiques `invitations` et `roles`. Cette composition ne
justifie pas de replacer l'écran dans `app`.

## 6. Invariants de migration

1. Aucun changement fonctionnel volontaire pendant un déplacement.
2. Les routes, URLs, test IDs, libellés et capabilities restent stables.
3. Le chargement lazy est conservé pour chaque page migrée.
4. Les contributions déclaratives restent utilisables côté serveur sans React.
5. Une page migrée ne dépend plus d'un context ou hook interne à `app`.
6. Une migration est verticale : page, sous-composants, contrôleur et tests
   changent de propriétaire ensemble.
7. Aucun shim de réexport depuis l'ancien chemin n'est conservé au-delà de la
   story qui en a besoin.
8. La baseline de composants métier dans `src/app/components` ne peut pas
   augmenter.
9. Les imports profonds entre modules sont bloqués par la CI.
10. Typecheck, tests d'architecture, tests fonctionnels et build restent verts
    à chaque vague.

## 7. Hors périmètre

- refonte visuelle ou changement du design Magrit ;
- modification des règles fonctionnelles UM1 ;
- changement des contrats HTTP ou du modèle de données sans nécessité démontrée ;
- remplacement de React, Tailwind ou du routeur ;
- fusion de modules métier ;
- migration MCP prévue par R3 ;
- optimisation générale de performance non liée au maintien du lazy loading.

## 8. Stratégie de composition React

Une page de module ne doit pas lire directement les contexts historiques de
`app`. Deux modèles sont autorisés :

1. le module utilise un port React neutre publié par `platform` pour obtenir les
   clients, l'acteur et le tenant courants ;
2. une boundary très fine de `app/surfaces` injecte ces valeurs à l'entrée UI du
   module par des props explicites.

Le choix doit être figé dans MUX0 et appliqué au pilote `members`. La création
d'un nouveau contexte global par module n'est pas une cible : les clients
restent composés une fois au niveau de la surface.

## 9. Critères d'acceptation globaux

1. **Given** une nouvelle page métier, **when** elle est ajoutée, **then** son
   implémentation se trouve dans le module propriétaire et non dans `src/app`.
2. **Given** un fichier `modules/*/ui`, **when** ses imports sont inspectés,
   **then** il ne dépend ni de `app`, ni d'un adaptateur, ni d'un fournisseur.
3. **Given** une contribution de surface, **when** elle est chargée côté serveur,
   **then** elle n'importe ni React ni le composant de page.
4. **Given** une route workspace migrée, **when** elle est ouverte, **then** son
   composant est chargé paresseusement depuis l'entrée publique du module.
5. **Given** la fin de la migration, **when** `src/app/components` est inspecté,
   **then** il ne contient que les shells explicitement autorisés ou est vide au
   profit de `app/layouts` et `shared/ui`.
6. Les parcours existants restent couverts et sans régression fonctionnelle.

## 10. Décisions validées par MUX0/MUX1

- racine du design system : `src/shared/ui` ;
- source commune des identifiants de test :
  `src/shared/presentation/testIds.ts` ;
- injection React : port neutre `WorkspaceUiRuntime` publié par `platform` et
  alimenté par `WorkspaceModuleUiBridge` dans la composition applicative ;
- entrée publique UI : `modules/<id>/ui/index.ts` ;
- une UX inter-domaines est importée depuis cette entrée UI publique, comme le
  rapport legacy publié par `shop-customers/ui` et composé par `members/ui`.

## 11. État livré MUX2 à MUX6

La migration complète applique les décisions précédentes aux vingt modules UI
du dépôt.

- `src/app/components` ne contient plus aucun fichier métier (baseline 0) ;
- les primitives neutres résident dans `src/shared/ui` (49 fichiers) ;
- les pages, hooks, contexts de présentation et helpers métier résident sous
  `src/modules/<module>/ui` ;
- les shells globaux résident sous `src/app/layouts` et la composition des
  surfaces sous `src/app/surfaces` ;
- le workspace injecte `WorkspaceUiRuntime` depuis
  `WorkspaceModuleUiBridge` ;
- le storefront injecte un `StorefrontUiRuntime` anonyme distinct depuis
  `StorefrontRuntimeBoundary` ;
- les anciens registres globaux de clients et services React ont été supprimés ;
- les entrées publiques peuvent être spécialisées par catégorie (`ui/hooks`,
  `ui/runtime`, `ui/storefront`, etc.). Un leaf explicitement réexporté par
  `ui/index.ts` peut être importé directement lorsque le barrel créerait un
  cycle de chunks ; les autres imports internes restent interdits.

Les invariants sont rendus opposables par `modular-ui-boundaries.test.ts`,
`api-first-boundaries.test.ts` et le test du graphe statique storefront.
