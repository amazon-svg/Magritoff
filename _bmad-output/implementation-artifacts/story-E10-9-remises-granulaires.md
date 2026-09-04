---
id: E10.9
epic: E10 — Gestion commerciale
status: done
branch: feat/gescom-e10-9-remises-granulaires
depends_on: [E10.21, E10.6, E10.7]
blocks: [E10.10]
---
# E10.9 — Remises granulaires par ligne de devis et traçabilité d audit

CRUD complet sur `commercial_quote_lines` (devis brouillon uniquement) :
`sale_price` et `margin_rate` mutuellement exclusifs, l un recalcule l autre
et le `discount_rate` déduit en temps réel ; `production_price`,
`public_price`, `customer_price` restent affichés en colonnes immuables.
Prix calculé exclusivement via `PricingEngine` (E10.21) + `PriceRulesService`
(E10.6/E10.7), jamais ailleurs. Backfill des lignes E10.3 existantes via
`resolve_price_rule`.

Périmètre élargi au texte de la story (décision Arnaud du 01/09, chantier
d unification des devis) : reprend aussi l ajout de ligne (chiffrage ou
libre), la suppression et le réordonnancement transactionnel
(`PUT .../line-positions`), qui appartenaient à l ancien éditeur retiré.

Journal d audit append-only (`commercial_quote_line_audit`, une entrée par
champ modifié), lecture par `GET .../audit-entries`, fermée aux clés de
service (piece de contrôle interne, jamais une donnée d intégration Studio).
Garde d accès provisoire : rôle `admin` du tenant en dur, **en attente de
`can_manage_pricing` (E10.11)** — même mécanisme que l écran E10.6.

Avertissements non bloquants dans la réponse `200` (jamais en 4xx) :
`negative_margin` (ligne vendue sous son coût) et `production_cost_stale`
(chiffrage source potentiellement périmé). Conforme à l amendement du WM du
01/09 : aucun seuil ne bloque la saisie, y compris marge négative — Xavier
Péchoultres : « il faut pouvoir le faire, ils le font juste pour remplir les
machines ».

**Hors périmètre, reporté à E10.11** : `discount_threshold_exceeded` (seuil
de remise configurable par rôle) — seule l alerte marge négative est livrée
ici, pas le seuil lui-même.

## QA-review — deux tours de correction

- **Round 1** (`4f73537`) — bloquant B1 : écriture de ligne ne faisait pas
  avancer `updated_at` du devis parent, rendant l ETag inerte
  (`reorderQuoteLines` promettait une concurrence optimiste qui ne
  fonctionnait pas). C1 : `NegativeSalePriceError` dédiée au lieu d un 500
  quand un `margin_rate` produit un prix de vente négatif. C2 : scénario SQL
  et test PricingEngine mis en miroir exact. Six points mineurs.
- **Round 2** (`57ec6f1`) — N1/N2 : la garde d état brouillon relevait à tort
  le devis parent introuvable lors de la cascade DELETE de ses propres
  lignes ; le trigger d audit ne journalise plus un retrait de ligne quand
  son devis parent n existe déjà plus (évite de violer la FK d audit).
  Nouveau scénario SQL, branché dans `scripts/test-storefront-sql.sh`
  (il n était joué par aucun exécutant).

## Vérifications

`pnpm typecheck`, `pnpm gen:api` + `gen:api:check`, `pnpm test:contract`,
`pnpm test:architecture`, `pnpm build` — tous verts. `pnpm test` complet :
1551 passed / 3 failed / 36 skipped — les 3 échecs sont préexistants,
non liés à cette story (bucket `product_mockups`, fichier non touché).

## Intégration

Fusionnée dans `feat/gescom-e10-4-entite-client` le 04/09/2026 (commit
`7fa3f32`), après audit croisé Notion ↔ dépôt ayant révélé que la story
était en réalité terminée (2 tours de qa-review passés) sans que Notion
le reflète.
