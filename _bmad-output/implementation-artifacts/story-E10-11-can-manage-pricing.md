---
id: E10.11
epic: E10 — Gestion commerciale
status: done
branch: feat/gescom-e10-4-entite-client
depends_on: [E10.6, E10.9]
blocks: []
---
# E10.11 — Droit dédié `can_manage_pricing`

Remplace la garde grossière « rôle `admin` du tenant », posée provisoirement
par E10.6 (CA7, écran des règles de prix) et E10.9 (lecture du journal
d'audit des lignes de devis), par un droit métier dédié `can_manage_pricing`,
évalué via `public.user_has_capability(tenant_id, 'can_manage_pricing')`
(mécanisme générique de droits, §3.5 de `docs/api/CONVENTIONS.md`).

Quatre opérations gardées par ce droit :

| Opération | Chemin | Nature du changement |
|---|---|---|
| `listQuoteAuditEntries` | `GET /quotes/{quoteId}/audit-entries` | substitution additive (garde applicative « rôle admin » → capability) |
| `createPriceRule` | `POST /price-rules` | fermeture (RLS `role in ('admin','member')` → capability) |
| `updatePriceRule` | `PATCH /price-rules/{priceRuleId}` | idem |
| `setProductRangeDefaultMargin` | `PUT /product-ranges/{productRangeId}/default-margins` | idem |

**Décision produit tranchée (Arnaud, 04/09, confirmée en qa-review round 2)** :
`can_manage_pricing` reste réservé aux `admin` du tenant par dérivation
d'appartenance (`user_has_capability`). Aucun mécanisme de délégation à un
membre ordinaire dans cette story — cohérent avec « admin unique » (chantier
UM, 14/08). Le trigger UM1 `restrict_magrit_assignments_to_options`
(`20260824000200_um1_admin_shop_guards.sql:47-74`) interdit de toute façon
l'affectation d'un rôle portant cette capability à un membre Magrit
(`access_scope = 'magrit_full'`, le défaut). Ni option système
`option_pricing`, ni élargissement de ce trigger : pistes explicitement
écartées.

Lectures volontairement non gardées : `listPriceRules`, `getPriceRule`,
`resolvePriceRule`, `getProductRangeDefaultMargin` — `resolvePriceRule` et
`getProductRangeDefaultMargin` sont les entrées du `PricingEngine` (E10.21),
nécessaires à tout commercial pour chiffrer une affaire.

## Critères d'acceptation

1. `createPriceRule`/`updatePriceRule`/`setProductRangeDefaultMargin` refusent
   (403 `identity.role_required`) tout acteur sans `can_manage_pricing`, y
   compris un membre simple qui aurait pu écrire ces tables sous l'ancienne
   RLS `role in ('admin','member')` — **fait**.
2. `listQuoteAuditEntries` refuse (403) tout acteur sans `can_manage_pricing`
   — **fait** (garde applicative pré-existante depuis E10.9, désormais fondée
   sur la capability plutôt que sur `role === 'admin'` en dur).
3. Aucun `admin` actuel ne perd l'accès à ces quatre opérations (dérivation
   d'appartenance, substitution additive au sens CA13/§7) — **fait**.
4. La RLS de `price_rules`/`product_range_default_margins` (écriture) et de
   `commercial_quote_line_audit`/`price_rules_audit` (lecture) applique la
   même garde que la façade API, pour fermer le contournement par appel
   PostgREST direct — **fait** (corrigé en 2 rounds de qa-review, voir
   ci-dessous).
5. La garde d'écriture ne dépend jamais de l'appartenance seule : un acteur
   qui n'est plus membre du tenant ne conserve aucun accès résiduel via une
   affectation de rôle non révoquée — **fait** (bloquant B2, round 2).
6. Lectures `listPriceRules`/`getPriceRule`/`resolvePriceRule`/
   `getProductRangeDefaultMargin` restent ouvertes à tout membre du tenant
   (aucune régression sur une lecture déjà publiée en v1, §7) — **fait**.

## QA-review — deux tours de correction

- **Round 1** (`ef15156`) — bloquant B1 : les policies de LECTURE
  `commercial_quote_line_audit_select` (E10.9) et `price_rules_audit_select`
  (E10.6) ne filtraient QUE par isolation tenant, jamais par
  `can_manage_pricing` — un membre simple obtenait les deux journaux d'audit
  par appel PostgREST direct malgré le refus applicatif côté API. Réserve R5 :
  même trou sur `price_rules_audit_select`, par cohérence de classe de
  donnée. Corrigé par une migration additive dédiée
  (`20260904150000_gescom_e10_11_audit_select_capability.sql`), les policies
  d'origine (`20260904142026`) n'étant pas encore déployées sur le projet
  Supabase partagé au moment du correctif (dette t2).
- **Round 2** — bloquant B2 : `price_rules_write` et
  `product_range_default_margins_write` ne vérifiaient que
  `user_has_capability(tenant_id, ...)`, sans exiger l'appartenance actuelle
  au tenant ; la troisième branche de `user_has_capability`
  (`tenant_role_assignments`) ne vérifie jamais `tenant_members`, donc un
  utilisateur ayant quitté un tenant (suppression de `tenant_members` sans
  révocation de ses affectations de rôle, faute de cascade) conservait la
  capacité d'écrire ces deux tables par appel direct — régression par
  rapport à la policy E10.6 remplacée. Corrigé directement dans
  `20260904142026_gescom_e10_11_can_manage_pricing.sql` (jamais déployée,
  dette t2) en ajoutant `tenant_id in (select
  public.current_user_tenant_ids())` en tête de chaque `using`/`with check`.
  Réserves traitées dans le même lot :
  - **R1** : nouveau scénario prouvant qu'un `admin` sans affectation
    explicite continue de lire les deux journaux d'audit après le
    durcissement de `20260904150000` (garde-fou anti-régression du round 1,
    jusqu'ici seulement documenté en prose).
  - **R2** : commentaires corrigés (`admin`/`owner` → `admin` seul,
    `20260814000100` → `20260814000200_admin_unique.sql:130-157`) dans la
    migration `20260904142026` et dans `price-rules-repository.ts`,
    `commercial-quotes-service.ts`, `surface-contributions.ts`.
  - **R3** : `updatePriceRule`/`setProductRangeDefaultMargin`
    (`price-rules-routes.ts`) lisaient la ressource courante (`getById`/
    `getDefaultMargin`, pour l'`ETag`) avant d'appeler le service — un
    acteur sans droit pouvait recevoir un 404/409 avant le 403 attendu.
    `PriceRulesService.assertCanManagePricing()` rendue publique, appelée
    explicitement par les deux routes avant la lecture qui alimente l'ETag.
  - **R4** : précondition explicite ajoutée pour `price_rules_audit` (au
    moins une entrée réelle avant le test de non-visibilité), symétrique de
    celle déjà posée pour `commercial_quote_line_audit`.
  - **R5** : ce document, produit après coup (même manquement déjà corrigé
    pour E10.9 par le commit `78ccc03`, pris comme modèle).
  - Conséquence du bloquant B1 du contrat (architecte, même round) : le cas
    SQL `tests/sql/gescom-e10-11-can-manage-pricing.sql` est réécrit —
    l'ancien scénario d'octroi par nouvelle affectation de rôle à un membre
    Magrit échoue désormais volontairement (`magrit_option_required`,
    trigger UM1) ; le fichier prouve désormais le cycle réel : membre refusé
    (écriture + lecture), admin accepté sans affectation explicite (écriture
    + lecture), tentative d'affectation explicitement rejetée par le trigger
    UM1 (documentée comme comportement protégé, pas contournée).

## Vérifications

`pnpm typecheck`, `pnpm gen:api:check`, `pnpm test:contract`,
`pnpm test:architecture`, `npx vitest run` (suite complète) — voir rapport de
fin de story pour le détail des résultats de ce round.

`pnpm test:storefront:sql` reste injouable sur ce poste (Docker absent,
dette **t1**, `docs/api/CONVENTIONS.md` §8.1/§8.4/§8.5/§8.6/§8.11) : le cas
SQL est relu ligne par ligne à la place d'une exécution réelle, comme au
round précédent.

## Dette restante

- **t1** — `tests/sql/gescom-e10-11-can-manage-pricing.sql` jamais exécuté
  (Docker absent). Chemin : `pnpm db:local:start && pnpm test:storefront:sql`
  sur un poste équipé.
- **t2** — `20260904142026_gescom_e10_11_can_manage_pricing.sql` et
  `20260904150000_gescom_e10_11_audit_select_capability.sql` non déployées
  sur le projet Supabase partagé (`ightkxebexuzfjdbpsdg`). Chemin :
  `supabase db push --linked --dry-run` puis `--linked`, PAT Supabase requis.
- **t3** — `lintRoutesAgainstContract()` n'aligne pas encore le code sur
  `x-required-capabilities` (pas de champ déclaratif de capability sur
  `GescomRoute`) ; la garde applicative des 4 opérations reste vérifiée par
  test comportemental dédié, pas par lint générique. Chemin décrit dans
  `docs/api/CONVENTIONS.md` §8.11, cellule s6.

## Intégration

Développée directement sur `feat/gescom-e10-4-entite-client` (pas de branche
dédiée créée pour cette story, décision opérationnelle de la session — le
travail s'enchaînait avec E10.4/E10.9 déjà en cours sur cette branche).
