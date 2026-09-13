# Banc de mesure — export comptable des commandes (E10.18)

Archive du banc utilisé par l'architecte le 2026-09-13 pour rouvrir et
corriger la réserve (g) (`docs/api/CONVENTIONS.md` §8.24, point 4, douzième
et treizième entrées du bandeau). Conservé pour que la mesure soit
**rejouable**, pas seulement citée — c'est la troisième exigence que la
douzième entrée pose sur toute mesure qui fonde une constante du code :
« passe par le chemin réel, s'exécute sous les limites qui tuent en
production, et est archivée avec son script et ses données ».

## Ce que ça mesure, et ce que ça NE mesure PAS

Le verdict qui compte est celui du **superviseur de l'Edge Runtime**
(`Shutdown.reason`, `cpu_time_used`, `memory_used` — le tas V8 et la
mémoire externe **comptés par le superviseur**), **PAS le RSS du
conteneur Docker**. Deux protocoles précédents (12/09 et une première
tentative du dev-story d'E10.18d) ont mesuré autre chose que ce que la
plateforme tue réellement :

- une mesure hors de la limite CPU du superviseur (temps d'horloge pris
  dans un *main worker*, ou un worker sans `cpuTimeHardLimitMs`) ;
- le RSS d'un conteneur `--memory=256m` tout entier (runtime + graphe de
  modules + fixtures), qui n'est PAS la grandeur que le superviseur
  applique par *invocation*.

Ce banc sert l'Edge Function **réelle** (`index.ts`, composition,
adaptateurs supabase-js — pas une bibliothèque isolée) en **user worker**
via `EdgeRuntime.userWorkers.create()`, avec **les limites exactes du
`main.ts` de la CLI Supabase** (`memoryLimitMb: 256`,
`cpuTimeSoftLimitMs: 1000`, `cpuTimeHardLimitMs: 2000` — configurables par
requête pour explorer, voir `harness/main/index.ts`). En face, un faux
PostgREST (`harness/fake-supabase.ts`), hors de l'isolat, sert des pages
de la forme exacte de `api_read_order_export_rows` remplies de données
réalistes.

## Structure

```
Dockerfile.bench       image de banc = supabase/edge-runtime:v1.69.12
                        + harness/main + harness/events + les instantanés
                        proj*/lib-only (NON archivés ici, voir plus bas)
harness/
  main/index.ts         service principal : cree un user worker par requete,
                         sur l'Edge Function réelle copiée dans /proj*
  events/index.ts        event worker minimal (requis par EdgeRuntime)
  fake-supabase.ts        faux PostgREST : /reset (fixtures), /rpc/... ,
                         /last (dernier tour observé)
  bench.sh                PRIMITIVE de mesure : un conteneur, une requête,
                         un verdict (réponse + statut conteneur + cgroup)
  run-matrix.sh, run-variance.sh, run-platform.sh, run-repeat.sh,
  run-cachedtz.sh, chain*.sh, bisect.sh
                         campagnes qui enchaînent bench.sh sur plusieurs
                         formats/lignes/mémoires — glue de la session du
                         13/09, PAS des primitives indépendantes (voir
                         « Reproduire » ci-dessous)
c1/
  Dockerfile.c1, c1a/, c1b/, c1c/, c1d/, run-c1.sh
                         sondes DÉDIÉES à l'épinglage de fflate côté Deno
                         (réserve C1, treizième entrée (ii)) : quatre
                         combinaisons import-map/import réel/deno.lock,
                         lues dans /deno-dir après coup
  c1.log, c1-cd.log       sorties brutes des quatre sondes (2026-09-13)
```

**Volontairement NON archivé** : `edge-runtime.bin` (163 Mo, binaire
téléchargé), les répertoires `proj/`, `proj-nolimit/`, `proj-noop/`,
`proj-cachedtz/`, `lib-only/` (instantanés de
`supabase/functions/magrit-order-export-runner` + sa composition, à
différents états correctifs — ce sont des COPIES du code du dépôt à un
instant donné, pas des artefacts indépendants), les `*.log` de campagne
autres que `c1/*.log` (volumineux, résumés ci-dessous), et tous les
fichiers de diagnostic ponctuels de la session (`*.sql` de mutation,
`*.diff`, `mut.json`, etc. — utiles pendant l'investigation, sans valeur
de rejeu).

## Reproduire

Le Dockerfile attend quatre instantanés du dépôt sous forme de
sous-répertoires (`proj`, `proj-nolimit`, `proj-noop`, `proj-cachedtz`) et
un cinquième réduit à la bibliothèque seule (`lib-only`) :

```bash
# Depuis la racine du dépôt, un instantané "code livré" :
mkdir -p /tmp/magrit-bench/proj
cp -r supabase /tmp/magrit-bench/proj/
cp -r src /tmp/magrit-bench/proj/
# proj-nolimit / proj-noop / proj-cachedtz : memes copies, avec
# respectivement ORDER_EXPORT_ROW_LIMIT retire/tres eleve, le renderer
# remplace par un no-op, et le correctif du formateur de date applique
# (voir git log de ce lot pour les diffs exacts).

cd /tmp/magrit-bench
cp /chemin/vers/ce/dossier/Dockerfile.bench .
cp -r /chemin/vers/ce/dossier/harness .
docker build -f Dockerfile.bench -t magrit-e1018-bench .

# Une mesure ponctuelle (voir harness/bench.sh pour les arguments) :
bash harness/bench.sh proj 256m 256 xlsx line 5000
```

Sondes C1 (épinglage `fflate`, autonomes, ne dépendent d'aucun
instantané) :

```bash
cd c1 && docker build -f Dockerfile.c1 -t magrit-e1018-c1 .
bash run-c1.sh
```

## Les chiffres du 13/09 (voir `docs/api/CONVENTIONS.md` §8.24, douzième et
## treizième entrées du bandeau, pour le détail complet et les cinq constats)

**Plafond de volume (douzième entrée)** — sous les limites réelles (256 Mo,
CPU 1000/2000 ms), c'est le **CPU qui tue, jamais la mémoire** (moins de
140 Mo comptés dans tous les cas CSV mesurés, contre un RSS conteneur
observé jusqu'à 919 Mio) :

| Charge | Code livré (E10.18c/d) | Formateur de date mis en cache |
|---|---|---|
| CSV 5 000 | passe (< 1 s) | passe (< 1 s) |
| CSV 20 000 | tué 1 fois sur 4 (2 901 ms) | passe (< 1 s) |
| CSV 50 000 | tué (3 417 ms) | passe 5/5 (< 1 s) |
| XLSX 5 000 | passe, 1 835 ms au pire (92 % du budget) | passe 5/5 (< 1 s) |
| XLSX 7 500 | tué 1 fois sur 3 (3 110 ms) | — |
| XLSX 10 000 | tué | passe 5/5, 1 843 ms au pire (92 %) |
| XLSX 20 000 | tué | tué 1 fois sur 3 (2 221 ms) |

**Plafond retenu : `ORDER_EXPORT_ROW_LIMIT = 5 000`**, sous TROIS
conditions sans lesquelles il serait faux lui aussi (§8.24 point 4) :
formateur de date construit une seule fois (`src/kernel/clock/timezone.ts`,
`CIVIL_DATE_FORMATTER`), un export par invocation
(`DEFAULT_ORDER_EXPORT_RUN_SETTINGS.limit = 1`), un filet de reprise des
exports tués (migration `20260913010000`). **Sans le correctif du
formateur, le plafond serait 2 000** — `formatCivilDateInReferenceTimeZone`
construisait un `Intl.DateTimeFormat` À CHAQUE LIGNE : 1 757 ms pour
50 000 lignes contre 70 ms avec un formateur réutilisé.

**Épinglage de `fflate` côté Deno (C1, treizième entrée (ii))** — sondes
`c1/c1.log` et `c1/c1-cd.log`, avec une version délibérément plus ancienne
(0.8.2) que la plus haute compatible (0.8.3) pour que l'effet soit
visible. **Ces deux fichiers sont exclus de git par `*.log` (`.gitignore`)
— recopiés ici tels quels, sans forcer leur ajout**, pour que la preuve
survive même si le répertoire de travail est nettoyé :

```
$ cat c1/c1.log                              (187 octets)
PROBE c1a -> {"ok":true,"bytes":2777,"probe":1}
0.8.2 registry.json fflate write-excel-file
PROBE c1b -> {"ok":true,"bytes":2777}
0.8.3 registry.json fflate write-excel-file
CHAIN_DONE

$ cat c1/c1-cd.log                           (166 octets)
PROBE c1c -> {"ok":true,"bytes":2777}
0.8.2 registry.json fflate write-excel-file
PROBE c1d -> {"ok":true,"bytes":2777}
0.8.3 registry.json fflate write-excel-file
```

Lecture (`run-c1.sh` liste le contenu de
`/deno-dir/npm/registry.npmjs.org/fflate/` après coup — la première ligne
de chaque paire est la version de `fflate` RÉELLEMENT téléchargée, la
seconde le contenu du cache npm racine) :

- **c1a** — import-map `"fflate": "npm:fflate@0.8.2"` **+ import réel
  NOMMÉ** (`import { strToU8 } from 'fflate'`) → **0.8.2 seule**
  téléchargée : transitive FIGÉE.
- **c1b** — **aucune** entrée d'import-map pour `fflate` (seule
  `write-excel-file/node` y figure), mais un `c1b/deno.lock` (v4) qui
  épingle `fflate@0.8.2` comme dépendance de `write-excel-file@4.1.1` →
  **0.8.3** téléchargée quand même : le `deno.lock` est IGNORÉ, sans
  erreur ni contrôle d'intégrité.
- **c1c** — MÊME import-map que c1a (`fflate@0.8.2`), mais un import à
  EFFET DE BORD SEUL (`import 'fflate';`, aucun symbole nommé) → **0.8.2
  seule** téléchargée : un import à effet de bord FIGE tout autant qu'un
  import nommé — ce n'est pas la forme de l'import qui compte, seulement
  sa présence RÉELLE.
- **c1d** — même import-map (`fflate@0.8.2`) que c1a/c1c, **SANS AUCUN
  import** de `fflate` → **0.8.3** téléchargée : une entrée d'import-map
  SEULE, sans import réel qui l'accompagne, ne fige RIEN.

Les quatre sondes se recoupent : c1a/c1c prouvent que l'import réel FIGE
(nommé ou à effet de bord, peu importe) ; c1b/c1d prouvent que ni un
`deno.lock` ni une entrée d'import-map seule ne suffisent. D'où la règle
opposable, qui exige les DEUX à la fois (l'import-map ET l'import réel).

D'où la règle opposable : l'import-map ET un `import 'fflate';` réel dans
`src/modules/order-exports/application/renderers/xlsx-renderer.ts`, jamais
un `deno.lock` seul (voir `tests/architecture/order-export-xlsx-library-boundaries.test.ts`
pour la garde automatisée).

**Aucun secret dans ce dossier** : `MAGRIT_ORDER_EXPORT_RUN_SECRET` et
`SUPABASE_SERVICE_ROLE_KEY` du harness (`harness/main/index.ts`) sont des
valeurs de test en clair (`bench-secret`, `bench-service-role-key`), sans
rapport avec un environnement réel.
