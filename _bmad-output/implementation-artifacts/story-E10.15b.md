---
id: E10.15b
epic: E10 — Gestion commerciale
status: ready-for-qa-review
branch: feat/gescom-e10-4-entite-client
depends_on: [E10.15a]
blocks: [E10.15c, E10.15d, E10.15e]
---
# E10.15b — Notifications multicanal : l'écran de paramétrage, aucun envoi

Contrat déjà écrit par l'architecte (`docs/api/CONVENTIONS.md` §8.23,
`openapi/magrit-core.v1.yaml`), **non modifié par ce lot** (`git diff
openapi/` vide, `git diff src/platform/api/generated/` vide). Socle E10.15a
déjà livré, approuvé en 2 rounds de qa-review, déployé sur
`ightkxebexuzfjdbpsdg` : les six opérations de configuration
(`listNotificationEvents`, `listNotificationTemplates`,
`createNotificationTemplate`, `getNotificationTemplate`,
`updateNotificationTemplate`, `previewNotificationTemplate`) sont
consommées telles quelles par ce lot, aucune n'est modifiée.

Périmètre strict, repris tel qu'écrit au §8.23 §8, ligne « E10.15b — l'écran
de paramétrage » : **liste, éditeur, aperçu, sous
`src/modules/notifications/ui/`. `data-testid` déclarés dans
`src/shared/presentation/testIds.ts`. Aucun changement serveur.**

## qa-review round 1 — REJETÉ, trois bloquants et quatre points moyens corrigés

Une première remise a été **rejetée** (3 bloquants B1/B2/B3, 4 moyens
M1-M4, plusieurs mineurs). Tous corrigés dans cette même passe, avant remise
pour une nouvelle revue :

- **B1 (BLOQUANT)** — CA5, la fonction testée n'était **pas** celle qui
  s'exécutait : `NotificationTemplateFormModal.insertTag()` réimplémentait
  l'insertion de balise en ligne au lieu d'appeler `insertTagAtCursor`
  (`notification-templates.helpers.ts`), qui n'était importée nulle part
  dans `src/`. Corrigé : `insertTag()` appelle désormais réellement
  `insertTagAtCursor` pour les deux champs (sujet et corps) — vérifié par
  `grep`, le helper a maintenant deux appelants dans le composant en plus de
  son test.
- **B2 (BLOQUANT, GRAVE)** — perte silencieuse du filtre d'étape de
  production lors d'un `PATCH` (CA2) : `production_step_id` était envoyé
  **inconditionnellement**, calculé à partir de `selectedEvent` (dérivé du
  catalogue `listNotificationEvents`, chargé de façon indépendante par la
  page). Un `Promise.all` partiellement en échec laissait `selectedEvent`
  à `undefined` **même pour un modèle existant déjà rattaché à une étape** —
  l'éditeur restait ouvrable (chargé par un hook séparé), et enregistrer une
  correction sans rapport (nom, corps) effaçait le filtre d'étape sans un
  mot. Corrigé : une variable `catalogReady` (`selectedEvent !== undefined`)
  garde l'inclusion de la clé `production_step_id` dans le `PATCH` — absente
  du corps quand le catalogue n'a pas chargé, ce qui est un **PATCH
  partiel** valide (contrat : « seuls les champs présents sont
  appliqués ») ; le serveur garde alors la valeur déjà enregistrée. Même
  garde par défense en profondeur côté `POST` de création.
- **B3 (BLOQUANT)** — un contrôle **client** plus strict que le serveur
  bloquait un chemin d'édition normal : des destinataires explicites
  saisis puis abandonnés au profit de l'audience « client » survivaient
  dans `recipientsRaw`, et `validateNotificationTemplateForm` refusait un
  formulaire pointant un champ **qui n'était même plus affiché**, alors que
  la commande réellement construite envoyait déjà `recipients: null`, que
  le serveur aurait accepté. Corrigé : un effet vide `recipientsRaw` dès que
  `audience` repasse à `'customer'`.
- **M1** — le 409 (conflit d'`ETag`) n'avait aucune porte de sortie :
  rejouer « Enregistrer » renvoyait le même `ETag` périmé et échouait à
  l'identique jusqu'à fermeture du modal, perdant la saisie. Corrigé :
  reprise du patron déjà en place (`DocumentTemplateFieldsPage.
  handleSave`/`handleReloadAfterConflict`, `conflictDialog`/
  `conflictReloadBtn`) — un 409 sur `updateNotificationTemplate` ouvre un
  dialogue qui recharge le modèle frais (`getForEdit`) et réinitialise tous
  les champs du formulaire dessus.
- **M2** — `openEdit`/`handleToggle` (`NotificationTemplatesPage`) étaient
  appelés en `void ...` sans `catch` ; un clic sur un modèle supprimé
  entretemps, ou un blip réseau, ne produisait alors AUCUN message. Corrigé :
  les deux fonctions capturent leur erreur dans un état `actionError`
  dédié, affiché dans une bannière séparée (`actionErrorBanner`).
- **M3** — deux chemins pouvaient afficher une `ZodError` brute : (a)
  `handlePreview` n'exécutait aucune validation préalable — un corps vide
  levait une `ZodError` locale relayée telle quelle ; (b)
  `validateNotificationTemplateForm` testait le sujet **non trimmé**, alors
  que la commande envoie `subject.trim()` (et le schéma Zod du contrat
  trimme aussi) — un sujet fait uniquement d'espaces passait donc la
  validation locale puis échouait au `.parse()` client. Corrigé : nouvelle
  fonction `validateNotificationPreviewInput()` appelée avant `api.preview`
  ; `channelShapeWarnings()` trimme désormais le sujet avant de le
  transmettre à `channelShapeIssues`, alignée sur ce qui est réellement
  envoyé.
- **M4** — la liste des étapes de production ne chargeait que
  `{status:'active'}` : une étape désactivée (E10.13 permet la
  désactivation, jamais la suppression) référencée par un filtre existant
  s'affichait en UUID brut dans la liste, et le select de l'éditeur n'avait
  aucune option correspondante. Corrigé : `productionStepsApi.list({})`
  (catalogue complet, actives et désactivées) pour la résolution des
  libellés **et** pour peupler le select, avec la mention « (étape
  désactivée) » sur une option inactive.
- **Mineurs traités** : m1 (audiences dérivées de `selectedEvent.audiences`
  plutôt que codées en dur `customer`/`explicit`) ; m2 (motif de
  désactivation de l'aperçu rendu **visible** sous le bouton, en plus du
  `title`) ; m5 (`error`/`referenceError`/`actionError` affichés dans trois
  bannières distinctes, plus de `??` masquant silencieusement l'échec du
  catalogue — c'est précisément ce `??` qui avait laissé passer B2 inaperçu
  en lecture de code). m3 (vérification du testid `notifications-config-page`
  contre les Hints DOM) reste hors de portée de cet agent, faute d'accès
  direct à la fiche Notion — signalé tel quel, non traité comme un doute
  résolu.
- **m4 (inexactitudes du rapport corrigées)** : le nombre de testid du
  scope `notificationTemplate` était annoncé à 24, il est maintenant de
  **26** (3 ajoutés par cette passe — `conflictDialog`, `conflictReloadBtn`,
  `actionErrorBanner` — moins aucun retiré) ; le nom du fichier de test
  (`tests/modules/notifications/notification-templates-ui-helpers.test.ts`)
  était déjà exact dans la version précédente de ce document, aucune
  correction nécessaire sur ce point précis.

## Ce qui est livré

| Élément | Détail |
|---|---|
| `src/modules/notifications/ui/workspace/NotificationTemplatesPage.tsx` (nouveau) | Écran `DashboardNotificationTemplates` : liste des modèles du tenant, filtrable par événement/canal/statut (`?event_name=`/`?channel=`/`?status=`, déjà gérés par `listTemplates()` d'E10.15a) — vérifié contre le client, aucun paramètre inventé. Colonnes nom/événement/canal/étape/statut, bascule actif/désactivé (relit l'`ETag` du modèle avant l'écriture, même discipline que `usePriceRulesManagement`). Catalogue des étapes de production chargé **sans filtre de statut** (qa-review M4 : une étape désactivée reste référencée par un filtre existant, jamais supprimée). Erreurs d'ouverture/de bascule capturées et affichées (qa-review M2) ; trois bannières d'erreur distinctes — liste, catalogue, actions de ligne — jamais fusionnées par un `??` (qa-review M5). |
| `src/modules/notifications/ui/workspace/NotificationTemplateFormModal.tsx` (nouveau) | Éditeur de modèle : sélection de l'événement (catalogue `listNotificationEvents`), canal (options bornées par `event.channels`, donc invisibles si `notification_sms_enabled` est éteint pour l'espace), filtre d'étape de production **si et seulement si** `event.supports_step_filter` (vrai uniquement pour `order.step_changed`, contrat §8.23 §4), audience dérivée de `event.audiences` (qa-review m1), destinataire (client de l'événement / destinataires explicites, 10 max, un par ligne, vidé automatiquement au changement d'audience — qa-review B3), sujet (email seulement), corps, actif. `event_name`/`channel` affichés en lecture seule en modification (immuables au contrat, `UpdateNotificationTemplateCommand` ne les porte pas). `production_step_id` omis du corps de la commande quand le catalogue d'événements n'a pas chargé, plutôt qu'envoyé à `null` à tort (qa-review B2). Conflit d'`ETag` (409) : dialogue de rechargement (qa-review M1), même patron que `DocumentTemplateFieldsPage`. |
| Insertion de balise au clic (CA5) | Liste des balises **de l'événement sélectionné** (`event.tags`, catalogue serveur, jamais recopiée en dur), un bouton par balise (`data-tag`), insertion à la position du curseur du champ actif (sujet ou corps) via `insertTagAtCursor` (fonction pure, testée) — remplace la sélection courante si le texte était sélectionné, jamais un `String.replace` global. |
| Aperçu avant enregistrement (CA6) | Bouton qui appelle `POST /notification-templates/{id}/previews` avec le sujet/corps **actuellement à l'écran** (pas nécessairement enregistrés). **Écart documenté** : le contrat n'autorise l'aperçu que sur un `templateId` existant (§8.23 §2, décision « prévisualiser AVANT la première sauvegarde n'est pas possible en V1 ») — voir section dédiée ci-dessous. |
| Compteur de caractères SMS (CA — avertissement au-delà de 480) | `smsCounterState()` (pure, testée) affiche `count/480`, coloré en rouge au-delà. **Valeur vérifiée dans le contrat livré par E10.15a** (`channelShapeIssues`, colonne `body` de `notification_templates`, §8.23 §4/§9(e)) — **480, pas 160** comme le suggérait la fiche Notion d'origine ; le contrat écrit explicitement avoir ajusté ce chiffre. Le compteur **réexpose** `channelShapeIssues` (même fonction que la validation Zod du client ET du service serveur), il n'en réécrit pas une seconde version. |
| Validation immédiate de formulaire | `validateNotificationTemplateForm()` (pure, testée) : mêmes bornes que le schéma Zod du contrat (nom ≤120, corps ≤4000, destinataires 1–10 si audience explicite / 0 si audience client, forme par canal). Retour immédiat, **jamais la seule barrière** : `create()`/`update()` revalident via le même schéma Zod côté client, et le serveur refuse en 422 de toute façon. |
| Messages d'erreur API | `notificationTemplateApiProblemMessage()` (pure, testée) : mappe chaque code métier du contrat (`notification_template.unknown_tag`, `.event_not_notifiable`, `.recipients_required`, `.step_filter_not_applicable`, `.limit_reached`, `.not_found`, `api.validation_failed`) vers un message français stable, et ajoute le détail par champ (`problem.errors[]`) pour nommer **quelle** balise est fautive (CA5) plutôt que de forcer l'utilisateur à deviner. |
| Navigation | `src/modules/notifications/manifest.ts` + `surface-contributions.ts` (nouveaux, même patron que `pricing`/`document-templates`) : route `notifications.workspace.templates` (`/notifications`), garde d'ergonomie `requiredCapabilities: ['can_manage_notifications']` (l'autorisation réelle reste tenue par la RLS + `x-required-capabilities` côté serveur), entrée de menu « Notifications » (groupe `commercial`, icône `bell`). `src/app/layouts/DashboardLayout.tsx` : icône `bell` ajoutée à `WORKSPACE_ICONS` (plomberie obligatoire, même geste que chaque module précédent — `workflow`/`percent`/`file-clock`, etc.). `src/app/surfaces/workspaceRuntimeRoutes.tsx` et `src/surfaces/application-registry.ts` : câblage du module, même patron que les 11 modules déjà enregistrés. |
| `src/shared/presentation/testIds.ts` | Scope `notificationTemplate` (nouveau), **26** testid : les 14 repris littéralement de la liste mandatée par la fiche Notion citée au contrat, plus les testid complémentaires nécessaires (filtres de liste, modal, champs non listés explicitement, et — qa-review round 1 — `conflictDialog`/`conflictReloadBtn`/`actionErrorBanner`), déclarés selon la même convention `<scope>-<element>[-<modifier>]` — jamais de chaîne littérale improvisée dans un composant. |

## Écart documenté avec le mandat — aperçu sur un brouillon non enregistré

Le mandat demandait de vérifier si le contrat permet un aperçu sur un modèle
pas encore créé. **Vérifié dans le contrat d'E10.15a** (`openapi/
magrit-core.v1.yaml`, opération `previewNotificationTemplate`) : non — le
chemin est `POST /notification-templates/{templateId}/previews`, et le
contrat documente explicitement ce choix (« Pourquoi un `templateId` au
chemin, alors qu'un aperçu est apatride. C'est l'arbitrage assumé de cette
story : le parcours d'écran est "créer désactivé, écrire, prévisualiser,
activer" [...]. Prévisualiser AVANT la première sauvegarde n'est pas
possible en V1 »).

**Conséquence côté écran, assumée** : en mode création, le bouton Aperçu
est désactivé (infobulle « Enregistrez le modèle une première fois pour
prévisualiser. »). Au premier `Enregistrer`, le modal **reste ouvert**,
passe en mode édition avec le modèle et l'`ETag` fraîchement créés (relu via
`getForEdit()`, car `create()` ne porte pas l'`ETag` — même limite que
`PriceRulesApiClient.create()`/`ProductionStepsApiClient.create()`, pattern
déjà en place, non modifié ici), et le bouton Aperçu devient utilisable —
il envoie alors le sujet/corps **actuellement à l'écran**, pas
nécessairement déjà réenregistrés, ce qui reste conforme au contrat
(« un écran d'édition prévisualise ce qui est À L'ÉCRAN »).

**Chemin de mise en conformité si un aperçu pré-sauvegarde est un jour
demandé** : le contrat le prévoit déjà comme extension additive, non
tranchée ici — un chemin de collection `/notification-template-previews`
portant `event_name` et `channel` dans le corps (cité par le contrat
lui-même comme issue future).

## Dette introduite ou héritée

| Réf. | Trou | Chemin de mise en conformité |
|---|---|---|
| **D1 — nouvelle, mineure** | Aucun aperçu possible avant le premier enregistrement d'un modèle **neuf** (voir section dédiée ci-dessus). Ce n'est pas une dette d'implémentation de ce lot : c'est la conséquence directe d'une décision déjà écrite au contrat d'E10.15a, vérifiée avant de coder. | Sans objet côté E10.15b — évoluerait uniquement si le contrat publie un jour `/notification-template-previews` (issue additive déjà nommée par l'architecte). |
| **D2 — nouvelle, mineure** | Le champ « destinataires explicites » est un simple textarea « un par ligne » plutôt qu'une liste d'entrées structurées avec ajout/suppression unitaire. Le contrat ne prescrit aucune forme d'écran ; ce choix minimise le code pour ce lot (parsing/format purs et testés, `parseRecipientsInput`/`formatRecipientsInput`) au prix d'une ergonomie un peu plus rustique qu'une liste de puces. | Amélioration UI possible sans toucher au contrat ni au client API — remplacer le textarea par une liste d'input avec bouton `+`/`-`, en gardant les mêmes fonctions de parsing comme frontière testée. |
| **D3 — nouvelle, mineure** | Aucun test de composant React (`.test.tsx`) n'existe pour cet écran — conforme au patron du dépôt (aucun `.test.tsx` n'existe nulle part dans `tests/` à la remise de ce lot, y compris pour `PricingRulesPage`/`ProductionStepsPage`, plus anciens et de complexité comparable). Toute la logique non triviale (insertion de balise, compteur SMS, validation, messages d'erreur) est extraite en fonctions pures et testée unitairement (26 cas). Le rendu React lui-même (câblage des `data-testid`, désactivation conditionnelle des champs) n'est vérifié que par lecture de code et, si l'environnement le permet, par un parcours manuel. | Si le dépôt adopte un jour Testing Library (décision transverse, hors périmètre d'une story unique), ces composants seraient de bons candidats de première couverture. |
| **D4 — héritée, non aggravée** | `send-order-notification` (Edge Function pré-E10) continue d'envoyer un courriel d'atelier à la création d'une commande boutique, avec une heuristique « admin tenant » en dur — signalée par le contrat (§8.23 §1/§9(f)) comme doublon fonctionnel dès qu'un tenant configure un modèle équivalent sur `order.step_changed`/`quote.converted`. Un tenant qui active un modèle E10.15 sur un événement voisin recevra donc potentiellement DEUX notifications tant qu'E10.15c/d ne branchent aucun envoi réel — mais **aucun envoi n'existe encore dans ce lot ni dans E10.15a**, donc le risque ne se matérialise pas avant E10.15c. | Arbitrage déjà demandé à Arnaud par le contrat (réserve (f)) : laisser vivre `send-order-notification`, ou le remplacer par un modèle une fois E10.15d livrée. Aucune action de ce lot. |

## Vérifications

- `pnpm typecheck` (`typecheck:modular`) : **0 erreur**.
- `pnpm typecheck:all` (`tsconfig.json`, couvre aussi `tests/**`) :
  **pré-existant en échec, sans rapport avec ce lot** — confirmé en isolant
  par `git stash` : la liste d'erreurs (`tests/utils/productEnrichment.
  test.ts`, `tests/server/roles-routes.test.ts`,
  `tests/modules/shop-customers/*`, `tests/server/api/magrit-api-
  composition.test.ts`, etc.) est **identique** avec et sans les fichiers de
  ce lot — aucun fichier de `src/modules/notifications/ui/` n'y apparaît.
- `pnpm gen:api:check` : aligné, aucune dérive (`git diff openapi/` et
  `git diff src/platform/api/generated/` vides — aucun endpoint modifié).
- `pnpm test:architecture` : **146/146** (34 fichiers), inchangé —
  `modular-ui-boundaries`/`api-first-boundaries` couvrent le nouveau module
  sans qu'aucune violation ne soit relevée (aucun import Supabase direct,
  aucun import profond inter-module hors barrel).
- `pnpm test:contract` : **405/405** (21 fichiers), inchangé — ce lot
  n'ajoute et ne modifie aucune route, donc aucun test de contrat neuf.
- `pnpm vitest run tests/modules/notifications/notification-templates-
  ui-helpers.test.ts` : **34/34** (26 initiaux + 8 qa-review round 1) —
  insertion de balise (curseur, sélection remplacée, bornes hors plage,
  champ vide), parsing/formatage des destinataires, compteur SMS (sous la
  limite, pile à 480, au-delà), réexposition de `channelShapeIssues` (email
  sans sujet, sms >480, cas conforme, **sujet fait uniquement d'espaces
  traité comme absent — round 1, M3b**), validation de formulaire (nom/corps
  vides, destinataires manquants/en excès/interdits selon l'audience, cumul
  avec les règles de canal, **sujet uniquement d'espaces — round 1**),
  **`validateNotificationPreviewInput` neuve (round 1, M3a)** : corps
  vide/trop long refusés avant tout appel API, sujet vide sur canal email
  refusé, jeux conformes email/sms acceptés — messages d'erreur API (code
  connu, détail par champ, code inconnu → détail du problème → fallback,
  cause non-`ApiClientError`).
- `npx vitest run --maxWorkers=2` (suite complète) : **2205 passés / 36
  skip** (+8 par rapport à la remise initiale), 3 échecs **pré-existants et
  sans rapport** (`tests/storage/product_mockups_isolation.test.ts` —
  `StorageApiError: Bucket not found`, confirmé identique avant **et** après
  ce lot par `git stash`, bucket Storage local absent de l'environnement,
  aucune mention de `notification` dans ce fichier).
- `pnpm vitest run tests/data-testid.smoke.spec.ts` : **21/21**, inchangé.
- `pnpm vitest run tests/surfaces/contribution-registry.test.ts` :
  **21/21**, inchangé (comptage statique, indépendant du nombre de modules
  enregistrés).

**Test manuel navigateur réel** : **non exécuté** dans cette session (pas
d'accès interactif à `pnpm dev` depuis cet environnement d'exécution).
Limite documentée telle que demandée par le mandat, sans bloquer la remise
— le parcours golden path (créer un modèle → insérer une balise → voir
l'aperçu → sauvegarder) reste à rejouer manuellement par `qa-review` ou
Arnaud avant merge, en particulier pour confirmer visuellement le
positionnement du curseur après insertion de balise (logique testée
unitairement via `insertTagAtCursor`, mais le focus/`setSelectionRange`
DOM réel n'est vérifiable qu'en navigateur).

## Critères d'acceptation (contrat §8.23 §8, ligne E10.15b, et CA5/CA6 du
corps du §8.23, tenus un par un)

1. **Liste des modèles, filtrable par événement/canal/actif** — **fait**.
   `NotificationTemplatesPage` : trois filtres (`eventFilterSelect`,
   `channelFilterSelect`, `statusFilterSelect`) posés sur les query params
   déjà gérés par `listTemplates()` (`event_name`/`channel`/`status`,
   vérifiés dans `client.ts` d'E10.15a avant de coder — aucun paramètre
   `is_active` booléen inventé, la forme `status: active|disabled` du
   contrat est reprise telle quelle).
2. **Éditeur : création/modification avec sélection de l'événement (parmi
   le catalogue), filtre d'étape si l'événement le permet, canal,
   destinataire, objet (email seulement), corps, actif** — **fait**.
   `NotificationTemplateFormModal` : `eventSelect` alimenté par
   `listNotificationEvents()` ; `stepFilterSelect` rendu conditionnellement
   sur `event.supports_step_filter` (vrai seulement pour
   `order.step_changed`) ; `channelSelect` borné aux canaux proposés par
   l'événement ; `audienceSelect` + `recipientsInput` conditionnel ;
   `subjectInput` affiché seulement sur canal email ; `bodyInput` ;
   `activeCheckbox`. `event_name`/`channel` en lecture seule en édition
   (immuables au contrat).
3. **L'éditeur affiche la liste des balises disponibles POUR L'ÉVÉNEMENT
   SÉLECTIONNÉ et les insère au clic (CA5)** — **fait**. `tagList` dérivé de
   `selectedEvent.tags` (catalogue serveur, jamais recopié), un bouton par
   balise (`tagInsertBtn`, `data-tag`), insertion à la position du curseur
   du champ actif via `insertTagAtCursor` (testé : insertion en position,
   remplacement de sélection, bornes hors plage, champ vide).
4. **Aperçu avant enregistrement (CA6)** — **fait, avec la limite documentée
   ci-dessus** : le bouton appelle `POST /notification-templates/{id}/
   previews` avec le texte à l'écran ; désactivé tant qu'aucun modèle n'a
   été enregistré une première fois (contrainte du contrat d'E10.15a, pas
   une omission de ce lot).
5. **Canal SMS : compteur de caractères visible, avertissement au-delà de
   480** — **fait**. `smsCharCounter`, valeur 480 vérifiée dans le contrat
   livré (pas 160, valeur de la fiche Notion d'origine explicitement
   corrigée par l'architecte).
6. **`data-testid` mandatés par la fiche, vérifiés contre la convention
   avant déclaration** — **fait**. Les 14 testid cités par le mandat
   (`notifications-config-page`, `notification-template-row` +
   `data-template-id`/`data-channel`/`data-event`,
   `notification-template-create-btn`, `notification-event-select`,
   `notification-step-filter-select`, `notification-channel-select`,
   `notification-subject-input`, `notification-body-input`,
   `notification-tag-list`, `notification-tag-insert-btn` + `data-tag`,
   `notification-preview-btn`, `notification-preview-panel`,
   `notification-sms-char-counter`, `notification-template-save-btn`) sont
   déclarés **littéralement identiques** dans
   `src/shared/presentation/testIds.ts` (scope `notificationTemplate`) et
   utilisés tels quels dans les composants — aucune chaîne improvisée.
7. **Lien de navigation depuis le menu workspace existant** — **fait**.
   `notificationsWorkspaceContribution` (groupe `commercial`, icône `bell`,
   ordre 170 — entre `pricing` à 165 et `shops` à 180, aucune collision),
   même patron que `pricing`/`document-templates`.
8. **Aucun mécanisme d'envoi, aucun consumer outbox, aucune nouvelle route
   API, pas d'écran de journal** — **respecté par construction**. Aucun
   fichier de ce lot n'ouvre de connexion réseau sortante hors les six
   opérations déjà livrées par E10.15a ; `git diff openapi/` vide ;
   `notification_logs`/`GET /notification-logs` non référencés (assignés à
   E10.15c par le contrat, non anticipés ici).

## Fichiers créés/modifiés

**Module `notifications` (UI, nouveau)**
- `src/modules/notifications/ui/workspace/NotificationTemplatesPage.tsx`
- `src/modules/notifications/ui/workspace/NotificationTemplateFormModal.tsx`
- `src/modules/notifications/ui/workspace/notification-templates.helpers.ts`
- `src/modules/notifications/ui/workspace/index.ts`
- `src/modules/notifications/ui/hooks/useNotificationTemplatesManagement.ts`
- `src/modules/notifications/ui/hooks/index.ts`
- `src/modules/notifications/ui/index.ts`
- `src/modules/notifications/manifest.ts` (nouveau)
- `src/modules/notifications/surface-contributions.ts` (nouveau)
- `src/modules/notifications/index.ts` (export du manifest/de la contribution)

**Câblage transverse (navigation, aucun changement serveur)**
- `src/surfaces/application-registry.ts`
- `src/app/surfaces/workspaceRuntimeRoutes.tsx`
- `src/app/layouts/DashboardLayout.tsx` (icône `bell`)
- `src/shared/presentation/testIds.ts` (scope `notificationTemplate`)

**Tests**
- `tests/modules/notifications/notification-templates-ui-helpers.test.ts` (nouveau, 34 cas — 26 initiaux + 8 qa-review round 1)
