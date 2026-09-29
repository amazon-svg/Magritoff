---
id: HSPQ-1
epic: Integration HopeStudio
status: done
branch: feat/hopstudio-project-quote-callback
depends_on: []
blocks: [HSPQ-2]
---
# HSPQ-1 — Isoler et reprendre la session HopeStudio d’un projet

<!-- notion-functional:begin — aucune story Notion rattachée ; section maintenue dans le dépôt (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel

> Cette story est née dans le dépôt pendant l’intégration HopeStudio. Aucune
> page Notion ni aucun cas de test Notion ne lui est rattaché au 29/09/2026.

**En tant que** commercial, **je veux** que chaque projet conserve sa propre
session HopeStudio, **afin de** reprendre la bonne conversation sans afficher
le contenu du projet précédemment ouvert.

### Critères d’acceptation

1. Un projet peut recevoir un identifiant de session HopeStudio uniquement si
   sa valeur courante est `null`.
2. Une session HopeStudio ne peut être associée qu’à un seul projet d’un même
   tenant.
3. L’ouverture d’un projet qui possède une session ouvre directement
   HopeStudio avec cette session.
4. L’ouverture d’un projet sans session reste sur l’accueil jusqu’à l’envoi
   d’un premier prompt.
5. Avant l’initialisation du runtime, la session globale précédente est remise
   à zéro ; l’identifiant du projet est fourni comme session initiale.
6. Le prompt initial est fourni à HopeStudio par `HChat.initial_prompt` :
   Magrit ne déclenche pas lui-même un appel HTTP `CallAI`.
7. L’identifiant de session créé par HopeStudio est persisté sur le projet une
   seule fois ; une course ou une tentative de remplacement est refusée sans
   écraser la valeur déjà enregistrée.

### Cas de test rattachés

Voir `CT-HSPQ-001` à `CT-HSPQ-007` dans le
[carnet de tests de la PR](./carnet-tests-hopstudio-project-quote-callback.md).

---

_Fin du périmètre fonctionnel. La suite décrit l’implémentation._
<!-- notion-functional:end -->

## Implémentation livrée

- `projects.hopstudio_session_id` porte la session du projet.
- L’index partiel unique
  `projects_tenant_hopstudio_session_id_unique` empêche le partage d’une même
  session entre deux projets du tenant.
- `ProjectsService.update()` verrouille la session dès qu’elle est définie.
- Le repository traduit la violation d’unicité en
  `project.hopstudio_session_already_assigned`.
- `HopeStudioWorkspace` initialise `HChat.session_id` à `null`, puis fournit
  `HChat.initial_session_id` et `HChat.initial_prompt` au runtime.
- Le workspace observe la session effectivement créée par HopeStudio et la
  rattache au projet seulement si celui-ci ne possède toujours aucune session.
- La sélection d’un ancien projet muni d’une session contourne l’accueil de
  nouveau prompt et affiche directement le Studio.

## Hors périmètre

- transfert manuel d’une session d’un projet vers un autre ;
- remplacement ou suppression d’une session déjà affectée ;
- fusion de conversations HopeStudio ;
- appels directs à `CallAI` depuis Magrit.

## Preuves et fichiers principaux

- `supabase/migrations/20260922000100_gescom_hopstudio_project_session.sql`
- `supabase/migrations/20260924000100_unique_hopstudio_session_per_project.sql`
- `src/modules/projects/application/projects-service.ts`
- `src/adapters/supabase/projects-repository.ts`
- `src/modules/hopstudio/ui/HopeStudioWorkspace.tsx`
- `src/modules/catalog/ui/workspace/configurator-workspace-state.ts`
- `tests/contract/projects.contract.test.ts`
- `tests/modules/catalog/configurator-workspace.test.ts`
- `tests/modules/hopstudio/workflow-transport.test.ts`

## Dette et vigilance

- La migration globale reste dépendante d’un historique Supabase local propre.
  Un doublon historique a été résolu en mettant une association à `null`, mais
  l’anomalie d’historique `20260417000000` doit rester traitée séparément.
- La valeur de session est volontairement immuable au niveau métier. Toute
  future fonction de transfert devra être une opération explicite, auditée et
  atomique.

