---
id: MUX0
epic: EPIC-MUX-UX-MODULAIRE
sprint: MUX-A
priority: P0
effort: M
status: done
branch: refactor/modular-ux-foundation
depends_on: []
unblocks: [MUX1]
---

# MUX0 — Socle et frontières de l'UX modulaire

## User story

En tant qu'équipe Magrit, nous voulons un design system placé dans une racine
neutre et des tests de frontières bloquants afin que les modules puissent
posséder leur UX sans dépendre de l'application ou des fournisseurs techniques.

## Critères d'acceptation

1. **Given** les primitives existantes de `src/app/components/ui`, **when** MUX0
   est livrée, **then** elles sont accessibles depuis une racine partagée neutre
   et leur API publique reste compatible.
2. **Given** un fichier `src/modules/*/ui`, **when** il importe un élément de
   `src/app`, `src/adapters`, Supabase ou un fournisseur, **then**
   `pnpm test:architecture` échoue en nommant le fichier et l'import.
3. **Given** deux modules A et B, **when** A importe un fichier interne de B au
   lieu de son entrée publique, **then** le test d'architecture échoue.
4. **Given** `manifest.ts` ou `surface-contributions.ts`, **when** leurs imports
   sont inspectés, **then** ils restent indépendants de React et des entrées UI.
5. **Given** une entrée UI de module, **when** elle est chargée par une surface,
   **then** son contrat d'export est documenté et compatible avec un import lazy.
6. **Given** les composants métier historiques de `src/app/components`, **when**
   leur nombre augmente, **then** la CI échoue ; une baisse doit mettre à jour la
   baseline.
7. Routes, comportement utilisateur, contrats HTTP et styles restent inchangés.

## Tasks

- [x] Valider `src/shared/ui` comme racine du design system.
- [x] Déplacer les 48 primitives et adapter les imports de manière mécanique.
- [x] Définir `modules/<id>/ui/index.ts` comme entrée publique UI.
- [x] Choisir et documenter l'injection des clients, de l'acteur et du tenant.
- [x] Ajouter un test `modular-ui-boundaries` dans la suite architecture.
- [x] Ajouter un test des imports profonds inter-modules.
- [x] Mesurer et versionner la baseline de composants métier dans `app`.
- [x] Ajouter une entrée UI lazy réelle avec le pilote Members.
- [x] Conserver l'alias TypeScript/Vite partagé et déclarer les types React.
- [x] Exécuter la validation complète.

## Décision attendue sur l'injection

MUX0 doit choisir un seul patron parmi :

- ports React neutres publiés par `platform`, consommables par tous les modules ;
- props explicites fournies par une boundary fine de `app/surfaces`.

Le choix doit garantir qu'aucun module n'importe `ModuleClientsContext`,
`TenantContext`, `AuthContext` ou un autre context appartenant à `app`.

## Dérogation brownfield R5

Les écrans métier restent provisoirement dans `src/app/components` et sont
comptés dans une baseline figée. Aucune nouvelle page ne peut y être ajoutée.
La conformité est obtenue progressivement par MUX1 à MUX6.

## Plan de test

- tests négatifs avec probes temporaires pour chaque frontière ;
- compilation d'un exemple `modules/*/ui` ;
- `pnpm run typecheck` ;
- `pnpm test:architecture` ;
- `pnpm test` ;
- `pnpm run build`.

## Definition of Done

Le socle est livré sans changement fonctionnel, les règles de dépendance sont
opposables en CI, et MUX1 peut migrer `members` sans créer de nouveau mécanisme
de composition.

## Dev Agent Record

### Décisions d'implémentation

- Le port `WorkspaceUiRuntime` appartient à `platform/runtime` et ne connaît
  aucun module métier.
- `WorkspaceModuleUiBridge` injecte acteur, tenant, transport API et
  rafraîchissement du jeton depuis la composition `app`.
- Les `data-testid` ont rejoint `shared/presentation` afin de rester une source
  unique accessible aux modules sans dépendance vers `app`.
- La baseline brownfield après MUX1 est de 130 fichiers sous `app/components`.

### Résultats de validation

- `pnpm run typecheck` : vert ;
- `pnpm run test:architecture` : 174 tests verts ;
- `pnpm test` : 1 239 tests verts, 36 ignorés ;
- `pnpm run build` : vert, 2 193 modules transformés.
