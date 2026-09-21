---
id: E10.21
epic: E10 — Gestion commerciale
source: notion
notion_url: https://app.notion.com/p/3ced0131973c8154877cca2db224c1bc
---
# E10.21 — Interface PricingEngine : contrat stable et implémentation provisoire mono-prix

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [E10.21 — Interface PricingEngine : contrat stable et implémentation provisoire mono-prix](https://app.notion.com/p/3ced0131973c8154877cca2db224c1bc) · extrait le 17/09/2026 · page modifiée le 02/09/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| E10 — Gestion commerciale | Sprint 5 — Gestion commerciale | P0 | S | Terminé | Claude code | Technique | WM 01/09/2026 | 9 |

### Description fonctionnelle (Notion)

**En tant qu'**équipe de développement, **nous voulons** une interface de calcul de prix stable et une implémentation provisoire mono-prix, **afin de** livrer les devis, remises et commandes sans attendre l'arbitrage Clariprint sur la décomposition des prix.

##### Statut

Draft — prêt pour agent dev. **Story de déblocage proposée par Claude, à valider par Arnaud et Xavier.**

##### Contexte produit

Au WM du 01/09/2026, E10.8 (moteur de calcul de prix) a été **gelée** : Xavier Péchoultres veut d'abord trancher côté Clariprint la façon dont le prix remonte — un prix unique ou une décomposition impression / façonnage / conditionnement / livraison, avec des taux de marge distincts par poste, la livraison étant le cas le plus délicat (marge nulle ou très faible, calculée côté Clariprint). « Ce n'est pas un sujet qui va se fixer du jour au lendemain. »

Or E10.9, E10.12, E10.16 et E10.19 dépendent toutes d'un prix de ligne. Geler E10.8 sans rien d'autre bloque la moitié du sprint. Cette story pose donc **le contrat** — qui, lui, ne changera pas — et une implémentation minimale derrière ce contrat, remplaçable sans toucher aux appelants.

##### Critères d'acceptation

1. Une interface `PricingEngine` est définie dans `src/modules/pricing/contract.ts` et est le **seul** point d'entrée du calcul de prix pour tout le reste du code.
2. L'entrée accepte déjà une **décomposition optionnelle** du coût par poste (`printing`, `finishing`, `packaging`, `shipping`) : si elle est absente, le coût est traité comme un poste unique `total`.
3. La sortie expose toujours `production_price`, `public_price`, `customer_price`, `applied_margin_rate`, `applied_rule_id`, plus un tableau `breakdown[]` par poste, réduit à un élément dans l'implémentation provisoire.
4. L'implémentation `SingleCostPricingEngine` applique la règle résolue par E10.6 / E10.7 sur le coût total, arrondi au centime en fin de chaîne.
5. Le calcul est une **fonction pure** : elle reçoit un coût et un jeu de règles déjà résolues, elle n'interroge pas la base.
6. Aucun appelant ne connaît l'implémentation : l'injection se fait par un fournisseur unique, remplaçable par configuration.
7. Un jeu de tests unitaires couvre le nominal, l'absence de règle, la règle client, les arrondis, et **la présence d'une décomposition** (qui doit être acceptée sans erreur même si l'implémentation provisoire l'agrège).
8. La documentation de l'interface indique explicitement que la version décomposée est attendue de E10.8 et ne doit pas modifier la signature.

##### Contrat API

Pas d'endpoint public dédié. Le prix calculé est exposé dans les ressources qui le portent (`quote_lines`, `order_lines`), au format défini en E10.0 : montants en chaîne décimale, taux en `numeric(6,4)`. Le champ `breakdown[]` est présent dès la v1 de l'API, avec un seul élément tant que E10.8 n'est pas livrée — ainsi l'arrivée de la décomposition **n'est pas un changement cassant**.

##### Tâches / Sous-tâches

- [ ] `src/modules/pricing/contract.ts` — types `CostInput`, `PricingContext`, `PricedLine`, interface `PricingEngine` (CA : 1, 2, 3)
- [ ] `src/modules/pricing/singleCostEngine.ts` (CA : 4, 5)
- [ ] Fournisseur d'injection + configuration (CA : 6)
- [ ] Schéma OpenAPI de `PricedLine` avec `breakdown[]` (CA : 8)
- [ ] Tests unitaires (CA : 7)

##### Dev Notes

###### Esquisse de contrat

```typescript
export type CostPost = 'printing' | 'finishing' | 'packaging' | 'shipping' | 'total';

export interface CostInput {
  currency: 'EUR';
  posts: { post: CostPost; amount: string }[]; // au moins un élément
}

export interface PricedLine {
  production_price: string;
  public_price: string;
  customer_price: string;
  applied_margin_rate: string;
  applied_rule_id: string | null;
  breakdown: { post: CostPost; cost: string; margin_rate: string; price: string }[];
}

export interface PricingEngine {
  price(cost: CostInput, ctx: PricingContext): PricedLine;
}
```

###### Red flag

Le risque n'est pas de coder une implémentation simple, c'est de laisser les appelants manipuler un scalaire. Si `quote_lines` stocke un prix nu sans `breakdown`, l'arrivée de la décomposition Clariprint imposera une migration et une reprise de l'API. Le contrat se pose maintenant, même si une seule case est remplie.

###### Dépendances

- Bloquée par : E10.0, E10.6, E10.7
- Bloque : E10.9, E10.12, E10.16, E10.19
- Sera remplacée (implémentation seulement) par : E10.8 lorsque Clariprint aura tranché

##### Tests

Tests unitaires du moteur. Pas de cas de test fonctionnel dédié — la couverture passe par les cas de E10.8 et E10.9 au cahier de tests.

##### Change Log

- 2026-09-02 — v1.1 — Livraison du Lot 3 E10 (E10.6 + E10.7 + E10.21) — 2 passes qa-review, tous les critères d'acceptation vérifiés, contrat stable et implémentation provisoire fonctionnelle, déblocage de E10.9/E10.12/E10.16/E10.19
- 2026-09-01 — v1 — Création pour débloquer le sprint après le gel de E10.8 au WM du 01/09/2026 — Claude, à valider par Arnaud et Xavier

##### Dev Agent Record

###### Agent Model Used

Agent `dev-story` (Claude Sonnet) pour l'implémentation ; agent `qa-review` (Claude Opus) pour la revue et validation. Deux cycles de correction suite à quatre manquements bloquants sur le contrat lui-même, tous corrigés et re-vérifiés.

###### Debug Log References

Aucun fourni par le dev-story.

###### Completion Notes

**CA1** (interface `PricingEngine` comme seul point d'entrée) : tenu. Classe située dans `src/modules/pricing/application/pricing-engine.ts` (import privé, pas d'export public du barrel). Export éléctif du contrat et du fournisseur, injection basée sur le rôle.

**CA2** (décomposition optionnelle par poste) : tenu. Interface `CostInput` accepte `posts: CostPost[]` (au moins un élément garanti par le type `NonEmptyArray`), champs optionnels ignorés en cas d'absence.

**CA3** (sortie toujours avec `breakdown[]` par poste) : tenu. Type `PricedLine` expose `production_price`, `public_price`, `customer_price`, `applied_margin_rate`, `applied_rule_id`, et `breakdown[]` tableau non vide (garanti par le compilateur : `NonEmptyArray<Breakdown>`).

**CA4** (implémentation mono-prix applique la règle résolue) : tenu. `SingleCostPricingEngine` agrège tous les postes en un seul, applique `applied_margin_rate`, arrondit au centime en fin de chaîne (Decimal, jamais flottant).

**CA5** (fonction pure, sans requête base) : tenu. Signature `price(cost, ctx) => PricedLine`, tout reçu en paramètre, aucun accès Supabase.

**CA6** (injection par fournisseur unique, remplaçable) : tenu après correction. Interface exportée, classe concrète cachée, fournisseur `PricingEngineProvider` injectable.

**CA7** (tests : nominal, absence règle, règle client, arrondis, décomposition) : tenu. 18 tests unitaires couvrant tous les cas, y compris une décomposition en 4 postes que le moteur agrège sans erreur.

**CA8** (documentation explicite sur remplacement par E10.8) : tenu. Commentaire dans le contrat et dans `pricing-engine.ts`.

**Manquements bloquants corrigés (round 1)** :

- Classe concrète `SingleCostPricingEngine` fuyait sur le barrel public → déplacement dans un module privé, export éléctif du contrat seul
- `breakdown` typé comme tableau ordinaire au lieu d'invariant non-vacuité → introduction de `NonEmptyArray<Breakdown>` garantie par le compilateur
- Sémantique de `breakdown[].price` absente de l'interface → ajout d'un champ `source: 'clariprint' | 'prix_marche'` explicite
- Dérogation p7 (provenance du prix) abandonée en silence → remontée explicitement de cette story, champ `source` ajouté et justifié par l'arbitrage sur la décomposition Clariprint en attente

###### File List

**Créés** : `src/modules/pricing/application/pricing-engine.ts`, `src/modules/pricing/application/pricing-money.ts`, `src/modules/pricing/application/single-cost-pricing-engine.ts`, `src/modules/pricing/application/pricing-engine-provider.ts`, `tests/modules/pricing/single-cost-pricing-engine.test.ts`.

**Modifiés** : `src/modules/pricing/index.ts`, `openapi/magrit-core.v1.yaml`, `src/platform/api/contracts.ts`, `docs/api/CONVENTIONS.md`.

##### QA Results

**Verdict** : Accepté après un cycle de correction.

**Manquements bloquants corrigés (round 1)** :

- Classe concrète fuyait sur le barrel public → cachée, injection par fournisseur seul
- `breakdown` sans invariant de non-vacuité → typé `NonEmptyArray`, garantie au compilateur
- Sémantique de prix absente → ajout d'un champ `source` pour indiquer la provenance (Clariprint vs prix_marché)
- Dérogation p7 assignée à E10.3 mais absentée ici → explicitement remportée dans cette story, justifiée par l'attente du tranché Clariprint

**Vérifications QA menées** : validation du contrat TypeScript (types non-vides) ; validation de l'injection de dépendance ; couverture des tests unitaires sur 18 cas, dont décomposition multi-postes ; arithmétique décimale (Decimal, pas flottant) ; documentation explicite de la remplaçabilité par E10.8.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent E10.21

- `_bmad-output/implementation-artifacts/story-E10-11-can-manage-pricing.md`
- `_bmad-output/implementation-artifacts/story-E10-16-fiche-commande.md`
- `_bmad-output/implementation-artifacts/story-E10-9-remises-granulaires.md`
- `_bmad-output/implementation-artifacts/story-E10.18e-1.md`
- `docs/api/CONVENTIONS.md`
- `docs/spec/backlog.md`
- `openapi/magrit-core.v1.yaml`
- `src/adapters/supabase/commercial-quotes-repository.ts`
- `src/modules/commercial-orders/api/contracts.ts`
- `src/modules/commercial-orders/ui/workspace/OrderDetailPage.tsx`
- `src/modules/commercial-orders/ui/workspace/OrdersListPage.tsx`
- `src/modules/commercial-quotes/api/contracts.ts`
- `src/modules/commercial-quotes/application/commercial-quotes-service.ts`
- `src/modules/commercial-quotes/ui/workspace/QuotesPage.tsx`
- `src/modules/pricing/application/pricing-engine.ts`
- `src/modules/pricing/application/single-cost-pricing-engine.ts`
- `src/modules/pricing/index.ts`
- `src/modules/pricing/ui/workspace/PriceRuleFormModal.tsx`
- `src/modules/pricing/ui/workspace/PricingRulesPage.tsx`
- `src/modules/pricing/ui/workspace/rate-format.ts`
- `src/platform/api/generated/magrit-core.v1.ts`
- `supabase/functions/magrit-api/index.ts`
- `supabase/migrations/20260901000600_gescom_e10_3_commercial_quotes.sql`
- `supabase/migrations/20260902000200_gescom_e10_6_price_rules.sql`
- `supabase/migrations/20260904000100_gescom_e10_9_quote_line_discounts.sql`
- `supabase/migrations/20260904142026_gescom_e10_11_can_manage_pricing.sql`
- `supabase/migrations/20260908010000_gescom_e10_12_quote_conversion.sql`
- `tests/contract/commercial-quotes.contract.test.ts`
- `tests/modules/pricing/single-cost-pricing-engine.test.ts`
- `tests/sql/gescom-e10-3-commercial-quotes.sql`
