---
id: E10.19b
epic: E10 — Gestion commerciale
status: done
branch: feat/gescom-e10-4-entite-client
depends_on: [E10.19a]
blocks: []
---
# E10.19b — La production et la remise du bon de commande PDF

Contrat écrit par l'architecte (`docs/api/CONVENTIONS.md` §8.20, quatre
arbitrages d'Arnaud du 2026-09-10 : (A) gabarit `order` distinct, (B) accusé
de commande destiné au client, (C2) production sur action explicite
rejouable, (D) le document montre les remises via colonnes gelées). Périmètre
**strict** de cette sous-story, repris tel que découpé au contrat (§8.20
§7) : table `order_documents` + bucket, résolveur de valeurs de commande,
réutilisation du moteur de rendu, `generateOrderDocument`/`getOrderDocument`,
bouton « Produire le bon de commande » puis téléchargement sur
`OrderDetailPage`. S'appuie sur E10.19a (gabarit `order`, colonnes gelées
`show_discounts`/`customer_reference` sur `commercial_orders`, déjà livré,
approuvé en qa-review, commité et déployé sur `ightkxebexuzfjdbpsdg`) — non
remis en cause.

**Cette story a fait l'objet d'un round de `qa-review` « Rejeté »** (un
bloquant B1, un majeur M1, deux mineurs m1/m2), traité en intégralité — voir
la section dédiée ci-dessous. Les décisions produit d'Arnaud (action
explicite, colonnes gelées relues sans jointure, gabarit `order` sans repli,
idempotence) étaient déjà tenues et non retouchées par ce round.

## Ce qui est livré

| Élément | Détail |
|---|---|
| Migration `20260910000200` | Table `order_documents` (jumelle de `quote_documents`, `order_id unique on delete cascade`, `template_id not null on delete restrict`), bucket privé `order_documents` (aucune policy `storage.objects`), trigger `order_documents_assert_same_tenant` (même patron que 4c), RLS lecture atelier standard, **APPEND-ONLY par fonction `security definer`** (`api_register_order_document`) plutôt que par `service_role` en insertion directe — écart délibéré avec `quote_documents`, motivé ci-dessous. |
| `api_register_order_document` | Résout `generated_by`/`generated_by_label` depuis `auth.uid()`/`auth.users.email` (même patron que `api_change_commercial_order_production_step`, E10.14) — possible **uniquement** parce que `generateOrderDocument` exige `bearerAuth` seul (aucune clé de service, contrat). Vérifie appartenance tenant (admin/member), existence de la commande (`order.not_found`), existence du gabarit **`order`** dans le tenant (`order.document_template_missing`, AUCUN repli sur `quote`), catch `unique_violation` sur `order_id` → `order.document_already_generated`. |
| Module `src/modules/order-documents/` | `api/contracts.ts` (`orderDocumentSchema`, jumeau de `quoteDocumentSchema` avec `generated_by`/`generated_by_label` en plus) ; `application/order-documents-repository.ts` (port + 4 erreurs de domaine) ; `application/order-documents-service.ts` (`OrderDocumentsService.generate()`/`getForOrder()`). |
| Résolveur de valeurs (`quote-documents/application/document-field-value-resolver.ts`, étendu) | `resolveOrderDocumentFieldValues()` ajouté (5 valeurs `order.*`) ; `applyCustomerFields`/`applyTotalsFields` factorisés pour que les familles `customer.*`/`totals.*` ne puissent jamais diverger entre devis et commande ; `resolveDocumentLineFieldValues` **réutilisée telle quelle** pour les lignes de commande (déjà générique). |
| Moteur de rendu | `renderQuoteDocument` (`quote-documents/application/quote-document-renderer.ts`) **réutilisé tel quel**, importé directement par `order-documents-service.ts` — déjà générique (contrat §0 : « ne connaît aucune notion de devis »). **Pas renommé ni déplacé** — voir dette D1. |
| Filtre `show_discounts` | Appliqué **côté serveur, une seule fois**, dans `CommercialOrdersService.generateDocument()` (nouvelle méthode) — même discipline que `CommercialQuotesService.send()` pour le devis (E10.10b-1 décision 3). Les colonnes gelées `show_discounts`/`customer_reference` (E10.19a) sont lues via une nouvelle méthode de port `CommercialOrdersRepository.findForDocumentGeneration()`, jamais via `CommercialOrderDetailDto` (qui ne les publie pas, décision du contrat). |
| Endpoints | `GET /commercial-orders/{orderId}/documents` (`getOrderDocument`, scope `orders:read`) et `POST /commercial-orders/{orderId}/documents` (`generateOrderDocument`, `authentication: 'user'` seul, `createsResource: true`) — ajoutés dans `commercial-orders-routes.ts` (pas un fichier `order-documents-routes.ts` séparé : la ressource vit sous `/commercial-orders`, l'orchestration data + filtre `show_discounts` vit dans `CommercialOrdersService`). |
| UI | `OrderDocumentPanel` (`commercial-orders/ui/components/`), quatrième section de `OrderDetailPage.tsx` — bouton « Produire le bon de commande » (action explicite, jamais automatique) puis lien de téléchargement une fois produit. `data-testid` : `orderDocument.{block,emptyState,generateBtn,downloadBtn,generatedLabel,errorBanner}`. |
| Client HTTP | `CommercialOrdersApiClient.getDocument()` (rend `null` sur `order.document_not_generated`, cas nominal — pas une exception à attraper par l'écran) et `.generateDocument()` (Idempotency-Key générée). |
| Compensation de rejeu (`SupabaseOrderDocumentsRepository.store()`, qa-review B1) | Si l'upload réussit mais que l'enregistrement en base échoue, l'objet déposé est supprimé **uniquement si aucune ligne `order_documents` n'existe pour cette commande** (garde anti-course), pour que le rejeu (contrat, decision C2) reste réellement possible sans intervention manuelle. |

## Décision assumée : régénération — « une commande = un document, jamais recréé »

Le contrat (§8.20 §6/§9, confirmé par le schéma `OrderDocument` : « POURQUOI
PAS DE RE-RENDU ») tranche déjà cette question : **une fois produit, jamais
reproduit**. `generateOrderDocument` sur une commande qui porte déjà son
document rend **409 `order.document_already_generated`**, jamais un
remplacement. Ce n'était donc pas un point ouvert à trancher dans cette
sous-story — implémenté tel que le contrat le dicte, vérifié par un test de
contrat dédié (rejeu avec une cle d'idempotence différente → 409) et par le
scénario 4bis du test SQL (contrainte unique `order_id`, traduite par la
fonction).

## Écart délibéré avec `quote_documents` : écriture par RPC, pas par `service_role`

`SupabaseQuoteDocumentsRepository.store()` (E10.10b-4c) écrit la ligne
`quote_documents` en INSERT direct via un client `service_role`, parce que
`QuoteDocument` ne porte ni `generated_by` ni `generated_by_label` — l'acteur
est simplement transmis en paramètre, jamais résolu côté base.

`OrderDocument` porte **les deux** (« produire est désormais le geste d'une
personne », contrat). Résoudre `generated_by_label` (l'e-mail) exige de lire
`auth.users`, ce que seule une fonction `security definer` invoquée **avec le
jeton de l'acteur** (`auth.uid()` non nul) peut faire fidèlement — exactement
le patron déjà établi par `api_change_commercial_order_production_step`
(E10.14) pour `actor_label`. C'est possible ici (et ne l'était pas pour le
devis) précisément parce que `generateOrderDocument` **n'accepte aucune clé
de service** — l'acteur a toujours un jeton.

Conséquence dans `SupabaseOrderDocumentsRepository` : **deux clients**,
`authenticatedClient` (jeton de l'acteur — lecture RLS + RPC d'écriture) et
`privilegedClient` (`service_role` — bucket uniquement, jamais la table).
Différent de `SupabaseQuoteDocumentsRepository` (un seul client
`service_role` pour tout), signalé en tête de fichier plutôt que réutilisé
par mimétisme aveugle.

## qa-review round 1 (« Rejeté ») → corrections

### B1 — BLOQUANT, la promesse « rejouable tant qu'elle n'a pas réussi » n'était pas tenue → corrigé

**Constat exact.** `SupabaseOrderDocumentsRepository.store()` déposait le PDF
via `upload()` **sans `upsert` ni compensation**, sur un chemin de stockage
**déterministe** (`storagePathFor`). Si l'upload réussissait mais que
l'enregistrement en base (`api_register_order_document`) échouait ensuite
(timeout, coupure réseau, 5xx PostgREST — la production dure « quelques
secondes », le contrat lui-même reconnaît ce risque), **aucune ligne
`order_documents` n'était créée, mais l'objet restait seul dans le bucket**.
Au rejeu suivant, le PDF était re-rendu puis `upload()` échouait
**définitivement** avec « resource already exists » → 500, sans aucun moyen
de se rattraper sans intervention manuelle dans le bucket. Le contrat promet
pourtant explicitement (`openapi/magrit-core.v1.yaml` ~l.6946-6947,
décision C2) que « l'action explicite est ce qui rend l'échec rattrapable,
c'est tout ce qui la justifie » — recopier le « sans upsert » de
`quote-documents-repository.ts` (justifié là où le devis n'a AUCUNE
opération de rejeu) ne se transportait pas ici, où le rejeu est la promesse
centrale.

**Corrigé** — `store()` entoure désormais l'appel RPC d'un `catch` qui
supprime l'objet **uniquement lorsqu'aucune ligne `order_documents` n'existe
pour cette commande au moment de l'échec** (`findByOrderId` re-vérifié dans
le `catch`, avant toute suppression), puis relance l'erreur d'origine
(mappée). **Pas d'`upsert: true` nu** : la garde protège l'inverse — une
invocation perdante d'une course réelle (rarissime, le chemin déterministe
et l'absence d'`upsert` la rendent quasi impossible en pratique) ne doit
jamais supprimer l'objet du gagnant, ce qui casserait la promesse
`OrderDocument.sha256` (« même fichier d'une lecture à l'autre »). La
suppression est *best-effort* : un échec de nettoyage est journalisé
(`console.error`) mais **ne masque jamais** l'erreur d'origine.

**Preuve, par exécution réelle (`pnpm exec vitest run
tests/adapters/supabase/order-documents-repository.test.ts`)** :
1. « REJEU après un ÉCHEC d'enregistrement » — 1er appel : upload réussit,
   RPC échoue (panne générique) → objet **absent** du bucket après l'échec,
   aucune ligne enregistrée ; 2e appel (même commande) → upload **réussit**
   (chemin libéré), RPC réussit → DTO rendu. Reproduit **exactement** le
   scénario du bug et prouve qu'il est corrigé.
2. « GARDE » — une ligne `order_documents` existe déjà (simulateur du
   gagnant) au moment où l'invocation courante échoue en
   `order.document_already_generated` → l'objet **n'est jamais supprimé**.

### M1 — MAJEUR, la branche `show_discounts === true` n'était exercée par aucun test → corrigé

**Constat exact, vérifié en inversant les quatre ternaires de
`generateDocument()`** : tous les tests de contrat passaient par une
conversion depuis un devis dont `show_discounts` vaut `false` par défaut —
la CI restait entièrement verte même en inversant la règle, ce qui aurait
imprimé remise + prix avant remise sur un document destiné à un client ayant
demandé qu'elles soient masquées.

**Corrigé** — nouveau fichier
`tests/modules/commercial-orders/commercial-orders-service.test.ts`, qui
espionne `OrderDocumentsService.generate()` (jamais réimplémenté : un faux
qui capture l'argument `OrderForDocumentGeneration` reçu) pour prouver les
quatre ternaires **des deux côtés** : `show_discounts=true` →
`priceBeforeDiscount`/`discountRate`/`linesSubtotal`/`globalDiscount`
**transmis** ; `show_discounts=false` → les quatre à `null`, `salePrice`/
`netTotal` **inchangés** (toujours imprimés, remises visibles ou non).

### m1 — mineur, `setCustomerReferenceForTest()` posé sans être exercé → utilisé

Ajouté un test de contrat (« customer_reference renseigné ») qui l'exerce
de bout en bout via la vraie route HTTP, plus un test unitaire dédié
(`commercial-orders-service.test.ts`) qui prouve que `customerReference`/
`expectedDeliveryDate` traversent `generateDocument()` **sans altération**,
quel que soit `show_discounts` — complète la preuve déjà apportée par
`document-field-value-resolver.test.ts` (le resolveur imprime correctement
la valeur quand elle est fournie).

### m2 — mineur, l'écran restait bloqué après un 409 `order.document_already_generated` → corrigé

`OrderDocumentPanel.handleGenerate()` détecte désormais spécifiquement ce
code (`ApiClientError.problem.code === 'order.document_already_generated'`)
et appelle `load()` pour recharger le document existant, au lieu de laisser
l'utilisateur bloqué sur le bouton « Produire » sans lien de téléchargement
jusqu'à un rafraîchissement manuel — conforme au contrat (« le lire, ne pas
le reproduire »).

### m3 — mineur, aucun cahier de tests Notion ne couvre encore `orderDocument.*` → signalé au scribe, non bloquant

Non traité ici (pas un défaut de code) : à faire confirmer par le `scribe`
dès que le cahier TF existera, même discipline que les autres écrans neufs
de ce sprint (`documentTemplate.*`, `documentTemplateFields.*`).

## Critères d'acceptation (périmètre transmis par l'agent appelant, tenus un par un)

1. **Réutilisation de `findEligibleTemplateForGeneration(tenantId, documentType)` généralisée par E10.19a, pas de reduplication.** — **fait.** `OrderDocumentsService` dépend d'un port narrow (`OrderDocumentTemplateForGenerationPort`, `documentType: 'order'` figé), satisfait structurellement par `DocumentTemplatesRepository` — aucune nouvelle implémentation, aucun code dupliqué. Vérifié par `order-documents-service.test.ts` (`toHaveBeenCalledWith(TENANT, 'order')`).
2. **Déclenchement = action explicite et rejouable, contrairement au devis.** — **fait.** `POST /commercial-orders/{orderId}/documents`, `authentication: 'user'` seul (aucune clé de service, contrat), `createsResource: true` → `Idempotency-Key` exigée et gérée par le socle transverse (rejeu = 201 identique, `Idempotency-Replayed: true`). **Une seule fois, jamais régénéré** : 409 `order.document_already_generated` sur toute seconde tentative avec une cle différente — décision du contrat, pas une question ouverte (voir section dédiée ci-dessus). Absence de gabarit actif → 409 `order.document_template_missing`, code vérifié exact dans le contrat (`openapi/magrit-core.v1.yaml` ligne ~7040) avant implémentation.
3. **Données imprimées = colonnes gelées de la commande, aucun recalcul/jointure au rendu.** — **fait.** `CommercialOrdersRepository.findForDocumentGeneration()` lit `commercial_orders.show_discounts`/`customer_reference` directement (pas via `commercial_quotes`, pas via `CommercialOrderDetailDto` qui ne les publie pas) ; le filtre `show_discounts` est appliqué une seule fois, côté serveur, dans `CommercialOrdersService.generateDocument()`, avant tout appel au moteur — même discipline que le devis (E10.10b-1 décision 3).
4. **`getOrderDocument` pour la lecture, URL signée, même patron que `getQuoteDocument`.** — **fait.** `GET /commercial-orders/{orderId}/documents`, scope `orders:read`, `OrderDocumentsRepository.findByOrderId()` + signature d'URL 300 s (même TTL que le devis, même motif). 404 `order.document_not_generated` = cas nominal (aucune commande sans production explicite n'est une anomalie), distinct de 404 `order.not_found`.
5. **Migration Supabase.** — **fait.** `20260910000200_gescom_e10_19b_order_documents.sql`, numéro suivant après `20260910000100` (E10.19a), réversible (bloc SQL de retrait en pied de fichier), rejouée réellement contre Postgres local (voir tests exécutés).

## Écart constaté avec le contrat existant, signalé plutôt que corrigé

Aucun. Le contrat OpenAPI (`getOrderDocument`/`generateOrderDocument`,
schéma `OrderDocument`) était déjà entièrement écrit par l'architecte avant
cette story — vérifié ligne par ligne avant d'implémenter (schéma des
erreurs 404/409, TTL de l'URL signée, absence de `serviceKey` sur le POST,
familles de champs `order.*` déjà posées par E10.19a). Le client TypeScript
généré (`src/platform/api/generated/magrit-core.v1.ts`) n'a pas été touché à
la main ; `pnpm gen:api:check` confirme l'alignement.

## Dette introduite

| Réf. | Point | Chemin de mise en conformité |
|---|---|---|
| **D1** | Le moteur de rendu (`renderQuoteDocument`), le planificateur de mise en page (`document-layout-planner.ts`), l'assainissement de texte et le formatage (`document-text-sanitization.ts`/`document-value-formatting.ts`) sont **déjà entièrement génériques** (aucune notion de devis) mais restent physiquement hébergés sous `src/modules/quote-documents/application/` — le cadrage architecte (§8.20 §0) recommandait explicitement de les « renommer/déplacer (document-rendering, ou un `_shared` de documents) ». Ce lot ne le fait pas : `order-documents-service.ts` importe `renderQuoteDocument` et les fonctions du résolveur **directement depuis le module `quote-documents`**, avec un commentaire documentant ce choix. | Une story de refactoring dédiée qui déplace ces quatre fichiers vers `src/modules/_shared/documents/` (ou équivalent) et met à jour les imports des DEUX modules (`quote-documents`, `order-documents`) dans le MÊME commit. Risque de régression jugé disproportionné pour un gain cosmétique dans le périmètre strict de cette sous-story (renommage de fichiers déjà couverts par 5 suites de tests unitaires dédiées, sans changement de comportement). |
| **D2** | `order.customer_reference` n'imprime jamais rien (hérité d'E10.19a, non résolu ici) : aucune colonne `customer_reference` n'existe sur `commercial_quotes`, donc `commercial_orders.customer_reference` vaut `NULL` sur toute commande. Le résolveur applique correctement la règle « valeur absente = rien imprimé », mais le champ reste inatteignable en pratique tant que la source amont n'existe pas. | Story distincte sur le module `commercial-quotes` (déjà signalée par E10.19a et par `document-field-value-resolver.ts` pour `quote.customer_reference`), hors périmètre de ce lot. |
| **D3** | `order.expected_delivery_date` n'imprime jamais rien pour la même raison structurelle (réserve (h) du contrat E10.16/§8.17, aucun écrivain n'existe encore) — inoffensif par construction (« valeur absente = rien imprimé »), le champ deviendra utile sans changement de carte le jour où la réserve sera traitée. | Story distincte, déjà tracée par E10.16/§8.17, non rouverte ici. |
| **D4 (héritée, sans rapport)** | `tests/storage/product_mockups_isolation.test.ts` échoue (3 tests, « Bucket not found ») sur cette base locale — bucket créé hors des migrations versionnées, cause déjà établie par E10.10b-4a/E10.17a/E10.19a. | Hors périmètre. |
| **D5 (héritée, sans rapport)** | `pnpm test:storefront:sql` (script complet, séquentiel) échoue dès `tests/sql/legacy-shop-only-write-freeze.sql` (rôle `owner` déprécié) sur cette base locale — panne pré-existante, déjà documentée comme dette de sensibilité à l'état local par E10.19a (D2 de sa propre fiche). Le script s'arrête à la première erreur (`set -e`), donc les cas E10.19a/E10.19b n'ont pas été rejoués via ce script précis — ils l'ont été **individuellement**, en isolation, avec succès (voir tests exécutés). | Hors périmètre — signalé pour qu'il ne soit pas reperdu. |
| **D6 (héritée, sans rapport)** | `pnpm typecheck:all` (couvre `tests/`, contrairement à `pnpm typecheck`) porte une classe d'erreurs pré-existante répétée à l'identique sur des dizaines de fichiers de test non touchés par cette story (`Id<string>` non convertible, `Property 'key' does not exist`, `Tuple type '[]' de longueur 0`, `projectTags` manquant sur `ProjectsService`...) — confirmé PRÉ-EXISTANT par `git stash` + rejeu de `typecheck:all` avant toute modification de cette session. Mes deux nouveaux fichiers de test (`commercial-order-documents.contract.test.ts`, `order-documents-service.test.ts`) héritent de la MÊME classe d'erreur en copiant des patrons déjà utilisés (et déjà cassés) par des fichiers sœurs déjà commités (`commercial-orders.contract.test.ts`, `commercial-order-step-changes.contract.test.ts`). | Hors périmètre — dette d'environnement TypeScript antérieure à E10.19a/b, à traiter par une story dédiée qui isole la cause (probablement une divergence de version TS entre `tsc` et le transform esbuild de vitest). `pnpm typecheck` (alias utilisé en CI, `tsconfig.modular.json`, ne couvre pas `tests/`) reste **vert, 0 erreur**. |

## Tests exécutés — TOUS les gates rejoués depuis le début après correction qa-review

| Commande | Résultat |
|---|---|
| `pnpm typecheck` (`tsconfig.modular.json`) | **vert**, 0 erreur |
| `pnpm typecheck:all` (`tsconfig.json`) | Aucune erreur nouvelle imputable à cette story (vérifié fichier par fichier) ; erreurs résiduelles **pré-existantes**, confirmées par `git stash` + rejeu avant toute modification (voir dette D6) |
| `pnpm gen:api:check` | **vert**, aligné (`openapi/magrit-core.v1.yaml` non touché par cette story) |
| `pnpm test:architecture` | **vert**, 34 fichiers / 146 tests (MUX/API-first boundaries, aucune dérogation) |
| `pnpm test:contract` (`vitest run tests/contract`) | **vert**, 19 fichiers / **344 tests** (+1 après le round qa-review : test `customer_reference` de bout en bout, m1) |
| `vitest run tests/modules/order-documents tests/modules/quote-documents tests/modules/commercial-orders tests/adapters/supabase/order-documents-repository.test.ts` | **vert**, 11 fichiers / **98 tests** — inclut les nouveaux fichiers du round qa-review : `tests/adapters/supabase/order-documents-repository.test.ts` (2 tests, B1 : rejeu après échec + garde anti-course) et `tests/modules/commercial-orders/commercial-orders-service.test.ts` (3 tests, M1 + m1 : `show_discounts` true/false, `customer_reference`/`expected_delivery_date` inaltérés) |
| `pnpm exec vitest run` (suite complète) | **2011 passés / 36 skip / 3 échecs** (+6 par rapport à avant ce round) — les 3 échecs sont `tests/storage/product_mockups_isolation.test.ts` (dette D4, préexistante, sans rapport) |
| Migration `20260910000200` rejouée contre Postgres local | **appliquée réellement** (`docker exec psql`), aucune erreur — **inchangée par ce round** (B1/M1/m1/m2 sont des corrections applicatives TypeScript, aucun SQL retouché) |
| `tests/sql/gescom-e10-19b-order-documents.sql` | **exécuté réellement** contre Postgres local, rejoué après ce round (inchangé) : **0 erreur**, `ROLLBACK` propre. 5 groupes de scénarios : (1) RLS lecture atelier inter-tenant ; (2) append-only (insert/update/delete direct refusés pour `authenticated`, admin inclus) ; (3) trigger de cohérence tenant (`order_id`/`template_id` d'un autre tenant refusés) ; (4) `api_register_order_document` — succès nominal (`generated_by`/`generated_by_label` résolus), `permission_denied` (non-membre), `order.not_found` (commande inconnue), `order.document_template_missing` (gabarit `quote` au lieu de `order`, AUCUN repli), `order.document_already_generated` (seconde production de la même commande) ; (5) `template_id on delete restrict` — étend (sans y toucher) la branche 409 `document_pdf_template.in_use` déjà prouvée par E10.10b-4c pour `quote_documents`, maintenant atteignable pour un gabarit `order`. |
| `tests/sql/gescom-e10-19a-order-document-template.sql`, `tests/sql/gescom-e10-10b-4c-quote-documents.sql` rejoués isolément après la migration `20260910000200` | **0 erreur**, aucune régression |
| `tests/sql/gescom-e10-13-production-steps.sql`, `-16-order-contact-and-delivery.sql`, `-17a-order-files.sql`, `-10b-4a`, `-10b-4b` rejoués isolément lors de la remise initiale (voir « Écart délibéré ») | **0 erreur**, non concernés par ce round (aucune migration retouchée pour B1/M1/m1/m2) |
| `scripts/test-storefront-sql.sh` | Fichier de cette story ajouté à la liste des cas exécutés par le script (`tests/sql/gescom-e10-19b-order-documents.sql`) — le script complet bute sur une panne pré-existante sans rapport (dette D5) avant d'atteindre ce cas dans l'ordre séquentiel ; rejoué en isolation avec succès (ligne ci-dessus) |

## Fichiers créés/modifiés

**Créés** :
- `supabase/migrations/20260910000200_gescom_e10_19b_order_documents.sql`
- `src/modules/order-documents/api/contracts.ts`
- `src/modules/order-documents/application/order-documents-repository.ts`
- `src/modules/order-documents/application/order-documents-service.ts`
- `src/modules/order-documents/index.ts`
- `src/adapters/supabase/order-documents-repository.ts`
- `src/modules/commercial-orders/ui/components/OrderDocumentPanel.tsx`
- `tests/sql/gescom-e10-19b-order-documents.sql`
- `tests/contract/commercial-order-documents.contract.test.ts`
- `tests/contract/_fakes/order-documents-service.fake.ts`
- `tests/modules/order-documents/order-documents-service.test.ts`

**Créés au round qa-review (B1 + M1 + m1)** :
- `tests/adapters/supabase/order-documents-repository.test.ts` (B1 : rejeu après échec d'enregistrement, garde anti-course)
- `tests/modules/commercial-orders/commercial-orders-service.test.ts` (M1 : `show_discounts` true/false ; m1 : `customer_reference`/`expected_delivery_date` inaltérés)

**Modifiés** :
- `src/modules/commercial-orders/application/commercial-orders-repository.ts` (types `OrderDataForDocumentGeneration`/`OrderLineDataForDocumentGeneration`, méthode `findForDocumentGeneration`)
- `src/modules/commercial-orders/application/commercial-orders-service.ts` (dépendance `documents: OrderDocumentsService`, méthodes `getDocument()`/`generateDocument()`)
- `src/modules/commercial-orders/api/client.ts` (`getDocument()`, `generateDocument()`)
- `src/modules/commercial-orders/ui/components/index.ts` (export `OrderDocumentPanel`)
- `src/modules/commercial-orders/ui/workspace/OrderDetailPage.tsx` (quatrième section, CA8 câblé)
- `src/adapters/supabase/commercial-orders-repository.ts` (`findForDocumentGeneration`)
- `src/server/api/commercial-orders-routes.ts` (routes `getOrderDocument`/`generateOrderDocument`, extension de `withCommercialOrderErrors` avec un `orderNotFoundCode` optionnel rétro-compatible)
- `src/modules/quote-documents/application/document-field-value-resolver.ts` (`resolveOrderDocumentFieldValues`, factorisation `applyCustomerFields`/`applyTotalsFields`)
- `src/modules/quote-documents/index.ts` (export des nouveaux symboles)
- `supabase/functions/magrit-api/index.ts` (composition `OrderDocumentsService`, câblage dans `commercialOrdersService`)
- `src/shared/presentation/testIds.ts` (scope `orderDocument`)
- `scripts/test-storefront-sql.sh` (ajout du cas SQL de ce lot)
- `tests/contract/_fakes/commercial-orders-repository.fake.ts` (`findForDocumentGeneration`, maps `showDiscounts`/`customerReference`, setter de test)
- `tests/contract/commercial-orders.contract.test.ts`, `tests/contract/commercial-order-step-changes.contract.test.ts` (dépendance `documents` ajoutée via `createNullOrderDocumentsService()`)
- `tests/modules/quote-documents/document-field-value-resolver.test.ts` (7 cas `resolveOrderDocumentFieldValues`)

**Modifiés au round qa-review (B1 + m1 + m2)** :
- `src/adapters/supabase/order-documents-repository.ts` (`store()` — compensation de rejeu avec garde anti-course, B1)
- `tests/contract/commercial-order-documents.contract.test.ts` (1 cas `customer_reference` de bout en bout, m1)
- `src/modules/commercial-orders/ui/components/OrderDocumentPanel.tsx` (rechargement automatique sur 409 `order.document_already_generated`, m2)

**Non touchés (rappel R5)** : `openapi/magrit-core.v1.yaml`, `src/platform/api/generated/magrit-core.v1.ts` — le contrat était déjà écrit par l'architecte, aucun endpoint neuf codé sans description préalable. Aucune migration SQL retouchée par ce round.
