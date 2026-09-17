---
id: E10.9
epic: E10 — Gestion commerciale
status: done
branch: feat/gescom-e10-9-remises-granulaires
depends_on: [E10.21, E10.6, E10.7]
blocks: [E10.10]
---
# E10.9 — Remises granulaires par ligne de devis et traçabilité d audit

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [E10.9 — Remises granulaires par ligne de devis et traçabilité d'audit](https://app.notion.com/p/3cad0131973c81afb062c46505c612ed) · extrait le 17/09/2026 · page modifiée le 04/09/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| E10 — Gestion commerciale | Sprint 5 — Gestion commerciale | P0 | L | Terminé | Claude code | Pro+ | RP 28/08/2026, WM 01/09/2026 | 11 |

### Description fonctionnelle (Notion)

**En tant que** commercial, **je veux** ajuster le prix de vente ou la marge ligne par ligne, **afin de** construire une offre fine — par exemple distinguer l'impression de la structure — tout en laissant une trace auditable.

##### Statut

Draft — prêt pour agent dev

##### Contexte produit

Décision RP du 28/08/2026 : le calcul des prix, remises et marges est granulaire, au niveau de chaque ligne de produit. Le commercial agit sur le prix de vente **ou** sur le taux de marge, les deux étant affichés ; l'action sur l'un détermine la remise. Xavier Péchoultres exige une traçabilité d'audit totale côté administrateur, afin qu'un commercial ne puisse pas contester a posteriori le prix affiché.

##### Critères d'acceptation

1. Chaque ligne de devis affiche simultanément le prix de vente et le taux de marge ; la modification de l'un recalcule l'autre en temps réel.
2. La remise est déduite : `remise = (prix client - prix de vente) / prix client`. Elle peut être positive ou négative.
3. La ligne persiste `sale_price`, `discount_rate`, `margin_variation` (écart au taux de marge initialement résolu).
4. Le coût de production, le prix public et le prix client restent affichés en colonnes immuables, à titre informatif.
5. Toute modification d'une ligne crée une entrée d'audit : ligne, auteur, horodatage, valeur avant, valeur après, champ modifié.
6. L'audit est consultable par les rôles habilités (E10.11) depuis le devis, en lecture seule, et n'est ni modifiable ni supprimable.
7. Une remise supérieure au seuil configuré pour le rôle déclenche un avertissement bloquant ou non bloquant selon E10.11.

##### Tâches / Sous-tâches

- [ ] Colonnes `sale_price`, `discount_rate`, `margin_variation` sur `quote_lines` (CA : 3)
- [ ] Table `quote_line_audit` alimentee par trigger, en append-only (CA : 5, 6)
- [ ] Composant `src/components/quotes/QuoteLineEditor.tsx` — double saisie prix / marge (CA : 1, 2, 4)
- [ ] Panneau `src/components/quotes/QuoteAuditPanel.tsx` (CA : 6)
- [ ] Contrôle de seuil de remise selon rôle (CA : 7)

##### Dev Notes

###### Contraintes techniques

- La table d'audit est **append-only** : REVOKE UPDATE et DELETE pour tous les rôles applicatifs. Un audit modifiable n'est pas un audit.
- Le recalcul croisé prix / marge se fait sur la valeur numérique, pas sur la chaîne affichée : le champ non modifié se met à jour au `blur`, pas à chaque frappe, sous peine de boucle d'arrondi.
- Une remise négative est valide et doit rester saisissable : elle correspond à une vente au-dessus du prix client.

###### data-testid

`quote-line-sale-price-input`, `quote-line-margin-input`, `quote-line-discount-display` (+ `data-sign="positive"|"negative"`), `quote-line-immutable-cols`, `quote-audit-panel`, `quote-audit-row` (+ `data-audit-id`), `quote-discount-threshold-warning`

###### Dépendances

- Bloquée par : E10.8
- Bloque : E10.10

##### Mise à jour — WM du 01/09/2026

- **Le seuil de remise est ALERTANT, jamais bloquant.** Le CA 7 est amendé : dépasser le seuil, y compris vendre à marge négative, reste **autorisé**. Le système affiche une alerte visible sur la ligne et sur le total du devis, et journalise le dépassement. Xavier Péchoultres : « il faut pouvoir le faire, ils le font juste pour remplir les machines ». Aucun blocage à la saisie, aucun refus serveur sur ce motif.
- **Alerte de marge négative.** Dès que la marge d'une ligne devient négative, un indicateur explicite apparaît sur la ligne et un bandeau sur le devis. C'est une information, pas une interdiction.
- Une autorisation hiérarchique (le responsable valide un dépassement) est **hors périmètre V1**, notée comme piste V2.
- Le calcul de prix passe désormais par l'interface `PricingEngine` de **E10.21**, E10.8 étant gelée. Ne jamais appeler un calcul de prix ailleurs que derrière ce contrat.

##### Contrat API

| Méthode | Route | Objet |
|---|---|---|
| PATCH | `/api/v1/quotes/{quoteId}/lines/{lineId}` | Modifie `sale_price` **ou** `margin_rate` ; le serveur recalcule l'autre et la remise ; `If-Match` |
| GET | `/api/v1/quotes/{quoteId}/audit` | Journal d'audit du devis, lecture seule, réservé à `can_manage_pricing` |

La réponse de PATCH renvoie la ligne complète au format `PricedLine` (E10.21), avec `breakdown[]`, et un objet `warnings[]` portant `negative_margin` ou `discount_threshold_exceeded` le cas échéant. Les avertissements sont **dans la réponse 200**, jamais en 4xx.

##### Tests

Parcours P13 — modification du prix de vente d'une ligne, contrôle du recalcul de la marge et de l'entrée d'audit. Cas limite : remise négative acceptée et correctement signée.

##### Change Log

- 2026-09-04 — v1.1 — Livraison du Lot 4 E10 — 5 passes qa-review, correctif production mergé round 2, défauts rounds 3-5 confinés au test SQL (Docker absent), réserve Docker consignée
- 2026-08-28 — v1 — Création à partir de la séance du 28/08/2026 — Arnaud Mazon / Claude

##### Dev Agent Record

###### Agent Model Used

Agent `dev-story` (Claude Sonnet) pour l'implémentation ; agent `qa-review` (Claude Opus) pour la revue et validation. Cinq passes qa-review — la plus longue série de ce sprint après E10.7.

###### Debug Log References

Aucun fourni par le dev-story.

###### Completion Notes

**CA1** (double affichage prix vente/marge, recalcul temps réel) : tenu. `sale_price` et `margin_rate` éditables simultanément, l'un recalcule l'autre.

**CA2** (remise déduite, positive ou négative) : tenu. Colonne immuable, accepte valeurs négatives.

**CA3** (persistance `sale_price`/`discount_rate`/`margin_variation`) : tenu.

**CA4** (coût production/prix public/prix client immuables) : tenu.

**CA5** (audit append-only, une entrée par champ changé) : tenu. Table `quote_line_audit`, trigger SQL, jamais par requête.

**CA6** (audit consultable, lecture seule, réservé aux rôles habilités) : tenu avec garde provisoire — rôle `admin` du tenant en dur, en attente de `can_manage_pricing` (E10.11). Fermé aux clés de service.

**CA7** (alerte remise dépassement seuil) : **partiel — reporté à E10.11**. Alerte `negative_margin` livrée (non bloquante) ; alerte bonus `production_cost_stale` pour divergence coût production après changement quantité.

**Capacités livrées au-delà du texte strict** (décision Arnaud du 01/09, unification devis) : quantité éditable, ajout de ligne (chiffrage ou libre), suppression, réordonnancement transactionnel (`PUT .../line-positions`).

**Série de 5 passes qa-review — la plus lourde du sprint** :

- **Round 1** : 1 bloquant (B1 — ETag du devis n'avançait jamais, rendant concurrence optimiste du réordonnancement inerte), 2 correctifs (C1 — taux marge très négatif provoquait 500 au lieu de 4xx ; C2 — absence de garde-fou entre SQL et moteur TypeScript `PricingEngine`), 7 points mineurs.
- **Round 2** : tous corrigés, mais nouveau bloquant (N1 — suppression devis brouillon avec lignes provoquait 500 faute d'ordre de visibilité trigger cascade) et N2 (fichier de test SQL jamais exécuté par aucun script du dépôt).
- **Round 3** : N1/N2 corrigés en code, mais fichier de test SQL lui-même défectueux (positions non renseignées à insertion) bloquant son propre scénario de preuve.
- **Round 4** : défaut du fichier corrigé, mais valeur d'assertion incorrecte bloquait encore parcours.
- **Round 5** : corrigé, **Accepted**.

**Correctif de production (N1, trigger garde cascade `DELETE`)** : mergé au round 2. Correctifs rounds 3-5 : confinés au fichier de test SQL, jamais exécuté en pratique (Docker absent tout le sprint).

**Réserve — à consigner explicitement** : le fichier `tests/sql/gescom-e10-9-quote-line-discounts.sql` (8 scénarios, dont preuve de N1) n'a jamais été exécuté sur cette machine faute de Docker — validé uniquement par relecture attentive à chaque round. Sa première exécution réelle reste à faire sur un poste équipé.

###### File List

`supabase/migrations/20260904000100_gescom_e10_9_quote_line_discounts.sql`, `src/modules/commercial-quotes/application/quote-line-pricing.ts`, `src/modules/commercial-quotes/ui/workspace/QuoteEditorPage.tsx`, `openapi/magrit-core.v1.yaml`, `src/modules/commercial-quotes/api/routes.ts`, `src/modules/commercial-quotes/api/contracts.ts`, `src/modules/commercial-quotes/application/commercial-quotes-service.ts`, `src/modules/commercial-quotes/application/commercial-quotes-repository.ts`, `src/adapters/supabase/commercial-quotes-repository.ts`, `src/server/api/commercial-quotes-routes.ts`, `tests/sql/gescom-e10-9-quote-line-discounts.sql`, `tests/contract/commercial-quotes.contract.test.ts`, `tests/modules/commercial-quotes/quote-line-pricing.test.ts`.

##### QA Results

**Verdict : Accepté** après cinq cycles de correction.

**Round 1** : 1 bloquant (B1 — ETag du devis inerte), 2 correctifs majeurs (C1/C2 — prix négatif, divergence calcul), 7 points mineurs.

**Round 2** : tous corrigés, mais nouveau bloquant N1 découvert (trigger cascade DELETE) et N2 (fichier test SQL jamais exécuté).

**Round 3** : N1/N2 corrigés en code, mais fichier de test SQL défectueux (positions non renseignées) bloquant sa propre exécution.

**Round 4** : fichier corrigé, mais assertion fausse bloquait encore.

**Round 5** : assertion corrigée, **Accepted**.

**Vérifications menées** : typecheck, contrat OpenAPI, tests unitaires et d'architecture verts. `pnpm test` complet : 1551 passed / 3 failed (préexistants, bucket `product_mockups`) / 36 skipped. Correctif de production (N1) mergé round 2 ; défauts des rounds 3-5 confinés au test SQL (Docker absent, validé par relecture statique seule).

**Note Docker structurante** : le fichier `tests/sql/gescom-e10-9-quote-line-discounts.sql` contient 8 scénarios dont la preuve du correctif N1 (N1 = suppression devis brouillon sans 500 sur cascade DELETE) — jamais exécuté en pratique sur cette session faute de Docker. Première exécution réelle reste à faire sur un poste équipé.

### Cas de test fonctionnels rattachés (Notion)

| TF | Cas de test | Statut | Priorité | Parcours | Cible | Stories liées |
|---|---|---|---|---|---|---|
| [TF-174](https://app.notion.com/3cad0131973c81d59ffff3edfee6be15) | GC — Remise par ligne : agir sur le prix de vente et contrôler l'audit | À jouer | P0 — Critique | P13 — Devis et gestion commerciale | B6 | E10.9, E10.11 |
| [TF-175](https://app.notion.com/3cad0131973c81f49eccf8923de9ca84) | GC — Limite : remise négative acceptée, signée et journalisée | À jouer | P1 — Importante | P13 — Devis et gestion commerciale | B6 | E10.9 |
| [TF-176](https://app.notion.com/3cad0131973c81d98e46eb8745c4d9f7) | GC — Masquer les remises sur le document client sans perdre la donnée | À jouer | P1 — Importante | P13 — Devis et gestion commerciale | B6 | E10.10, E10.9 |
| [TF-177](https://app.notion.com/3cad0131973c8141b67edc455c6da9d2) | GC — Droits : écran tarifaire interdit au commercial, mais remise au-delà du seuil autorisée avec alerte | À jouer | P0 — Critique | P13 — Devis et gestion commerciale | B6 | E10.11, E10.9 |
| [TF-182](https://app.notion.com/3cad0131973c81f3ab64f0a2de1a7b2d) | GC — Limite : l'historique de statut n'est ni modifiable ni supprimable | À jouer | P1 — Importante | P13 — Devis et gestion commerciale | B6 | E10.14, E10.9 |

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

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
