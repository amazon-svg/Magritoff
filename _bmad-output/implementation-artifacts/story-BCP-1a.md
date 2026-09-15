---
id: BCP-1a
epic: E10 — Gestion commerciale (chantier boutique "chaine des prix Magrit -> panier")
status: done (implementation dev-story) — qa-review distincte requise avant merge
branch: worktree isole agent-acbdfe468bc74da64, depuis feat/gescom-e10-4-entite-client @ e6e7e331
depends_on: [BCP-0, BCP-0b]
bloque: [campagne du banc (Arnaud, --execute), ecriture du contrat par l architecte (BCP-1b)]
---
# BCP-1a — Diagnostic Clariprint cote serveur : verdict, journal, expurgation, banc, referentiel des finitions

Cadrage opposable : `docs/api/CONVENTIONS.md` §8.25, point **2.3** (BCP-1a),
et la ligne BCP-1a du decoupage (~ligne 4886). **Aucun changement de contrat,
aucun changement de forme de la route** `POST /api/v1/clariprint/quote` :
les memes champs existent, mais leur CONTENU est desormais expurge.
`openapi/magrit-core.v1.yaml` n a pas ete touche (point 2.1 : le contrat
E10 s ecrit APRES la campagne du banc, par l architecte, jamais par
dev-story).

## Ce qui est livre

### 1. Le verdict et le journal (point 2.3, "Conserver"/"Journaliser")

| Element | Detail |
|---|---|
| `src/modules/clariprint/application/clariprint-quote-verdict.ts` (neuf) | Type `ClariprintQuoteVerdict` (statut HTTP amont, `success` amont, erreur amont tronquee a 500 caracteres, `response` brut serialise en chaine, nombre d entrees de `all_process`, `all_faulty_process` EXPURGE, duree en ms, charge envoyee EXPURGEE) + fonctions PURES testees cas par cas : `truncateUpstreamError`, `countAllProcessEntries`, `expurgeAllFaultyProcess` (cles -> ordinal `imprimeur_1..20`, 300 caracteres/detail), `expurgeSentConfig` (retire `reference`/`address` a toute profondeur), `buildClariprintQuoteVerdict`, `logLevelForOutcome` (`info`/`warn`/`error`). Expurgation **par liste autorisee** (tout champ amont non liste est retenu, jamais recopie). |
| `src/modules/clariprint/application/clariprint-quote-logger.ts` (neuf) | Port `ClariprintQuoteLogger` injecte (`log(entry)`), `noopClariprintQuoteLogger` par defaut. Testable sans `console`. |
| `src/adapters/clariprint/http-clariprint-quote-gateway.ts` (modifie) | `quote(command, requestId?)` : construit un verdict a CHAQUE reponse (succes compris), le journalise via le port injecte avec l outcome (`priced`/`not_priced`/`unavailable`/`not_configured`), et rend une reponse publique EXPURGEE — voir §2. |
| `src/modules/clariprint/application/clariprint-quote-gateway.ts` (modifie) | Interface `quote(command, requestId?)` : parametre optionnel ajoute, retro-compatible (les fakes a 1 argument des tests existants restent valides). |
| `src/modules/clariprint/application/clariprint-service.ts` (modifie) | `quote(command, caller, requestId?)` relaie `requestId` au gateway, apres consommation du budget (BCP-0b, inchange). |
| `src/server/api/clariprint-routes.ts` (modifie, 1 ligne) | `service.quote(command, caller, context.requestId)` — c est l en-tete `X-Request-Id` deja pose par la facade historique (`api-v1-handler.ts:185`). |
| `supabase/functions/magrit-api/index.ts` (modifie) | `consoleClariprintQuoteLogger()` : seule composition concrete du port (`console.info`/`warn`/`error` selon `logLevelForOutcome`), cablee en 5e argument de `HttpClariprintQuoteGateway`. |

### 2. L expurgation — fermeture de la dette qa de BCP-0 (point 2.3)

Avant ce lot, `http-clariprint-quote-gateway.ts` recopiait du texte brut vers
l appelant anonyme de cette route publique, a quatre endroits (lignes 22 a
30 de l ancienne version) :
- une exception reseau (`catch`) posait `details: error.message.slice(0,
  500)` — **l hote Clariprint apparait couramment dans ce message**
  (`getaddrinfo ENOTFOUND <hote>`) ;
- un HTTP non-2xx posait `details: text.slice(0, 500)` — le corps brut de
  la reponse amont, un extrait de reponse au sens du cadrage ;
- une reponse non-JSON posait `details: text.slice(0, 300)` — idem ;
- un refus Clariprint (`payload.success === false`) posait
  `error: payload.error` — **le texte brut d erreur de Clariprint tel
  quel**.

**Ces quatre chemins sont desormais generiques** : le texte brut (host
compris) ne va plus qu au VERDICT journalise (retrouvable par
`request_id`), jamais a la reponse. Chaque chemin garde le meme champ
(`error`, parfois `credentialsMissing`/`message`) mais son contenu est une
phrase fixe :
- exception reseau -> `error: 'Connexion Clariprint impossible'` (plus de
  `details`) ;
- HTTP non-2xx -> `error: 'Clariprint injoignable ou en erreur'` (plus de
  `details`) ;
- non-JSON -> `error: 'Réponse Clariprint invalide (non-JSON)'` (plus de
  `details`) ;
- refus Clariprint -> `error: 'Erreur de calcul Clariprint'` (le texte brut
  de Clariprint ne sort plus).

Les deux chemins de prix invalide (negatif / NaN-absent) gardaient deja un
message generique pour `error`, mais posaient un `details` avec un extrait
de la valeur recue (`priceHT brut recu: ...`) : retire de meme, conserve
dans le verdict (`rawResponseValue`).

**"aucun changement de forme de la route"** : les noms de champs du schema
(`error`, `details`, `credentialsMissing`, `message`, `priceHT`, `costs`,
`fournisseur`, ...) sont inchanges — seul le contenu de `error`/`details`
sur les chemins d echec est desormais generique. Le champ `details` n est
plus jamais peuple par ce gateway (le schema le garde optionnel pour ne pas
casser un futur appelant qui le lirait).

### 3. Le referentiel des finitions (point 5.3, cree en BCP-1a pour BCP-2/BCP-7)

| Element | Detail |
|---|---|
| `src/modules/clariprint/application/clariprint-finishing-codes.ts` (neuf) | `CLARIPRINT_FINISHING_LABELS` (les 5 valeurs du prompt : `""`, `PELLIC_ACETATE_BRILLANT`, `PELLIC_ACETATE_MAT`, `OFFSET_SATIN`, `UVS_MAT_RESERVE`), `getClariprintFinishingLabel(code)` (code inconnu ou vide -> `null`, JAMAIS affiche brut), `formatClariprintFinishingLabel(codes)` (combinaison jointe par `" + "`, ou `null` si aucun code connu). |

### 4. Le banc de rejeu (point 2.3, "Le banc de rejeu")

**Instrument, pas une capacite** : ni un endpoint, ni un rejeu automatique
en production. Vit hors de `src/` (script operationnel, comme
`scripts/run-quality-audit.mjs`) — **hors perimetre de `pnpm typecheck`**
(voir "Derogations" plus bas), teste par vitest directement sur les
fichiers `.mjs` (Vite/Vitest transpile du JS sans configuration
supplementaire).

| Element | Detail |
|---|---|
| `scripts/diagnostics/clariprint-variants/plan.mjs` (neuf) | Donnee PURE, sans E/S : `MAX_BILLED_CALLS = 18` (Q7, constante ecrite dans le code), `PHASE_A_REPEAT_COUNT = 3`, `PHASE_B_VARIANTS` (10 transformations, dans l ordre du soupcon B1..B10 du tableau du point 2.3), `PHASE_C_FINISHING_CODES` (les 4 codes du referentiel, recopies en donnee declarative car ce dossier n importe pas de TS), `buildWorstCasePlan(baseCharge)` (18 etapes exactement dans le pire cas), `chargeAlreadyHasFinishing`, `withFinishingCode`. |
| `scripts/diagnostics/clariprint-variants/runner.mjs` (neuf) | `buildDryRunReport(baseCharge)` — signature a 1 seul argument, ne peut PAS recevoir de fonction reseau : preuve structurelle qu aucun appel ne peut en sortir. `runClariprintVariantsBench({baseCharge, callCheckAuth, callQuote, archive, maxBilledCalls})` — execution reelle : compteur incremente AVANT chaque appel (`CheckAuth` compris), refuse le 19e (`BilledCallCapExceededError`), archive apres CHAQUE appel, applique les regles d arret exactes du tableau du point 2.3 (CheckAuth refuse -> 1 appel ; prix obtenu au moins 1 fois en phase A -> non-deterministe, B SAUTEE, base de C = charge de depart ; 3 echecs identiques -> phase B, arret au 1er succes ; 10 echecs -> fin de campagne a 14 appels, pas de C ; phase C filtre les codes deja portes par la base gagnante). |
| `scripts/diagnostics/clariprint-variants/run.mjs` (neuf) | CLI. Mode sec PAR DEFAUT (`buildDryRunReport`, imprime le plan/JSON, **aucun** `fetch`). `--execute` (jamais lance par cet agent) exige les identifiants dans l environnement (`CLARIPRINT_HOST`/`CLARIPRINT_LOGIN`/`CLARIPRINT_PASSWORD`, jamais dans le depot) et `--charge <fichier.json>` **obligatoire dans les deux modes** — cet outil n invente AUCUNE charge : `--charge` doit contenir la capture reseau reelle du smoke du 15/09 (A5, "flyers A5 recto-verso"), qui n existe pas dans le depot (voir "Ce qui reste bloque"). Parle a Clariprint EN DIRECT (pas via `HttpClariprintQuoteGateway`) : c est un instrument de diagnostic, pas un appelant de production. Archive JSON sous `results/<date>-<objet>.json`, ecrite apres chaque appel. |
| `scripts/diagnostics/clariprint-variants/results/.gitkeep` (neuf) | Dossier d archivage vide, versionne (le contenu des campagnes ne l est pas — a committer separement si Arnaud le souhaite). |

## Tests

- `tests/adapters/clariprint/http-clariprint-quote-gateway.test.ts` (etendu,
  18 tests dont 2 anciens reecrits + 7 nouveaux) :
  - les deux tests "dette BCP-1a documentee" de l ancienne version (HTTP
    non-OK, non-JSON) sont REECRITS : ils affirment desormais l ABSENCE de
    l extrait de reponse et l egalite stricte avec le message generique
    (ils echouaient sur le code d avant : `toEqual` avec le message generique
    est faux tant que `details` porte l extrait brut) ;
  - nouveau test dedie a la fuite de l hote/texte d exception reseau
    (`serialized).not.toContain('badhost.clariprint.invalid')`) ;
  - test etendu sur le refus Clariprint : le texte amont
    (`W_UPSTREAM_ERROR_TEXT_1`) ne sort plus, `toEqual` strict sur
    `{success:false, error:'Erreur de calcul Clariprint'}` ;
  - 8 nouveaux tests sur le verdict journalise via un logger espion : outcome
    correct par chemin (`priced`/`not_priced`/`unavailable`/`not_configured`),
    le texte amont tronque et l hote **presents dans le verdict** (preuve
    que le diagnostic n est pas perdu, seulement deplace), expurgation de
    `all_faulty_process` (ordinal, jamais le nom reel) et de `sentConfig`
    (`reference`/`address` retires a toute profondeur).
- `tests/modules/clariprint/clariprint-quote-verdict.test.ts` (neuf, 17 tests) —
  chaque fonction pure testee cas par cas : troncature a 500, plafond de 20
  entrees / 300 caracteres sur `all_faulty_process`, retrait profond de
  `reference`/`address`, serialisation `-1` en chaine, niveaux de log.
- `tests/modules/clariprint/clariprint-finishing-codes.test.ts` (neuf, 9 tests) —
  les 5 codes connus, le masquage d un code vide/inconnu (avec la fixture
  historique `PELLIC_BRILL` citee par le cadrage), les combinaisons.
- `tests/scripts/clariprint-variants/plan.test.ts` (neuf, 13 tests) — `MAX_BILLED_CALLS
  === 18`, `buildWorstCasePlan` a EXACTEMENT 18 etapes reparties 4/10/4, l
  ordre B1..B10, les 4 codes de la phase C identiques (memes cles) a ceux du
  referentiel applicatif (`src/modules/clariprint/application/clariprint-finishing-codes.ts`)
  — comparaison croisee pour empecher toute divergence silencieuse entre la
  copie declarative du banc et le referentiel de production —, et chaque
  transformation B1-B10 verifiee individuellement.
- `tests/scripts/clariprint-variants/runner.test.ts` (neuf, 12 tests) —
  mode sec (signature a 1 argument, aucun `fetch` touche, plan annonce =
  plan reel), plafond (compteur incremente avant l appel, refus du
  19e, plafond par defaut 18 -> 14 appels sur une campagne qui echoue
  partout), ordre des phases et regles d arret (CheckAuth refuse, succes en
  phase A -> B sautee avec preuve par espion que les `apply` de B ne sont
  JAMAIS invoques, arret au 1er succes en B avec preuve que B4..B10 ne sont
  jamais appliquees, filtre de la phase C sur un code deja porte),
  archivage apres chaque appel.

**Preuve d echec sur le code d avant (methode §8, point 2).** Deux preuves
distinctes :
1. **Fuite (point 2 de ce document)** : les 3 tests "ne laisse fuir aucun
   detail interne..." / "ne transmet jamais...texte brut" ont ete rejoues
   mentalement contre le code lu en debut de story (lignes 22-30 de l
   ancienne version, citees ci-dessus) : `details: error.message.slice(...)`,
   `details: text.slice(...)` et `error: payload.error` y placent le texte
   temoin (`badhost.clariprint.invalid`, `W_UPSTREAM_ERROR_TEXT_1`) dans le
   JSON serialise — ces assertions `not.toContain(...)` echoueraient donc
   sur le code d avant. Les DEUX tests HTTP non-OK/non-JSON portaient deja
   dans le depot un commentaire explicite ("dette BCP-1a documentee") disant
   qu ils ne couvraient PAS encore ce point — preuve directe, dans
   l historique du depot lui-meme, que ce n etait pas verifie avant ce lot.
2. **Bug reel intercepte par les tests de ce lot** : la premiere version de
   `runner.mjs` ne passait pas `callQuote` a `runPhaseC` (`ReferenceError:
   callQuote is not defined`) — 4 tests de `runner.test.ts` ont echoue
   immediatement a l ecriture, avant tout commit. Corrige avant la
   premiere execution verte. C est la preuve empirique, sur ce lot meme,
   que les tests du banc ne sont pas vacuous.

## Gates executees

| Gate | Resultat |
|---|---|
| `pnpm typecheck` | vert (`tsc -p tsconfig.modular.json`, aucune erreur) |
| vitest cible (clariprint + scripts/diagnostics) | 145 + 25 = 170 tests verts |
| `pnpm test` (suite complete) | 2757 passed, 86 skipped (293 fichiers), aucune regression |
| `pnpm test:contract` | 432 tests verts (aucune route E10 touchee) |
| `pnpm test:architecture` | 193 tests verts |
| `pnpm gen:api:check` | vert — `openapi/magrit-core.v1.yaml` non touche |
| `deno check --no-lock supabase/functions/magrit-api/index.ts` | vert |
| `pnpm test:storefront:sql` | NON JOUE — aucun SQL touche dans ce lot (aucune migration, aucune fonction Postgres) |

## Derogations R5 et choix assumes

- **`scripts/diagnostics/clariprint-variants/` est hors du perimetre de
  `pnpm typecheck`** (ni `tsconfig.json` ni `tsconfig.modular.json` ne
  l incluent). Choix delibere, coherent avec les scripts existants du meme
  dossier (`scripts/run-quality-audit.mjs`, `.mjs` egalement non
  type-checkes) : ce n est pas un module applicatif, c est un instrument
  operationnel hors E10. La discipline de test reste entiere (vitest
  execute directement les `.mjs`, cf. 25 tests verts). **Chemin de mise en
  conformite si Arnaud le souhaite** : ajouter
  `scripts/diagnostics/clariprint-variants` a l `include` d un
  `tsconfig` dedie (pas `tsconfig.modular.json`, dont le `strict` casserait
  probablement d autres scripts non concernes par ce lot).
- **`PHASE_C_FINISHING_CODES` est DUPLIQUE** (une fois dans le referentiel
  applicatif TypeScript, une fois en donnee declarative dans `plan.mjs`) car
  ce dossier hors-`src/` ne peut pas importer un module TypeScript sans
  outillage supplementaire (pas de `tsx`/`ts-node` dans le depot). Un test
  crise (`plan.test.ts`, "identiques a ceux du referentiel") compare les
  deux listes a chaque execution pour qu une divergence future echoue
  immediatement plutot que de se decouvrir a la campagne facturee.
- **Aucune derogation sur l expurgation** : le point 2.3 est traite dans son
  integralite (verdict, journal, expurgation par liste autorisee, banc,
  referentiel).

## Ce qui reste bloque

- **La charge exacte du smoke (A5, "flyers A5 recto-verso")** n existe dans
  aucun fichier du depot (verifie : `tests/server/smoke_acheteur_ai.test.ts`
  ne porte qu une fixture factice `{format:'A5', paper:'std'}`, pas la
  charge Clariprint reelle capturee au reseau le 15/09). Le banc EXIGE
  `--charge <fichier.json>` en entree (dans les deux modes, y compris le
  mode sec) precisement pour ne RIEN inventer a la place. **Action
  necessaire avant tout lancement, meme en mode sec avec une vraie charge** :
  Arnaud ou le coordinateur fournit ce fichier (capture DevTools/HAR du
  smoke, ou re-extraction depuis les logs de la session live si encore
  disponibles).
- **La campagne facturee n a pas ete executee** (interdiction explicite de
  cette story). Commande exacte a lancer par Arnaud, decrite sans etre
  executee :

  ```bash
  CLARIPRINT_HOST=<hote de production> \
  CLARIPRINT_LOGIN=<identifiant> \
  CLARIPRINT_PASSWORD=<mot de passe> \
  node scripts/diagnostics/clariprint-variants/run.mjs \
    --charge <chemin-vers-la-charge-A5-du-smoke.json> \
    --execute
  ```

  Nombre d appels attendu par phase (point 2.3) :
  - **Phase A : 4 au plus** (1 `CheckAuth` + 3 fois la charge A5, identique).
    Arret a 1 appel si `CheckAuth` est refuse.
  - **Phase B : jusqu a 10**, une variante a la fois (B1..B10), arret au
    PREMIER prix obtenu. **Sautee entierement** si la phase A a deja obtenu
    un prix au moins une fois (verdict non-deterministe).
  - **Phase C : jusqu a 4**, un appel par code de finition du referentiel
    NON DEJA PORTE par la charge de base retenue.
  - **Total : 18 appels au plus.** Chemin nominal si le 1er suspect est le
    bon : 4 + 1 + 4 = **9**. Si la phase A chiffre directement : 4 + 4 =
    **8**. Pire cas (cause introuvable en B) : 4 + 10 = **14**, sans phase
    C.
  - **A executer d abord en mode sec** (retirer `--execute`) pour verifier
    le plan et la charge avant toute depense reelle.
- **Q3 (dorure, soft-touch, qualite de papier par defaut) reste NON
  TRANCHEE** — aucun code n a ete invente pour ces options dans ce lot
  (aucun fichier de ce lot n en avait besoin : le normaliseur config -> charge
  est BCP-2, hors perimetre de BCP-1a).
- **Le contrat OpenAPI de la future operation E10** (BCP-1b) n est PAS ecrit
  par cette story : il attend l archive de la campagne facturee, et c est le
  role exclusif de l architecte (point 2.3, methode point 4).
- **La duree de retention des journaux de fonction Supabase** reste a
  verifier (reserve explicite du cadrage, point 2.3) avant de promettre
  qu un `request_id` donne se retrouve toujours au journal — hors perimetre
  de cette story (aucune action de verification ne portait sur ce lot).

## Ce qui n est PAS dans le perimetre

- **BCP-0 et BCP-0b** — non touches (verifie negativement : aucune migration,
  aucune fonction SQL, `clariprint-quote-budget.ts`/`clariprint-quote-rate-limit.ts`
  inchanges).
- **`openapi/` et `docs/api/CONVENTIONS.md`** — non touches (role exclusif de
  l architecte).
- **BCP-1b** (nouvelles operations `/api/v1/clariprint-quotes` et
  `/api/v1/public-shops/{shopSlug}/clariprint-quotes`, statuts HTTP
  differencies 422/502/503, retrait de la route historique) — hors
  perimetre, attend le contrat.
- **Aucun changement de statut HTTP** sur la route historique
  `POST /api/v1/clariprint/quote` : elle continue de repondre 200 avec
  `{success:false, ...}` sur un echec, exactement comme avant ce lot (point
  2.3 : "aucun changement de forme de la route"). La differenciation
  422/502/503 est le contrat de BCP-1b.
- **Aucun changement d ecran** : `ProductCardPrix.tsx` (atelier) affiche
  deja `clariprintQuote.details` de facon conditionnelle
  (`{clariprintQuote.details && (...)}`) — ce panneau ne s affiche
  simplement plus jamais sur cette route (le champ n est plus jamais
  peuple), sans qu aucune ligne de JSX n ait ete modifiee.
