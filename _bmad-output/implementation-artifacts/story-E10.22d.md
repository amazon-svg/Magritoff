---
id: E10.22d
epic: E10 — Gestion commerciale
status: done
branch: feat/gescom-e10-4-entite-client
depends_on: [E10.22a, E10.22b, E10.22c]
blocks: [E10.22e]
---
# E10.22d — pilotage PAR ESPACE de la purge automatique des fichiers de commande

Contrat déjà écrit par l'architecte : `docs/api/CONVENTIONS.md` §8.22bis.
`openapi/magrit-core.v1.yaml` **non touché par ce lot** (extension du schéma
`CommercialSettings`/`UpdateCommercialSettingsCommand` déjà en place,
`pnpm gen:api:check` vert, `git diff --stat openapi/magrit-core.v1.yaml`
vide) et client TypeScript déjà régénéré, non modifié à la main.

E10.22a/a-bis/b/c sont livrées, approuvées, commitées, déployées sur
`ightkxebexuzfjdbpsdg` — et **inertes** (aucun `pg_cron` planifié, aucun
secret Vault posé). Ce lot pose l'interrupteur **avant** d'armer le
mécanisme, jamais après.

## Décisions actées (non rouvertes)

- Pilotage **PAR ESPACE** (pas d'interrupteur global Magrit), stocké dans le
  singleton `commercial_settings` (E10.10a) via `order_file_purge_enabled`
  (booléen, `false` par défaut, réserve (i) fermée le 2026-09-11).
- Désactiver arrête **tout le pipeline** pour ce tenant (rappels, purge,
  événements) — **sauf** le nettoyage des objets orphelins (E10.22c), qui
  reste actif pour tous les tenants indépendamment de ce réglage.
- Plancher d'activation (`order_file_purge_enabled_at` en base,
  `CommercialSettings.order_file_purge_effective_from` au contrat, lecture
  seule) : activer ne détruit jamais un fichier avant 30 jours pleins à
  compter du geste d'activation, même si `purge_at` est déjà très dépassé.
  Ce plancher ne modifie **jamais** `purge_at` — c'est une seconde borne,
  appliquée en plus.

## Critères d'acceptation — un par un

| # | Critère | État | Détail |
|---|---|---|---|
| 1 | Migration ajoute le pilotage sur `commercial_settings`, sans toucher aux migrations déjà appliquées | Fait | `supabase/migrations/20260911000000_gescom_e10_22d_purge_activation.sql` — deux colonnes (`order_file_purge_enabled`, `order_file_purge_enabled_at`), un `check`, un trigger neuf, une fonction neuve (`order_file_effective_purge_at`), une fonction neuve (`api_reset_stale_order_file_purge_notices`), quatre `create or replace` sur des fonctions déjà déployées. Aucune migration `20260910*` éditée. |
| 2 | Cohérence par `check`, pas par discipline applicative | Fait | `commercial_settings_purge_activation_coherence` : refuse "armé sans date d'armement" et l'inverse. Testé trigger désactivé (défense en profondeur), scénario A du fichier SQL. |
| 3 | Le plancher ne se recule jamais en re-cliquant sur "activer" | Fait | Trigger `commercial_settings_track_purge_activation` : transition inchangée (true→true, false→false) laisse `enabled_at` inchangé. Scénario B. |
| 4 | Réactivation après désactivation recalcule un nouveau plancher | Fait | Scénario B (3ᵉ transition) : `enabled_at` distinct du précédent après false→true→false→true. |
| 5 | `api_claim_order_file_purge_notices`/`api_claim_order_files_for_purge` excluent les tenants désactivés (jointure interne, absence de ligne = à l'arrêt) | Fait | Scénario E : tenant sans ligne ET tenant explicitement désactivé, tous deux avec destinataire joignable et fichier très échu → aucun rappel, aucune purge. |
| 6 | Cas limite explicite : fichier déjà à J+35, activation aujourd'hui, deux rappels déjà confirmés → aucune purge avant 30 jours | Fait | Scénario D, reproduit exactement le piège identifié par l'architecte (deux courriels le même matin, purge sous 48h sans le plancher) : `api_claim_order_files_for_purge` rend 0 ligne pour ce fichier malgré la garde des deux rappels confirmés satisfaite. |
| 7 | Vivacité : rappel confirmé sous une activation passée n'autorise rien sous la suivante ; les pointeurs périmés sont remis à zéro | Fait | Garde étendue `n.confirmed_at >= s.order_file_purge_enabled_at` sur `api_claim_order_files_for_purge` ; `api_reset_stale_order_file_purge_notices()` (étape 0 du `PurgeSweepService`) remet à null les pointeurs vers des rappels créés avant l'activation courante, dans les espaces armés uniquement. Scénario G (pointeur périmé remis à zéro, pointeur frais conservé, tenant désactivé jamais touché). |
| 8 | Nettoyage des objets orphelins (E10.22c) indépendant du réglage | Fait | `api_claim_orphan_order_file_objects` **non modifiée** (aucun `create or replace` dans ce lot) — vérifié explicitement dans la migration. |
| 9 | `api_count_blocked_order_file_purges` reste observable pour les espaces désarmés, cinquième motif `purge_desactivee` | Fait | Jointure externe conservée, motif ajouté, négation exacte de la garde étendue. Scénario H. |
| 10 | Extension API (lecture/écriture), même discipline ETag/If-Match | Fait | `src/modules/commercial-settings/api/contracts.ts` étendu (champs optionnels, alignement de compilation contrat↔schéma) ; `SupabaseCommercialSettingsRepository` lit/écrit `order_file_purge_enabled`, calcule `order_file_purge_effective_from` en lecture ; aucune écriture de `order_file_purge_enabled_at` côté application (le trigger SQL en a la charge exclusive). Routes/service inchangés (`ETag`/`If-Match` déjà en place, aucune régression — `tests/contract/commercial-settings.contract.test.ts` vert). |
| 11 | UI : toggle sur l'écran `commercial-settings` existant, texte informant du consentement | Fait | `OrderFilePurgePanel` ajouté à `PricingRulesPage.tsx` (même écran que `DefaultValidityDaysPanel`, même client API, même garde `can_manage_pricing`). Textes repris du contrat/§8 (mêmes formulations que les rappels validés par Arnaud en E10.22a). `data-testid` déclarés dans `src/shared/presentation/testIds.ts`, namespace `commercialSettings` existant. |
| 12 | Aucun endpoint nouveau, aucun événement nouveau, `openapi/` non modifié | Fait | Vérifié (`git diff --stat openapi/` vide, `gen:api:check` vert). |
| 13 | RLS testée sur les colonnes neuves (étanchéité inter-tenant) | Fait | Scénario J (`tests/sql/gescom-e10-22d-purge-activation.sql`) : un membre d'un tenant étranger ne lit ni ne modifie `order_file_purge_enabled` d'un autre tenant. Policies RLS de `commercial_settings` **inchangées** par ce lot (même garde `can_manage_pricing` en écriture). |
| 14 | Non-régression E10.17a/19a/19b/20a/20b/22a/22b/22c | Fait (partiel, voir dette) | Cas SQL des lots antérieurs relus, aucune migration antérieure éditée ; `create or replace` limité aux fonctions explicitement listées par le contrat. **Rejeu réel impossible** dans cet environnement (Docker absent) — voir dette D1. |

## Périmètre exact tenu

1. **Migration SQL** : `supabase/migrations/20260911000000_gescom_e10_22d_purge_activation.sql`.
2. **SQL de balayage étendu** : `api_claim_order_file_purge_notices`,
   `api_claim_order_files_for_purge`, `api_count_blocked_order_file_purges`
   (tous trois `create or replace`, mêmes signatures, grants hérités) + deux
   fonctions neuves (`order_file_effective_purge_at`,
   `api_reset_stale_order_file_purge_notices`).
3. **API `commercial-settings`** : contrats Zod étendus, adaptateur Supabase
   étendu (lecture des deux colonnes neuves + calcul de
   `order_file_purge_effective_from`, écriture de `order_file_purge_enabled`
   seul — jamais `order_file_purge_enabled_at`, propriété exclusive du
   trigger SQL). Routes et service **inchangés** (aucune garde nouvelle à
   ajouter : le droit `can_manage_pricing` couvrait déjà tout le PATCH).
4. **UI** : `OrderFilePurgePanel` dans
   `src/modules/pricing/ui/workspace/PricingRulesPage.tsx` (écran existant,
   `DefaultValidityDaysPanel` pris comme modèle).
5. **`PurgeSweepService`** : étape 0 (`resetStaleNotices`) ajoutée, en tête
   de tour. `PurgeSweepRepository` étend son port
   (`resetStaleNotices(): Promise<number>`), implémenté dans
   `SupabaseOrderFilePurgeSweepRepository`. Aucun filtre de tenant écrit en
   TypeScript — la garde (comme le filtre "espace armé") vit entièrement en
   SQL.

## Fichiers créés/modifiés

**Créés**
- `supabase/migrations/20260911000000_gescom_e10_22d_purge_activation.sql`
- `tests/sql/gescom-e10-22d-purge-activation.sql`
- `tests/adapters/supabase/commercial-settings-repository.test.ts`
- `_bmad-output/implementation-artifacts/story-E10.22d.md` (ce document)

**Modifiés**
- `src/modules/commercial-settings/api/contracts.ts` — deux champs additifs
  (`order_file_purge_enabled`, `order_file_purge_effective_from` en lecture ;
  `order_file_purge_enabled` en écriture), alignement de compilation étendu.
- `src/adapters/supabase/commercial-settings-repository.ts` — lecture/écriture
  des colonnes neuves, calcul de `order_file_purge_effective_from`.
- `src/modules/order-files/application/purge-sweep-repository.ts` — port
  `resetStaleNotices()`.
- `src/modules/order-files/application/purge-sweep-service.ts` — étape 0,
  champ `staleNoticesReset` sur `PurgeSweepReport`.
- `src/adapters/supabase/order-file-purge-repository.ts` — implémentation de
  `resetStaleNotices()` (RPC `api_reset_stale_order_file_purge_notices`).
- `src/modules/pricing/ui/workspace/PricingRulesPage.tsx` — `OrderFilePurgePanel`.
- `src/shared/presentation/testIds.ts` — quatre `data-testid` neufs sous
  `commercialSettings`.
- `scripts/test-storefront-sql.sh` — cas SQL neuf ajouté à la liste.
- `tests/contract/_fakes/commercial-settings-repository.fake.ts` — reproduit
  la règle du trigger d'activation en mémoire.
- `tests/modules/order-files/purge-sweep-service.test.ts` — étape 0 couverte.
- `tests/server/api/order-file-purge-composition.test.ts` — RPC neuve
  câblée dans le faux client, un test dédié.

## Dérogation R5 (règle de dépôt) utilisée

Aucune. Le module `commercial-settings` et le pattern de dossiers
(`api/`+`application/`, adaptateur `src/adapters/supabase/`, routes
`src/server/api/`) existaient déjà (E10.10a) ; ce lot les **étend**, il n'en
recrée aucun.

## Écart constaté avec le contrat (documenté, non corrigé — hors mandat)

Le contrat §8 prescrit une phrase affichée "seulement s'il existe des
rappels [déjà] émis" à la désactivation. **Aucun endpoint de lecture** de
`commercial_order_file_purge_notices` n'existe côté workspace, et §9 du
contrat est explicite : "aucun endpoint nouveau" dans ce lot. Cette condition
ne peut donc pas être évaluée depuis l'écran sans un endpoint hors mandat.
**Choix assumé** : la phrase est affichée **inconditionnellement** à l'état
désactivé plutôt qu'omise à tort — un avertissement vrai affiché à tort est
sans conséquence, un avertissement vrai jamais affiché laisserait croire à
une réversibilité qui n'existe pas. Chemin de mise en conformité : un futur
lot pourrait exposer un endpoint de lecture minimal (`GET
/commercial-order-file-purge-notices?tenant=...&status=pending`) réservé au
workspace, à spécifier par l'architecte.

## Dette introduite

| # | Dette | Portée | Chemin de mise en conformité |
|---|---|---|---|
| D1 | Cas SQL (`tests/sql/gescom-e10-22d-purge-activation.sql`) **jamais rejoué contre Postgres réel** dans cette session — Docker absent de la machine de développement (`pnpm test:storefront:sql` échoue faute de `supabase_db_magritoff-v5`). Le texte de la migration a été relu ligne à ligne et le fichier de test a été écrit avec la même discipline que les lots E10.22a/b/c (dont le rejeu réel avait trouvé des bloquants que la relecture seule n'avait pas vus, notamment B2/B7) — cette dette **mord donc réellement**, elle n'est pas cosmétique. | Élevée (mécanisme qui détruit des données) | Rejouer `pnpm test:storefront:sql` dès qu'un environnement Docker est disponible ; traiter tout échec comme un bloquant avant tout déploiement du geste d'exploitation E10.22e. |
| D2 | Écart documenté ci-dessus (phrase "rappels déjà émis" affichée inconditionnellement, faute d'endpoint de lecture). | Faible (UX, pas de risque de donnée) | Spécifier un endpoint de lecture minimal si le besoin est confirmé par Arnaud ; sinon accepter l'affichage inconditionnel comme définitif. |
| D3 | `order_file_purge_effective_from` est calculé côté adaptateur TypeScript (arithmétique de date sur `order_file_purge_enabled_at`), pas dans `api_get_commercial_settings` côté SQL. Écart mineur de méthode par rapport à la doctrine "la garde vit en SQL" — mais ce champ est un **affichage**, jamais une décision (la garde réelle est entièrement portée par `order_file_effective_purge_at` côté SQL, testée en D1). | Faible | Si un second consommateur de `getCommercialSettings` apparaît hors du contrôle de ce dépôt (ex. partenaire externe), envisager de déplacer ce calcul dans `api_get_commercial_settings` pour une seule source de vérité. |
| D4 | Réserves (j)/(k)/(l)/(m) du contrat §8.22bis §11, et (b)/(c)/(e)/(f)/(g)/(h) de §8.22 §10, restent **ouvertes**, inchangées par ce lot (garde unique `can_manage_pricing`, nom de l'écran "Règles de prix", absence de journal d'audit sur le basculement, plancher à 30 jours non arbitré séparément, domaine Resend, etc.). | Documentée dans le contrat, non introduite ici | Aucune action requise par cette story — à traiter par de futurs lots si Arnaud le décide. |

## Tests exécutés et résultat

| Commande | Résultat |
|---|---|
| `pnpm typecheck` (modulaire) | **vert** |
| `pnpm typecheck:all` | Pré-existant en échec (baseline identique avant/après ce lot, `diff` vide sur la sortie complète — vérifié par `git stash`) : erreurs sans rapport avec ce lot (roles-routes, shop-customers, productEnrichment, etc.). Aucune erreur nouvelle introduite. |
| `pnpm gen:api:check` | **vert** |
| `pnpm test:architecture` | **vert — 146 cas, 34 fichiers** |
| `pnpm test:contract` | **vert — 381 cas, 20 fichiers** (inchangé, aucun test de contrat nouveau — conforme au contrat §9) |
| `pnpm test` (suite complète) | **2119 passés**, 3 échecs pré-existants (`tests/storage/product_mockups_isolation.test.ts`, dépendance réseau à un bucket Supabase réel, sans rapport avec ce lot — même échec avant et après), 36 ignorés |
| `pnpm test:storefront:sql` | **Non exécutable** — Docker absent (dette D1). Cas SQL écrit (`gescom-e10-22d-purge-activation.sql`), ajouté à `scripts/test-storefront-sql.sh`, relu attentivement mais jamais exécuté réellement. |
| `git diff --stat openapi/magrit-core.v1.yaml` | **vide** |

## Cas limite explicitement demandé — vérifié en détail

Scénario D du fichier SQL : tenant avec un fichier `purge_at = now() - 35
jours` (déjà purgeable en théorie selon la date brute). Le réglage est activé
aujourd'hui. Les deux rappels (`first`/`second`) sont insérés **déjà
confirmés délivrés** (`confirmed_at = now()`), reproduisant exactement le
scénario où les deux courriels tombent le même matin. `api_claim_order_files_for_purge`
est appelée : **zéro ligne rendue** pour ce fichier, `deleted_at`/`purged_at`
restent `NULL`. La cause : `order_file_effective_purge_at(purge_at,
enabled_at) = enabled_at + 30 jours` domine le `purge_at` très dépassé, et la
clause `effective <= now()` exclut le fichier de la sélection **avant même**
que la garde des deux rappels ne soit évaluée.

Cycle activation → désactivation → réactivation (scénario B) : le plancher
est bien recalculé à chaque **nouvelle** activation (transition
false→true), jamais repoussé par un re-clic sur un réglage déjà actif
(true→true), et remis à zéro à la désactivation (true→false).
