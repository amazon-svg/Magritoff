---
id: E10.17b
epic: E10 — Gestion commerciale
status: done (qa-review round 1 "Changes Requested" traité)
branch: feat/gescom-e10-4-entite-client
depends_on: [E10.17a]
blocks: []
---
# E10.17b — Panneau de dépôt et gestion des fichiers sur la fiche commande

**Cette story a fait l'objet d'un round de `qa-review` "Changes Requested"**
(deux réserves bloquantes B1/B2, huit non bloquantes N1-N8), traité en
intégralité sauf N8 (hors ressort du dev-story, constat de process déjà
connu) — voir la section dédiée plus bas.

Second lot de la décomposition d'E10.17 (§8.19 §5 du contrat,
`docs/api/CONVENTIONS.md`). E10.17a (base + API, six opérations, migration,
RLS testée) n'avait **aucun effet observable** — c'est ce lot qui rend le
travail visible à l'imprimeur : bloc « Fichiers », troisième section de
`OrderDetailPage.tsx`, dépôt glisser-déposer avec barre de progression,
bascule de visibilité, suppression confirmée.

Wireframe **validé par Arnaud le 09/09/2026** :
`.design-handoff/wireframes/E10.17b-panneau-fichiers-commande.md`. Microcopie
FR reprise **mot pour mot** (§4), deux arbitrages tranchés en §6 respectés à
la lettre (Q1 — emplacement/gabarit, Q2 — pas de bandeau proactif au
plafond).

## Ce qui est livré

| Élément | Détail |
|---|---|
| Helpers purs | `src/modules/order-files/ui/order-files.helpers.ts` — `ORDER_FILES_COPY` (source **unique** de toute la microcopie du panneau, aucun texte littéral ailleurs), `validateOrderFileForUpload()` (extension via `resolveOrderFileContentType()` d'E10.17a, taille ≤ 50 Mo, compteur < 30, dans cet ordre — confort UX, **jamais** la seule barrière), `resolveOrderFileIconFamily()`, `formatOrderFileSize()`, `formatOrderFileDepositedAt()`/`formatOrderFileDepositedByLine()`. |
| Composant | `src/modules/order-files/ui/OrderFilesBlock.tsx` — zone de dépôt glisser-déposer + bouton « Parcourir », liste des fichiers (icône par famille, poids, auteur/date, bascule de visibilité, téléchargement, suppression), cartes d'envoi en cours avec barre de progression réelle et bouton « Réessayer » sans resélection, dialogue de confirmation de suppression (`AlertDialog` shadcn, même patron que `CancelOrderConfirmDialog`), menu de visibilité (`DropdownMenu` shadcn) avec avertissement **permanent et non masquable**. |
| Entrée publique du module | `src/modules/order-files/ui/index.ts` — exporte `OrderFilesBlock`, seul point d'import autorisé depuis `commercial-orders` (règle MUX). |
| Câblage | `src/modules/commercial-orders/ui/workspace/OrderDetailPage.tsx` — `<OrderFilesBlock orderId={order.id} />` ajouté comme **troisième section**, après « Lignes », import exclusivement par l'entrée publique `@/modules/order-files/ui`. |
| `data-testid` | `src/shared/presentation/testIds.ts`, scope `orderFiles` — `block: 'order-files-block'` posé **exactement** tel qu'exigé par le contrat (§8.19 §5 : « le `data-testid` `order-files-block` était volontairement non posé par E10.16 … c'est ce lot qui le déclare »). Quatorze autres testid déclarés au même endroit (`counter`, `dropzone`, `browseBtn`, `fileInput`, `emptyState`, `errorBanner`, `retryLoadBtn`, `row` + `data-file-id`, `rowError`, `retryUploadBtn`, `progressBar`, `missingObjectIcon`, `visibilityToggle`, `visibilityOption`, `visibilityWarning`, `downloadBtn`, `deleteBtn`, `deleteDialog`, `deleteConfirmBtn`, `deleteCancelBtn`). |
| Extension de l'existant (17a) | `src/modules/order-files/api/client.ts` — `uploadOrderFile()` accepte désormais un **quatrième paramètre optionnel** `onProgress?: (loaded, total) => void`. Sans lui : comportement **inchangé** (`fetch` nu, aucun appelant existant affecté, 17a n'avait aucune UI donc aucun appelant réel avant ce lot). Avec lui : dépôt par `XMLHttpRequest` (seule API navigateur qui expose un évènement de progression fiable sur le corps envoyé d'un `PUT`), même `Content-Type` posé depuis le nom de fichier (`resolveOrderFileContentType()`, jamais `File.type`), aucun import du SDK Supabase. |

## Périmètre de la sous-story, tenu point par point

1. **Bloc « Fichiers », testid `order-files-block`, troisième section, même gabarit visuel.** — **fait.** `OrderDetailPage.tsx` : `<section className="border border-line rounded-xl p-4 space-y-3" data-testid={TEST_IDS.orderFiles.block}>` (via `OrderFilesBlock`), positionné après la section « Lignes », classes strictement identiques aux deux sections existantes.
2. **Zone de dépôt glisser-déposer + « Parcourir », validation CLIENT immédiate (extension, taille ≤ 50 Mo, compteur < 30).** — **fait.** `validateOrderFileForUpload()` appelée avant tout appel réseau (`beginUpload()`), dans l'ordre du wireframe (format → taille → plafond). Testé unitairement (13 cas). Glisser-déposer natif HTML5 (`onDragOver`/`onDrop`) + `<input type="file" multiple>` caché déclenché par le lien « Parcourir ».
3. **Liste des fichiers déjà déposés** : icône par famille (PDF/image/archive), nom, taille, auteur/date, menu de bascule de visibilité avec avertissement permanent, icône téléchargement (URL signée en téléchargement forcé, nouvel onglet), icône suppression. — **fait.** `resolveOrderFileIconFamily()` + `FileFamilyIcon`, `formatOrderFileSize()`, `formatOrderFileDepositedByLine()` (« Déposé par vous… » si `file.deposited_by === actor.userId`, sinon `deposited_by_label`). Le téléchargement rouvre `download_url` (déjà **forcé** côté serveur par `download=<filename>`, décision #6 du contrat E10.17a) via `window.open(..., '_blank', 'noopener,noreferrer')` — jamais un rendu inline.
4. **Dialogue de confirmation de suppression**, texte exact, un seul bouton de confirmation. — **fait.** `AlertDialog` shadcn, même patron que `CancelOrderConfirmDialog` (S3.4) : « Annuler » / « Supprimer » (rouge, `bg-err-fg`), aucune saisie de type « tapez SUPPRIMER ».
5. **Barre de progression pendant le dépôt, état « Envoi en cours… », bouton « Réessayer » sans ressaisir le fichier.** — **fait.** `Progress` (shadcn/Radix) alimentée par une progression **réelle** (`XMLHttpRequest.upload.onprogress`, cf. extension du client ci-dessus — pas une barre indéterminée). Le `File` sélectionné reste en mémoire dans l'état du composant (`PendingUpload.file`) : `retryUpload()` relance le cycle **adapté à l'étape qui a échoué** depuis le round qa-review (voir B2/N2 ci-dessous) — plus systématiquement un cycle complet.
6. **Tous les messages d'erreur du wireframe §4.3, mot pour mot.** — **fait**, les sept messages sont dans `ORDER_FILES_COPY`, désormais **fixés en chaînes littérales indépendantes dans les tests** (qa-review N6) pour qu'une paraphrase future soit détectée : fichier trop volumineux, format non accepté, plafond de 30 atteint, échec réseau au dépôt, échec de confirmation, échec de suppression, échec de chargement de la liste. Deux messages **hors wireframe**, ajoutés par nécessité et signalés comme écarts : échec de la bascule de visibilité, échec de téléchargement (round qa-review, voir B1).
7. **Cas limite §4.4 — objet de stockage disparu** : ligne visible, icône d'alerte discrète, suppression toujours possible. — **fait, corrigé au round qa-review (B1, bloquant).** La version initiale désactivait **définitivement** le bouton de téléchargement au premier échec, quelle qu'en soit la cause (réseau, jeton expiré, 500 transitoire) — un fichier parfaitement sain devenait injoignable sans recharger toute la page. **Corrigé** : le bouton de téléchargement n'est **plus jamais désactivé** (un nouvel essai reste toujours possible), et `missingObjectIds` est **purgé à chaque rechargement de la liste** (`loadFiles()`, automatique après une action ou manuel via « Réessayer »). L'icône d'alerte reste **informative**, jamais une preuve : `listOrderFiles` ne signe aucune URL (contrat §8.19 §1), donc il est structurellement impossible de distinguer côté client un objet réellement disparu d'un aléa réseau — signalé explicitement en tête d'`OrderFilesBlock.tsx` comme un point qui nécessiterait, pour une distinction fiable, un code métier serveur dédié (ex. `order_file.object_missing`) à demander à l'architecte plutôt qu'à improviser côté client.

## qa-review round 1 (« Changes Requested ») → corrections

### B1 — BLOQUANT, impasse permanente sur un fichier sain après un simple aléa réseau → corrigé

**Constat de la qa-review, confirmé exact.** Le `catch {}` autour du
téléchargement marquait **n'importe quelle** erreur (coupure réseau, 500,
jeton expiré) comme « objet de stockage disparu », désactivait
définitivement le bouton de téléchargement, et rien — ni `loadFiles()`, ni
« Réessayer » — ne purgeait `missingObjectIds`. Un fichier parfaitement sain
devenait injoignable sans recharger toute la page.

**Corrigé selon la voie 1 proposée** (celle qui s'intègre le mieux, sans
attendre un ajustement de contrat) :
- `handleDownload()` ne pose plus **jamais** `disabled` sur le bouton de
  téléchargement — un nouvel essai reste toujours possible, et peut réussir
  si l'échec était transitoire.
- `loadFiles()` **purge** `missingObjectIds` (`setMissingObjectIds(new
  Set())`) à **chaque** rechargement, automatique (après un dépôt ou une
  suppression) ou manuel (« Réessayer » du bandeau d'erreur de liste).
- Un message distinct, hors wireframe (« Le téléchargement a échoué.
  Réessayez. », `ORDER_FILES_COPY.errorDownloadFailed`), est affiché en plus
  de l'icône d'alerte — qui reste, elle, purement informative.
- La voie 2 (code métier serveur dédié, ex. `order_file.object_missing`)
  **reste ouverte et signalée** en tête d'`OrderFilesBlock.tsx` : aucune
  distinction fiable n'est possible côté client tant que le contrat ne
  publie pas un code d'erreur qui discrimine un objet réellement absent
  d'un aléa quelconque — à demander à l'architecte si cette distinction
  devient un besoin réel.

### B2 — BLOQUANT, plafond de 30 fichiers affiché comme une erreur réseau avec un « Réessayer » qui ne peut jamais aboutir → corrigé

**Constat confirmé.** Les `catch {}` autour de l'émission du billet et de la
confirmation traitaient toute erreur serveur comme un échec réseau générique,
alors que `ApiClientError.problem.code` (déjà discriminé par
`DocumentTemplateFieldsPage.handleSave`, E10.10b-4b) permet de distinguer un
plafond atteint (`order_file.limit_reached`, 409) d'un objet refusé
(`order_file.rejected`, 422) d'un vrai échec réseau/500.

**Corrigé** : nouveau helper pur `describeOrderFileUploadFailure(cause,
fallbackMessage)` (`order-files.helpers.ts`), même discipline que
`DocumentTemplateFieldsPage` — `cause instanceof ApiClientError` puis
`problem.code`, jamais une inspection de texte :
- `order_file.limit_reached` → message dédié du wireframe (« Cette commande
  a atteint son maximum de 30 fichiers… »), `retryable: false` — le bouton
  « Réessayer » est **retiré** dans ce cas précis (`upload.retryable ===
  false` masque le bouton, seul « Fermer » reste proposé).
- `order_file.rejected` → réutilise le message de format non accepté
  (le plus juste côté imprimeur pour un objet refusé par le serveur),
  `retryable: true`.
- Tout le reste (réseau réel, 500 générique, erreur non `ApiClientError`) →
  message générique inchangé (`errorUploadNetwork`/`errorConfirmFailed`
  selon l'étape), `retryable: true`.

Testé unitairement (5 cas : plafond, rejeté, autre code `ApiClientError`,
erreur non-`ApiClientError`, distinction du message de repli par étape).

### N1 — commentaire trompeur sur la couverture du CA5 amendé d'E10.16 → corrigé

Le commentaire affirmait « CA5 — LIVRÉ PAR CE LOT » sans préciser que le CA5
amendé d'E10.16 demandait un groupement **par item** (`order_line_id`), que
ce lot ne rend pas (le wireframe validé par Arnaud ne le demandait pas —
donc pas un écart de design, mais un commentaire qui laissait croire à tort
qu'un CA plus large était intégralement couvert). **Corrigé** : le
commentaire d'en-tête d'`OrderDetailPage.tsx` dit maintenant explicitement
« panneau à l'échelle de la commande, groupement par item non rendu » et
signale le point à tracer côté Notion par le scribe.

### N2 — un « Réessayer » après échec de confirmation pouvait créer une ligne orpheline → corrigé

**Constat confirmé** : un réessai après un échec à l'étape de confirmation
réémettait un billet **neuf** avec une `Idempotency-Key` **neuve** — si la
confirmation avait en réalité réussi côté serveur mais que la réponse
s'était perdue, cela pouvait créer une seconde ligne pour le même fichier et
laisser un objet orphelin.

**Corrigé, coût jugé faible** : `PendingUpload` conserve désormais `ticket`
et `idempotencyKey` dès qu'ils sont obtenus. `retryUpload()` détecte
`failedStage === 'confirm'` et **rejoue uniquement la confirmation**, avec
le **même** billet et la **même** clé d'idempotence — aucun nouveau dépôt
d'octets, aucune seconde ligne possible. `OrderFilesApiClient.confirmUpload()`
accepte désormais un troisième paramètre optionnel `idempotencyKey` (sans
lui : comportement inchangé, une clé neuve est générée). Un échec au dépôt
(billet ou transport) continue, lui, de repartir d'un cycle complet — la
distinction est nécessaire, un nouveau billet implique un nouveau `file_id`.

### N3 — une carte d'upload en erreur consommait indéfiniment une place du plafond client → corrigé

**Corrigé** : bouton « Fermer » (`dismissUploadBtn`) ajouté sur toute carte
en erreur, qui retire la carte de `pendingUploads` — `currentFileCount()`
en tient compte immédiatement. Affiché systématiquement à côté de
« Réessayer » (ou seul quand `retryable === false`, cas du plafond atteint —
voir B2).

### N4 — littéral "Chargement…" hors de `ORDER_FILES_COPY` → corrigé

Déplacé dans `ORDER_FILES_COPY.loading`, utilisé tel quel dans le composant.

### N5 — "un membre du tenant" exposait du jargon interne → corrigé

`formatOrderFileDepositedByLine()` replie désormais sur « un membre de
l'espace » (vocabulaire déjà employé ailleurs dans le produit), plus jamais
« tenant ». Test mis à jour en conséquence.

### N6 — tests de microcopie tautologiques → corrigés

Les tests de `validateOrderFileForUpload()` comparaient le résultat à
`ORDER_FILES_COPY.errorXxx` lui-même — une paraphrase future des 7 messages
du wireframe n'aurait fait échouer aucun test. **Corrigé** : les 7 messages
du wireframe §4.3 sont désormais fixés en **chaînes littérales
indépendantes** en tête du fichier de test
(`tests/modules/order-files/order-files.helpers.test.ts`), comparées au
résultat des helpers — une modification du texte source dans
`order-files.helpers.ts` fait maintenant échouer le test tant que la chaîne
littérale du wireframe n'a pas, elle aussi, été mise à jour délibérément.

### N7 — deux écarts visuels mineurs avec le wireframe → corrigés

- **Zone de dépôt compacte quand des fichiers existent déjà** (écran B du
  wireframe) : la dropzone bascule désormais sur un rendu une ligne (« Déposez
  un fichier ici, ou Parcourir », sans icône ni sous-texte de formats/limites)
  dès que `files.length > 0 || pendingUploads.length > 0` ; la forme complète
  (écran A, icône + sous-textes) ne reste que pour l'état réellement vide.
- **Indicateur de sélection courante sur le menu de visibilité** (les ○/●
  de l'écran C) : remplacement de `DropdownMenuItem` par
  `DropdownMenuRadioGroup`/`DropdownMenuRadioItem` (Radix), `value` lié à
  `file.visibility` — la case cochée est maintenant visible nativement.

### N8 — non traité, sur instruction explicite

Convention « une story = une branche » non respectée sur ce sprint : constat
de process déjà connu et accepté, hors ressort de ce lot. Non touché.

## Écarts avec le wireframe, à signaler

- **Barre de progression réelle plutôt qu'un pourcentage possiblement indéterminé.** Le wireframe montre un exemple à 62 % sans préciser le mécanisme. `uploadOrderFile()` (E10.17a) reposait sur `fetch`, qui n'expose aucun évènement de progression fiable côté navigateur pour un `PUT`. **Extension** ajoutée à ce client (paramètre `onProgress` optionnel, bascule vers `XMLHttpRequest`) plutôt qu'une duplication de la logique de dépôt dans l'UI — le client reste la source unique du dépôt physique, conformément à `.claude/rules/frontend.md`. Aucun appelant existant affecté (17a n'avait aucune UI).
- **Détection de l'objet de stockage disparu, paresseuse et désormais purement informative** (point 7 ci-dessus, corrigé par B1) — conséquence directe du contrat (`listOrderFiles` ne signe rien) : aucun code d'erreur serveur ne distingue aujourd'hui un objet réellement disparu d'un aléa quelconque. Signalé explicitement dans le code comme nécessitant, pour aller plus loin, un ajustement de contrat par l'architecte — pas une dérogation prise dans ce lot.
- **Deux messages d'erreur hors wireframe §4.3** (aucun texte dédié prévu pour ces cas) : échec de bascule de visibilité (« Le changement de visibilité a échoué. Réessayez. ») et échec de téléchargement générique (« Le téléchargement a échoué. Réessayez. », ajouté au round qa-review B1) — à faire confirmer par Sally/Arnaud si des textes dédiés sont souhaités, n'affectent aucun message prescrit.
- **`updateVisibility` relit d'abord `getOrderFile`** (avec signature d'URL) pour obtenir l'`ETag` requis par `If-Match`, plutôt que d'utiliser l'endpoint interne `getRawById` (réservé au serveur, non exposé par le contrat HTTP — voir N6 d'E10.17a, qui l'a ajouté **côté serveur** précisément pour éviter ce coût sur `updateOrderFile`). Côté client, seul `getOrderFile`/`getForRead` est publié : un aller-retour Storage inutile est donc payé à chaque bascule de visibilité. Coût mineur (une bascule reste un geste rare), non bloquant, signalé pour trace.
- **Pas de modification d'`openapi/magrit-core.v1.yaml` ni de `docs/api/CONVENTIONS.md`** — aucun besoin constaté à ce stade ; B1 signale toutefois qu'un futur code d'erreur serveur dédié (`order_file.object_missing`) serait la voie propre si la distinction devient nécessaire.

## Tests exécutés (rejoués intégralement après correction, round qa-review inclus)

| Commande | Résultat |
|---|---|
| `pnpm typecheck` (modular, gate CI) | **vert**, 0 erreur |
| `pnpm typecheck:all` | Échecs **pré-existants**, sans rapport avec ce lot (fichiers `tests/modules/catalog`, `tests/modules/pricing`, `tests/server/roles-routes.test.ts`, `tests/utils/productEnrichment.test.ts`, etc. — aucun fichier créé/modifié par E10.17b n'y figure). Non un gate de ce dépôt (`package.json` : `pnpm typecheck` pointe sur `typecheck:modular` uniquement, c'est ce que la CI (`architecture.yml`) exécute). |
| `deno check supabase/functions/magrit-api/index.ts` | **vert**, 0 erreur (aucune modification serveur dans ce lot) |
| `pnpm gen:api:check` | **vert**, aligné (aucune modification d'`openapi/`) |
| `pnpm test:architecture` | **vert**, 34 fichiers / 146 tests (inchangé — ce lot respecte les frontières MUX : entrée publique `ui/index.ts` posée, aucun import profond inter-module, aucun import Supabase/`app`/`adapters` dans l'UI) |
| `pnpm test:contract` | **vert**, 18 fichiers / 329 tests (inchangé, aucun endpoint touché) |
| `tests/modules/order-files/order-files.helpers.test.ts` | **vert**, 44/44 (26 initiaux + **18 ajoutés au round qa-review** : 5 pour `describeOrderFileUploadFailure`, reste réparti sur la correction N5/N6 des assertions existantes et l'ajout de chaînes littérales indépendantes). |
| `pnpm vitest run tests/modules/order-files tests/modules/commercial-orders tests/architecture tests/data-testid.smoke.spec.ts` | **vert**, 39 fichiers / 230 tests en un seul run explicite |
| `pnpm test` (suite complète) | **1969 passés / 36 skip / 3 échecs pré-existants** (`tests/storage/product_mockups_isolation.test.ts`, projet Supabase distant, cause déjà établie par E10.10b-4a/E10.17a, sans rapport avec ce lot). +5 par rapport à la remise initiale de ce lot (les 5 tests de `describeOrderFileUploadFailure`). |

## Ce qui n'a pas pu être testé automatiquement — vérification manuelle requise

Aucun framework de test de composant React n'existe dans ce dépôt (précédent posé par E10.10b-4b) : seuls les helpers purs sont testés unitairement. **Restent à vérifier manuellement, sur un poste réel avec navigateur** :
- Le glisser-déposer HTML5 réel (`onDragOver`/`onDrop`), non simulable en test unitaire Node.
- Le rendu réel du panneau (dropzone, cartes, menu de visibilité, dialogue de suppression) et son intégration visuelle dans `OrderDetailPage.tsx`.
- La progression réelle de la barre pendant un dépôt (dépend du réseau et de la taille du fichier).
- Le comportement de `.zip` sur au moins deux systèmes d'exploitation différents pour le `Content-Type` posé par `resolveOrderFileContentType()` — consigne déjà signalée comme non mesurée par E10.17a, toujours vraie ici (aucun navigateur disponible dans cet environnement).
- Le déclenchement réel du cas §4.4 (objet de stockage disparu) — nécessite de supprimer manuellement un objet du bucket `commercial_order_files` en le laissant en base pour observer l'icône d'alerte (le bouton de téléchargement, depuis la correction B1, reste volontairement actif : à vérifier que le second essai échoue de la même façon, sans blocage définitif de l'interface).
- Le scénario concret décrit par la qa-review B2 (commande à 29 fichiers, dépôt simultané de 3 fichiers) — nécessite un serveur réel pour observer que le 409 `order_file.limit_reached` produit bien le message dédié sans bouton « Réessayer », et que les deux autres dépôts restent normalement rejouables.

## Fichiers créés/modifiés

**Créés (remise initiale)** :
- `src/modules/order-files/ui/order-files.helpers.ts`
- `src/modules/order-files/ui/OrderFilesBlock.tsx`
- `src/modules/order-files/ui/index.ts`
- `tests/modules/order-files/order-files.helpers.test.ts`

**Modifiés (remise initiale)** :
- `src/modules/order-files/api/client.ts` (paramètre `onProgress` optionnel sur `uploadOrderFile()`, bascule vers `XMLHttpRequest` quand fourni — comportement par défaut inchangé)
- `src/modules/commercial-orders/ui/workspace/OrderDetailPage.tsx` (troisième section `<OrderFilesBlock orderId={order.id} />`, en-tête de fichier mis à jour pour refléter CA5 comme livré)
- `src/shared/presentation/testIds.ts` (scope `orderFiles`, quinze testid dont `block: 'order-files-block'` exigé par le contrat)

**Modifiés au round qa-review (B1, B2, N1-N7)** :
- `src/modules/order-files/ui/OrderFilesBlock.tsx` (B1 : plus de `disabled` permanent sur le téléchargement, purge de `missingObjectIds` dans `loadFiles()` ; B2 : `runUpload`/`retryUpload` discriminent via `describeOrderFileUploadFailure`, bouton « Réessayer » masqué si `retryable === false` ; N2 : `PendingUpload` conserve `ticket`/`idempotencyKey`, reprise de la confirmation seule si `failedStage === 'confirm'` ; N3 : bouton « Fermer » (`dismissUploadBtn`) sur les cartes en erreur ; N4 : `ORDER_FILES_COPY.loading` ; N7 : dropzone compacte quand des fichiers existent, `DropdownMenuRadioGroup`/`DropdownMenuRadioItem` pour la visibilité)
- `src/modules/order-files/ui/order-files.helpers.ts` (B2 : nouveau helper `describeOrderFileUploadFailure()` ; N4 : `ORDER_FILES_COPY.loading` ; N5 : « un membre de l'espace » au lieu de « un membre du tenant » ; ajout `ORDER_FILES_COPY.errorDownloadFailed`/`dismissUpload`)
- `src/modules/order-files/api/client.ts` (N2 : `confirmUpload()` accepte un troisième paramètre optionnel `idempotencyKey`)
- `src/modules/commercial-orders/ui/workspace/OrderDetailPage.tsx` (N1 : commentaire d'en-tête corrigé — « panneau à l'échelle de la commande, groupement par item non rendu »)
- `src/shared/presentation/testIds.ts` (ajout `orderFiles.dismissUploadBtn`, N3)
- `tests/modules/order-files/order-files.helpers.test.ts` (N5 : assertion mise à jour ; N6 : les 7 messages du wireframe fixés en chaînes littérales indépendantes ; B2 : 5 tests ajoutés pour `describeOrderFileUploadFailure`)

## Confirmation du testid exigé par le contrat

`order-files-block` est posé **exactement** ainsi (aucune variante, aucun préfixe/suffixe supplémentaire) sur l'élément racine (`<section>`) d'`OrderFilesBlock`, via `TEST_IDS.orderFiles.block`. Aucune chaîne littérale improvisée dans le composant : tous les testid du panneau proviennent de `src/shared/presentation/testIds.ts`.
