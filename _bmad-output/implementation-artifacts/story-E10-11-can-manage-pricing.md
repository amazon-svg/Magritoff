---
id: E10.11
epic: E10 — Gestion commerciale
status: done
branch: feat/gescom-e10-4-entite-client
depends_on: [E10.6, E10.9]
blocks: []
---
# E10.11 — Droit dédié `can_manage_pricing`

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [E10.11 — Séparation des droits Admin et Commercial sur la tarification](https://app.notion.com/p/3cad0131973c81ea98d3ea7a4e582ec8) · extrait le 17/09/2026 · page modifiée le 05/09/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| E10 — Gestion commerciale | Sprint 5 — Gestion commerciale | P0 | M | Terminé | Claude code | Toutes | RP 28/08/2026, WM 01/09/2026 | 10 |

### Description fonctionnelle (Notion)

**En tant qu'**administrateur, **je veux** que la stratégie tarifaire me soit réservée et que le commercial n'agisse que dans le cadre qu'elle définit, **afin de** garder la maîtrise de la politique de prix.

##### Statut

Draft — prêt pour agent dev

##### Contexte produit

Décision RP du 28/08/2026 : deux niveaux distincts. L'administrateur ou le responsable commercial accède à la gestion des marges et des remises ; le commercial produit du prix dans le cadre hérité. La question du seuil de latitude laissé au commercial est traitée ici.

##### Critères d'acceptation

1. Deux permissions distinctes existent : `can_manage_pricing` (référentiel des règles) et `can_discount` (ajustement d'une ligne de devis).
2. Sans `can_manage_pricing`, l'écran de gestion des règles de prix est inaccessible — masqué dans la navigation et refusé côté RLS.
3. `can_discount` porte un seuil de remise maximal paramétrable par rôle, exprimé en points de marge ou en pourcentage de remise.
4. Au-delà du seuil, la saisie est refusée avec un message explicite ; en deçà, elle passe et alimente l'audit.
5. Le panneau d'audit du devis (E10.9) n'est visible qu'avec `can_manage_pricing`.
6. Les permissions s'ajoutent au modèle existant de E9.3 sans en casser la sémantique.

##### Tâches / Sous-tâches

- [ ] Extension du `permissions jsonb` de `tenant_memberships` (CA : 1, 6)
- [ ] Paramètre de seuil par rôle au niveau du tenant (CA : 3)
- [ ] Politiques RLS sur `price_rules` et `quote_line_audit` (CA : 2, 5)
- [ ] Guard de navigation et masquage des entrées de menu (CA : 2)
- [ ] Contrôle serveur du seuil à l'écriture d'une ligne de devis (CA : 4)

##### Dev Notes

###### Contraintes techniques

- Le contrôle de seuil doit être **serveur**. Un contrôle uniquement React se contourne par appel direct à l'API.
- Reprendre le pattern `useAccessGuard()` de E9.3 plutôt que d'introduire un second mécanisme de droits.

###### data-testid

`nav-sidebar-pricing-link`, `pricing-access-denied`, `quote-line-discount-limit-error`, `quote-audit-panel`

###### Dépendances

- Liée à : E9.3
- Bloque : E10.6, E10.9 (contrôles d'accès)

##### Mise à jour — WM du 01/09/2026

**Arbitrage rendu : le seuil de remise est alertant, pas bloquant.** Les CA 3 et 4 sont amendés :

- `can_discount` reste une permission : sans elle, le commercial ne peut pas modifier le prix d'une ligne.
- Le **seuil** rattaché à `can_discount` ne refuse plus la saisie. Il déclenche une alerte visible et une entrée d'audit typée `discount_threshold_exceeded`. La vente à marge négative est explicitement autorisée — c'est un besoin métier assumé (remplissage de parc machine, effort commercial ponctuel).
- Le contrôle serveur subsiste, mais il **journalise** au lieu de refuser. Aucun 4xx sur ce motif.
- Piste V2 notée en séance : circuit d'autorisation où un responsable valide un dépassement. Hors périmètre du sprint 5.

##### Contrat API

| Méthode | Route | Objet |
| --- | --- | --- |
| GET | `/api/v1/me/permissions` | Permissions effectives de l'utilisateur courant, dont `can_manage_pricing`, `can_discount`, `discount_alert_threshold` |
| GET | `/api/v1/tenants/current/pricing-permissions` | Paramétrage des seuils par rôle |
| PUT | `/api/v1/tenants/current/pricing-permissions` | Met à jour le paramétrage (`If-Match`) |

Les permissions sont portées par le jeton et vérifiées côté serveur à chaque appel ; l'interface ne fait que masquer.

##### Tests

Parcours P13 — un commercial sans `can_manage_pricing` ne voit pas l'écran des règles de prix et se voit refuser une remise au-delà du seuil.

##### Change Log

- 2026-08-28 — v1 — Création à partir de la séance du 28/08/2026 — Arnaud Mazon / Claude

##### Dev Agent Record

###### Agent Model Used

Dev : Claude Sonnet 4.5 (dev-story)

QA : Claude Opus 4.1 (qa-review — 2 rounds)

###### Debug Log References

Aucun

###### Completion Notes

**Droit `can_manage_pricing` introduit et appliqué sur 4 opérations** — fermeture de la garde grossière « rôle admin » posée provisoirement en E10.6/E10.9.

**CA1-3** : ✓ Refus (403 `identity.role_required`) pour les acteurs sans `can_manage_pricing` sur `createPriceRule`, `updatePriceRule`, `setProductRangeDefaultMargin`. Accès conservé pour tous les admins tenant (dérivation d'appartenance).

**CA2** : ✓ `listQuoteAuditEntries` (GET `/quotes/{quoteId}/audit-entries`) refuse (403) tout acteur sans `can_manage_pricing`.

**CA4-5** : ✓ RLS durcie sur `price_rules` (écriture), `product_range_default_margins` (écriture), `commercial_quote_line_audit` (lecture), `price_rules_audit` (lecture) — même garde que l'API. Correction B2 (round 2) : policies d'écriture incluent désormais vérification `tenant_id in (select public.current_user_tenant_ids())` pour interdire accès résiduel après quitter le tenant.

**CA6** : ✓ Lectures `listPriceRules`, `getPriceRule`, `resolvePriceRule`, `getProductRangeDefaultMargin` restent ouvertes (aucune régression).

**QA-review** : Round 1 — B1 (policies de lecture audit sans garde capability) + R5 (même sur price_rules_audit). Round 2 — B2 (policies d'écriture sans check tenant_members) + R1-R5 (réserves corner cases, doc corrections). Migrations jamais déployées au round 1 → ré-entrée directe dans la migration principale. Migrations déployées en prod le 2026-09-05 (supabase db push --linked). Deux nits résiduels corrigés sans nouveau tour (c8d6c43).

**Déploiement** : 2 migrations appliquées sur `ightkxebexuzfjdbpsdg` · `supabase migration list --linked` confirme local = remote.

**Dette t1 (non levée)** : SQL tests (`tests/sql/gescom-e10-11-can-manage-pricing.sql`) jamais exécutés faute de Docker. Relecture manuelle 3×. Chemin de résolution : `pnpm db:local:start && pnpm test:storefront:sql` sur poste équipé.

###### File List

supabase/migrations/20260904142026_gescom_e10_11_can_manage_pricing.sql

supabase/migrations/20260904150000_gescom_e10_11_audit_select_capability.sql

src/modules/commercial-quotes/application/commercial-quotes-repository.ts

src/modules/commercial-quotes/application/commercial-quotes-service.ts

src/adapters/supabase/commercial-quotes-repository.ts

src/server/api/commercial-quotes-routes.ts

src/modules/price-rules/application/price-rules-repository.ts

src/adapters/supabase/price-rules-repository.ts

src/server/api/price-rules-routes.ts

src/modules/pricing/surface-contributions.ts

tests/sql/gescom-e10-11-can-manage-pricing.sql

##### QA Results

**Verdict : Approuvé** (qa-review round 2 final, 2026-09-04)

Tous les critères d'acceptation vérifiés. Deux tours de correction :

- **Round 1** : B1 refusé (policies de lecture audit non gardées par capability) — corrigé.
- **Round 2** : B2 refusé (policies d'écriture manquaient vérification tenant_members) — corrigé. Cinq réserves (R1-R5) traitées dans le même lot (corner cases SQL, doc outdated, ordre de vérifications API).

Deux nits résiduels d'une ligne (owner périmé, promesse de délégation survivante) corrigés sans nouveau cycle complet (c8d6c43).

**Capacité bloquante confirmée** : aucun mécanisme de délégation `can_manage_pricing` à un membre ordinaire dans cette story (cohérent avec « admin unique » du chantier UM, 14/08). Le trigger UM1 `restrict_magrit_assignments_to_options` (20260824000200:47-74) l'interdit d'office.

### Cas de test fonctionnels rattachés (Notion)

| TF | Cas de test | Statut | Priorité | Parcours | Cible | Stories liées |
|---|---|---|---|---|---|---|
| [TF-174](https://app.notion.com/3cad0131973c81d59ffff3edfee6be15) | GC — Remise par ligne : agir sur le prix de vente et contrôler l'audit | À jouer | P0 — Critique | P13 — Devis et gestion commerciale | B6 | E10.9, E10.11 |
| [TF-177](https://app.notion.com/3cad0131973c8141b67edc455c6da9d2) | GC — Droits : écran tarifaire interdit au commercial, mais remise au-delà du seuil autorisée avec alerte | À jouer | P0 — Critique | P13 — Devis et gestion commerciale | B6 | E10.11, E10.9 |

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

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

**Verdict qa-review round 2 : Approved.** Deux réserves résiduelles d'une
ligne (owner périmé dans `commercial-quotes-repository.ts:281`, promesse de
délégation survivante dans `surface-contributions.ts:20-21`) corrigées sans
nouveau tour de revue complet (`c8d6c43`).

## Vérifications

`pnpm typecheck`, `pnpm gen:api:check`, `pnpm test:contract`,
`pnpm test:architecture`, `npx vitest run` (suite complète) — voir rapport de
fin de story pour le détail des résultats de ce round.

`pnpm test:storefront:sql` reste injouable sur ce poste (Docker absent,
dette **t1**, `docs/api/CONVENTIONS.md` §8.1/§8.4/§8.5/§8.6/§8.11) : le cas
SQL est relu ligne par ligne à la place d'une exécution réelle, comme au
round précédent.

## Dette restante

- ~~**t1**~~ — **Levée le 2026-09-06.** Colima installé (runtime Docker léger,
  pas de Docker Desktop) pour lever ce blocage définitivement sur ce poste.
  `docker exec -i supabase_db_magritoff-v5 psql ... < tests/sql/gescom-e10-11-can-manage-pricing.sql`
  exécuté réellement, à deux reprises indépendantes (dev-story puis
  qa-review round 5 d'E10.10a) : `EXIT=0`, `ROLLBACK` final, aucune erreur.
  Les 3 scénarios (garde d'écriture + appartenance, garde de lecture des
  journaux d'audit, dérivation admin sans affectation, rejet de la
  délégation par le trigger UM1) sont désormais prouvés par exécution, pas
  seulement relus.
- ~~**t2**~~ — **Levée le 2026-09-05.** Les deux migrations sont déployées sur
  `ightkxebexuzfjdbpsdg` (`supabase db push --linked`, PAT fourni par Arnaud) ;
  `supabase migration list --linked` confirme `local = remote` sur les deux
  entrées et tout l'historique antérieur. La RLS durcie est active en
  production.
- **t3** — `lintRoutesAgainstContract()` n'aligne pas encore le code sur
  `x-required-capabilities` (pas de champ déclaratif de capability sur
  `GescomRoute`) ; la garde applicative des 4 opérations reste vérifiée par
  test comportemental dédié, pas par lint générique. Chemin décrit dans
  `docs/api/CONVENTIONS.md` §8.11, cellule s6.

## Intégration

Développée directement sur `feat/gescom-e10-4-entite-client` (pas de branche
dédiée créée pour cette story, décision opérationnelle de la session — le
travail s'enchaînait avec E10.4/E10.9 déjà en cours sur cette branche).
