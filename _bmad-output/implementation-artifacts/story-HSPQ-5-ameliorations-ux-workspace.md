---
id: HSPQ-5
epic: Integration HopeStudio
status: in-progress
branch: feat/hopstudio-project-quote-callback
depends_on: [HSPQ-1, HSPQ-2, HSPQ-3, HSPQ-4]
blocks: []
---
# HSPQ-5 — Améliorations UX du workspace HopeStudio

<!-- notion-functional:begin — aucune story Notion rattachée ; section maintenue dans le dépôt (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel

> Story évolutive née dans le dépôt le 29/09/2026 pour regrouper les
> améliorations UX demandées après la première intégration HopeStudio. Aucune
> page Notion ni aucun cas de test Notion ne lui est rattaché à cette date.

**En tant que** membre d’un espace Magrit, **je veux** toujours comprendre dans
quel espace je travaille et disposer de raccourcis cohérents, **afin de** me
repérer sans interrompre mon travail commercial.

### Lot UX-1 — Lien vers l’espace courant dans la barre supérieure

1. Le nom de l’espace courant est affiché à côté de la marque `Magrit` dans la
   barre supérieure des routes tenant.
2. Le nom est un lien vers l’accueil canonique `/t/{tenantSlug}` de cet espace.
3. Le lien utilise le nom lisible de l’espace, avec une infobulle et un libellé
   accessible explicites.
4. Le texte long est tronqué sur petit écran sans déplacer le menu utilisateur.
5. Cliquer sur le lien d’espace ne déclenche pas l’action `nouvelle
   conversation` attachée au bouton Magrit.
6. Aucun lien d’espace n’est affiché sur les routes hors tenant si aucun espace
   courant n’est résolu.

### Lot UX-2 — Gestion du projet depuis « Éléments du projet »

1. Le nom du projet peut être modifié directement dans l’en-tête du drawer.
2. Chaque élément du projet peut être renommé en ligne, sans modifier son
   payload de chiffrage, sa description, ses fichiers ou son prix.
3. Chaque élément peut être supprimé après une confirmation explicite dans la
   ligne concernée.
4. Un renommage ou une suppression met immédiatement à jour l’affichage, la
   sélection et le compteur d’éléments, sans recharger la page.
5. Le renommage du projet est répercuté dans le contexte actif et dans sa
   sauvegarde de session.
6. Les champs vides sont refusés et les actions en cours ne peuvent pas être
   soumises deux fois.
7. Renommer ou supprimer un élément de projet n’altère jamais rétroactivement
   les lignes de devis ou de commande déjà créées à partir de cet élément.

### Cas de test rattachés

Voir `CT-HSPQ5-001` à `CT-HSPQ5-014` dans le
[carnet de tests UX](./carnet-tests-HSPQ-5-ameliorations-ux-workspace.md).

---

_Fin du périmètre fonctionnel. La suite décrit l’implémentation._
<!-- notion-functional:end -->

## Journal d’implémentation

### 29/09/2026 — UX-1 livré

- `Header` lit désormais `currentTenant` depuis le contexte tenant.
- Le groupe de marque affiche `Magrit / Nom de l’espace`.
- Le nom utilise un composant `Link` indépendant du bouton Magrit.
- `workspaceHomePath()` centralise et encode la route d’accueil tenant.
- Le testid stable `nav-current-space-link` est ajouté pour les futurs parcours
  navigateur.
- Le test ciblé passe (2 cas), le build et le validateur de spécifications
  passent. Le typecheck global reste en échec sur une dette préexistante sans
  erreur signalée dans les fichiers de ce lot.

### 29/09/2026 — UX-2 livré

- Le drawer charge le projet avec son `ETag` et permet de renommer le projet
  avec la route `PATCH /projects/{projectId}` existante.
- La nouvelle opération `PATCH /projects/{projectId}/items/{itemId}` renomme
  uniquement le libellé de l’élément.
- Les actions crayon et corbeille sont disponibles sur chaque ligne ; la
  suppression demande une confirmation locale explicite.
- La suppression retire aussi l’identifiant de la sélection courante et met à
  jour les badges de compteur sur l’accueil et dans HopeStudio.
- Le reducer du configurateur conserve immédiatement le nouveau nom du projet,
  ensuite persisté dans `sessionStorage` par le mécanisme existant.
- La lecture unitaire d’un élément fournit désormais un `ETag` ; son renommage
  exige `If-Match` et refuse donc les écrasements concurrents silencieux.
- Vérifications : 36 tests ciblés passent, typecheck modulaire réussi, 212
  opérations OpenAPI valides, types générés alignés, build et specs valides.

## Fichiers

- `src/app/layouts/Header.tsx`
- `src/app/layouts/header-navigation.ts`
- `src/shared/presentation/testIds.ts`
- `tests/app/header-current-space-link.test.ts`
- `src/modules/catalog/ui/workspace/ActiveProjectItemsDrawer.tsx`
- `src/modules/catalog/ui/workspace/configurator-workspace-state.ts`
- `src/modules/projects/api/client.ts`
- `src/modules/projects/api/contracts.ts`
- `src/modules/projects/application/projects-service.ts`
- `src/adapters/supabase/projects-repository.ts`
- `src/server/api/projects-routes.ts`
- `openapi/magrit-core.v1.yaml`
- `tests/contract/projects.contract.test.ts`
- `tests/modules/catalog/configurator-workspace.test.ts`
- `_bmad-output/implementation-artifacts/carnet-tests-HSPQ-5-ameliorations-ux-workspace.md`

## Points ouverts

- Les prochains ajustements UX de cette séquence seront ajoutés comme lots
  numérotés dans cette story et dans le même carnet.
- La validation visuelle desktop/mobile de chaque lot reste consignée
  séparément des tests unitaires.
