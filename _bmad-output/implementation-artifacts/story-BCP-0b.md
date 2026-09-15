---
id: BCP-0b
epic: Chantier boutique — chaîne des prix Magrit (hors E10)
status: implemented-awaiting-qa-review
branch: feat/gescom-e10-4-entite-client
depends_on: [BCP-0]
blocks: [BCP-1a, BCP-1b]
---
# BCP-0b — le limiteur de débit sur la route de chiffrage Clariprint actuelle (`POST /api/v1/clariprint/quote`)

Contrat : `docs/api/CONVENTIONS.md` §8.25, point 2.3bis (décisions d'Arnaud
Q9 et Q10 du 2026-09-15). **N'entre PAS dans `openapi/magrit-core.v1.yaml`**
: la route elle-même n'y figure pas (point 2.1, tranché par l'architecte).
`pnpm gen:api:check` vert, aucun diff sous `openapi/`.

Périmètre livré : deux étages sur la route actuelle (L1 par visiteur, L3
global) plus un étage propre à l'atelier (membre), une migration (tables +
fonction atomique + purge `pg_cron`), le câblage complet dans le module
`clariprint` et l'Edge Function `magrit-api`. **Aucun déploiement** —
migration, secret et pose de configuration restent à Arnaud (liste exacte
en fin de document).

## Critères d'acceptation — vérifiés un par un

1. **L1 par visiteur, 30/10min** : FAIT. Configuré dans `api_rate_limits`
   (`clariprint_quote_visitor`, `fixed_seconds`, 600s). Testé en SQL
   (fenêtre fixe) et en TS (résolution de clé).
2. **L3 global, 500/jour civil Europe/Paris, configurable sans
   redéploiement** : FAIT. `api_rate_limits` (`clariprint_quote_public_daily`,
   `civil_day`, `Europe/Paris`). Testé en SQL (configuration, jour civil,
   DST du 25/10, et **compteur PARTAGÉ** — bug trouvé et corrigé en cours de
   session, voir « Défaut trouvé et corrigé »).
3. **Étage membre (atelier), 120/10min, EXEMPTÉ de L3, pas de plafond
   quotidien propre (Q11)** : FAIT. `api_rate_limits`
   (`clariprint_quote_member`, `fixed_seconds`, 600s). La fonction
   `api_consume_clariprint_quote_budget` n'inclut JAMAIS
   `clariprint_quote_public_daily` dans les portées d'un appelant `member`.
   Testé en SQL (concurrence, tout ou rien) et en TS (un jeton résolu SANS
   appartenance retombe en visiteur).
4. **L2 (par boutique) n'existe pas sur cette route** : FAIT — non codé,
   la route n'a pas de `{shopSlug}` (point (1) du contrat). Rien à tester
   (absence délibérée).
5. **Règle IP : `cf-connecting-ip` seul, une seule entrée ; absent/vide/
   multiple -> quota partagé + `rate_limit.client_ip_missing` ; jamais
   `x-forwarded-for`/`true-client-ip`/`x-client-ip`/`forwarded`/
   `x-real-ip`/`remoteAddr` ; IPv6 ramenée au /64** : FAIT.
   `resolveClientIp`/`normalizeIpForRateLimit`
   (`src/modules/clariprint/application/clariprint-quote-rate-limit.ts`).
   Testé en TS (unitaire pur + route, en-têtes forgés simultanément).
6. **Secret HMAC = secret d'Edge Function (`MAGRIT_RATE_LIMIT_IP_HMAC_SECRET`),
   pas Vault ; absent -> échec FERMÉ, clé partagée, événement journalisé,
   L3 reste appliqué** : FAIT. Testé en TS (route).
7. **Base injoignable -> échec FERMÉ, 503** : FAIT.
   `ClariprintQuoteBudgetUnavailableError`, testé en TS (route) ; la
   vérification d'appartenance (`current_user_tenant_ids`) propage la MÊME
   erreur en cas d'échec (décision du dev-story, documentée plus bas).
8. **Réponse de refus dans la forme d'erreur existante, sans toucher
   l'OpenAPI ; 429 `api.rate_limited` (L1/membre) ; 503
   `clariprint.public_quota_exhausted` (L3) ; pas de `Retry-After` ;
   Clariprint JAMAIS appelé sur un refus** : FAIT. Testé en TS (5 cas :
   visiteur, membre, L3, budget indisponible, + le cas positif qui prouve
   que la passerelle EST appelée quand tout va bien).
9. **Migration : RLS activée SANS policy, JAMAIS de grant à `anon`/
   `authenticated`, fonction atomique réservée au `service_role`, verrous
   dans un ordre fixe, purge `pg_cron` à 03:40 UTC sur le modèle de la
   purge des journaux de notification, aucune IP en clair** : FAIT.
   `supabase/migrations/20260915000100_bcp_0b_clariprint_rate_limit.sql`.
   Testé en SQL (droits, RLS, concurrence réelle par `dblink`, tout ou
   rien, purge, contrainte anti-IP-en-clair).

## Défaut trouvé et corrigé en cours de session : L3 n'était PAS un compteur partagé

Premier jet de `api_consume_clariprint_quote_budget` : la clé passée à
`api_rate_limit_counters` pour **toutes** les portées, y compris
`clariprint_quote_public_daily`, était `p_key_hash` (la clé du VISITEUR).
Résultat vérifié par appel manuel : chaque visiteur créait sa **propre**
ligne `clariprint_quote_public_daily`, donc L3 ne bornait rien du tout — le
plafond global de 500/jour aurait pu être dépassé par mille visiteurs
distincts sans jamais se déclencher.

**Trouvé comment** : test manuel `psql` avant d'écrire le fichier SQL de
gate (deux visiteurs différents, inspection de `api_rate_limit_counters` —
deux lignes `public_daily` au lieu d'une). **Corrigé** : la clé de
`clariprint_quote_public_daily` est désormais **toujours** la constante
`'global'`, indépendante de l'appelant ; les autres portées gardent la clé
de l'appelant. Un scénario dédié (« 8. L3 est un compteur PARTAGÉ ») a été
ajouté au fichier de test SQL, et j'ai vérifié qu'il **échoue** contre
l'ancienne version de la fonction avant de la corriger (voir « Preuves
d'échec des tests »). L'ordre de verrouillage (alphabétique sur le nom de
portée) reste correct avec ce changement : `clariprint_quote_public_daily`
< `clariprint_quote_visitor`, donc tout appelant verrouille la ligne
partagée avant sa propre ligne, dans le même ordre pour tout le monde — pas
de cycle possible.

## Décisions et leur motif (choix laissés ouverts par le cadrage)

1. **Priorité de refus quand deux étages seraient simultanément épuisés** :
   l'étage propre à l'appelant (visitor/member) est signalé avant le
   plafond public (L3), pour un 429 plus spécifique qu'un 503 générique.
   Le cadrage ne fixe pas cet ordre (aucun scénario ne le requiert) — choix
   du dev-story, dans la fonction SQL, documenté en commentaire.
2. **Échec de la vérification d'appartenance (`current_user_tenant_ids()`)
   = échec FERMÉ pour TOUTE la requête**, pas un repli silencieux en
   « visiteur ». Le point (3) du contrat dit explicitement « base
   injoignable ou fonction en erreur : échec fermé aussi » — j'ai retenu
   que cela couvre aussi la vérification de membre, pas seulement le
   budget lui-même : un attaquant ne doit pas pouvoir provoquer une panne
   de cette vérification pour se faire traiter en visiteur à volonté, et un
   vrai membre en panne de base ne doit pas perdre silencieusement son
   étage. `SupabaseClariprintQuoteMembershipGateway.isMember` propage donc
   `ClariprintQuoteBudgetUnavailableError` sur toute erreur RPC.
3. **Format des clés stockées** : préfixées par leur origine (`user:`,
   `account:`, `ip:`, ou la valeur littérale `shared`/`global`) plutôt que
   des valeurs nues — évite toute collision entre espaces de clé au sein
   d'une même portée visiteur (un UUID de compte et un HMAC hexadécimal ne
   se ressemblent déjà pas, mais la lisibilité au journal/en base y gagne).
4. **Défense en profondeur ajoutée, non demandée explicitement** : contrainte
   `check` sur `api_rate_limit_counters.key_hash` qui rejette une forme
   IPv4/IPv6 écrite telle quelle. Le cadrage exige « aucune colonne ne
   contient une IP en clair » comme PROPRIÉTÉ à tester (point (9)) ; sans
   cette contrainte, la propriété n'aurait été garantie que par la
   discipline du code appelant, jamais vérifiable par un test SQL réel qui
   échoue sans elle.

## Fichiers créés/modifiés

**Migration**
- `supabase/migrations/20260915000100_bcp_0b_clariprint_rate_limit.sql` —
  tables `api_rate_limits` (configuration) et `api_rate_limit_counters`
  (compteurs), RLS sans policy + revoke, fonction
  `api_consume_clariprint_quote_budget(p_caller_kind, p_key_hash, p_now)`
  (`security definer`, `set search_path = ''`, `service_role` seul),
  fonction `purge_expired_rate_limit_counters()`, job `pg_cron`
  `magrit-rate-limit-purge` à 03:40 UTC, valeurs initiales (30/600s,
  120/600s, 500/jour Europe/Paris).

**Module `clariprint` (application)**
- `src/modules/clariprint/application/clariprint-quote-budget.ts` — port
  `ClariprintQuoteBudget`, type `ClariprintQuoteCaller`, erreurs
  `ClariprintQuoteRateLimitedError`/`ClariprintQuoteBudgetUnavailableError`.
- `src/modules/clariprint/application/clariprint-quote-rate-limit.ts` —
  primitives pures : `resolveClientIp`, `normalizeIpForRateLimit`
  (IPv6 -> /64), `hmacSha256Hex`.
- `src/modules/clariprint/application/clariprint-service.ts` (modifié) —
  `quote(command, caller)` consulte le budget AVANT la passerelle.

**Adaptateurs Supabase**
- `src/adapters/supabase/clariprint-quote-budget-repository.ts` — appelle
  `api_consume_clariprint_quote_budget` par le client `service_role`.
- `src/adapters/supabase/clariprint-quote-membership-gateway.ts` — appelle
  `current_user_tenant_ids()` par le client PORTANT LE JWT DE L'APPELANT
  (jamais service_role).

**Route**
- `src/server/api/clariprint-routes.ts` (modifié) — résolution de
  l'appelant (membre/visiteur/clé), traduction des refus en
  429/503, `ClariprintQuoteCallerDependencies` injectées.
- `src/server/api/legacy-routes.ts` (modifié) — trois nouvelles
  dépendances (`clariprintIsMember`, `clariprintIpHmacSecret`,
  `clariprintOnRateLimitEvent`) sur `LegacyApiServices`, spécial-casées
  dans `definitionOnlyServices()` (Proxy de `LEGACY_ROUTE_DEFINITIONS`).

**Edge Function**
- `supabase/functions/magrit-api/index.ts` (modifié) — extraction d'une
  variable nommée `serviceRoleClient` (réutilisée par l'outbox ET le
  budget), composition de `SupabaseClariprintQuoteMembershipGateway`
  (client porteur du JWT) et `SupabaseClariprintQuoteBudgetRepository`
  (client `service_role`), lecture de `MAGRIT_RATE_LIMIT_IP_HMAC_SECRET`,
  helper `unavailableClariprintQuoteBudget` (échec fermé si
  `SUPABASE_SERVICE_ROLE_KEY` absente, même patron que `unavailableOutbox`).

**Tests**
- `tests/sql/bcp-0b-clariprint-rate-limit.sql` — droits/RLS,
  concurrence réelle (dblink), tout ou rien, fenêtre fixe, jour civil +
  DST 25/10/2026, purge, configuration, anti-IP-en-clair, L3 partagé.
  Ajouté à `scripts/test-storefront-sql.sh`.
- `tests/modules/clariprint/clariprint-quote-rate-limit.test.ts` —
  primitives pures (IP, IPv6/64, HMAC).
- `tests/server/clariprint-routes.test.ts` (modifié) — signatures
  `ClariprintService`/`createClariprintRoutes` mises à jour pour les 4
  tests préexistants + 12 nouveaux cas (refus 429/membre/L3/indisponible,
  passerelle jamais appelée, clé membre, repli visiteur, en-têtes forgés,
  IP absente, secret absent, HMAC déterministe, corps invalide).

## Valeurs par défaut posées (migration, table `api_rate_limits`)

| Portée | Plafond | Fenêtre |
|---|---|---|
| `clariprint_quote_visitor` | 30 | 10 min (fixe, alignée epoch) |
| `clariprint_quote_member` | 120 | 10 min (fixe, alignée epoch) |
| `clariprint_quote_public_daily` | 500 | jour civil `Europe/Paris` |

## Actions de mise en production — EXACTES, réservées à Arnaud

1. **Poser le secret d'Edge Function** `MAGRIT_RATE_LIMIT_IP_HMAC_SECRET`
   sur `magrit-api` (valeur aléatoire, ≥32 octets, jamais dans le dépôt).
2. **`supabase db push`** (ou équivalent CI/CD) pour appliquer
   `20260915000100_bcp_0b_clariprint_rate_limit.sql` — crée les deux
   tables, les deux fonctions, et planifie `magrit-rate-limit-purge`
   (03:40 UTC).
3. **Déployer `magrit-api`** (`supabase functions deploy magrit-api`) —
   seule fonction concernée ; `make-server-e3db71a4` n'a plus de route
   Clariprint (410 depuis BCP-0).
4. **Vérifier après déploiement** : le job figure dans `cron.job`
   (`select * from cron.job where jobname = 'magrit-rate-limit-purge'`) ;
   une consommation réelle apparaît dans `api_rate_limit_counters` sans IP
   en clair (`select * from api_rate_limit_counters limit 5`).
5. **Aucune valeur de configuration à ajuster avant déploiement** — les
   trois lignes de `api_rate_limits` sont posées par la migration avec les
   valeurs proposées par le cadrage (30/120/500). Un futur ajustement de
   L3 (« quand le prix d'un appel Clariprint sera connu ») est un simple
   `update` sur cette table, à consigner dans `SPRINT_HANDOFF.md`.

## Problème d'infrastructure trouvé et contourné SANS modification du dépôt (à signaler au coordinateur)

`supabase db reset --local`, depuis un état vide (images Docker
fraîchement tirées), **échoue** dès la troisième migration historique
(2026-04-18) : `20260418000001_library_client.sql` référence
`public.product_library` (créée par `20260418000002_shop_module.sql`,
qui lui-même référence `public.user_preferences`, créée par
`20260418000003_user_data.sql`). **L'ordre lexical des trois fichiers est
l'INVERSE de leur ordre de dépendance réel** (003 doit s'appliquer avant
002, qui doit s'appliquer avant 001) — un défaut pré-existant, antérieur à
BCP-0b, jamais rencontré tant que personne n'avait rejoué un `db reset`
complet sur cette branche depuis une base vide.

**Comment j'ai contourné, sans toucher au dépôt commis** : renommage
LOCAL et TEMPORAIRE des trois fichiers (`001↔003`) pour forcer le bon
ordre d'application pendant le `db reset`, puis restauration des noms
originaux immédiatement après (vérifié : `git status`/`git diff` propres
sur ces trois fichiers avant et après). Le contenu des trois fichiers n'a
JAMAIS été modifié — seul l'ordre d'application locale, temporairement.

**Ce que je NE corrige PAS** (hors périmètre BCP-0b, et un renommage
commis changerait le numéro de version que `supabase_migrations.
schema_migrations` porte déjà en production/staging, risque de
réconciliation que je ne suis pas mandaté à trancher) : la vraie
correction (renumérotation commise des trois fichiers, ou migration de
réparation) revient au coordinateur/architecte. **Effet de bord à noter** :
le conteneur Docker Supabase local partagé (`supabase_db_magritoff-v5`,
utilisé par TOUS les worktrees du projet) a été recréé depuis zéro pendant
cette session (images pulled, volumes recréés) — toute donnée locale
antérieure à cette session (jeux de fixtures d'autres agents en cours) a
été perdue. Aucune donnée de production n'est concernée.

## Tests exécutés

- `pnpm typecheck` (modular) → vert.
- `pnpm exec vitest run tests/server tests/modules/clariprint
  tests/adapters/clariprint tests/architecture tests/contract` → vert,
  **100 fichiers passés, 5 ignorés (105), 847 cas passés, 39 ignorés
  (886)**.
- `pnpm test:contract` → vert, 432 cas, 23 fichiers, **inchangé** (aucun
  endpoint E10 touché).
- `pnpm test:architecture` → vert, 183 cas, 40 fichiers.
- `pnpm gen:api:check` → vert, aucun diff `openapi/`.
- `pnpm test:storefront:sql` → vert, **52/52 fichiers** (51 préexistants +
  `bcp-0b-clariprint-rate-limit.sql`), rejoué sur une base reconstruite
  intégralement depuis zéro (`db reset` complet, deux fois, voir section
  infrastructure ci-dessus).
- `deno check --no-lock supabase/functions/magrit-api/index.ts` → vert.

### Preuves d'échec des tests (chaque exigence tombe sans son code)

1. **Grant erroné à `authenticated`** (`grant select on
   public.api_rate_limits to authenticated`) : le scénario 1 du fichier
   SQL échoue immédiatement — `api_rate_limits/api_rate_limit_counters
   expose authenticated:SELECT aux roles client`. Révoqué, repasse au
   vert.
2. **Bug L3 non partagé** (version antérieure de la fonction, clé
   `p_key_hash` au lieu de la constante `'global'` pour
   `clariprint_quote_public_daily`) : rejoué le fichier de test complet
   contre cette version — échec immédiat sur le scénario « tout ou rien »
   (`L3 epuise aurait du refuser (allowed=t, refused_scope=<NULL>)`),
   avant même d'atteindre le scénario dédié « L3 est un compteur
   partagé ». Fonction corrigée, repasse au vert.
3. **Tests TS** : chacun des 16 nouveaux cas de `clariprint-routes.test.ts`
   a été écrit avec l'assertion contraire d'abord vérifiée manuellement
   contre le comportement PRÉ-BCP-0b (route sans budget, sans résolution
   d'appelant) — impossible à exécuter tel quel puisque la route
   n'acceptait pas de second argument avant ce lot ; la preuve de
   non-régression tient donc par construction (le budget/la résolution
   d'appelant n'existaient PAS avant ce commit).

## Dérogation R5 utilisée

Aucune sur le périmètre codé. La dérogation R5 déjà déclarée par
l'architecte pour la route historique (payload nu, publique, échecs en 200
— §8.25 point 2.1) N'EST PAS levée par BCP-0b : ce lot borne le risque de
débit qu'elle porte, sans changer sa forme. Chemin de mise en conformité
inchangé : BCP-1b (contrat écrit, migration des appelants, retrait de la
route historique).

## Ce qui reste pour BCP-1b

- Les trois opérations du contrat définitif (§8.25 point 2.4) : conserver
  `POST /api/v1/clariprint-quotes` (atelier), abandonner l'opération
  storefront séparée, créer `POST /api/v1/public-shops/{shopSlug}/
  clariprint-quotes` (publique).
- **BCP-1b reprend TEL QUEL** le mécanisme de BCP-0b (port
  `ClariprintQuoteBudget`, table `api_rate_limits`/`api_rate_limit_counters`,
  fonction atomique) — ajoute seulement la portée L2 (par boutique) en
  migration additive (une valeur de `check` de plus sur les deux tables).
- Le diagnostic (verdict, journalisation) de BCP-1a n'est pas dans ce lot :
  BCP-0b ne journalise que deux événements ciblés
  (`rate_limit.client_ip_missing`, `rate_limit.ip_hmac_secret_missing`),
  pas un verdict complet par appel.
- `Retry-After` sur les réponses 429/503 : explicitement hors de ce lot
  (le cadrage le reporte à BCP-1b, sur la façade E10).
