---
id: E7.7
epic: E7 — Perf & infra
source: notion
notion_url: https://app.notion.com/p/358d0131973c819db802eeff473a709a
---
# E7.7 — Instrumentation data-testid pour automatisation de tests

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [E7.7 — Instrumentation data-testid pour automatisation de tests](https://app.notion.com/p/358d0131973c819db802eeff473a709a) · extrait le 17/09/2026 · page modifiée le 06/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| E7 — Perf & infra | Sprint 2 | P0 | M | Terminé | Claude code | Technique | Demande 05/05 | — |

### Description fonctionnelle (Notion)

**En tant qu'**équipe test (Arnaud + Claude in Chrome), **je veux** que tous les composants React des parcours P00 à P11 portent des attributs `data-testid` stables et cohérents, **afin de** pouvoir automatiser l'exécution des cahiers de tests fonctionnels sans casser à chaque refacto CSS ou changement de wording.

##### Contexte

La nouvelle base Notion [🧪 Cahiers de tests fonctionnels Magrit](https://www.notion.so/7e576e695d504cc9a32ead92f4dde01c) contient un champ **Hints DOM** que Claude in Chrome utilise pour se repérer dans le DOM. Aujourd'hui, sans `data-testid`, les sélecteurs disponibles (classes Tailwind, libellés visibles, structure DOM) sont fragiles. Cette story livre l'instrumentation propre.

##### Critères d'acceptation

- Convention de nommage `<scope>-<element>[-<modifier>]` documentée (cf. brief technique).
- Fichier `src/lib/testIds.ts` créé et exporté comme const enum centrale.
- Tous les composants listés en section 3 du brief technique sont instrumentés (parcours P00 à P09 ; P10 et P11 différés aux livraisons E9.5 et E3.1/E3.2).
- Composants UI custom de `src/components/ui/` forwardent les props `data-*`.
- Test de fumée `tests/data-testid.smoke.spec.ts` qui vérifie la présence des testid critiques (≥1 par parcours, listés en section 6 du brief).
- PR par parcours (1 commit par parcours pour faciliter la review).

##### Brief technique détaillé

Le brief complet à communiquer à Claude Code est disponible dans le fichier `SPEC_data-testid_06052026.md` partagé par Arnaud. Sections du brief :

1. Contexte et objectif
2. Convention de nommage
3. Périmètre — composants à instrumenter (par parcours P00-P09)
4. Patterns techniques React (forward props, fichier testIds.ts, pas de strip en prod)
5. Critères d'acceptation
6. Liste des testid critiques pour le test de fumée
7. Ce qui est hors périmètre
8. Process de PR

##### Dépendances

- E9.5 (email invitation) pour finaliser P10
- E3.1, E3.2 (streaming) pour finaliser P11
- E7.5 (blocage Freemium) pour finaliser les testid `usage-quota-blocked-modal` / `usage-quota-upgrade-btn` de P07
- E7.6 (dashboard ops) pour finaliser le testid `admin-usage-dashboard` de P07

##### Articulation avec les cahiers de tests

Quand la PR est mergée, Arnaud alimente le champ **Hints DOM** des cas de test dans la base Notion en référençant les testid livrés. Ce travail est manuel (ou peut être confié à Claude in Chrome qui parcourt les routes pour extraire automatiquement les testid présents).

##### Red flag

Ne pas supprimer les testid existants éventuels sans accord préalable. En cas de besoin de renommage : stratégie dual-tag pendant 1 sprint, mise à jour des cahiers de tests Notion, suppression au sprint suivant.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent E7.7

- `SPRINT_HANDOFF.md`
- `_bmad-output/implementation-artifacts/story-S2.1-shop-layout-3col.md`
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/prd.md`
- `docs/project-context.md`
- `src/modules/catalog/ui/components/ProductCard.tsx`
- `src/modules/conversations/ui/components/ChatInterface.tsx`
- `src/shared/presentation/testIds.ts`
- `tests/data-testid.smoke.spec.ts`
