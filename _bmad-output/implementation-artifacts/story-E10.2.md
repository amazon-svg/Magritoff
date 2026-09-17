---
id: E10.2
epic: E10 — Gestion commerciale
source: notion
notion_url: https://app.notion.com/p/3cad0131973c810eaecbc76640c4ab4c
---
# E10.2 — Tags libres colorés sur les projets, recherche et filtrage

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [E10.2 — Tags libres colorés sur les projets, recherche et filtrage](https://app.notion.com/p/3cad0131973c810eaecbc76640c4ab4c) · extrait le 17/09/2026 · page modifiée le 01/09/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| E10 — Gestion commerciale | Sprint 5 — Gestion commerciale | P1 | M | Terminé | Claude code | Pro+ | RP 28/08/2026, WM 01/09/2026 | 5 |

### Description fonctionnelle (Notion)

**En tant que** commercial gérant de nombreux projets, **je veux** poser des tags libres et colorés sur mes projets et filtrer dessus, **afin de** classer mes affaires sans subir une arborescence de dossiers rigide.

##### Statut

Draft — prêt pour agent dev

##### Contexte produit

Décision RP du 28/08/2026 : le classement par arborescence est écarté au profit de tags textuels libres, créés à la volée, avec une couleur. Combinés à un champ de recherche et à un filtre, ils suffisent au repérage des projets.

##### Critères d'acceptation

1. Un projet accepte 0 à N tags ; un tag est une chaîne libre associée à une couleur d'une palette fermée.
2. Le tag se crée à la volée depuis le champ de saisie du projet : si le libellé n'existe pas dans le tenant, il est créé et proposé ensuite en autocomplétion.
3. Les tags sont scopés au tenant ; deux tenants peuvent avoir le même libellé sans collision.
4. La liste des projets offre un champ de recherche plein texte (nom du projet, nom du client) et un filtre multi-tags en ET logique.
5. Le retrait d'un tag d'un projet ne supprime pas le tag du tenant ; un tag non utilisé reste disponible et peut être supprimé explicitement depuis la configuration.
6. Les tags sont affichés sur la ligne de projet dans la liste et dans l'en-tête du projet.

##### Tâches / Sous-tâches

- [ ] Migration SQL `project_tags` et `project_tag_links` (CA : 1, 3, 5)
  - [ ] `project_tags` : id, tenant_id, label, color, created_at ; contrainte UNIQUE (tenant_id, lower(label))
  - [ ] `project_tag_links` : project_id, tag_id, PK composite ; ON DELETE CASCADE côté projet
- [ ] Composant `src/components/projects/TagInput.tsx` — autocomplétion + création à la volée (CA : 2)
- [ ] Composant `src/components/projects/TagBadge.tsx` (CA : 6)
- [ ] Barre de recherche et filtre multi-tags sur la liste (CA : 4)
- [ ] Écran de gestion des tags dans la configuration du tenant (CA : 5)

##### Dev Notes

###### Modèle de données

Palette fermée alignée sur les couleurs shadcn/Tailwind déjà utilisées dans le design system, stockée comme jeton (`slate`, `blue`, `green`, `amber`, `red`, `violet`) et non comme code hexadécimal — la charte doit pouvoir évoluer sans migration.

###### Composants et fichiers cibles

- `src/components/projects/TagInput.tsx`, `TagBadge.tsx` (nouveaux)
- `src/pages/dashboard/projects/index.tsx` (recherche et filtre)
- `src/services/projectTags.ts` (nouveau)

###### data-testid

`project-tag-input`, `project-tag-option` (+ `data-tag-id`), `project-tag-badge` (+ `data-tag-id`), `project-tag-remove-btn`, `projects-search-input`, `projects-tag-filter`, `projects-tag-filter-option` (+ `data-tag-id`)

###### Contraintes techniques

- La recherche s'appuie sur un index `pg_trgm` sur `projects.name` — pas de filtrage côté client sur une liste paginée.
- Normaliser le libellé (trim, casse insensible) avant contrôle d'unicité, l'afficher tel que saisi.

###### Dépendances

- Bloquée par : E10.1

##### Contrat API (ajout WM 01/09/2026)

Conventions de **E10.0**.

| Méthode | Route | Objet |
|---|---|---|
| GET | `/api/v1/project-tags` | Liste des tags du tenant ; `?q=` pour l'autocomplétion |
| POST | `/api/v1/project-tags` | Crée un tag ; renvoie l'existant en 200 si le libellé normalisé existe déjà |
| DELETE | `/api/v1/project-tags/{id}` | Supprime un tag du tenant |
| PUT | `/api/v1/projects/{id}/tags` | Remplace la liste des tags du projet : `{ tag_ids: [uuid] }` (`If-Match`) |

La création à la volée est **idempotente sur le libellé normalisé** (trim, casse insensible) : deux commerciaux qui saisissent le même tag simultanément obtiennent le même identifiant, pas deux tags jumeaux.

##### Tests

Parcours P13 — création d'un tag à la volée puis filtrage de la liste sur ce tag.

##### Change Log

- 2026-08-28 — v1 — Création à partir de la séance du 28/08/2026 — Arnaud Mazon / Claude

##### Dev Agent Record

###### Agent Model Used

Sonnet (implementation), Opus (verification)

###### Debug Log References

(none provided)

###### Completion Notes

**CA1** (0 to N tags, color from closed palette): met. Color assigned server-side (never received from client), token palette (no hardcoded hex color).

**CA2** (on-the-fly creation, autocompletion): met. Most delicate point verified in depth by QA with genuinely simultaneous calls against the database (not a simulation): two commercials entering the same label at the same instant get the same identifier, never two twin tags.

**CA3** (tenant scope, no collision between tenants): met and tested.

**CA4** (full-text search + multi-tag filter in AND logic): met after correction — a search containing a comma did not trigger a visible error but silently returned no results, even on unrelated names. Fixed.

**CA5** (tag removal ≠ deletion, explicit deletion refused if in use): met, backed by database constraint.

**CA6** (display on list and project card): met.

**Explicitly recorded debt:**

- No dedicated screen for tag management/deletion in the UI (action exists server-side and works, but nothing accesses it visually) — to open as separate story if the need to clean up the tag catalogue arises.
- ETag instability issue on projects containing tags found and fixed — rare case where two consecutive reads of the same project could have triggered a rejection ("someone else modified it" message when that wasn't the case). Also fixed the same defect on an older component (E10.5, shop accounts) in the same pass.
- Tenant isolation test suite written and carefully reviewed, not executed in real environment (same as all stories in sprint).

###### File List

`src/modules/project-tags/**`, `src/adapters/supabase/project-tags-repository.ts`, `src/server/api/project-tags-routes.ts`, `supabase/migrations/20260902000100_gescom_e10_2_project_tags.sql`, `tests/sql/gescom-e10-2-project-tags.sql`, `src/modules/projects/ui/workspace/{ProjectDetailPage,ProjectsPage}.tsx`, `src/modules/projects/ui/workspace/ProjectTagsEditor.tsx` (new), `openapi/magrit-core.v1.yaml`, `src/shared/presentation/testIds.ts`

##### QA Results

**Verdict: Accepté** (after 2 correction cycles)

All CA verified in depth. Notable verification: idempotent creation under concurrent load — two simultaneous requests for the same normalized label correctly produce a single tag. Color assignment, tenant isolation, search with commas, tag persistence on project deletion all confirmed working.

### Cas de test fonctionnels rattachés (Notion)

| TF | Cas de test | Statut | Priorité | Parcours | Cible | Stories liées |
|---|---|---|---|---|---|---|
| [TF-162](https://app.notion.com/3cad0131973c81d0bd48deeb4ffb5e3f) | GC — Créer un tag à la volée et filtrer la liste des projets | À jouer | P1 — Importante | P13 — Devis et gestion commerciale | B6 | E10.2 |

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent E10.2

- `_bmad-output/implementation-artifacts/story-E10-13-etapes-production.md`
- `_bmad-output/implementation-artifacts/story-E10.10b-4b.md`
- `docs/api/CONVENTIONS.md`
- `docs/spec/backlog.md`
- `openapi/magrit-core.v1.yaml`
- `src/adapters/supabase/customers-repository.ts`
- `src/adapters/supabase/price-rules-repository.ts`
- `src/adapters/supabase/project-tags-repository.ts`
- `src/adapters/supabase/projects-repository.ts`
- `src/modules/production-steps/api/contracts.ts`
- `src/modules/production-steps/application/production-steps-service.ts`
- `src/modules/project-tags/api/client.ts`
- `src/modules/project-tags/api/contracts.ts`
- `src/modules/project-tags/application/project-tags-service.ts`
- `src/modules/projects/api/client.ts`
- `src/modules/projects/api/contracts.ts`
- `src/modules/projects/application/projects-repository.ts`
- `src/modules/projects/application/projects-service.ts`
- `src/modules/projects/ui/helpers/tagColors.ts`
- `src/modules/projects/ui/hooks/useProjectDetail.ts`
- `src/modules/projects/ui/hooks/useProjectTagsCatalog.ts`
- `src/modules/projects/ui/hooks/useProjectsManagement.ts`
- `src/modules/projects/ui/workspace/ProjectTagsEditor.tsx`
- `src/platform/api/generated/magrit-core.v1.ts`
- `src/server/api/gescom-middleware.ts`
- `src/server/api/gescom-routes.ts`
- `src/server/api/project-tags-routes.ts`
- `src/server/api/projects-routes.ts`
- `src/shared/presentation/testIds.ts`
- `supabase/functions/magrit-api/index.ts`
- `supabase/migrations/20260901000500_gescom_e10_1_projects.sql`
- `supabase/migrations/20260902000100_gescom_e10_2_project_tags.sql`
- `supabase/migrations/20260908020000_gescom_e10_13_production_steps.sql`
- `supabase/migrations/20260909030000_gescom_e10_10b_4b_document_pdf_template_fields.sql`
- `tests/adapters/supabase/customers-repository.test.ts`
- `tests/adapters/supabase/projects-repository.test.ts`
- `tests/contract/_fakes/customers-repository.fake.ts`
- `tests/contract/_fakes/project-tags-repository.fake.ts`
- `tests/contract/_fakes/projects-repository.fake.ts`
- `tests/contract/_lint.ts`
- `tests/contract/openapi-document.contract.test.ts`
- `tests/contract/project-tags.contract.test.ts`
- `tests/contract/projects.contract.test.ts`
- `tests/modules/project-tags/color-for-label.test.ts`
- `tests/sql/gescom-e10-2-project-tags.sql`
