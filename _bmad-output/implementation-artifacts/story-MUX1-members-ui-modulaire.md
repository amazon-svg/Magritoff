---
id: MUX1
epic: EPIC-MUX-UX-MODULAIRE
sprint: MUX-A
priority: P0
effort: L
status: blocked-by-MUX0
branch: refactor/members-modular-ui
depends_on: [MUX0, UM1-REGLES-FONCTIONNELLE]
unblocks: [MUX2, MUX3, MUX4]
---

# MUX1 — Pilote UX modulaire du domaine Members

## User story

En tant qu'équipe Magrit, nous voulons que le module `members` possède
entièrement l'écran d'administration de l'équipe afin de valider le patron UX
modulaire sur un parcours fonctionnel réel et stabilisé par UM1.

## Périmètre fonctionnel à préserver

- affichage exclusif des membres Magrit `magrit_full` ;
- profils `Admin` et `Utilisateur` ;
- options `Boutiques` et `Commandes` ;
- invitation avec choix du profil et des options compatibles ;
- renvoi et révocation d'une invitation ;
- changement de profil ;
- modification des options ;
- retrait d'un membre ;
- interdiction de supprimer ou rétrograder le dernier administrateur ;
- filtrage de la route et de la navigation par `members.manage` ;
- séparation stricte avec les comptes clients boutique.

## Propriété cible

```text
src/modules/members/
  ui/
    workspace/
      MembersPage.tsx
    components/
      InviteMemberDialog.tsx
      EditMemberOptionsDialog.tsx
      MembersTable.tsx
      PendingInvitations.tsx
    hooks/
      useMembersWorkspace.ts
    models/
      membersPresentation.ts
    index.ts
```

Le module `members` est propriétaire de la page. Il peut consommer les entrées
publiques de `invitations` et `roles`, mais ne peut pas importer leurs dossiers
`application` ou `api` par un chemin profond.

## Critères d'acceptation

1. **Given** la route `members.workspace.list`, **when** elle est résolue, **then**
   le composant lazy provient de l'entrée publique `modules/members/ui`.
2. **Given** le module `members`, **when** ses fichiers UI sont inspectés,
   **then** la page, ses modales, ses helpers et son contrôleur lui appartiennent.
3. **Given** les anciens fichiers `DashboardUsers`, `InviteUserModalV2` et
   `EditUserRolesModal`, **when** la story est terminée, **then** ils n'existent
   plus sous `src/app/components/dashboard` et aucun shim permanent ne subsiste.
4. **Given** l'UX Members, **when** ses imports sont inspectés, **then** elle ne
   dépend d'aucun context, hook ou composant métier de `src/app`.
5. **Given** une intégration avec Invitations ou Roles, **when** elle est
   compilée, **then** elle passe exclusivement par l'entrée publique du module
   concerné.
6. **Given** un Admin, **when** il ouvre la page, **then** les membres,
   invitations, profils et options UM1 sont fonctionnellement inchangés.
7. **Given** un Utilisateur sans `members.manage`, **when** il tente d'ouvrir la
   route, **then** la gate de capability conserve le refus actuel.
8. **Given** une tentative affectant le dernier Admin, **when** la commande est
   envoyée, **then** le refus serveur est affiché sans état UI incohérent.
9. Le chunk Members reste chargé paresseusement et n'augmente pas le bundle
   initial de manière significative.
10. La baseline métier sous `app/components` diminue du nombre exact de fichiers
    migrés.

## Tasks

- [ ] Créer l'entrée publique `src/modules/members/ui/index.ts`.
- [ ] Déplacer et renommer `DashboardUsers` en `MembersPage`.
- [ ] Décomposer la page en table des membres et invitations en attente.
- [ ] Déplacer et renommer les modales d'invitation et d'options.
- [ ] Déplacer les helpers purs et leurs tests dans le périmètre Members.
- [ ] Remplacer `useMagritUsersManagement` par un contrôleur appartenant à
      `members/ui` utilisant les façades publiques.
- [ ] Injecter acteur, tenant et clients selon la décision MUX0.
- [ ] Publier les opérations nécessaires dans les entrées publiques de
      `invitations` et `roles` sans exposer leur implémentation.
- [ ] Modifier `workspaceRuntimeRoutes` pour charger l'entrée UI Members.
- [ ] Conserver la contribution déclarative `membersWorkspaceContribution`
      indépendante de React.
- [ ] Supprimer les anciens fichiers et corriger les imports/tests.
- [ ] Mettre à jour la baseline brownfield.
- [ ] Documenter le patron obtenu pour MUX2 à MUX4.

## API et données

Aucun changement de contrat HTTP ou de migration SQL n'est attendu. Si un
contrat manque pour retirer une dépendance vers `app`, cette lacune doit être
documentée avant modification et donner lieu à un sous-lot API-first distinct.

Les règles d'autorisation restent contrôlées côté serveur. Les gates React
améliorent l'UX mais ne constituent jamais la barrière de sécurité.

## Scénarios de test

1. Admin : chargement des membres Magrit et invitations en attente.
2. Admin : invitation d'un Admin sans options.
3. Admin : invitation d'un Utilisateur avec option Boutiques, Commandes ou les
   deux.
4. Admin : renvoi puis révocation d'une invitation.
5. Admin : promotion d'un Utilisateur en Admin.
6. Admin : modification des options d'un Utilisateur.
7. Dernier Admin : rétrogradation et retrait refusés proprement.
8. Utilisateur sans capability : navigation masquée et route refusée.
9. Compte boutique : absence de la liste Members.
10. Import dynamique : aucun code Members dans le chunk initial avant ouverture.

## Plan de validation

- tests unitaires des modèles de présentation et helpers ;
- tests des hooks avec clients injectés ;
- tests de route, navigation et capability existants ;
- tests serveur Members, Invitations et Roles existants ;
- test d'architecture interdisant tout import vers `app` ;
- `pnpm run typecheck` ;
- `pnpm test:architecture` ;
- `pnpm test` ;
- `pnpm run build`.

## Definition of Done

Le parcours Utilisateurs est fonctionnellement équivalent à UM1, son code React
appartient au module `members`, aucun import interdit n'est présent et ce module
sert d'exemple officiel aux migrations suivantes.

