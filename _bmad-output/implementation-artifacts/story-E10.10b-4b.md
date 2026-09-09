---
id: E10.10b-4b
epic: E10 — Gestion commerciale
status: done (revue qa-review distincte requise avant merge)
branch: feat/gescom-e10-4-entite-client
depends_on: [E10.10b-4a]
blocks: [E10.10b-4c]
---
# E10.10b-4b — Éditeur visuel de correspondance coordonnées

Contrat : `docs/api/CONVENTIONS.md` §8.18, `openapi/magrit-core.v1.yaml`
(`DocumentFieldId`, `DocumentLineFieldId`, `DocumentFieldPlacement`,
`DocumentLinesColumn`, `DocumentLinesBlock`, `DocumentPdfTemplateFieldMap`,
`GET`/`PUT /document-pdf-templates/{templateId}/fields`) — schémas et
opérations déjà écrits par l'architecte avant cette story, non modifiés ici.
Design : `.design-handoff/wireframes/E10.10b-4b-editeur-coordonnees.md`,
validé par Arnaud le 09/09/2026, deux arbitrages §6 tenus à la lettre :
(1) aucun raccourci de remplacement du fond dans cet éditeur (reste sur
l'écran 4a) ; (2) bouton "Enregistrer" explicite, pas de sauvegarde
automatique.

Périmètre : `GET`/`PUT .../fields`, table `document_pdf_template_fields`,
rendu du fond PDF.js, positionnement souris + clavier, réglages par champ,
bloc de lignes et ses colonnes, mode Aperçu sur un devis d'exemple fixe.

**Ce document couvre DEUX passes** : la livraison initiale, puis le round 1
de qa-review ("Changes Requested") et ses corrections — détaillées dans leur
propre section, tous les gates étant **rejoués intégralement** après
correction (aucun résultat de la première passe n'est réutilisé tel quel).

## Critères d'acceptation, tenus un par un

1. **Migration `document_pdf_template_fields`, RLS testée, D1 complété.** —
   **fait.** Migration `20260909030000_gescom_e10_10b_4b_document_pdf_template_fields.sql` :
   table neuve (25 valeurs de `field` en `check`, bornes `x`/`y`/`width`/
   `font_size` en `check`, `unique(template_id, field)`), **trigger
   `document_pdf_template_fields_assert_same_tenant`** (défense en
   profondeur, ajouté au round qa-review 1, voir B1 ci-dessous), RLS
   (`document_pdf_template_fields_select` ouverte à tout membre,
   `document_pdf_template_fields_write` en défense en profondeur), fonction
   `api_replace_document_pdf_template_fields` (`security definer`,
   remplacement intégral delete+insert, verrou `pg_advisory_xact_lock`, 409
   `document_pdf_template.upload_required` si le gabarit n'est pas `ready`).
   `api_confirm_document_pdf_template_upload` **recréée** (même signature,
   `create or replace`) pour compléter `has_field_map` par un
   `OR exists(select 1 from document_pdf_template_fields where template_id = …
   and tenant_id = …)`, filtre `tenant_id` **ajouté au round qa-review 1**
   (voir B1). **Testé réellement** contre Postgres local (Docker déjà
   démarré sur ce poste), pas seulement relu :
   `tests/sql/gescom-e10-10b-4b-document-pdf-template-fields.sql`, **6**
   scénarios (RLS lecture inter-tenant, RLS écriture directe, la fonction de
   remplacement, la contrainte unique en base, la preuve concrète de D1, et
   l'isolation tenant du scénario 6 ajouté au round 1). Rejoué aussi :
   `tests/sql/gescom-e10-10b-4a-document-pdf-templates.sql` (0 erreur,
   aucune régression sur la fonction recréée).
2. **Endpoints `GET`/`PUT /document-pdf-templates/{templateId}/fields`,
   module existant étendu, `If-Match`/ETag sur le `PUT`.** — **fait.**
   Ajoutés dans `src/server/api/document-templates-routes.ts` (même module,
   pas de nouveau fichier de routes). Lecture ouverte à tout membre du
   tenant (contrat). Écriture gardée par `can_manage_document_templates`,
   vérifiée **avant** toute lecture de la ressource (même ordre que
   `updateDocumentPdfTemplate`). `ETag` de la carte **distinct** de celui du
   gabarit (fonction `fieldMapEntityTag`, calculée sur
   `DocumentPdfTemplateFieldMap` complet) — renommer le gabarit ne casse pas
   un `If-Match` posé sur sa carte, et réciproquement. 409
   `document_pdf_template.upload_required`, 422
   `document_pdf_template.invalid_field_map` avec `Problem.errors` détaillé
   par champ, 428/409 sur `If-Match` (mécanisme partagé du socle E10, aucun
   code neuf à écrire).
3. **Écran d'édition** (`/dashboard/document-templates/:templateId/fields`,
   `DashboardDocumentTemplateFields`) — **fait**, avec les écarts listés
   ci-dessous, tous signalés :
   - **PDF.js en import dynamique, aucun effet sur le bundle boutique.**
     Vérifié par un **build réel** (`pnpm build`, **rejoué après toutes les
     corrections qa-review**), pas seulement affirmé : `pdfjs-dist`
     (361 Ko) et son worker (2,2 Mo) forment un chunk séparé
     (`pdf-*.js`/`pdf.worker-*.mjs`), référencé **uniquement** par le chunk
     lazy du module `document-templates` (`index-DJy3GyLz.js` dans ce
     dernier build), lui-même chargé en `import()` dynamique depuis
     `workspaceRuntimeRoutes.tsx` pour les DEUX routes du module (liste 4a
     et éditeur 4b, qui partagent le même point d'entrée `ui/index.ts`).
     Aucun chunk storefront/portail (`PortalCatalog`, `PortalOrders`,
     `CartContext`) ne référence `document-templates`, `pdfjs-dist`
     (`PDFDocumentProxy`) ni `pdf-lib` (`StandardFonts`) — vérifié par
     `grep` sur `dist/assets/*.js` après build.
   - **Palette "Champs" à droite**, groupée par les 4 familles du wireframe
     §1, libellés FR repris littéralement, un champ déjà posé disparaît de
     la liste (contrat). Compteur "n/26" (25 champs + le tableau des lignes
     compté à part, wireframe §2 — **corrigé au round qa-review 1, R7**,
     affichait "n/25" avant correction).
   - **Positionnement multi-modal** : glisser-déposer natif (HTML5
     `draggable`/`onDrop`), clic-puis-clic (sélection palette "armée" puis
     clic sur le canevas), **et clavier** (Entrée sur un champ de palette le
     pose au centre de la page visible ; flèches pour affiner de 1 pt, Maj
     + flèche pour 10 pt ; Suppr/Retour retire le champ ; Échap désarme/
     désélectionne). **Déplacement d'un champ déjà posé géré par `onDrop`
     du canevas** (corrigé au round qa-review 1, R3 — voir ci-dessous), pas
     par `onDragEnd` de l'étiquette. Conversion point-PDF ↔ pixel écran
     isolée dans `pdf-coordinates.ts` (fonction **pure**, testée
     unitairement), réutilisée à l'identique par le calque d'Aperçu.
   - **Panneau de réglages** par champ sélectionné : police (deux menus
     couplés famille/style, mapping exact du wireframe §1), taille,
     alignement (désactivé sans largeur, **et forcé à `left` quand la
     largeur est retirée** — corrigé au round qa-review 1, R4), couleur
     (4 pastilles + sélecteur natif), réglages avancés repliés
     (`max_lines`), retrait du gabarit. Libellés associés à leurs champs
     par `htmlFor`/`id` (corrigé au round qa-review 1, R8).
   - **Onglet "Tableau"** : une seule zone de colonnes qui se répète (aucun
     contrôle "ligne N" nulle part — garantie structurelle du contrat),
     stepper "lignes par page" **plafonné côté client** par `maxRowsPerPage()`
     (même fonction que la validation serveur), **plafond appliqué à
     l'ÉTAT stocké et pas seulement à la valeur affichée** (corrigé au
     round qa-review 1, R1), sélection de la page de reprise si le gabarit
     a plusieurs pages, menu de colonne qui retire les champs déjà
     utilisés. **Rendu visuel du tableau AJOUTÉ sur le canevas** (ligne
     réelle éditable + ligne fictive grisée/pointillée montrant le pas de
     répétition, deux poignées de glissé — ancre et espacement) — **ajouté
     au round qa-review 1, R5, confirmé par Arnaud**, absent de la première
     livraison.
   - **Mode Aperçu** : calque client (`PreviewOverlay.tsx`) sur un devis
     d'exemple fixe (`sample-quote.ts`, jeu de données inventé représentatif
     — Établissements Dupont & Fils, DEV-2026-00042, repris du wireframe
     écran D), avec case "Simuler un devis long" (22 lignes). Réutilise
     **exactement** la même conversion `pdf-coordinates.ts` que l'éditeur.
     **Aucun appel à un moteur de génération** (qui n'existe pas encore,
     4c). Nombre de pages **calculé dynamiquement** depuis le `lines_block`
     réel (`computeDocumentPageCount()`, corrigé au round qa-review 1, R6 —
     n'est plus codé en dur dans le jeu de données). Mention "aperçu limité
     à la page 1" **permanente** dès qu'un gabarit multi-page ou un
     débordement de lignes s'applique, et **repère visuel distinct**
     (contour pointillé ambré) pour les champs `totals.`/`page.` (corrigé
     au round qa-review 1, R2).
   - **Bouton "Enregistrer" explicite**, indicateur d'état
     (Enregistré/Modifications non enregistrées/Enregistrement…), gestion du
     409 (dialogue "Recharger la carte"), 422 (bandeau avec le détail par
     champ rendu par le serveur), sortie avec modifications non enregistrées
     (dialogue "Abandonner"/"Continuer à modifier").
   - **Microcopy FR** : titres, boutons, aides contextuelles et messages
     d'erreur du wireframe §4 repris tels quels partout où un texte utilisateur
     est affiché.
4. **Terminologie des totaux alignée (Q4).** — **fait**, avec **divergence
   assumée par rapport au wireframe**, documentée dans
   `field-catalog.ts` : `totals.lines_subtotal` et `totals.net_total` sont
   affichés "Sous-total lignes"/"Net HT" (au lieu de "Total des lignes (avant
   remise)"/"Total HT" proposés par le wireframe), pour rester cohérents
   avec `QuoteEditorPage.tsx` (`src/modules/commercial-quotes/ui/workspace/`),
   qui affiche **déjà** ces mêmes champs (`totals.lines_subtotal`/
   `totals.net_total`, même schéma `CommercialQuoteTotals`) sous ces
   libellés à l'atelier. `totals.total_incl_tax` ("Total TTC") était déjà
   identique aux deux endroits. `totals.vat_rate`/`totals.vat_amount`
   n'ayant pas d'équivalent séparé dans `QuoteEditorPage` (qui les fusionne
   en un seul libellé "TVA (X %)"), les libellés du wireframe ("Taux de
   TVA"/"Montant de TVA") sont conservés tels quels.

## qa-review round 1 — Changes Requested, corrigé

Un point **bloquant** (B1), une demande confirmée par Arnaud (R5), une
correction de documentation (D2), et huit réserves non bloquantes (R1-R8,
plus R9 signalé sans être traité, hors périmètre). Traités dans l'ordre.

**B1 — faille de sécurité réelle, confirmée par test empirique (isolation
tenant rompue), CORRIGÉE.** `document_pdf_template_fields.template_id` et
`.tenant_id` étaient deux colonnes indépendantes, sans lien de cohérence
vérifié : un admin du tenant B, connaissant l'UUID d'un gabarit du tenant A,
pouvait insérer une ligne avec `template_id` = gabarit de A et `tenant_id` =
son propre tenant B — la policy `with check` de
`document_pdf_template_fields_write` ne vérifiant que le `tenant_id` **de la
ligne elle-même**, jamais le tenant **réel** du gabarit désigné. Conséquences
prouvées par exécution réelle avant correction (déni de service durable sur
A via `unique(template_id, field)`, résidu que A ne peut ni voir ni effacer,
`has_field_map` calculé sans filtre `tenant_id`). Corrigé aux **trois**
endroits demandés, dans la migration `20260909030000` (jamais déployée,
corrigée sur place, aucune migration corrective séparée) :
1. **Trigger `document_pdf_template_fields_assert_same_tenant`** (`before
   insert or update`), **même patron exact** que
   `project_tag_links_assert_same_tenant`
   (`20260902000100_gescom_e10_2_project_tags.sql:76-100`) : relit le
   `tenant_id` **réel** de `document_pdf_templates` pour `new.template_id`
   et refuse toute ligne dont il ne correspond pas à `new.tenant_id`.
2. **`and tenant_id = v_current.tenant_id` ajouté** au `exists(...)` de
   `has_field_map` dans `api_confirm_document_pdf_template_upload`, pour
   aligner exactement la fonction SQL sur l'adaptateur TypeScript
   (`templateHasFieldMap()`, qui filtrait déjà par les deux colonnes).
3. **Scénario 6 ajouté** à
   `tests/sql/gescom-e10-10b-4b-document-pdf-template-fields.sql` : (6a) un
   admin du tenant B tente l'INSERT DIRECT décrit ci-dessus → **refusé**
   par le trigger, aucun résidu persisté malgré l'exception ; (6b) défense
   en profondeur redondante sur `has_field_map` — le trigger est
   **explicitement désactivé** le temps d'un seul INSERT privilégié pour
   forcer artificiellement la ligne incohérente que le trigger interdit
   désormais, et on vérifie que le filtre `tenant_id` du point 2 l'ignore
   quand même. **Rejoué réellement** contre Postgres local : 12 blocs `DO`,
   0 erreur, `ROLLBACK` atteint.

**R5 — retour visuel du tableau de lignes sur le canevas, CONFIRMÉ par
Arnaud, AJOUTÉ.** La première livraison ne rendait le tableau que par des
champs numériques, sans aucun aperçu avant le mode Aperçu complet. Ajouté
dans `DocumentTemplateFieldsPage.tsx` : une ligne RÉELLE (première ligne,
éditable, teintée `brand`) et une ligne FICTIVE (grisée, bordure pointillée,
avec l'infobulle "repère, pas une donnée réelle" du wireframe A8), toutes
deux positionnées via `pdfPointToScreenPixel` comme les placements simples.
Deux poignées de glissé (icône `GripVertical`) : l'une déplace l'ANCRE
(décale toutes les colonnes du même delta, préservant leur espacement
relatif), l'autre règle l'ESPACEMENT (`row_height`) en tirant la ligne
fictive — wireframe §2 écran C, note "glisser la poignée verticale entre
les deux lignes règle `row_height` en direct". **Écart résiduel signalé** :
la poignée d'espacement n'est pas positionnée pixel-perfect "entre" les
deux lignes comme l'illustre le wireframe (elle est à gauche de la ligne
fictive) — l'interaction fonctionnelle (glisser règle bien `row_height`) est
tenue, l'emplacement exact de l'affordance graphique reste perfectible.

**Requalification D2 — pas un bug, une correction de documentation.** La
livraison initiale de ce document qualifiait le fait que `reset_fields`
efface aussi les placements de "décision ajoutée par ce lot, non
explicitement écrite au contrat". **C'était inexact** : le contrat l'écrit
littéralement à deux endroits (`openapi/magrit-core.v1.yaml`,
`ConfirmDocumentPdfTemplateUploadCommand.reset_fields` et
`confirmDocumentPdfTemplateUpload`) — `reset_fields` efface l'objet
`DocumentPdfTemplateFieldMap` **en entier**, `placements` inclus. 4a ne
pouvait effacer que `lines_block`, seule partie de la carte qui existait
alors (la table `document_pdf_template_fields` n'existait pas encore) ; 4b
**répare** ce que 4a n'avait pas pu tenir, il n'invente rien. Libellé
corrigé partout dans ce document et dans les commentaires de la migration
(`20260909030000`, en-tête et fonction `api_confirm_document_pdf_template_upload`).

**Réserves non bloquantes, toutes traitées :**

| Réf. | Constat | Correction |
|---|---|---|
| R1 | `LinesTablePanel.tsx` plafonnait `rows_per_page` seulement à l'AFFICHAGE (`Math.min` sur la valeur rendue), pas dans l'état stocké : remonter l'ancre après avoir réglé 20 lignes faisait chuter le plafond sans corriger la valeur enregistrée → 422 à l'enregistrement, écran pourtant "correct" à l'œil. | `useEffect` ajouté (déclaré **avant** le retour anticipé de l'état vide, hooks appelés inconditionnellement) qui plafonne l'ÉTAT lui-même (`onChange`) dès que `rows_per_page > cap`, à chaque recalcul de `cap`. |
| R2 | `PreviewOverlay.tsx` : l'avertissement "page 1 seulement" n'apparaissait que si "Simuler un devis long" était coché ; un gabarit à 2 pages avec des champs sur la page 2 était silencieusement invisible, et les familles `totals.`/`page.` n'avaient aucun repère distinct. | Mention **permanente** dès que `pages.length > 1` OU que `computeDocumentPageCount()` calcule un débordement ; contour pointillé ambré + infobulle distincte sur les placements `totals.`/`page.`. |
| R3 | `onDragEnd` sur l'étiquette appliquait la position même si le dépôt avait eu lieu hors du canevas (drag annulé), et certains navigateurs (Firefox) y rapportent `clientX/clientY = 0` → téléportation de l'étiquette, perte du placement. | Repositionnement déplacé sur `onDrop` du CANEVAS (coordonnées toujours fiables, aucun `drop` ne se déclenche hors cible valide) ; `onDragEnd` retiré, le type `text/document-move-field-id` déjà posé au `dragstart` est désormais LU par `handleCanvasDrop`. |
| R4 | Décocher "Donner une largeur" laissait `align: 'right'`/`'center'` en mémoire (radios `disabled` mais visuellement toujours cochées) → carte invalide, 422 à l'enregistrement. | Décocher force désormais `align: 'left'` dans le même `onChange` (`FieldSettingsPanel.tsx`). |
| R6 | `sample-quote.ts` codait `page.count: '2'` en dur, y compris quand `rows_per_page` ferait tenir tout le devis sur une seule page réelle. | Valeurs `page.number`/`page.count`/`page.number_of_count` retirées du jeu de données statique (placeholders `'—'` jamais censés s'afficher) ; `PreviewOverlay.tsx` les recalcule à CHAQUE rendu via `computeDocumentPageCount()` (nouvelle fonction pure, `pdf-coordinates.ts`, 5 tests unitaires) à partir du `lines_block` RÉEL et du nombre de lignes de l'échantillon choisi. |
| R7 | `PaletteFieldsPanel.tsx` affichait "X / 25" ; le wireframe dit "0 / 26" (25 champs + le tableau compté à part). | Compteur aligné sur 26 (`hasTable` ajouté aux props, incrémente le total ET le compte positionné quand un `lines_block` existe). |
| R8 | Labels sans `htmlFor`/`id` sur les inputs numériques de `LinesTablePanel.tsx` et `FieldSettingsPanel.tsx` — non associés pour les lecteurs d'écran. | Chaque `<label>` associé à son input par `id`/`htmlFor` (ou `aria-label`/`aria-labelledby` pour les groupes de boutons/swatches). |
| R9 | `react-dnd`/`react-dnd-html5-backend` restent des dépendances mortes dans `package.json`. | **Non traité sur instruction explicite** — arbitrage de l'architecte au niveau du dépôt, hors périmètre de cette story. Signalé, `package.json` non touché pour ce point. |

## Ce qui est livré

| Élément | Détail |
|---|---|
| Migration `20260909030000` | Table `document_pdf_template_fields`, **trigger `document_pdf_template_fields_assert_same_tenant`** (qa-review B1), fonction `api_replace_document_pdf_template_fields`, `api_confirm_document_pdf_template_upload` recréée (D1, filtre `tenant_id` qa-review B1). Appliquée réellement (`pnpm db:local:push`, puis rejouée après corrections qa-review). |
| Module `document-templates` (étendu) | `api/contracts.ts` (11 schémas neufs) ; `api/client.ts` (`getFields`/`replaceFields`) ; `application/document-field-map-validator.ts` (validation sémantique **pure**, nouvelle) ; `application/document-templates-repository.ts`/`-service.ts` étendus (2 méthodes, 2 erreurs de domaine) ; `index.ts`/`manifest.ts`/`surface-contributions.ts` étendus. |
| Adaptateur Supabase | `src/adapters/supabase/document-templates-repository.ts` — `getFields`/`replaceFields`, `templateHasFieldMap()`, mapping d'erreurs étendu. |
| Routes | `src/server/api/document-templates-routes.ts` — 2 routes neuves dans le fichier existant, `fieldMapEntityTag()` dédié. |
| UI (nouveau dossier) | `src/modules/document-templates/ui/workspace/field-editor/` : `DocumentTemplateFieldsPage.tsx`, `PaletteFieldsPanel.tsx`, `FieldSettingsPanel.tsx`, `LinesTablePanel.tsx`, `PreviewOverlay.tsx`, `usePdfPageCanvas.ts`, `field-catalog.ts`, `pdf-coordinates.ts` (+ `computeDocumentPageCount`, qa-review R6), `sample-quote.ts`, `types.ts`. |
| Câblage routage | `surface-contributions.ts` (route `document-templates/:templateId/fields`), `manifest.ts` (feature neuve), `workspaceRuntimeRoutes.tsx` (loader lazy), `DocumentTemplatesPage.tsx` (lien "Positionner les champs" sur un gabarit `ready`). |
| Dépendance | `pdfjs-dist@4.9.155` ajoutée à `package.json`/`pnpm-lock.yaml`. Version et API non vérifiées via Context7 (outil indisponible dans cette session) — vérifiées empiriquement : import résolu par `pnpm add`, exports confirmés par lecture des types, isolation du bundle confirmée par build réel. |
| Tests | `tests/contract/document-templates.contract.test.ts` (+9), `tests/contract/_fakes/document-templates-repository.fake.ts` (étendu), `tests/modules/document-templates/document-field-map-validator.test.ts` (17), `tests/modules/document-templates/pdf-coordinates.test.ts` (11, dont 5 pour `computeDocumentPageCount`), `tests/modules/document-templates/field-catalog.test.ts` (9), `tests/sql/gescom-e10-10b-4b-document-pdf-template-fields.sql` (6 scénarios, exécuté réellement). |

## Écarts avec le wireframe — signalés, pas dissimulés

| # | Écart | Motif | Statut |
|---|---|---|---|
| E1 | Largeur d'un placement SIMPLE donnée par un **contrôle numérique** ("Donner une largeur" + valeur en pt), pas en tirant une poignée sur le bord droit de l'étiquette. | Une poignée de redimensionnement fiable (drag précis, conversion pixel↔point en direct) est un morceau d'interaction à part entière. | Non traité par le round qa-review 1 (portait sur le TABLEAU, R5) — reste ouvert, fonctionnellement équivalent. |
| E2 | Ancre et espacement du tableau réglables par **champs numériques**, en PLUS du glisse sur le canevas ajouté par R5. | Les deux chemins mènent aux mêmes données ; le glisse seul (sans les champs numériques) priverait un imprimeur qui préfère taper une valeur exacte (wireframe §2 : "modifiable au clavier pour les imprimeurs qui préfèrent taper une valeur"). | Partiellement résorbé par R5 (le rendu visuel + le glisse existent désormais) ; les contrôles numériques sont conservés en complément, conforme au wireframe. |
| E3 | Mode Aperçu ne rend que la **première page**. | Répliquer la logique de recopie de page côté client aurait dédoublé la logique du moteur de génération (E10.10b-4c), qui n'existe pas encore. | Non bloquant, mention permanente ajoutée par R2. À enrichir une fois 4c livré, si souhaité. |
| E4 | Rail de pages : boutons texte, pas de vignettes miniatures du PDF. | Une vignette par page aurait multiplié les instances PDF.js pour un gain visuel seul. | Enrichissement UI pur si demandé. |
| E5 | `react-dnd`/`react-dnd-html5-backend` (dépendances existantes, inutilisées dans tout le dépôt) non mobilisés ; DnD HTML5 natif à la place. | Aucun précédent d'usage dans le dépôt. | Signalé (R9) — arbitrage architecte hors périmètre, `package.json` non touché sur instruction explicite. |
| E6 | Alignement `center`/`right` sans largeur refusé en 422, tiré de la description du schéma `DocumentTextAlign` plutôt que du résumé de l'opération. | La description du schéma est aussi normative que celle de l'opération. | À confirmer par l'architecte ; un seul point de retrait dans `document-field-map-validator.ts` si jugé trop strict. |

## Ce qui n'a pas pu être vérifié dans cette session

- **Rendu réel de PDF.js dans un navigateur** : aucun navigateur disponible dans cet environnement CLI. Vérifié à la place : résolution du paquet, exports conformes à l'usage prévu, isolation du bundle par un build réel (rejoué après corrections qa-review).
- **Interactions souris (glisser-déposer des poignées de tableau, redimensionnement) en conditions réelles** : écrites conformément à l'API DOM standard, mais aucun test de composant ni E2E n'existe dans ce dépôt pour ce type d'écran (aucun précédent). Point aveugle persistant, signalé explicitement.
- **`pnpm test:storefront:sql` (harnais complet)** : non rejoué en entier (dette v1 déjà documentée par 4a). Mon cas (avec le scénario 6) et celui de 4a ont été rejoués **individuellement** contre la base locale, sans reset : 0 erreur pour les deux, dans cette session ET après corrections qa-review.

## Vérifications — REJOUÉES intégralement après corrections qa-review round 1

Toutes les commandes ci-dessous ont été **rejouées dans cette session**,
après application des corrections B1/R1-R8 — aucun résultat n'est repris tel
quel d'un rapport précédent.

- `pnpm typecheck` : **0 erreur.**
- `pnpm gen:api:check` : **✅ aligné** (aucune touche à `openapi/magrit-core.v1.yaml`).
- `pnpm test:architecture` : **144/144** (33 fichiers), inchangé.
- `pnpm test:contract` : **301/301** (16 fichiers), inchangé (B1/R1-R8 ne touchent aucun contrat HTTP).
- `pnpm exec vitest run tests/modules/document-templates/` : **44/44** (4 fichiers) — +5 par rapport à la livraison initiale (39), tests neufs de `computeDocumentPageCount` (qa-review R6).
- `pnpm test` (suite complète) : **1805 passés / 36 skip**, **3 échecs pré-existants** (`tests/storage/product_mockups_isolation.test.ts`, projet Supabase distant, sans rapport avec ce lot, déjà documentés par 4a) — +5 par rapport à la livraison initiale (1800), cohérent avec les tests neufs.
- `tests/sql/gescom-e10-10b-4b-document-pdf-template-fields.sql` : **exécuté réellement** contre Postgres local (Docker déjà démarré), **6 scénarios** (12 blocs `DO`), **0 erreur** — inclut le scénario 6 (qa-review B1) dans ses deux volets (6a : refus de l'INSERT direct cross-tenant ; 6b : défense en profondeur de `has_field_map` avec trigger désactivé de force).
- `tests/sql/gescom-e10-10b-4a-document-pdf-templates.sql` : **rejoué** après la migration 4b corrigée — 0 erreur, aucune régression.
- `pnpm build` : **succès**, bundle **réinspecté** (`dist/assets`) après toutes les corrections — `pdfjs-dist` et son worker isolés dans un chunk séparé, référencé uniquement par le chunk lazy du module `document-templates` via un `import()` dynamique authentique (vérifié en lisant le contexte de la référence dans le chunk principal, pas seulement sa présence), absent de tout chunk storefront/portail (`PortalCatalog`, `PortalOrders`, `CartContext` grep'és explicitement).

## Dette introduite, points à faire confirmer

| Réf. | Point | Chemin de mise en conformité / statut |
|---|---|---|
| **B1** | ~~Isolation tenant rompue sur `document_pdf_template_fields`~~ — **CORRIGÉE** (trigger + filtre `tenant_id` sur `has_field_map` + scénario SQL 6). | Clos, comportement vérifié par exécution réelle. |
| **D1 (E10.10b-4b)** | Validation sémantique de la carte (page existante, coordonnée dans les bornes, `rows_per_page` compatible) tenue en TypeScript, la fonction SQL ne revalidant que bornes/enums/unicité. Un appel RPC direct (hors service applicatif) pourrait persister une carte géométriquement incohérente (mais plus inter-tenant, depuis B1). | Même risque déjà assumé sur `lines_block` en 4a. Signalé, pas corrigé. |
| **E6** | Alignement centre/droite sans largeur refusé en 422, tiré de la description du schéma plutôt que du résumé de l'opération. | Voir tableau des écarts. |
| **E5 / R9** | `react-dnd`/`react-dnd-html5-backend` restent des dépendances inutilisées. | Hors périmètre, arbitrage architecte, non traité sur instruction explicite. |
| **Hérité de 4a, non résolu ici** | Plafond de 20 gabarits non tenu par une contrainte EN BASE (N1 de 4a). | Hors périmètre de 4b, à traiter au niveau du sprint. |

## Ce qui reste à faire avant qu'E10.10b-4c (génération + envoi) puisse démarrer

- **Rien de bloquant côté 4b** : `GET .../fields` rend déjà la carte complète (`placements`, `lines_block`), exactement ce dont `renderQuoteDocument()` a besoin en paramètre.
- **Le moteur de rendu lui-même** (`renderQuoteDocument`, `pdf-lib`, table `quote_documents`, branchement `sendQuote`) reste entièrement à écrire — 4b ne fournit que la carte, jamais le rendu.
- **Cahier de test Notion TF-XX** : aucun n'existe encore pour cette story (comme pour 4a) — à créer par le `scribe`.
- **Passage Sally UX** signalé comme obligatoire par le contrat pour ce lot ("composant entièrement nouveau… manipulé par un utilisateur non technique") : **non fait dans cette session** — le design suivi est le wireframe déjà validé par Arnaud, et R5 a été directement confirmé par lui au round qa-review 1, mais une revue UX du résultat implémenté reste à faire si le process du sprint l'exige.
