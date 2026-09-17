---
id: E10.8
epic: E10 — Gestion commerciale
source: notion
notion_url: https://app.notion.com/p/3cad0131973c810881b0c16e2dd75d7e
---
# E10.8 — [GELÉE — spécification seulement] Moteur de calcul : coût de production vers prix public et prix client

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [E10.8 — [GELÉE — spécification seulement] Moteur de calcul : coût de production vers prix public et prix client](https://app.notion.com/p/3cad0131973c810881b0c16e2dd75d7e) · extrait le 17/09/2026 · page modifiée le 01/09/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| E10 — Gestion commerciale | Backlog | P0 | L | Pas commencé | Claude code | Pro+ | RP 28/08/2026, WM 01/09/2026 | — |

### Description fonctionnelle (Notion)

> ⛔ **GELÉE AU WM DU 01/09/2026 — SPÉCIFICATION SEULEMENT, NE PAS GÉNÉRER DE CODE.**
>
> Xavier Péchoultres : « cette épique parle des prix, des calculs de prix ; elle précise des choses mais elle ne doit pas générer du code pour l'instant ». Le flux de prix doit d'abord être tranché côté Clariprint : un prix unique remonte-t-il, ou une décomposition impression / façonnage / conditionnement / livraison, avec des taux de marge distincts par poste ? Le cas de la livraison est le plus délicat — marge nulle ou très faible, et calcul effectué côté Clariprint.
>
> **Ce qui prend le relais pour ne pas bloquer le sprint : E10.21** — interface `PricingEngine` stable et implémentation provisoire mono-prix. Le contrat de sortie (`breakdown[]`) est posé dès la v1 de l'API pour que l'arrivée de la décomposition ne soit pas un changement cassant.
>
> Cette story reste au backlog comme support de la spécification. Elle sera réactivée quand Clariprint aura arbitré.

**En tant que** commercial, **je veux** que le devis affiche un prix construit à partir du coût de production Clariprint et des règles de marge, **afin de** vendre sur une base tarifaire maîtrisée plutôt que sur un prix importé sans contrôle.

##### Statut

Draft — prêt pour agent dev

##### Contexte produit

Décision RP du 28/08/2026 : les prix issus de Clariprint peuvent être des prix de vente saisis par les imprimeurs ou des coûts de production purs. La pratique retenue est d'utiliser le **coût de production** et d'y appliquer les marges Magrit. Hormis le coût qui vient de Clariprint, tout le reste du calcul se passe dans Magrit.

##### Critères d'acceptation

1. La chaîne de calcul par ligne de devis est : `coût de production` → application de la marge générale ou de gamme → `prix public` → application de la règle client → `prix client`.
2. La règle appliquée est résolue par E10.6 à la date de création du devis, pas à la date d'affichage.
3. Chaque ligne persiste : `production_price`, `public_price`, `customer_price`, `applied_margin_rate`, `applied_rule_id`.
4. Le coût de production est immuable côté Magrit : aucun écran ne permet de l'éditer.
5. Le total du devis est la somme des `sale_price` des lignes (E10.9), calculé côté serveur.
6. Si aucune règle ne s'applique, la marge publique standard de la gamme (E10.6, CA 4) est utilisée ; à défaut, un taux de 0 % et un avertissement visible sur la ligne.
7. Les arrondis sont effectués au centime, à la dernière étape uniquement.

##### Tâches / Sous-tâches

- [ ] Module `src/lib/pricing/engine.ts` — fonction pure `computeLinePrice(cost, rules, context)` (CA : 1, 6, 7)
- [ ] Colonnes de prix sur `quote_lines` (CA : 3)
- [ ] Fonction serveur `recomputeQuoteTotals(quoteId)` (CA : 5)
- [ ] Composant d'affichage du détail de calcul sur la ligne (CA : 1, 6)
- [ ] Tests unitaires du moteur : jeu de cas nominal, sans règle, règle client, arrondis (CA : 1, 6, 7)

##### Dev Notes

###### Contraintes techniques

- `computeLinePrice` est une **fonction pure sans effet de bord** : elle prend un coût et un jeu de règles résolues, elle ne requête pas la base. C'est ce qui la rend testable et rejouable pour l'audit.
- Le total ne doit jamais être calculé uniquement côté React : un total client-side est un total falsifiable.
- Tous les montants en `numeric(12,2)`, tous les taux en `numeric(6,4)`.

###### data-testid

`quote-line-production-price`, `quote-line-public-price`, `quote-line-customer-price`, `quote-line-margin-rate`, `quote-line-pricing-detail-btn`, `quote-line-no-rule-warning`, `quote-total-display`

###### Dépendances

- Bloquée par : E10.3, E10.6
- Bloque : E10.9

##### Tests

Parcours P13 — devis sur une gamme avec marge standard puis sur un client disposant d'une règle dédiée : contrôle du prix public et du prix client. Cas limite : gamme sans aucune règle, avertissement attendu.

##### Change Log

- 2026-08-28 — v1 — Création à partir de la séance du 28/08/2026 — Arnaud Mazon / Claude

##### Dev Agent Record

###### Agent Model Used

*à compléter par l'agent dev*

###### Debug Log References

*à compléter*

###### Completion Notes

*à compléter*

###### File List

*à compléter*

##### QA Results

*à compléter*

### Cas de test fonctionnels rattachés (Notion)

| TF | Cas de test | Statut | Priorité | Parcours | Cible | Stories liées |
|---|---|---|---|---|---|---|
| [TF-172](https://app.notion.com/3cad0131973c817ab55ce733f74c569f) | GC — Chaîne de calcul coût de production, prix public, prix client | À jouer | P0 — Critique | P13 — Devis et gestion commerciale | B6 | E10.8, E10.6 |
| [TF-173](https://app.notion.com/3cad0131973c819487b0de92ea53a509) | GC — Limite : gamme sans règle de prix, avertissement sur la ligne | À jouer | P1 — Importante | P13 — Devis et gestion commerciale | B6 | E10.8 |

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent E10.8

- `_bmad-output/implementation-artifacts/story-E10-12-conversion-commande.md`
- `_bmad-output/implementation-artifacts/story-E10-16-fiche-commande.md`
- `_bmad-output/implementation-artifacts/story-E10.18e-1.md`
- `docs/api/CONVENTIONS.md`
- `docs/spec/backlog.md`
- `openapi/magrit-core.v1.yaml`
- `src/modules/commercial-orders/api/contracts.ts`
- `src/modules/commercial-orders/ui/workspace/OrderDetailPage.tsx`
- `src/modules/commercial-orders/ui/workspace/OrdersListPage.tsx`
- `src/modules/commercial-orders/ui/workspace/order-detail.helpers.ts`
- `src/modules/commercial-quotes/application/commercial-quotes-repository.ts`
- `src/modules/pricing/application/pricing-engine-provider.ts`
- `src/modules/pricing/application/pricing-engine.ts`
- `src/modules/pricing/application/single-cost-pricing-engine.ts`
- `src/platform/api/generated/magrit-core.v1.ts`
- `supabase/migrations/20260901000600_gescom_e10_3_commercial_quotes.sql`
- `supabase/migrations/20260904000100_gescom_e10_9_quote_line_discounts.sql`
- `supabase/migrations/20260906160000_gescom_e10_10a_send_duplicate_global_discount.sql`
- `supabase/migrations/20260908010000_gescom_e10_12_quote_conversion.sql`
