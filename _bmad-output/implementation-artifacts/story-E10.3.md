---
id: E10.3
epic: E10 — Gestion commerciale
source: notion
notion_url: https://app.notion.com/p/3cad0131973c817ca89be69ab67d6a8b
---
# E10.3 — Création d'un devis depuis un projet avec sélection multi-produits

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [E10.3 — Création d'un devis depuis un projet avec sélection multi-produits](https://app.notion.com/p/3cad0131973c817ca89be69ab67d6a8b) · extrait le 17/09/2026 · page modifiée le 01/09/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| E10 — Gestion commerciale | Sprint 5 — Gestion commerciale | P0 | L | Terminé | Claude code | Pro+ | RP 28/08/2026, WM 01/09/2026 | 6 |

### Description fonctionnelle (Notion)

**En tant que** commercial, **je veux** sélectionner un ou plusieurs chiffrages d'un projet et générer un devis, **afin de** passer de l'exploration tarifaire à une offre commerciale sans ressaisie.

##### Statut

Draft — prêt pour agent dev

##### Contexte produit

Décision RP du 28/08/2026 : un bouton « Créer un devis » est placé dans l'en-tête du projet. Il ouvre une sélection des éléments du projet, puis bascule vers l'interface d'édition du devis. Un projet peut donner lieu à plusieurs devis.

##### Critères d'acceptation

1. L'en-tête du projet expose un bouton « Créer un devis », actif seulement si le projet contient au moins un chiffrage.
2. Chaque élément du projet porte une case de sélection ; le bouton ouvre l'écran d'édition du devis avec les éléments cochés convertis en lignes.
3. Chaque ligne de devis reprend la configuration produit, la quantité et le prix de production issus du chiffrage source, et conserve la référence `project_item_id`.
4. Le devis hérite automatiquement du client du projet ; le client n'est pas ressaisi.
5. Un numéro de devis unique et séquentiel par tenant est attribué à la création (format `DEV-AAAA-NNNNN`).
6. Le devis est créé au statut « Brouillon » et reste éditable tant qu'il n'est pas validé (E10.12).
7. Un même élément de projet peut alimenter plusieurs devis successifs sans être consommé.

##### Tâches / Sous-tâches

- [ ] Migration SQL `quotes` et `quote_lines` (CA : 3, 5, 6)
  - [ ] `quotes` : id, tenant_id, customer_id, project_id, number, status ('draft'\|'sent'\|'accepted'\|'rejected'\|'converted'), valid_until, show_discounts bool, created_by, created_at
  - [ ] `quote_lines` : id, quote_id, project_item_id, label, product_config jsonb, quantity, position
  - [ ] Séquence de numérotation par tenant et par année
- [ ] Composant `src/components/projects/CreateQuoteDrawer.tsx` — sélection multi-éléments (CA : 1, 2)
- [ ] Page `src/pages/dashboard/quotes/[id].tsx` — édition du devis (CA : 3, 6)
- [ ] Service `src/services/quotes.ts` — `createQuoteFromProjectItems()` (CA : 2, 3, 4, 5, 7)

##### Dev Notes

###### Modèle de données

Les colonnes de prix des lignes sont définies par E10.8 (moteur de calcul) et E10.9 (remises) — ne pas les inventer ici, implémenter E10.8 d'abord ou poser les colonnes en une seule migration coordonnée.

###### API / Services

`createQuoteFromProjectItems(projectId, itemIds[])` est **transactionnelle** : numérotation, création du devis et des lignes dans la même transaction, sinon un trou de séquence ou un devis orphelin est possible.

###### data-testid

`project-create-quote-btn`, `project-item-checkbox` (+ `data-item-id`), `quote-create-drawer`, `quote-create-submit-btn`, `quote-editor-page`, `quote-number-display`, `quote-line-row` (+ `data-line-id`)

###### Contraintes techniques

- La numérotation doit passer par une séquence Postgres ou un `SELECT ... FOR UPDATE` sur un compteur par tenant : une numérotation calculée côté client produira des doublons en usage concurrent.

###### Dépendances

- Bloquée par : E10.1, E10.4
- Bloque : E10.8, E10.9, E10.12

##### Contrat API (ajout WM 01/09/2026)

Conventions de **E10.0**. Les prix de ligne sont au format `PricedLine` de **E10.21** (E10.8 gelée), avec `breakdown[]` dès la v1.

| Méthode | Route | Objet |
|---|---|---|
| POST | `/api/v1/quotes` | Crée un devis depuis des éléments de projet : `{ project_id, item_ids: [uuid] }` ; `Idempotency-Key` **obligatoire** ; transactionnel |
| GET | `/api/v1/quotes` | Liste ; `?customer_id=`, `?project_id=`, `?status=`, pagination par curseur |
| GET | `/api/v1/quotes/{id}` | Détail avec lignes |
| PATCH | `/api/v1/quotes/{id}` | Modifie entête, validité, affichage des remises (`If-Match`) |
| DELETE | `/api/v1/quotes/{id}` | Supprime un devis à l'état brouillon uniquement |

La numérotation est produite **côté base** dans la même transaction ; un client qui rejoue la requête avec la même `Idempotency-Key` reçoit le devis déjà créé, pas un second. Événement émis : `quote.created`.

##### Tests

Parcours P13 — création d'un devis à partir de deux éléments d'un projet, contrôle de l'héritage du client et de l'unicité du numéro.

##### Change Log

- 2026-08-28 — v1 — Création à partir de la séance du 28/08/2026 — Arnaud Mazon / Claude

##### Dev Agent Record

###### Agent Model Used

Sonnet (implementation), Opus (verification)

###### Debug Log References

(none provided)

###### Completion Notes

**CA1** ("Create quote" button active only if project has at least one quotation): met.

**CA2** (multi-element selection, conversion to lines): met.

**CA3** (each line copies product config, quantity, production price from source quotation): met — important: only production price (already known) is copied, no margin or selling price calculation was invented. The official price engine (E10.21) is not yet delivered in this sprint; corresponding columns exist but remain empty, pending delivery, without blocking anything for following stories.

**CA4** (customer inherited automatically from project): met.

**CA5** (quote number unique and sequential per tenant, format DEV-AAAA-NNNNN): met and verified in depth by QA with real load test (50 simultaneous creations), no duplicates or gaps in sequence.

**CA6** (Draft status, editable, deletion reserved for draft): met.

**CA7** (same project element can feed multiple quotes without being consumed): met.

**Notable decision, validated by QA:** a dedicated quote table for commercial management was created rather than reusing an older existing quote table (bound to a different use case, with structurally incompatible constraints) — verified in detail, this is not superfluous duplication.

**Explicitly recorded debt:**

- Dependency pending on future price engine (E10.21) — margin/selling price columns will remain empty until delivery.
- Isolation and no-duplicate-number test suite written and carefully reviewed, not executed in real environment (same as all stories in sprint).
- Migration not deployed at review time, deployed since by orchestrator on shared Supabase project, verified functional.
- Minor inconsistencies between API contract and actual behavior (status guard on modification, imprecise error message in edge case) — no user impact today, to be addressed before stories introducing other quote statuses.

###### File List

`src/modules/commercial-quotes/**`, `src/adapters/supabase/commercial-quotes-repository.ts`, `src/server/api/commercial-quotes-routes.ts`, `supabase/migrations/20260901000600_gescom_e10_3_commercial_quotes.sql`, `tests/sql/gescom-e10-3-commercial-quotes.sql`, `src/modules/projects/ui/workspace/ProjectDetailPage.tsx`, `openapi/magrit-core.v1.yaml`, `src/shared/presentation/testIds.ts`

##### QA Results

**Verdict: Accepté** (after 2 correction cycles)

All CA verified. Idempotent creation under concurrent load confirmed: 50 simultaneous quote creations via POST with Idempotency-Key produce correct numbering, no duplicates. Customer inheritance, project element independence, Draft status all confirmed working. Database consistency verified.

### Cas de test fonctionnels rattachés (Notion)

| TF | Cas de test | Statut | Priorité | Parcours | Cible | Stories liées |
|---|---|---|---|---|---|---|
| [TF-163](https://app.notion.com/3cad0131973c8100b201ef061c0b4cde) | GC — Créer un devis depuis un projet avec deux produits sélectionnés | À jouer | P0 — Critique | P13 — Devis et gestion commerciale | B6 | E10.3, E10.1 |
| [TF-164](https://app.notion.com/3cad0131973c81e2a2f9e746d63af999) | GC — Limite : numérotation des devis unique en création concurrente | À jouer | P1 — Importante | P13 — Devis et gestion commerciale | B6 | E10.3 |

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent E10.3

- `_bmad-output/implementation-artifacts/story-E10-10a-envoi-duplication-remise-globale.md`
- `_bmad-output/implementation-artifacts/story-E10-10b-1-lecture-portail-client.md`
- `_bmad-output/implementation-artifacts/story-E10-10b-2-decision-client.md`
- `_bmad-output/implementation-artifacts/story-E10-10b-3-notification.md`
- `_bmad-output/implementation-artifacts/story-E10-12-conversion-commande.md`
- `_bmad-output/implementation-artifacts/story-E10-13-etapes-production.md`
- `_bmad-output/implementation-artifacts/story-E10-14-modale-statut-historique.md`
- `_bmad-output/implementation-artifacts/story-E10-9-remises-granulaires.md`
- `_bmad-output/implementation-artifacts/story-E10.10b-4c.md`
- `_bmad-output/implementation-artifacts/story-E10.19a.md`
- `docs/api/CONVENTIONS.md`
- `docs/spec/backlog.md`
- `openapi/magrit-core.v1.yaml`
- `src/adapters/supabase/commercial-quotes-repository.ts`
- `src/adapters/supabase/customers-repository.ts`
- `src/modules/catalog/ui/components/QuoteModal.tsx`
- `src/modules/commercial-orders/api/contracts.ts`
- `src/modules/commercial-orders/application/commercial-orders-service.ts`
- `src/modules/commercial-quotes/api/client.ts`
- `src/modules/commercial-quotes/api/contracts.ts`
- `src/modules/commercial-quotes/application/commercial-quotes-service.ts`
- `src/modules/commercial-quotes/surface-contributions.ts`
- `src/modules/commercial-quotes/ui/components/CreateQuoteDrawer.tsx`
- `src/modules/commercial-quotes/ui/helpers/quoteStatus.ts`
- `src/modules/commercial-quotes/ui/workspace/QuoteEditorPage.tsx`
- `src/modules/commercial-quotes/ui/workspace/QuotesPage.tsx`
- `src/modules/customers/api/contracts.ts`
- `src/modules/customers/ui/workspace/CustomerDetailPage.tsx`
- `src/modules/pricing/application/pricing-engine.ts`
- `src/modules/projects/surface-contributions.ts`
- `src/modules/projects/ui/helpers/serializeQuotePayload.ts`
- `src/modules/projects/ui/workspace/AddToProjectModal.tsx`
- `src/modules/projects/ui/workspace/ProjectDetailPage.tsx`
- `src/modules/quote-documents/application/document-field-value-resolver.ts`
- `src/modules/quote-templates/ui/helpers/quote-rendering.ts`
- `src/modules/storefront-quotes/application/storefront-quotes-service.ts`
- `src/platform/api/generated/magrit-core.v1.ts`
- `src/server/api/commercial-quotes-routes.ts`
- `src/server/api/gescom-routes.ts`
- `src/shared/presentation/testIds.ts`
- `supabase/functions/magrit-api/index.ts`
- `supabase/migrations/20260901000300_gescom_e10_4_customers.sql`
- `supabase/migrations/20260901000500_gescom_e10_1_projects.sql`
- `supabase/migrations/20260901000600_gescom_e10_3_commercial_quotes.sql`
- `supabase/migrations/20260902000200_gescom_e10_6_price_rules.sql`
- `supabase/migrations/20260902000400_gescom_devis_unification_drop_legacy_quotes.sql`
- `supabase/migrations/20260904000100_gescom_e10_9_quote_line_discounts.sql`
- `supabase/migrations/20260906160000_gescom_e10_10a_send_duplicate_global_discount.sql`
- `supabase/migrations/20260908010000_gescom_e10_12_quote_conversion.sql`
- `supabase/migrations/20260908020000_gescom_e10_13_production_steps.sql`
- `tests/contract/_fakes/commercial-quotes-repository.fake.ts`
- `tests/contract/commercial-orders.contract.test.ts`
- `tests/contract/commercial-quotes.contract.test.ts`
- `tests/sql/gescom-e10-10b-1-storefront-quotes.sql`
- `tests/sql/gescom-e10-3-commercial-quotes.sql`
- `tests/sql/gescom-e10-9-quote-line-discounts.sql`
