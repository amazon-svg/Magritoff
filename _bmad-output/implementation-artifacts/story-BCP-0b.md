---
id: BCP-0b
epic: Chantier boutique — chaîne des prix Magrit (hors E10)
status: corrected-qa-review-round-2
branch: worktree-agent-a041a2721c4d4213b (worktree isolé créé depuis le HEAD commité de feat/gescom-e10-4-entite-client, SHA 8b23db6a — qa-review round 1 a signalé un défaut bas #8 sur ce champ, corrigé ici)
depends_on: [BCP-0]
blocks: [BCP-1a, BCP-1b]
---
# BCP-0b — le limiteur de débit sur la route de chiffrage Clariprint actuelle (`POST /api/v1/clariprint/quote`)

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

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
  429/503, `ClariprintQuoteCallerDependencies` injectées. **qa-review
  round 1** : le port de journalisation (`onRateLimitEvent`) est élargi
  (type `ClariprintRateLimitLogEvent`) pour couvrir chaque refus
  (`scope`/`callerKind`) et la cause d'un 503 `clariprint.unavailable`
  (auparavant avalée) — même port, pas de second mécanisme. **qa-review
  round 2** : l'événement `refused` ne porte plus `key` (l'empreinte d'IP
  ou le compte boutique y fuyaient, interdit par §8.25 (11) et le point
  2.4) — remplacé par `userId`, optionnel, rempli UNIQUEMENT pour un
  membre (point 2.3bis (4)).
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
- `tests/sql/bcp-0b-clariprint-rate-limit.sql` — droits/RLS, **concurrence
  réelle à 20 sessions simultanées (dblink, scrutation `dblink_is_busy`,
  qa-review round 1)**, tout ou rien (dans les deux sens : S3/scénario 3 et
  S7r), L3 exempte le membre (S5), fenêtre fixe, jour civil + DST
  25/10/2026 avec valeurs littérales (qa-review round 1), **jour civil
  indépendant du fuseau de la session appelante (scénario 4c, qa-review
  round 1)**, purge, configuration, anti-IP-en-clair, L3 partagé. Ajouté à
  `scripts/test-storefront-sql.sh`.
- `tests/modules/clariprint/clariprint-quote-rate-limit.test.ts` —
  primitives pures (IP, IPv6/64, HMAC).
- `tests/adapters/clariprint/clariprint-quote-budget-repository.test.ts`
  (qa-review round 1) — échec fermé de l'adaptateur budget (T7/T7b/T7c).
- `tests/adapters/clariprint/clariprint-quote-membership-gateway.test.ts`
  (qa-review round 1) — échec fermé de l'adaptateur d'appartenance (T7/T8).
- `tests/server/clariprint-routes.test.ts` (modifié) — signatures
  `ClariprintService`/`createClariprintRoutes` mises à jour pour les 4
  tests préexistants + 12 cas initiaux (refus 429/membre/L3/indisponible,
  passerelle jamais appelée, repli visiteur, en-têtes forgés, IP absente,
  secret absent, HMAC déterministe, corps invalide) + **qa-review round
  1** : clé exacte du membre (T5), session boutique (T6), secret injecté
  vs constante (T14), et 4 tests de journalisation des refus/pannes
  (recette 11).

## Valeurs par défaut posées (migration, table `api_rate_limits`)

| Portée | Plafond | Fenêtre |
|---|---|---|
| `clariprint_quote_visitor` | 30 | 10 min (fixe, alignée epoch) |
| `clariprint_quote_member` | 120 | 10 min (fixe, alignée epoch) |
| `clariprint_quote_public_daily` | 500 | jour civil `Europe/Paris` |

## Actions de mise en production — EXACTES, réservées à Arnaud

1. **`supabase db push --dry-run` AVANT tout** : il ne doit lister QUE
   `20260915000100_bcp_0b_clariprint_rate_limit.sql` — la production étant
   à `20260913010000` au moment d'écrire ce lot. Toute autre migration
   listée signale un écart d'historique à arrêter et diagnostiquer avant
   de continuer.
2. **Poser le secret d'Edge Function** `MAGRIT_RATE_LIMIT_IP_HMAC_SECRET`
   sur `magrit-api` (valeur aléatoire, ≥32 octets, jamais dans le dépôt).
   Confirmer avec `supabase secrets list` (le secret doit apparaître,
   jamais sa valeur en clair dans un journal ou une sortie de commande).
3. **`supabase db push`** (ou équivalent CI/CD) pour appliquer
   `20260915000100_bcp_0b_clariprint_rate_limit.sql` — crée les deux
   tables, les deux fonctions, et planifie `magrit-rate-limit-purge`
   (03:40 UTC).
4. **Déployer `magrit-api`** (`supabase functions deploy magrit-api`) —
   seule fonction concernée ; `make-server-e3db71a4` n'a plus de route
   Clariprint (410 depuis BCP-0).
5. **Vérifier après déploiement** : le job figure dans `cron.job`
   (`select * from cron.job where jobname = 'magrit-rate-limit-purge'`) ;
   une consommation réelle apparaît dans `api_rate_limit_counters` sans IP
   en clair (`select * from api_rate_limit_counters limit 5`).
6. **Après le premier chiffrage anonyme réel** (boutique ou atelier),
   vérifier dans le journal de la fonction l'ABSENCE de
   `rate_limit.client_ip_missing` et de `rate_limit.ip_hmac_secret_missing`
   — leur présence signale respectivement un problème d'en-tête
   `cf-connecting-ip` en amont (Cloudflare) ou un secret mal posé à l'étape
   2, PAS une erreur applicative.
7. **Aucune valeur de configuration à ajuster avant déploiement** — les
   trois lignes de `api_rate_limits` sont posées par la migration avec les
   valeurs proposées par le cadrage (30/120/500). Un futur ajustement de
   L3 (« quand le prix d'un appel Clariprint sera connu ») est un simple
   `update` sur cette table, à consigner dans `SPRINT_HANDOFF.md`.
8. **Retour arrière** : redéployer la version PRÉCÉDENTE de `magrit-api`
   (celle d'avant ce lot). La migration seule est INOFFENSIVE si elle
   reste appliquée (deux tables neuves, jamais lues par l'ancien code) —
   aucun retrait de migration n'est nécessaire pour annuler ce lot.

## qa-review round 1 (2026-09-15) — REJETÉ, CORRIGÉ

Rejeté sur cinq défauts moyens et trois défauts bas. Chaque correction est
tenue par un test qui échoue sur la mutation qu'il vise — preuve exécutée
et rapportée ci-dessous (voir aussi « Tests exécutés »).

### Défaut moyen 1 — S3 : la concurrence n'était pas prouvée

Le test à deux connexions (une synchrone puis une asynchrone qui l'attend)
restait vert même sans `for update`, puisque l'`insert ... on conflict`
fait déjà attendre le second appelant indépendamment de tout verrou sur le
`select` qui décide. **Corrigé** : `tests/sql/bcp-0b-clariprint-rate-limit.sql`
envoie désormais **20 sessions dblink ENSEMBLE** (`dblink_send_query` pour
les 20, avant de lire le moindre résultat), drainées par scrutation
(`dblink_is_busy`) — chaque connexion prête est commitée immédiatement
(libère son verrou pour la suivante). Plafond 5, 1 hit déjà consommé avant
la rafale : exactement 4 acceptés sur 20 attendus. **Mesuré, dans les deux
sens** : code actuel → 4 acceptés (voir « Tests exécutés ») ; `for update`
retiré → 9 acceptés (dans la plage 5-12 mesurée par la qa). Story doc
corrigé (l'affirmation « à une unité du plafond, exactement un appel
accepté » décrivait le VIEUX scénario à 2 connexions, retiré).

### Défaut moyen 2 — le repli fermé des adaptateurs n'était testé nulle part

`SupabaseClariprintQuoteBudgetRepository` et
`SupabaseClariprintQuoteMembershipGateway` ne sont JAMAIS exercés par les
tests de route (qui injectent un `ClariprintQuoteBudget`/`isMember`
factices) — leur propre logique d'adaptation (erreur RPC, réponse vide,
portée inconnue) n'était donc couverte par AUCUN test. **Corrigé** : deux
nouveaux fichiers, `tests/adapters/clariprint/clariprint-quote-budget-
repository.test.ts` (T7, T7b, T7c) et `tests/adapters/clariprint/
clariprint-quote-membership-gateway.test.ts` (T7/T8) — chaque cas
d'erreur/silence RPC est vérifié pour produire une indisponibilité
(`ClariprintQuoteBudgetUnavailableError`), jamais une autorisation. Le
comportement du gateway sur erreur (échec fermé POUR TOUTE LA REQUÊTE,
pas un repli en visiteur) est désormais figé par un test dédié.

### Défaut moyen 3 — tests exigés par (9) manquants (T5, T6)

- **T5** : le test du membre ne vérifiait que `caller.kind === 'member'`,
  jamais la clé exacte — une mutation qui remplacerait la clé par `'shared'`
  (ou toute autre constante) serait passée inaperçue. Corrigé :
  `toEqual({ kind: 'member', key: 'user:jeton-valide' })`.
- **T6** : aucun test n'injectait `storefrontSessions`/
  `storefrontCookiePolicy` — la branche « compte boutique » (premier ordre
  de résolution du visiteur, point (3)) pouvait disparaître entièrement
  sans qu'aucun test ne le voie. Nouveau test dédié, avec un faux
  `StorefrontSessionGateway` et un cookie réel — vérifie la clé exacte
  `account:<id>`, ET que l'IP (présente aussi dans la requête) ne prime
  pas dessus.

### Défaut moyen 4 — recette (11) : aucun refus n'était journalisé

`ClariprintQuoteCallerDependencies.onRateLimitEvent` ne portait que deux
événements (`client_ip_missing`/`ip_hmac_secret_missing`) — un refus
(429/503 public) et la CAUSE d'un 503 `clariprint.unavailable` n'étaient
JAMAIS journalisés (`clariprint-routes.ts:62`, avant ce correctif).
**Corrigé** : le même port est ÉLARGI (type `ClariprintRateLimitLogEvent`,
union discriminée) à deux événements de plus, `refused` (portée, type
d'appelant, clé déjà hachée/préfixée — jamais l'IP en clair) et
`unavailable` (cause).

> **CORRECTION qa-review round 2** : l'affirmation ci-dessus (« clé déjà
> hachée/préfixée — jamais l'IP en clair ») était FAUSSE en pratique. La
> « clé déjà hachée » d'un visiteur anonyme VAUT `ip:<hmac>` : c'est
> l'empreinte de son IP, que §8.25 (11) et le point 2.4 interdisent
> explicitement au journal, deux fois. Pour un visiteur avec session
> boutique, elle vaut `account:<uuid>`, un identifiant en clair. `key` a
> été RETIRÉ de l'événement `refused`, remplacé par `userId` (optionnel,
> membre seulement — voir section dédiée plus bas).

Aucun second mécanisme créé — c'est le SEUL port de
journalisation de ce lot, et la façade historique n'en offre pas d'autre
pour un refus intentionnel (`onUnexpectedError` ne sert qu'aux 500).
Composé dans `magrit-api/index.ts` en `console.warn`/`console.error`
(même patron que le reste du fichier). Quatre tests dédiés (visiteur,
membre, public, indisponibilité), chacun vérifié par mutation (voir
« Tests exécutés »).

### Défaut moyen 5 — deux invariants SQL sans test (S5, S7r)

- **S5** : un membre chiffre toujours même si L3 est épuisé (l'étage
  membre ne porte jamais L3) — aucun scénario ne le vérifiait.
- **S7r** : un refus L1 (étage propre au visiteur) laisse L3 INCHANGÉ —
  le miroir exact du scénario 3 existant (qui prouve l'inverse : refus L3
  laisse L1 inchangé). Sans lui, une régression qui incrémenterait L3 de
  façon anticipée (avant de savoir si L1 va refuser) passait inaperçue.

Deux scénarios SQL dédiés ajoutés, chacun vérifié par mutation ciblée
(voir « Tests exécutés »).

### Défaut bas 6 — le jour de L3 dépendait du fuseau de la SESSION appelante

`date_trunc('day', p_now at time zone v_civil_tz)` SEUL rend un horodatage
SANS fuseau, réinterprété selon le `TimeZone` GUC de la session appelante
au moment de son affectation à `v_window_start` (`timestamptz`) — une
session `UTC` et une session `America/New_York` calculaient alors DEUX
instants absolus différents pour le MÊME jour civil Paris, donc DEUX
lignes de compteur. **Corrigé** : seconde conversion explicite,
`(date_trunc('day', p_now at time zone v_civil_tz)) at time zone
v_civil_tz` — même patron que `(v_created_from::timestamp at time zone
'Europe/Paris')` (migration `20260913000000`, E10.18c). Le test 4b (DST)
calculait sa valeur ATTENDUE avec la MÊME expression que le code testé —
aveugle par construction au bug (les deux côtés auraient affiché la même
valeur, fausse ou juste). **Réécrit avec des littéraux UTC** vérifiés à la
main. **Nouveau scénario 4c** ajouté, qui fait varier explicitement `set
local time zone` (`America/New_York` puis `UTC` puis `Europe/Paris`) sur
le MÊME `p_now` et vérifie qu'une seule ligne, à l'instant UTC attendu
(minuit Paris), en résulte.

### Défaut bas 7 — clé HMAC non vérifiée au niveau de la route (T14)

Le test existant ne comparait que DEUX sorties entre elles (IP A vs IP B,
même secret) — une mutation qui remplacerait `deps.ipHmacSecret` par une
CONSTANTE dans le câblage de la route (`resolveClariprintQuoteCaller`)
serait passée inaperçue, puisque les deux clés produites resteraient
différentes (IP différente) même avec un secret constant. **Corrigé** :
nouveau test qui varie le SECRET (pas l'IP), et compare le résultat à la
primitive pure `hmacSha256Hex` calculée INDÉPENDAMMENT avec le VRAI secret
injecté — prouve que la route utilise bien la valeur reçue, jamais une
valeur fixée en dur.

### Défaut bas 8 — front-matter du story doc

`branch:` indiquait `feat/gescom-e10-4-entite-client` sans préciser qu'il
s'agit du HEAD dont le worktree est issu, pas de la branche locale réelle
du worktree (`worktree-agent-a041a2721c4d4213b`). Corrigé en front-matter.

### Mutation → test qui la tue (preuve exécutée, restaurée après chaque essai)

| Mutation | Fichier muté (temporairement, jamais commis) | Test(s) qui échouent |
|---|---|---|
| S3 : `for update` retiré du `select` de phase 1 | migration (fonction, en base locale) | scénario SQL S3 (20 sessions) : 9 acceptés au lieu de 4 |
| S5 : le membre porte aussi `clariprint_quote_public_daily` | idem | scénario SQL S5 : membre refusé alors que L3 est épuisé |
| S7r : L3 incrémenté dès la phase 1, avant la décision finale | idem | scénario SQL S7r : L3 bouge malgré un refus L1 |
| Défaut #6 : seconde conversion de fuseau retirée | idem | scénario SQL 4b (littéraux) : 0 ligne à l'instant UTC attendu |
| T7 : erreur RPC → `{allowed:true}` (budget) | `clariprint-quote-budget-repository.ts` | 5/7 cas du fichier adaptateur |
| T7/T8 : erreur RPC → `false` silencieux (appartenance) | `clariprint-quote-membership-gateway.ts` | 1/4 cas du fichier adaptateur |
| T5 : clé du membre remplacée par `'shared'` | `clariprint-routes.ts` (`resolveClariprintQuoteCaller`) | test T5 + test de journalisation « refus membre » |
| T6 : branche compte boutique retirée | idem | test T6 (session boutique) |
| T14 : secret HMAC remplacé par une constante | idem | test T14 (secret injecté) |
| Journal `refused` retiré | idem | 3 tests de journalisation des refus |
| Journal `unavailable` retiré | idem | test de journalisation de la panne |

Chaque ligne a été rejouée réellement (mutation posée, test exécuté et
observé en échec, mutation retirée, `git diff`/état de la base vérifié
propre, test re-exécuté vert) — pas seulement raisonnée.

## qa-review round 2 (2026-09-15) — REJETÉ sur UN SEUL point, CORRIGÉ

L'événement `refused` (ajouté en round 1) portait `key`, la clé du budget
elle-même — pour un visiteur anonyme, `ip:<hmac>` (l'empreinte de son IP,
interdite deux fois : §8.25 (11) « jamais une IP ni son empreinte » et le
point 2.4 « ni l'IP ni son empreinte ne figurent au journal ») ; pour un
visiteur avec session boutique, `account:<uuid>` en clair. Le test de
route l'exigeait même explicitement (`toMatch(/^ip:[0-9a-f]{64}$/)`).

**Corrigé** : `key` retiré de `ClariprintRateLimitLogEvent['refused']`,
remplacé par `userId?: string`, rempli UNIQUEMENT quand `callerKind ===
'member'` (point 2.3bis (4), seul cas où le cadrage autorise une trace —
« traçables au journal par `user_id` »). La ligne `console.warn` de
`magrit-api/index.ts` n'écrit plus `key=` ; elle écrit `user_id=<id>`
pour un membre seulement. Vérifié par `grep` : aucune des trois autres
lignes de journal (`unavailable`, `client_ip_missing`,
`ip_hmac_secret_missing`) ne porte de clé ni d'IP.

Trois tests réécrits/ajoutés dans `tests/server/clariprint-routes.test.ts`
(visiteur anonyme, visiteur avec session boutique, membre) — chacun
vérifié en échec contre `607b72a0` (voir « Tests exécutés », round 3) puis
en succès après correction.

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

### Round 1 (commit initial, `9ddb155e`)

- `pnpm typecheck` (modular) → vert.
- `pnpm exec vitest run tests/server tests/modules/clariprint
  tests/adapters/clariprint tests/architecture tests/contract` → vert,
  **100 fichiers passés, 5 ignorés (105), 847 cas passés, 39 ignorés
  (886)**.
- `pnpm test:contract` → vert, 432 cas, 23 fichiers, **inchangé**.
- `pnpm test:architecture` → vert, 183 cas, 40 fichiers.
- `pnpm gen:api:check` → vert, aucun diff `openapi/`.
- `pnpm test:storefront:sql` → vert, **52/52 fichiers**.
- `deno check --no-lock supabase/functions/magrit-api/index.ts` → vert.

Preuves d'échec (round 1) : grant erroné à `authenticated` détecté par le
scénario 1 ; bug L3 non partagé (clé `p_key_hash` au lieu de `'global'`)
détecté par le scénario « tout ou rien ». Voir commit `9ddb155e`.

### Round 2 (après correction qa-review round 1, ce commit)

- `pnpm typecheck` (modular) → vert.
- `pnpm exec vitest run tests/server tests/modules/clariprint
  tests/adapters/clariprint tests/architecture tests/contract` → vert,
  **102 fichiers passés, 5 ignorés (107), 864 cas passés, 39 ignorés
  (903)** — +2 fichiers (les deux tests d'adaptateur), +17 cas nets
  (12 nouveaux cas de route + T5/T6/T14/journalisation, moins la fusion de
  deux assertions d'événements en objets).
- `pnpm test:contract` → vert, 432 cas, 23 fichiers, **inchangé**.
- `pnpm test:architecture` → vert, 183 cas, 40 fichiers, **inchangé**.
- `pnpm gen:api:check` → vert, aucun diff `openapi/`.
- `pnpm test:storefront:sql` → vert, **52/52 fichiers**, rejoué sur une
  base reconstruite intégralement depuis zéro (voir section
  infrastructure ci-dessus — le contournement de renommage local a été
  répété pour ce round).
- `deno check --no-lock supabase/functions/magrit-api/index.ts` → vert.

### Preuves d'échec des tests round 2 (chaque nouvelle exigence tombe sans son code)

Détail complet dans la section « qa-review round 1 » ci-dessus (tableau
mutation → test). Résumé des preuves exécutées :

1. **S3** (concurrence) : `for update` retiré de la fonction en base
   locale → 9/20 acceptés au lieu de 4 (plage 5-12 mesurée par la qa).
   Restauré → repasse à 4/20, hits=5.
2. **S5** : le membre inclus dans les portées de `clariprint_quote_public_
   daily` → un membre refusé alors que L3 est épuisé. Restauré → membre
   toujours accepté.
3. **S7r** : L3 incrémenté en phase 1 (avant la décision finale) → L3
   bouge (2→3) malgré un refus L1. Restauré → L3 inchangé (2→2).
4. **Défaut #6** (fuseau) : seconde conversion retirée → 0 ligne trouvée à
   l'instant UTC attendu du 25/10 (le scénario littéral détecte
   immédiatement l'écart). Restauré → 1 ligne, hits=2, aux trois dates.
5. **T7/T7b/T7c** (`clariprint-quote-budget-repository.ts`) : erreur RPC,
   réponse vide, portée inconnue → chacun mute en `return { allowed: true
   }` → 5 des 7 tests du fichier échouent. Restauré → 7/7 verts.
6. **T7/T8** (`clariprint-quote-membership-gateway.ts`) : erreur RPC → mute
   en `return false` → 1 des 4 tests échoue. Restauré → 4/4 verts.
7. **T5** : clé du membre remplacée par `'shared'` → 2 tests échouent
   (T5 lui-même + la journalisation du refus membre). Restauré → verts.
8. **T6** : branche compte boutique retirée → 1 test échoue (clé `ip:...`
   obtenue au lieu de `account:...`). Restauré → vert.
9. **T14** : secret HMAC remplacé par une constante → 1 test échoue
   (comparaison à la primitive pure calculée avec le vrai secret).
   Restauré → vert.
10. **Journal `refused` retiré** : 3 tests de journalisation échouent
    (visiteur, membre, public). Restauré → verts.
11. **Journal `unavailable` retiré** : 1 test échoue (`événements: []`
    attendu non vide). Restauré → vert.

Chaque mutation a été posée directement dans le fichier réel (jamais dans
une copie), le test rejoué, l'échec observé et rapporté avec le message
exact, puis le fichier restauré et re-vérifié vert (`git diff` propre
avant de continuer).

### Round 3 (après correction qa-review round 2, ce commit)

- `pnpm typecheck` (modular) → vert.
- `pnpm exec vitest run tests/server tests/modules/clariprint
  tests/adapters/clariprint tests/architecture` → vert, **79 fichiers
  passés, 5 ignorés (84), 433 cas passés, 39 ignorés (472)** (périmètre
  réduit par rapport au round 2 : `tests/contract` non ré-exécuté à ce
  tour, aucun endpoint E10 concerné).
- `pnpm test:architecture` → vert, 183 cas, 40 fichiers, inchangé.
- `deno check --no-lock supabase/functions/magrit-api/index.ts` → vert.

**Preuve d'échec contre `607b72a0`** (le commit rejeté) : les trois
fichiers `src/server/api/clariprint-routes.ts` d'AVANT ce correctif ont
été restaurés temporairement (`git show 607b72a0:... >
src/server/api/clariprint-routes.ts`), et les 3 tests nouveaux/réécrits
exécutés contre cette version :
- visiteur anonyme → `expected true to be false` sur `'key' in event`
  (l'ancienne version pose `key`, la nouvelle assertion l'interdit) ;
- visiteur avec session boutique → même échec, `'key' in event` vrai ;
- membre → `toEqual` échoue, `key: 'user:jeton-membre'` présent au lieu
  de `userId: 'jeton-membre'`.

Fichier restauré (version corrigée), les 23 cas de
`clariprint-routes.test.ts` repassent au vert.

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
- Le diagnostic (verdict complet par appel, BCP-1a) n'est pas dans ce lot :
  BCP-0b journalise quatre événements ciblés (`client_ip_missing`,
  `ip_hmac_secret_missing`, `refused`, `unavailable` — élargi en
  qa-review round 1), pas un verdict complet Clariprint par appel.
- `Retry-After` sur les réponses 429/503 : explicitement hors de ce lot
  (le cadrage le reporte à BCP-1b, sur la façade E10).

## Hors périmètre — signalé, non touché

`GET /api/v1/diagnostics/clariprint` (`CheckAuth` sans aucune limite) est
HORS PÉRIMÈTRE de BCP-0b (route distincte de `POST /api/v1/clariprint/
quote`) — signalé par la qa-review, soumis par elle à l'architecte. Aucune
ligne de ce lot n'y touche.
