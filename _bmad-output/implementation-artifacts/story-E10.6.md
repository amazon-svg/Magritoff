---
id: E10.6
epic: E10 — Gestion commerciale
source: notion
notion_url: https://app.notion.com/p/3cad0131973c8147aac9cbd74fc9599b
---
# E10.6 — Référentiel des règles de prix : marge publique standard et règles ciblées

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [E10.6 — Référentiel des règles de prix : marge publique standard et règles ciblées](https://app.notion.com/p/3cad0131973c8147aac9cbd74fc9599b) · extrait le 17/09/2026 · page modifiée le 02/09/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| E10 — Gestion commerciale | Sprint 5 — Gestion commerciale | P0 | L | Terminé | Claude code | Pro+ | RP 28/08/2026, WM 01/09/2026 | 7 |

### Description fonctionnelle (Notion)

**En tant qu'**administrateur ou responsable commercial, **je veux** définir des règles de marge et de remise datées, générales ou ciblées sur une gamme ou un client, **afin de** piloter la politique tarifaire sans intervenir devis par devis.

##### Statut

Draft — prêt pour agent dev

##### Contexte produit

Décision RP du 28/08/2026 : le prix Clariprint est un coût de production. Magrit y applique ses propres règles commerciales. Une règle a une portée (globale, gamme, client, ou client + gamme) et une période de validité, ce qui autorise les opérations flash. Exemple donné en séance : marge minimale de 50 % sur la gamme carterie.

##### Critères d'acceptation

1. Une règle de prix porte : une portée, un type de valeur (`margin_rate` ou `discount_rate`), une valeur, une date de début et une date de fin optionnelle (nulle = sans terme).
2. Quatre portées sont supportées, par spécificité croissante : globale, gamme, client, client + gamme.
3. La résolution du prix retient la règle la plus spécifique applicable à la date de calcul ; une règle client ne crée jamais de conflit avec une règle générale, elle la surcharge.
4. Une marge publique standard est paramétrable par gamme de produits et sert de règle par défaut.
5. L'écran de gestion liste les règles avec leur portée, leur valeur et leur période, filtrables par gamme et par client.
6. Toute création, modification ou suppression de règle est journalisée (auteur, horodatage, valeurs avant et après).
7. L'écran n'est accessible qu'aux rôles habilités (E10.11).

##### Tâches / Sous-tâches

- [ ] Migration SQL `price_rules` et `price_rules_audit` (CA : 1, 2, 6)
  - [ ] `price_rules` : id, tenant_id, scope ('global'\|'range'\|'customer'\|'customer_range'), product_range_id, customer_id, value_type, value numeric(6,4), valid_from date, valid_to date NULL, is_active, created_by, created_at
  - [ ] Contrainte CHECK de cohérence scope / colonnes cibles renseignées
  - [ ] Contrainte `valid_to IS NULL OR valid_to > valid_from`
  - [ ] Index GiST sur `daterange(valid_from, valid_to)` pour la détection de chevauchement (E10.7)
- [ ] Service `src/services/priceRules.ts` — CRUD + `resolveRule(context, date)` (CA : 3, 4)
- [ ] Page `src/pages/dashboard/config/pricing/index.tsx` (CA : 5, 7)
- [ ] Composant `src/components/pricing/PriceRuleFormModal.tsx` (CA : 1, 2)
- [ ] Trigger SQL d'audit sur `price_rules` (CA : 6)

##### Dev Notes

###### Modèle de données

La spécificité est un rang numérique dérivé du scope (global = 0, gamme = 1, client = 2, client + gamme = 3). `resolveRule` ordonne par rang décroissant puis par `valid_from` décroissante et retient la première.

###### Contraintes techniques

- Les taux sont stockés en `numeric(6,4)` (0,5000 = 50 %) — jamais en float, les écarts d'arrondi sur des prix sont indéfendables devant un client.
- Une règle n'est jamais supprimée physiquement : `is_active = false` et conservation dans l'audit.

###### data-testid

`pricing-rules-page`, `pricing-rule-row` (+ `data-rule-id`), `pricing-rule-create-btn`, `pricing-rule-modal`, `pricing-rule-scope-select`, `pricing-rule-range-select`, `pricing-rule-customer-select`, `pricing-rule-value-input`, `pricing-rule-valid-from-input`, `pricing-rule-valid-to-input`, `pricing-rule-save-btn`

###### Dépendances

- Bloquée par : E10.4
- Bloque : E10.7, E10.8

##### Mise à jour — WM du 01/09/2026

Trois amendements, en cohérence avec la réécriture de E10.7 :

- **Nom obligatoire.** Une règle porte un champ `name` non vide : c'est par lui qu'on la retrouve dans la liste et qu'on l'identifie dans le détail de calcul d'une ligne de devis.
- **Actif / désactivé comme état de premier plan.** `is_active` n'est plus un simple drapeau de suppression logique : c'est l'état courant de la règle, basculé depuis la liste, avec pastille verte ou grise, filtre par statut, recherche par nom et tri par date.
- **Pas de contrainte d'exclusion sur les périodes.** L'index GiST et la contrainte d'exclusion prévus le 28/08 sont **retirés** : le chevauchement de périodes est désormais un état normal, arbitré à la lecture par la règle la plus récente (E10.7). Conserver un index B-tree de sélection.

##### Contrat API

Les endpoints du référentiel sont décrits en E10.7 (`/api/v1/price-rules`, `/api/v1/price-rules/resolve`). Cette story livre le modèle, la marge publique standard par gamme et l'écran ; E10.7 livre la résolution. Contrat commun, conventions de E10.0 : montants et taux en chaîne décimale, erreurs RFC 7807, `If-Match` sur PATCH.

Endpoint spécifique à cette story :

| Méthode | Route | Objet |
|---|---|---|
| GET | `/api/v1/product-ranges/{id}/default-margin` | Lit la marge publique standard de la gamme |
| PUT | `/api/v1/product-ranges/{id}/default-margin` | Définit la marge publique standard (`If-Match`) |

##### Tests

Parcours P13 — création d'une règle de marge 50 % sur la gamme carterie ; vérification que la règle client surcharge la règle générale sans déclencher d'alerte de conflit.

##### Change Log

- 2026-09-02 — v1.1 — Livraison du Lot 3 E10 — 2 passes qa-review, tous les critères d'acceptation vérifiés
- 2026-08-28 — v1 — Création à partir de la séance du 28/08/2026 — Arnaud Mazon / Claude

##### Dev Agent Record

###### Agent Model Used

Agent `dev-story` (Claude Sonnet) pour l'implémentation ; agent `qa-review` (Claude Opus) pour la revue et validation. Deux cycles de correction suite à trois manquements bloquants en round 1, tous corrigés et re-vérifiés en round 2.

###### Debug Log References

Aucun fourni par le dev-story.

###### Completion Notes

**CA1** (règle de prix : portée, type de valeur, valeur, dates début/fin) : tenu. Portée exposée en UI, valeurs décimales `numeric(6,4)`, dates avec validation `valid_to > valid_from`.

**CA2** (quatre portées, spécificité croissante) : tenu. Contrainte CHECK en base garantit la cohérence scope vs colonnes cibles.

**CA3** (résolution retient la règle la plus spécifique applicable) : implémenté dans E10.7 (résolution externalisée) ; cette story livre le modèle et l'écran.

**CA4** (marge publique standard par gamme) : tenu. Endpoints `GET/PUT /api/v1/product-ranges/{id}/default-margin` exposés, surface dédiée sur l'écran gamme.

**CA5** (écran de gestion : liste, filtres, pagination) : tenu après correction. Filtres nom/statut/gamme/client fonctionnels, pagination côté client avec contrôle « Charger la suite ».

**CA6** (audit : journalisation auteur/horodatage/avant-après) : tenu. Table `price_rules_audit` append-only, trigger SQL pour chaque mutation.

**CA7** (garde d'accès admin) : implémenté par RLS et raffinement futur en E10.11.

**Manquements bloquants corrigés (round 1)** :

- Filtre gamme/client absent du contrat OpenAPI → ajoutés en tant que paramètres de requête
- Borne de fin de période exclusive au lieu d'inclusive, contredisant le contrat → corrigée à inclusive
- Contrôle RLS négatif manquant sur `product_range_default_margins` → ajout de tests positif/négatif par tenant

###### File List

**Créés** : `supabase/migrations/20260902000200_gescom_e10_6_price_rules.sql`, `src/modules/pricing/api/price-rules-routes.ts`, `src/modules/pricing/application/price-rules-service.ts`, `src/modules/pricing/ui/PriceRulesPage.tsx`, `src/modules/pricing/ui/PriceRuleRow.tsx`, `src/modules/pricing/ui/PriceRuleFormModal.tsx`, `src/adapters/supabase/price-rules-repository.ts`, `tests/sql/gescom-e10-6-price-rules.sql`, `tests/contract/pricing.contract.test.ts`, `tests/adapters/supabase/price-rules-repository.test.ts`.

**Modifiés** : `openapi/magrit-core.v1.yaml`, `src/platform/api/contracts.ts`, `src/shared/presentation/testIds.ts`, `docs/api/CONVENTIONS.md`.

##### QA Results

**Verdict** : Accepté après un cycle de correction.

**Manquements bloquants corrigés** :

- Filtre gamme/client absent du contrat OpenAPI → ajoutés comme paramètres de requête avec validation
- Borne de fin de période exclusive au lieu d'inclusive → corrigée à inclusive (conforme au contrat)
- Contrôle RLS négatif manquant → ajout de tests d'isolation par tenant en lecture/écriture

**Vérifications QA menées** : validation du contrat OpenAPI vs implémentation ; relecture ligne à ligne des tests SQL ; vérification des contraintes CHECK en base ; isolement des données par tenant via RLS.

### Cas de test fonctionnels rattachés (Notion)

| TF | Cas de test | Statut | Priorité | Parcours | Cible | Stories liées |
|---|---|---|---|---|---|---|
| [TF-168](https://app.notion.com/3cad0131973c810fb761f022d96d8938) | GC — Définir une marge de 50 % sur la gamme carterie | À jouer | P0 — Critique | P13 — Devis et gestion commerciale | B6 | E10.6 |
| [TF-169](https://app.notion.com/3cad0131973c819abe03da90909bcd08) | GC — Une règle client surcharge la règle générale sans déclencher de conflit | À jouer | P0 — Critique | P13 — Devis et gestion commerciale | B6 | E10.6, E10.7 |
| [TF-170](https://app.notion.com/3cad0131973c81e895a1e5eee5688390) | GC — Conflit tarifaire : la règle la plus récente l'emporte, sans modifier l'existante | À jouer | P0 — Critique | P13 — Devis et gestion commerciale | B6 | E10.7, E10.6 |
| [TF-171](https://app.notion.com/3cad0131973c81369548ecd0747e4654) | GC — Désactiver une règle : la règle précédente reprend, l'historique est conservé | À jouer | P0 — Critique | P13 — Devis et gestion commerciale | B6 | E10.7, E10.6 |
| [TF-172](https://app.notion.com/3cad0131973c817ab55ce733f74c569f) | GC — Chaîne de calcul coût de production, prix public, prix client | À jouer | P0 — Critique | P13 — Devis et gestion commerciale | B6 | E10.8, E10.6 |

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent E10.6

- `_bmad-output/implementation-artifacts/story-E10-10a-envoi-duplication-remise-globale.md`
- `_bmad-output/implementation-artifacts/story-E10-10b-3-notification.md`
- `_bmad-output/implementation-artifacts/story-E10-11-can-manage-pricing.md`
- `_bmad-output/implementation-artifacts/story-E10-13-etapes-production.md`
- `_bmad-output/implementation-artifacts/story-E10-9-remises-granulaires.md`
- `_bmad-output/implementation-artifacts/story-E10.10b-4a.md`
- `_bmad-output/implementation-artifacts/story-E10.10b-4c.md`
- `docs/api/CONVENTIONS.md`
- `docs/spec/backlog.md`
- `openapi/magrit-core.v1.yaml`
- `src/adapters/supabase/price-rules-repository.ts`
- `src/adapters/supabase/production-steps-repository.ts`
- `src/modules/_shared/application/problem.ts`
- `src/modules/commercial-quotes/api/contracts.ts`
- `src/modules/commercial-quotes/application/commercial-quotes-service.ts`
- `src/modules/notifications/application/notification-templates-service.ts`
- `src/modules/notifications/ui/hooks/useNotificationLogsManagement.ts`
- `src/modules/pricing/api/client.ts`
- `src/modules/pricing/api/contracts.ts`
- `src/modules/pricing/application/price-rules-repository.ts`
- `src/modules/pricing/application/price-rules-service.ts`
- `src/modules/pricing/application/pricing-engine.ts`
- `src/modules/pricing/application/single-cost-pricing-engine.ts`
- `src/modules/pricing/surface-contributions.ts`
- `src/modules/pricing/ui/hooks/usePriceRulesManagement.ts`
- `src/modules/pricing/ui/workspace/PriceRuleFormModal.tsx`
- `src/modules/pricing/ui/workspace/PricingRulesPage.tsx`
- `src/modules/production-steps/application/production-steps-service.ts`
- `src/modules/production-steps/manifest.ts`
- `src/modules/production-steps/surface-contributions.ts`
- `src/platform/api/generated/magrit-core.v1.ts`
- `src/server/api/document-templates-routes.ts`
- `src/server/api/gescom-routes.ts`
- `src/server/api/price-rules-routes.ts`
- `src/server/api/production-steps-routes.ts`
- `src/shared/presentation/testIds.ts`
- `supabase/functions/magrit-api/index.ts`
- `supabase/migrations/20260901000300_gescom_e10_4_customers.sql`
- `supabase/migrations/20260902000200_gescom_e10_6_price_rules.sql`
- `supabase/migrations/20260902000300_gescom_e10_7_resolve_price_rule.sql`
- `supabase/migrations/20260904000100_gescom_e10_9_quote_line_discounts.sql`
- `supabase/migrations/20260904142026_gescom_e10_11_can_manage_pricing.sql`
- `supabase/migrations/20260904150000_gescom_e10_11_audit_select_capability.sql`
- `supabase/migrations/20260911010000_gescom_e10_15a_notification_templates.sql`
- `tests/contract/_fakes/price-rules-repository.fake.ts`
- `tests/contract/price-rules.contract.test.ts`
- `tests/modules/pricing/price-rules-service.test.ts`
- `tests/sql/gescom-e10-11-can-manage-pricing.sql`
- `tests/sql/gescom-e10-6-price-rules.sql`
- `tests/sql/gescom-e10-7-price-rules-resolve.sql`
