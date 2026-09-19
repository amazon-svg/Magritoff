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

## Historique de ce document — une correction qa-review, pas de la dette cachée

La première version de ce lot livrait deux choses : le défaut de colonne à
30, ET un rétrofit des espaces déjà créés à `null`. Une revue `qa-review`
adversariale a **rejeté** cette seconde moitié le 2026-09-19, avec trois
constats de fond (repris en détail plus bas) : le rétrofit écrasait une
décision réellement prise (rien en base ne distingue « jamais décidé » de
« explicitement décidé null »), le test SQL censé le garantir rejouait sa
propre copie du code qu'il prétendait garder, et la migration attribuait à
Arnaud une consigne qui venait en réalité du coordinateur du chantier. Le
coordinateur a tranché : **le lot se sépare en deux**, ce document ne porte
plus que la moitié « défaut de colonne ». Le rétrofit devient la question
ouverte **Q24** (`docs/api/CONVENTIONS.md` §8.25), à trancher par Arnaud,
hors mandat de ce lot.

## Ce qui est livré

### 1. 30 jours devient la valeur livrée — pour tout NOUVEL espace

- `supabase/migrations/20260919000200_gescom_default_validity_days_30.sql` :
  - **un seul effet** : `alter table commercial_settings alter column
    default_validity_days set default 30` — tout espace amorcé par
    `api_get_commercial_settings` (`insert ... (tenant_id) values (...)`,
    sans nommer la colonne) reçoit désormais 30 sans écriture applicative
    explicite.
  - **aucun `UPDATE`, aucune écriture de donnée** : les espaces déjà créés
    avant cette migration, qui portaient `null`, continuent de porter
    `null` après — leur comportement (devis sans terme annoncé) est
    inchangé. Vérifié positivement par un scénario dédié (ci-dessous) et
    gardé par un test qui lit le texte de la migration lui-même.
  - `NULL` reste une valeur valide après coup, pour un espace neuf comme
    pour un espace déjà créé (un commercial peut la reposer explicitement
    via `PATCH /commercial-settings`) — le défaut de colonne ne referme pas
    cette possibilité, vérifié par le scénario C du test SQL.

### 2. Le réglage apparaît dans le menu Devis, pas dans Règles de prix

- Le composant `DefaultValidityDaysPanel` (déjà écrit par E10.10a) est
  **déplacé** de `src/modules/pricing/ui/workspace/PricingRulesPage.tsx`
  vers `src/modules/commercial-quotes/ui/workspace/QuotesPage.tsx` — c'est
  l'écran du menu de navigation « Devis »
  (`commercial-quotes.workspace.navigation`, groupe `commercial`, voir
  `src/modules/commercial-quotes/surface-contributions.ts`).
- **Aucune duplication** : le composant n'existe qu'à un seul endroit après
  ce lot (vérifié par un test d'architecture, qui échoue si le panneau
  réapparaît dans `PricingRulesPage.tsx`).
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

## Contrat (`openapi/magrit-core.v1.yaml`)

**Une ligne de contrat était bien requise, contrairement à ce que la
première version de ce document affirmait à tort.** L'ancienne description
de `CommercialSettings.default_validity_days` promettait que l'état initial
d'un espace était `null` (« la façade n'invente pas 30 jours à la place
d'une décision commerciale que personne n'a prise ») — devenu faux du seul
fait de ce lot. `gen:api:check` ne pouvait pas le voir : il compare les
types générés, jamais le sens d'une description. L'architecte a corrigé
cette description (et deux autres, trouvées en vérifiant) sur la branche
`docs/gescom-contrat-validite-devis` (commit `227bd276`) — additif au sens
de la règle 13, aucun type, borne, `required` ni code d'erreur touché. Cette
branche n'a pas modifié `openapi/magrit-core.v1.yaml` de ce lot : la story
a été **rebasée** sur `origin/docs/gescom-contrat-validite-devis` pour que
les deux fusionnent ensemble, le contrat juste avant le code.

## Non fait, volontairement, hors mandat de ce lot

- **Le rétrofit des espaces déjà créés à `null`** — devenu la question
  ouverte **Q24**, à trancher par Arnaud. Ce lot ne l'exécute pas (voir
  section « Historique » ci-dessus).
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
- `tests/architecture/gescom-default-validity-days-no-backfill.test.ts` —
  garde-fou ajouté après la correction qa-review : lit le texte de la
  migration et échoue si un `UPDATE` sur `commercial_settings` y est
  réintroduit.

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
- `tests/contract/_fakes/commercial-settings-repository.fake.ts` — la
  création implicite amorçait encore `default_validity_days: null` ;
  alignée sur 30 (sinon une régression du défaut de colonne serait passée
  inaperçue, la couche contrat validant l'ancien comportement).
- `tests/contract/commercial-settings.contract.test.ts` — l'assertion
  d'amorce (`toBeNull()`) exigeait encore `null` ; alignée sur `30`.
- `tests/server/api/magrit-api-composition.test.ts` — même correction, sur
  l'assertion de composition réelle des façades.
- `tests/contract/_fakes/commercial-quotes-repository.fake.ts` — le
  fallback interne (`?? null`) qui modélisait un espace neuf sans validité
  est aligné sur `?? 30` ; le retrofit des espaces déjà existants (Q24)
  reste, lui, hors modèle de ce faux (aucun changement de ce côté).

## Correction qa-review (2026-09-19) — détail des trois constats

1. **Le rétrofit écrasait une décision réellement prise.** En base, rien ne
   distingue « personne n'a jamais décidé » de « on a décidé qu'il n'y
   aurait pas de validité » — les deux valent `null`. Un `where ...  is
   null` les confondait : une ligne à `45` survivait, une ligne
   explicitement à `null` devenait `30`. Conséquence bornée par
   l'architecte : les devis déjà envoyés ne bougent pas (`valid_until` figée
   à l'envoi), mais les prochains envois d'un espace ayant volontairement
   retiré la validité seraient partis à J+30, une acceptation à J+31 étant
   refusée en 409 `quote.decision_expired`.
2. **Le test du backfill ne testait rien.** Le scénario B de
   `tests/sql/gescom-default-validity-days-30.sql` rejouait sa propre copie
   de l'`UPDATE` plutôt que d'exercer celui de la migration : en supprimant
   les trois lignes de backfill de la migration, `test:architecture` et
   `test:storefront:sql` restaient verts. Remplacé par un scénario qui
   vérifie l'**absence** de retrofit (une ligne déjà à `null` explicite le
   reste après l'`ALTER`), complété par
   `gescom-default-validity-days-no-backfill.test.ts`, qui lit le texte de
   la migration et aurait échoué sur l'ancienne version (vérifié : 2/3
   assertions rouges en restaurant temporairement l'ancien contenu).
3. **Fausse attribution.** La migration écrivait que le retrofit était un
   « choix explicite d'Arnaud, dans ses mots : "oui" ». C'était faux :
   Arnaud a tranché la valeur (30 jours), jamais son extension au parc
   existant ; le « oui » venait d'une consigne du coordinateur, prise à
   tort pour une parole d'Arnaud. Phrase supprimée.

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
- `tests/architecture/gescom-default-validity-days-no-backfill.test.ts`
  rejoué contre le contenu de la migration **avant correction** (celui que
  qa-review a rejeté, avec le bloc `UPDATE` et l'attribution erronée) :
  **rouge, 2/3 assertions échouent** (aucune trace de `UPDATE` attendue
  absente, mention `Q24` absente). Rejoué contre le contenu corrigé :
  **vert, 3/3**.

## Tests exécutés (sortie réelle, ce jour — après correction qa-review)

- `pnpm typecheck` → `tsc --noEmit` silencieux, aucune erreur.
- `pnpm test:architecture` → 51 fichiers, 469 tests, tous passés.
- `pnpm test:contract` → 23 fichiers, 434 tests, tous passés.
- `pnpm test` → 326 fichiers passés, 12 skip (338 au total), 3359 tests
  passés, 88 skip (3447 au total).
- `pnpm gen:api:check` → `✅ Types generes alignes sur openapi/magrit-core.v1.yaml`
  (rejoué après rebase sur `docs/gescom-contrat-validite-devis` : les
  descriptions de contrat corrigées par l'architecte n'affectent pas les
  types générés, comparés bit à bit par cette gate).
- `pnpm test:storefront:sql` → 54 cas SQL exécutés contre Supabase local
  (docker `supabase_db_magritoff-v5`, base réinitialisée par `pnpm
  db:local:reset` après correction de la migration), tous `OK`, exit code
  0. Non demandé explicitement dans les gates mais nécessaire pour prouver
  le comportement réel de la migration (RLS/trigger/défaut de colonne, ce
  qu'une lecture du fichier ne prouve pas) — inclut la correction du
  scénario 1 d'E10.10a (création implicite → 30, plus null).

## Critères d'acceptation (un par un)

1. **Le temps de validité d'un devis est un paramètre modifiable** — déjà
   livré par E10.10a (`PATCH /commercial-settings`, borne 1-3650), non
   reconstruit ici. **Fait** (préexistant, vérifié).
2. **La valeur par défaut de ce paramètre est elle-même paramétrable dans
   le menu Devis** — **Fait** : `DefaultValidityDaysPanel` vit désormais
   dans `QuotesPage.tsx` (écran du menu de navigation « Devis »), plus dans
   « Règles de prix ». Testé par
   `commercial-quotes-default-validity-panel-location.test.ts`.
3. **La valeur par défaut livrée est 30 jours** — **Fait**, pour tout
   nouvel espace : défaut de colonne posé par la migration, vérifié par
   `gescom-default-validity-days-30.sql` (scénario A) et manuellement
   (`insert ... (tenant_id)` → `default_validity_days = 30`).
4. **Les espaces déjà créés à `null` reçoivent 30 rétroactivement** —
   **Retiré de ce lot par décision du coordinateur, à la suite de la
   qa-review du 2026-09-19.** Devenu la question ouverte **Q24**
   (`docs/api/CONVENTIONS.md` §8.25), non tranchée, hors mandat de ce lot.
   Un espace déjà créé qui portait `null` avant cette migration continue de
   porter `null` après — vérifié positivement (scénario B du test SQL,
   `gescom-default-validity-days-no-backfill.test.ts`).
5. **`NULL` reste une valeur explicitement possible après coup** — **Fait**,
   pour un espace neuf comme pour un espace déjà créé : un commercial peut
   reposer `default_validity_days = null` via `PATCH /commercial-settings`
   (contrat inchangé au type, `defaultValidityDaysSchema` reste
   `nullable()`). Testé (scénario C).
6. **Aucune duplication du réglage** — **Fait** : le composant n'existe
   qu'à un seul endroit après ce lot, testé négativement contre
   `PricingRulesPage.tsx`.
7. **Aucun contrôle métier posé uniquement côté navigateur** — **Fait** :
   la borne 1-3650 reste en base/au contrat, le panneau ne fait que
   `GET`/`PATCH` via le client API du module ; `min`/`max` HTML sont un
   confort de saisie, jamais la seule garde.
8. **`openapi/magrit-core.v1.yaml`** — **une ligne de contrat était
   requise**, contrairement à ce que la première version de ce document
   affirmait à tort (voir section « Contrat » ci-dessus) : la description
   de `CommercialSettings.default_validity_days` promettait `null` comme
   état initial, devenu faux. **Corrigée par l'architecte**
   (`docs/gescom-contrat-validite-devis`, commit `227bd276`), la branche de
   ce lot a été **rebasée** dessus plutôt que sur `main`. Ce lot lui-même
   ne modifie pas `openapi/magrit-core.v1.yaml` (aucun type, borne,
   `required` ni endpoint touché) ; `pnpm gen:api:check` vert après rebase.

## Dérogations R5

Aucune.
