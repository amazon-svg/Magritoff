---
id: Q18
epic: E10 (Sprint 5 — Gestion commerciale)
status: done-code
branch: feat/gescom-validite-devis-parametre
depends_on: [E10.10a]
---
# Lot "paramètre de validité des devis" — Q18

## Objectif

Livrer les deux moitiés que le cadrage (`docs/api/CONVENTIONS.md` §8.25
point 13 (3), ligne Q18 du point 9) laissait explicitement sans propriétaire
de lot, à la suite de l'arbitrage d'Arnaud du 2026-09-19 :

> « Le temps de validité d'un devis doit être un paramètre que l'on peut
> modifier, considérant une valeur par défaut qui doit être aussi un
> paramètre dans le menu devis », puis « valeur par défaut pour un devis
> 30 jours ».

Ce qui existait déjà et n'a pas été reconstruit : la colonne
`commercial_settings.default_validity_days` (E10.10a), sa borne `check (...
between 1 and 3650)`, son exposition par `PATCH /commercial-settings`, et le
composant React qui la pilote (déjà écrit, câblé sur le bon client API,
gardé par ETag/If-Match — seul son emplacement a changé dans ce lot).

## Ce qui est livré

### 1. 30 jours devient la valeur livrée

- `supabase/migrations/20260919000200_gescom_default_validity_days_30.sql` :
  - `alter table commercial_settings alter column default_validity_days set
    default 30` — tout espace amorcé par `api_get_commercial_settings`
    (`insert ... (tenant_id) values (...)`, sans nommer la colonne) reçoit
    désormais 30 sans écriture applicative explicite ;
  - `update commercial_settings set default_validity_days = 30 where
    default_validity_days is null` — rétrofit des espaces déjà créés à
    `null`, choix explicite d'Arnaud (« oui »), noté noir sur blanc dans le
    fichier de migration avec sa justification (un `null` sans comportement
    défini aujourd'hui, `resolve_quote_default_valid_until()` ne l'exploite
    jamais) ;
  - **nombre mesuré, sur la base locale uniquement** (docker
    `supabase_db_magritoff-v5`, 2026-09-19, avant application de la
    migration) : `select count(*), count(*) filter (where
    default_validity_days is null) from public.commercial_settings` →
    **0 ligne au total, donc 0 ligne concernée par ce backfill sur cet
    environnement**. Aucun chiffre de staging/production n'est avancé — non
    mesuré par cette story.
  - `NULL` reste une valeur valide après coup (un commercial peut la
    reposer explicitement via `PATCH /commercial-settings` sans
    `default_validity_days`) — le défaut de colonne ne referme pas cette
    possibilité, vérifié par le scénario C du test SQL.

### 2. Le réglage apparaît dans le menu Devis, pas dans Règles de prix

- Le composant `DefaultValidityDaysPanel` (déjà écrit par E10.10a) est
  **déplacé** de `src/modules/pricing/ui/workspace/PricingRulesPage.tsx`
  vers `src/modules/commercial-quotes/ui/workspace/QuotesPage.tsx` — c'est
  l'écran du menu de navigation « Devis »
  (`commercial-quotes.workspace.navigation`, groupe `commercial`, voir
  `src/modules/commercial-quotes/surface-contributions.ts`).
- **Aucune duplication** : le composant n'existe qu'à un seul endroit après
  ce lot (vérifié par le test d'architecture ci-dessous, qui échoue si le
  panneau réapparaît dans `PricingRulesPage.tsx`).
- Le panneau est gardé par `hasCapability('can_manage_pricing') ===
  true` côté React (même droit que la RLS `commercial_settings_write`),
  parce que l'écran Devis est ouvert à `commercial-quotes.read` — un membre
  sans `can_manage_pricing` ne doit pas voir un panneau dont l'écriture lui
  serait de toute façon refusée par la RLS. Même schéma que
  `QuoteEditorPage.tsx` (journal d'entête E10.10a).
- Aucun calcul, aucune borne recopiée en dur comme seule garde : le panneau
  appelle `CommercialSettingsApiClient.get()`/`.update()`, la borne 1-3650
  reste posée en base et au contrat — `min`/`max` sur l'`<input>` HTML ne
  sont qu'un confort de saisie.

## Non fait, volontairement, hors mandat de ce lot

- Le report de 30 jours sur la durée de validité du devis Clariprint
  conservé côté serveur (objet distinct de Q18, 24h proposées au titre du
  diagnostic) — reste à confirmer au moment de Q17-b, son seul
  consommateur, exactement comme le cadrage le dit.
- La correction de `.env.hopstudio.test.example` (sans rapport avec ce
  lot).

## Fichiers créés

- `supabase/migrations/20260919000200_gescom_default_validity_days_30.sql`
- `tests/sql/gescom-default-validity-days-30.sql`
- `tests/architecture/commercial-quotes-default-validity-panel-location.test.ts`

## Fichiers modifiés

- `src/modules/commercial-quotes/ui/workspace/QuotesPage.tsx` — reçoit
  `DefaultValidityDaysPanel`, gardé par `can_manage_pricing`.
- `src/modules/pricing/ui/workspace/PricingRulesPage.tsx` — perd
  `DefaultValidityDaysPanel` (déplacé, pas dupliqué).
- `scripts/test-storefront-sql.sh` — enregistre le nouveau cas SQL.
- `tests/sql/gescom-e10-10a-quote-send-duplicate.sql` — l'assertion
  "création implicite ⇒ `default_validity_days` est `null`" est devenue
  fausse par construction de ce lot ; mise à jour pour attendre `30`
  (conséquence directe et attendue de la migration, pas une dérogation).

## Vérifications faites (avant/après, sur le code)

- `tests/architecture/commercial-quotes-default-validity-panel-location.test.ts`
  rejoué contre les deux fichiers **restaurés à leur contenu `origin/main`**
  (`git show origin/main:<path>`) : **rouge, 4/4 assertions échouent**
  (panneau absent de `QuotesPage.tsx`, présent dans `PricingRulesPage.tsx`).
  Rejoué ensuite contre le code livré : **vert, 4/4**.
- `tests/sql/gescom-default-validity-days-30.sql` rejoué contre le schéma
  local avec le défaut de colonne retiré manuellement (`alter table ...
  drop default`, simulant l'état avant migration) : **rouge**, scénario A
  échoue (`obtenu <NULL>` au lieu de `30`). Défaut remis, rejoué : **vert**,
  scénarios A/B/C.

## Tests exécutés (sortie réelle, ce jour)

- `pnpm typecheck` → `tsc --noEmit` silencieux, aucune erreur.
- `pnpm test:architecture` → 50 fichiers, 466 tests, tous passés.
- `pnpm test:contract` → 23 fichiers, 434 tests, tous passés.
- `pnpm test` → 325 fichiers passés, 12 skip (337 au total), 3356 tests
  passés, 88 skip (3444 au total).
- `pnpm gen:api:check` → `✅ Types generes alignes sur openapi/magrit-core.v1.yaml`
  (confirme qu'aucune ligne de contrat n'a été touchée — attendu, ce lot
  n'ajoute et ne modifie aucun endpoint).
- `pnpm test:storefront:sql` → 54 cas SQL exécutés contre Supabase local
  (docker `supabase_db_magritoff-v5`), tous `OK`, exit code 0. Non demandé
  explicitement dans les gates mais nécessaire pour prouver le comportement
  réel de la migration (RLS/trigger/défaut de colonne, ce qu'une lecture du
  fichier ne prouve pas) — inclut la correction du scénario 1 d'E10.10a
  ci-dessus.

## Critères d'acceptation (un par un)

1. **Le temps de validité d'un devis est un paramètre modifiable** — déjà
   livré par E10.10a (`PATCH /commercial-settings`, borne 1-3650), non
   reconstruit ici. **Fait** (préexistant, vérifié).
2. **La valeur par défaut de ce paramètre est elle-même paramétrable dans
   le menu Devis** — **Fait** : `DefaultValidityDaysPanel` vit désormais
   dans `QuotesPage.tsx` (écran du menu de navigation « Devis »), plus dans
   « Règles de prix ». Testé par
   `commercial-quotes-default-validity-panel-location.test.ts`.
3. **La valeur par défaut livrée est 30 jours** — **Fait** : défaut de
   colonne posé par la migration, vérifié par
   `gescom-default-validity-days-30.sql` (scénario A) et manuellement
   (`insert ... (tenant_id)` → `default_validity_days = 30`).
4. **Les espaces déjà créés à `null` reçoivent 30 rétroactivement** —
   **Fait**, par décision explicite d'Arnaud consignée dans la migration ;
   **0 ligne concernée sur la base locale** (mesuré, voir section 1
   ci-dessus) — aucun chiffre de production avancé.
5. **`NULL` reste une valeur explicitement possible après coup** — **Fait**,
   non redondant avec le CA3 : un commercial peut reposer `default_validity_
   days = null` via `PATCH /commercial-settings` (contrat inchangé,
   `defaultValidityDaysSchema` reste `nullable()`). Testé (scénario C).
6. **Aucune duplication du réglage** — **Fait** : le composant n'existe
   qu'à un seul endroit après ce lot, testé négativement contre
   `PricingRulesPage.tsx`.
7. **Aucun contrôle métier posé uniquement côté navigateur** — **Fait** :
   la borne 1-3650 reste en base/au contrat, le panneau ne fait que
   `GET`/`PATCH` via le client API du module ; `min`/`max` HTML sont un
   confort de saisie, jamais la seule garde.
8. **`openapi/magrit-core.v1.yaml` non modifié** — **Fait**, aucune ligne de
   contrat requise (déjà exposé par E10.10a) ; confirmé par
   `pnpm gen:api:check` vert.

## Dérogations R5

Aucune.
