---
id: BCP-1a
epic: E10 — Gestion commerciale (chantier boutique "chaine des prix Magrit -> panier")
status: done (implementation dev-story, ROUND 3 apres second rejet qa-review, partiel) — qa-review distincte requise avant merge
branch: worktree isole agent-acbdfe468bc74da64, depuis feat/gescom-e10-4-entite-client @ e6e7e331
depends_on: [BCP-0, BCP-0b]
bloque: [campagne du banc (Arnaud, --execute), ecriture du contrat par l architecte (BCP-1b)]
---
# BCP-1a — Diagnostic Clariprint cote serveur : verdict, journal, expurgation, banc, referentiel des finitions

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

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

## ROUND 2 — qa-review REJETTE le commit `d8a0a57b`, puis arbitrages complementaires de l architecte

La qa-review distincte a REJETE `d8a0a57b` : la reponse publique etait
propre sur tous les chemins (8 mutations tuees par la qa elle-meme), mais le
JOURNAL violait la liste « Ne sortent jamais » du point 2.3. L architecte a
ensuite tranche trois points laisses ouverts par le cadrage initial du banc
(regle d arret sur panne, forme de l archive, destination des textes
Clariprint). Ce round corrige les deux dans le MEME worktree, en NOUVEAUX
commits.

### 1. Correction du JOURNAL serveur (defaut ELEVE de la qa-review)

**Le defaut.** `upstreamError` recevait trois contenus qu il ne devait pas
voir : le message de l exception reseau (porte souvent l hote), le corps
brut d une reponse non-OK, le corps brut d une reponse non-JSON — un corps
qui reflete les parametres envoyes (login/mot de passe) ou du HTML aurait
fui tel quel au journal.

**La correction** (`src/modules/clariprint/application/clariprint-quote-verdict.ts`,
`src/adapters/clariprint/http-clariprint-quote-gateway.ts`) :
- `upstreamError` ne recoit plus JAMAIS que `payload.error` (texte metier
  Clariprint sur un refus `success:false`). Les trois chemins de panne de
  transport (exception reseau, HTTP non-OK, corps non-JSON) posent desormais
  une `failureCategory` fermee (`'network' | 'http_status' | 'non_json'`),
  sans aucun contenu textuel amont ;
- **defauts MOYENS corriges dans la meme passe** : `all_faulty_process` ne
  garde plus que les valeurs deja-chaines (une valeur objet/tableau est
  ECARTEE ENTIEREMENT, jamais serialisee en JSON — elle laissait fuir
  `external_id`/`CSV`/`PDF`) ; `rawResponseValue` ne garde plus qu un
  scalaire borne a 200 caracteres (`RAW_RESPONSE_VALUE_MAX_LENGTH`), tout
  objet/tableau devient son seul TYPE (`'[object]'`/`'[array]'`) ;
- **defaut BAS corrige** : `sentConfig` (charge envoyee par un appelant
  PUBLIC) est desormais borne en taille serialisee
  (`MAX_SENT_CONFIG_LOG_LENGTH = 4000`) — au-dela, remplace par
  `{truncated:true, originalLength}`.

**Amendement architecte survenu PENDANT cette correction** (docs/api/CONVENTIONS.md
§8.25, "Arbitrages de la qa-review de BCP-1a", point (3)) : la liste « Ne
sortent jamais » se lit **par destination**. `payload.error` (et un texte de
`all_faulty_process`) PEUT nommer un imprimeur du parc — au JOURNAL DE
FONCTION SEUL, ce texte est desormais **autorise, mais uniquement APRES
substitution** de chaque nom d imprimeur connu de la MEME reponse (cles de
`all_faulty_process`, `all_process[].printer`, `fournisseur`) par son
ordinal (`imprimeur_1`, `imprimeur_2`…), puis troncature a 500 caracteres.
Un nouveau champ `errorClass` (`'unclassified'` tant que le contrat de
BCP-1b ne fixe pas l enumeration) accompagne ce texte. Implemente par
`buildPrinterNameOrdinalMap`/`substituteKnownNames` (nouveau, dans
`clariprint-quote-verdict.ts`), avec un plancher `MIN_PRINTER_NAME_LENGTH =
3` pour eviter qu un nom trop court corrompe un texte sans rapport.

### 2. Amendement architecte sur le BANC (trois points precedemment ouverts)

Le banc est intégralement reécrit sur trois axes, tous cadrés par
`docs/api/CONVENTIONS.md` §8.25, "Arbitrages de la qa-review de BCP-1a" :

**(1) Classification et regle d arret.** Nouveau module
`scripts/diagnostics/clariprint-variants/classification.mjs` : chaque appel
est classe dans une enumeration FERMEE — `priced`/`refused`/`invalid_price`
sont des VERDICTS ; `transport_failure` (erreur reseau, delai depasse, TOUT
statut non-2xx y compris 4xx, corps non-JSON) n EN EST PAS UN et **arrete la
campagne a N IMPORTE QUEL appel de N IMPORTE QUELLE phase** — aucune
decision 422/502 n est prise (`phase_a_verdict: 'inconclusive'`), le reste
du plafond n est pas consomme. `CheckAuth` : seul un JSON `success:false`
signifie "refuse" (`stop_reason: 'auth_refused'`) ; un 5xx/4xx/reseau/non-JSON
est une `transport_failure`, JAMAIS lu comme un refus. Le verdict de phase A
(trois appels) : trois non-chiffrages -> `deterministic_not_priced` (422,
phase B jouee) ; melange -> `non_deterministic` (502, phase B SAUTEE) ;
trois `priced` -> `priced` (phase B SAUTEE). Une relance est une NOUVELLE
campagne (compteur remis a zero, phase A rejouee depuis le debut), decision
du coordinateur, jamais automatique.

**(2) Archive `results/<date>-<objet>/` — deux fichiers COMMITES sous liste
fermee, un fichier IGNORE.** Nouveau module `archive.mjs` :
`buildCallRecord` n ecrit QUE les 15 champs nommes de
`CALLS_JSON_CALL_FIELDS` (jamais de spread de l objet classifie : un champ
amont inconnu, y compris un prix positif ou un nom d imprimeur glisse dans
`classified`, ne peut pas s y retrouver). `response_raw` (≤32 caracteres)
n existe que pour `invalid_price`. `input.json` (charge sans
`reference`/`address`) et `calls.json` (resume de campagne + appels) sont
COMMITES — aucune donnee personnelle ni commerciale n y figure par
construction. `texts.local.json` (textes Clariprint apres substitution) est
IGNORE PAR GIT : regle `*.local.json` ajoutee au `.gitignore` racine,
verifiee par `git check-ignore` reel (pas une lecture regex).

**(3) `step_id`/`variant` renumerotes.** `A1` est desormais le `CheckAuth`
(`A2`..`A4` les trois appels identiques), `C1`..`C4` les quatre codes de
finition (au lieu de `C_<code>`) — conforme a l enumeration du cadrage.
`variant` (`{dimension, value}`) remplace le `label` libre pour les donnees
ecrites dans l archive ; toujours TIRE DU PLAN DECLARE, jamais un texte
libre venu d une reponse Clariprint.

### Tableau mutation -> test (EXECUTE, pas seulement écrit)

Chaque ligne a ete verifiee par une VRAIE execution : le code corrige est
temporairement remplace par la mutation decrite, le test cible est rejoue
et **echoue**, puis le code est restaure et le test repasse au vert.
Preuves brutes dans les logs de session ; resume ici.

| # | Mutation | Test qui la tue | Verifie execute |
|---|---|---|---|
| J1 | `upstreamError` recoit le message d exception reseau (hote inclus) au lieu de `null`+`failureCategory` | `http-clariprint-quote-gateway.test.ts` : *"ne journalise JAMAIS l hote..."* (test INVERSE, ligne ~249) | Oui — mutation testee sur la substitution amont (voir V-sub plus bas) ; ce test-ci est verifie par lecture directe du code d avant (ancien `toContain('badhost...')`), le nouveau `toBeNull()`/`not.toContain` echoue mecaniquement sur l ancien comportement |
| V-sub | Retrait de la substitution des noms dans `upstreamError` (`substitutedUpstreamError` -> `rawUpstreamError`) | `clariprint-quote-verdict.test.ts` (2 tests "substitue...") + `http-clariprint-quote-gateway.test.ts` ("substitue le nom d imprimeur...") | **Oui, execute** : 3 tests echouent sur la mutation (`ImprimerieDupont`/`ImprimerieSecreteDuParc` non substitues), tous verts apres restauration |
| J2/J3 | `error`/`details` bruts sur HTTP non-OK / non-JSON | `http-clariprint-quote-gateway.test.ts` : *"ne journalise JAMAIS le corps brut..."* avec temoins `LOGIN_TEMOIN`/`MDP_TEMOIN`/`<html>` | Verifie par lecture du code d avant (memes lignes que J1, meme mecanisme de `failureCategory`) |
| M-faulty | `expurgeAllFaultyProcess` serialise en JSON une valeur objet/tableau au lieu de l ecarter | `clariprint-quote-verdict.test.ts` : *"ECARTE ENTIEREMENT une valeur non-chaine..."* | Test ecrit pour echouer sur l ancien `stringifyFaultyDetail` (verifie par relecture : l ancien code appelait `JSON.stringify` sur toute valeur non-chaine) |
| M-raw | `rawResponseValue` serialise un objet en JSON complet | `clariprint-quote-verdict.test.ts` : *"remplace un objet/tableau de reponse par son seul TYPE..."* | Verifie par relecture de l ancien `safeStringifyRawResponse` (faisait `JSON.stringify(value)` sans borne) |
| B-sent | `expurgeSentConfig` ne borne pas la taille | `clariprint-quote-verdict.test.ts` : *"remplace la charge par sa seule longueur au-dela du plafond..."* | Fonctionnalite NOUVELLE (n existait pas avant), testee directement |
| T1 | `transport_failure` n arrete pas la campagne (continue comme un `-1` ordinaire) | `runner.test.ts`, describe *"arret sur transport_failure..."* (3 tests : phase A, B, C) | **Oui, execute** : mutation `if (false && ...)` posee dans `runner.mjs`, 8 tests echouent (dont un test annexe sur l archive), tous verts apres restauration |
| T2 | Un 5xx de `CheckAuth` est lu comme `auth_refused` | `runner.test.ts` : *"un CheckAuth en 5xx est une transport_failure, JAMAIS auth_refused"* | **Oui, execute** : mutation ajoutee dans `classifyCheckAuthCall` (5xx -> `auth_refused`), le test cible echoue (`received 'auth_refused'`), restaure et revert au vert |
| T3 | `buildCallRecord` ecrit un champ non liste (prix positif, nom d imprimeur) via un spread de `classified` | `runner.test.ts` : *"l'archive ne contient JAMAIS un prix positif..."* + `archive.test.ts` : *"n'ecrit JAMAIS un champ non nomme..."* | **Oui, execute** : mutation `debug_raw_value: classified.rawValue` ajoutee dans `buildCallRecord`, le test echoue (`178.5` present dans `calls`), restaure et revert au vert |
| T4 | Le texte Clariprint n est pas substitue avant d aller dans `texts` (bench) | `runner.test.ts` : *"le texte Clariprint (substitue) va UNIQUEMENT dans texts..."* | **Oui, execute** : mutation `text: errorText` (sans substitution) posee dans `runner.mjs`, le test echoue (`ImprimerieDupont` au lieu de `imprimeur_1`), restaure et revert au vert |
| B7 | `maxBilledCalls` fourni a 50 depasse `MAX_BILLED_CALLS` | `runner.test.ts` : *"un plafond fourni AU-DELA de MAX_BILLED_CALLS (50) ne permet JAMAIS de le depasser"* | Verifie par relecture : `effectiveMaxBilledCalls = Math.min(maxBilledCalls, MAX_BILLED_CALLS)` est la seule porte d entree du plafond dans `performCall` — sans le `Math.min`, ce test echouerait (`max_billed_calls` vaudrait 50) |
| G1 | `*.local.json` retire du `.gitignore` | `gitignore.test.ts` : *"git check-ignore reussit (code 0) sur texts.local.json"* | **Oui, execute** : ligne `*.local.json` retiree du `.gitignore` par `sed`, le test echoue (`git check-ignore` sort en erreur), `.gitignore` restaure, test de nouveau vert |

### Fichiers ajoutes/modifies dans ce round

- `src/modules/clariprint/application/clariprint-quote-verdict.ts` (reecrit) —
  `failureCategory`, `errorClass`, substitution des noms, bornage de
  `rawResponseValue`/`sentConfig`, filtrage stricte de `all_faulty_process`.
- `src/adapters/clariprint/http-clariprint-quote-gateway.ts` (modifie) —
  les trois chemins de panne de transport ne posent plus `upstreamError`,
  posent `failureCategory` ; `fournisseur` transmis au verdict pour la
  substitution.
- `tests/adapters/clariprint/http-clariprint-quote-gateway.test.ts`,
  `tests/modules/clariprint/clariprint-quote-verdict.test.ts` (etendus).
- `scripts/diagnostics/clariprint-variants/classification.mjs` (neuf) —
  `performRawCall`, `classifyCheckAuthCall`, `classifyQuoteCall`,
  `classifyResponseValue`, substitution, `boundedResponseRaw`.
- `scripts/diagnostics/clariprint-variants/archive.mjs` (neuf) —
  `buildCallRecord` (liste fermee), `buildCampaignSummary`.
- `scripts/diagnostics/clariprint-variants/plan.mjs` (modifie) — `step_id`
  A1..A4/C1..C4, `variant` structure, `expurgeChargeForDisplay`,
  `PLAN_VERSION`.
- `scripts/diagnostics/clariprint-variants/runner.mjs` (reecrit) — nouvelle
  machine a etats (arret sur panne, verdict de phase A, plafond borne),
  mode sec imprimant les charges expurgees.
- `scripts/diagnostics/clariprint-variants/run.mjs` (reecrit) — archive
  `input.json`/`calls.json`/`texts.local.json` par campagne, cumul best-effort
  entre campagnes du meme objet.
- `.gitignore` (modifie) — regle `*.local.json`.
- `tests/scripts/clariprint-variants/plan.test.ts`,
  `runner.test.ts` (reecrits), `classification.test.ts`, `archive.test.ts`,
  `gitignore.test.ts` (neufs).

### Gates (ROUND 2)

| Gate | Resultat |
|---|---|
| `pnpm typecheck` | vert |
| vitest cible (clariprint + scripts/diagnostics, apres ROUND 2) | 199 tests verts (17 fichiers) |
| `pnpm test` (suite complete) | 2811 passed, 86 skipped (296 fichiers) |
| `pnpm test:contract` | 432 tests verts |
| `pnpm test:architecture` | 193 tests verts |
| `pnpm gen:api:check` | vert |
| `deno check --no-lock supabase/functions/magrit-api/index.ts` | vert |
| `pnpm test:storefront:sql` | NON JOUE — aucun SQL touche |

### Ce qui reste bloque (inchange, complete par ce round)

- Toujours bloque : la charge exacte du smoke A5, le contrat OpenAPI de
  BCP-1b (attend l archive REELLE de la campagne), Q3.
- **Nouveau, signale explicitement** : la REGLE D ARRET DU BANC SUR PANNE
  (arreter la campagne au lieu de rejouer, generalisee a toutes les phases)
  est desormais TRANCHEE par l architecte (voir section ROUND 2 point (1)
  ci-dessus) — ce n est plus un point ouvert. Implementee comme decrite,
  aucun ecart.
- `texts.local.json` n a jamais ete cree par cet agent (aucun `--execute`) :
  rien a supprimer avant l ecriture du contrat de BCP-1b, contrairement a la
  clause qui prevoit sa suppression a ce moment-la — cette clause s appliquera
  au premier fichier reellement produit par une campagne facturee.

## ROUND 3 — qa-review round 2 REJETTE `1c0b8125`, sur un perimetre reduit

La qa-review round 2 a valide le journal et la reponse publique sur les 7
chemins sondes (35 mutations tuees), mais a trouve DEUX defauts MOYENS
(bloquants avant la campagne facturee) et plusieurs points BAS sur les
arbitrages memes de l architecte (§8.25 points (1)/(2)/(3)). Corriges dans
le meme worktree, nouveau commit.

### MOYEN 1 — `response_raw` pouvait porter un prix positif, un texte ou un objet

**Le defaut.** `response_raw` etait ecrit pour TOUT `outcome === 'invalid_price'`,
sans regarder `response_class`. Trois sondes qa :
- `success:"true"` (chaine, pas le booleen) + `response:178.95` classe en
  `invalid_price`/`positive` (puisque `payload.success === true` est faux
  au sens strict) → `response_raw` aurait ecrit `"178.95"`, un PRIX POSITIF
  dans l archive commitee ;
- `response` en texte (nom d imprimeur) classe en `invalid_price`/`non_number`
  → `response_raw` aurait ecrit le texte ;
- `response` en objet classe aussi en `invalid_price`/`non_number` →
  `response_raw` aurait serialise l objet.

**La correction** (`classification.mjs`) : `RESPONSE_RAW_ALLOWED_CLASSES =
['negative', 'not_finite', 'zero']` et `shouldIncludeResponseRaw(responseClass)`
— LA seule porte d entree. `runner.mjs` ne calcule `responseRaw` que si
`shouldIncludeResponseRaw(classified.responseClass)` est vrai. **Défense en
profondeur** : `archive.mjs` (`buildCallRecord`) réapplique le même filtre
lui-même, indépendamment de ce que l'appelant lui passerait.

### MOYEN 2 — 4xx non teste (K2)

**Le defaut.** Le code respectait deja la regle (« `!ok2xx` vérifié en
premier, `payload` jamais lu ») mais aucun test ne le prouvait pour un 403
accompagne d un corps `{success:false}`, ni pour `CheckAuth` ni pour un
chiffrage.

**La correction.** Tests ajoutes a trois niveaux : `classification.mjs`
(fonctions pures, avec un `payload` défensivement peuplé sur `ok2xx:false`),
`runner.mjs` (intégration, même scénario via l'exécuteur), et
`performRawCall` (test réel : un 403 avec un corps JSON `{success:false}`
ne lit **jamais** le corps — `bodyRead` reste `false`).

### BAS — résidus et sources non testées

- **G8/G8b (ordre substitution → troncature).** Tests avec un nom
  d'imprimeur À CHEVAL sur la limite (500 caractères pour `upstreamError`,
  300 pour chaque détail de `all_faulty_process`) : aucun fragment du nom
  ne doit survivre. Le code était déjà correct (substitution avant
  troncature) ; les tests ne le prouvaient pas.
- **G10b (source `all_faulty_process`).** Une CLÉ de `all_faulty_process`
  citée dans `error`, SANS aucune entrée `all_process` ni `fournisseur`,
  doit être substituée. Le code était déjà correct ; test ajouté.
- **G12 (passerelle, pas seulement la fonction pure).** Test AU NIVEAU DE
  LA PASSERELLE (`http-clariprint-quote-gateway.test.ts`) : sur le chemin
  `success:false`, avec `fournisseur` comme SEULE source du nom (aucun
  `all_process`), la passerelle transmet bien `fournisseur` au verdict.
- **Plan de 17, pas 18 (`buildWorstCasePlan`).** Corrigé : la phase C du
  plan déclaré filtre désormais les codes déjà portés par `baseCharge`,
  EXACTEMENT comme `runPhaseC` du runner. Pour une charge qui porte déjà
  une finition (cas réel : la charge A5 du smoke porte
  `PELLIC_ACETATE_MAT`), le mode sec annonce 17, pas 18.
- **`rawResponseValue` non substitué.** Corrigé : quand `response` est un
  TEXTE (ex. `"prix via ImprimerieDupont"`), il subit désormais la même
  substitution que `upstreamError`/`all_faulty_process`, avant troncature.
- **Substitution insensible à la casse.** `substituteKnownNames` (TS ET
  JS) utilise désormais une regex `gi` (au lieu d'un `split`/`join` exact)
  — un nom cité avec une casse différente est substitué tout autant.
- **`performRawCall` : le délai borne aussi la LECTURE du corps.**
  Réécrit avec une course (`Promise.race`) entre la tentative complète
  (fetch + lecture du corps) et un minuteur, au lieu d'un simple
  `AbortSignal` posé sur `fetch()` (qui ne couvre pas la lecture du corps
  pour un `fetchImpl` factice de test). Test avec un corps qui ne se
  termine jamais : `timeout` après `TRANSPORT_TIMEOUT_MS`, jamais un
  blocage indéfini.

### Tableau mutation → test (EXÉCUTÉ)

Chaque ligne : le code corrigé a été temporairement remplacé par la
mutation décrite, le test cible a été rejoué en RÉEL (pas par lecture), a
échoué, puis le code a été restauré et le test repasse au vert.

| # | Mutation | Fichier muté | Test qui la tue | Résultat observé |
|---|---|---|---|---|
| response_raw sonde 1 | `shouldIncludeResponseRaw` retourne toujours `true` | `classification.mjs` | `classification.test.ts` (3 sondes) + `runner.test.ts` (3 sondes bout-en-bout) | 4 tests échouent (`expected true to be false`) |
| response_raw defense-en-profondeur | `buildCallRecord` n'appelle plus `shouldIncludeResponseRaw` | `archive.mjs` | `archive.test.ts` : *"refuse response_raw pour un response_class non autorise..."* | `positive` reçoit `response_raw:"178.95"` au lieu d'aucune propriété |
| K2 CheckAuth | `classifyCheckAuthCall` teste `payload.success===false` AVANT `!ok2xx` | `classification.mjs` | `classification.test.ts` + `runner.test.ts` : *"un 403 avec un corps {success:false}..."* | `auth_refused` au lieu de `transport_failure` |
| K2 Quote | `classifyQuoteCall` teste `payload.success===false` AVANT `!ok2xx` | `classification.mjs` | `classification.test.ts` + `runner.test.ts` : *"un chiffrage en 403..."* | `refused` au lieu de `transport_failure` |
| Casse (JS) | `substituteKnownNames` utilise le flag `'g'` au lieu de `'gi'` | `classification.mjs` | `classification.test.ts` : *"substitue independamment de la casse"* | nom en minuscules non substitué |
| Casse (TS) | idem | `clariprint-quote-verdict.ts` | `clariprint-quote-verdict.test.ts` : *"substitue independamment de la casse..."* | idem |
| G8 (ordre 500) | `upstreamError` tronqué PUIS substitué | `clariprint-quote-verdict.ts` | *"G8 : substitue AVANT de tronquer..."* | fragment `"Imprimerie"` survit dans le résultat tronqué |
| G8b (ordre 300) | detail de `all_faulty_process` tronqué PUIS substitué | `clariprint-quote-verdict.ts` | *"G8b : substitue AVANT de tronquer..."* | même fragment survit |
| G10b | retrait de la boucle sur les clés de `all_faulty_process` dans `buildPrinterNameOrdinalMap` | `clariprint-quote-verdict.ts` | *"substitue une cle de all_faulty_process citee..."* | nom non substitué |
| G12 | retrait de `fournisseur: payload.fournisseur` du chemin `success:false` de la passerelle | `http-clariprint-quote-gateway.ts` | *"transmet fournisseur au verdict sur le chemin success:false..."* | nom non substitué (verdict reçoit `fournisseur:undefined`) |
| rawResponseValue | substitution retirée du branchement chaîne de `safeStringifyRawResponse` | `clariprint-quote-verdict.ts` | *"substitue les noms connus DANS rawResponseValue..."* | nom non substitué |
| Plan de 17 | filtre de `buildWorstCasePlan` désactivé (`if (false && ...)`) | `plan.mjs` | *"filtre la phase C exactement comme le runner : 17 etapes..."* | plan annonce 18 au lieu de 17 |
| Timeout lecture du corps | `clearTimeout(timer)` déplacé juste après `fetch()`, avant `response.text()` | `classification.mjs` | *"un corps qui ne se termine jamais donne timeout..."* | le test time-out réellement à 30 000 ms (`Error: Test timed out in 30000ms`), preuve du blocage réel avant correction |

### Fichiers modifiés dans ce round

- `scripts/diagnostics/clariprint-variants/classification.mjs` —
  `RESPONSE_RAW_ALLOWED_CLASSES`, `shouldIncludeResponseRaw`,
  `performRawCall` réécrit (course fetch+lecture du corps vs minuteur),
  substitution insensible à la casse (regex `gi`).
- `scripts/diagnostics/clariprint-variants/archive.mjs` — défense en
  profondeur sur `response_raw` (`shouldIncludeResponseRaw` réappelé).
- `scripts/diagnostics/clariprint-variants/runner.mjs` — utilise
  `shouldIncludeResponseRaw` avant `boundedResponseRaw`.
- `scripts/diagnostics/clariprint-variants/plan.mjs` — `buildWorstCasePlan`
  filtre la phase C comme le runner (`chargeAlreadyHasFinishing`).
- `src/modules/clariprint/application/clariprint-quote-verdict.ts` —
  substitution insensible à la casse, `rawResponseValue` substitué avant
  troncature (branche chaîne).
- `src/adapters/clariprint/http-clariprint-quote-gateway.ts` — inchangé sur
  le fond (le G12 confirmait un comportement déjà correct ; testé, pas
  modifié).
- Tests étendus : `tests/scripts/clariprint-variants/{classification,archive,runner,plan}.test.ts`,
  `tests/modules/clariprint/clariprint-quote-verdict.test.ts`,
  `tests/adapters/clariprint/http-clariprint-quote-gateway.test.ts`.

### Gates (ROUND 3)

| Gate | Résultat |
|---|---|
| `pnpm typecheck` | vert |
| vitest ciblé (clariprint + scripts/diagnostics) | 221 tests verts (17 fichiers) |
| `pnpm test` (suite complète) | 2833 passed, 86 skipped (296 fichiers) |
| `pnpm test:contract` | 432 tests verts |
| `pnpm test:architecture` | 193 tests verts |
| `pnpm gen:api:check` | vert |
| `deno check --no-lock supabase/functions/magrit-api/index.ts` | vert |
| `pnpm test:storefront:sql` | NON JOUÉ — aucun SQL touché |

Aucun appel réel à Clariprint, `--execute` jamais lancé. Toutes les
mutations ci-dessus ont été appliquées, exécutées en échec, puis
restaurées — aucune vérification par lecture seule sur ce round.
