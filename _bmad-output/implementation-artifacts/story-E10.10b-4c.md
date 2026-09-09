---
id: E10.10b-4c
epic: E10 — Gestion commerciale
status: done (qa-review round 2 corrigée — B1/B2/B3/B5 + B4/B4-bis arbitrés par l'architecte — nouvelle revue distincte requise avant merge)
branch: feat/gescom-e10-4-entite-client
depends_on: [E10.10b-4a, E10.10b-4b]
blocks: []
---
# E10.10b-4c — Moteur de génération du document et branchement sur l'envoi

**Ce document couvre DEUX passes** : la livraison initiale, puis le round 2
de qa-review ("Changes Requested", 5 bloquants B1/B2/B3/B5 + B4 tranché par
l'architecte avec un bug additionnel B4-bis) et ses corrections — détaillées
dans leur propre section en fin de fichier. Tous les gates ont été **rejoués
intégralement** après correction, aucun résultat de la première passe n'étant
réutilisé tel quel.

Contrat : `docs/api/CONVENTIONS.md` §8.18 (§5 « la génération », §7 réserves
(a)/(j)), `openapi/magrit-core.v1.yaml` (`QuoteDocument`, `getQuoteDocument`,
`getStorefrontQuoteDocument`, réponse `500` de `sendQuote`) — schémas et
opérations déjà écrits par l'architecte avant cette story, non modifiés ici.

Dernière sous-story de la décomposition 4a (import gabarit) → 4b (éditeur de
coordonnées) → 4c (ici). Périmètre : moteur `pdf-lib` pur, table
`quote_documents` + bucket privé, branchement dans `sendQuote` (génération
**avant** la transition d'état), extension du corps d'e-mail Resend (2×2),
`GET /quotes/{id}/documents` et `GET /storefront-quotes/{id}/documents`.

## Critères d'acceptation, tenus un par un

1. **Moteur `renderQuoteDocument` — pdf-lib pur, `drawText`, pas d'AcroForm.**
   — **fait.** `src/modules/quote-documents/application/quote-document-renderer.ts` :
   charge le fond (`PDFDocument.load`), vérifie la géométrie contre
   `DocumentPdfTemplateDetail.pages` (défense en profondeur — 500 explicite si
   incohérence), embarque une police standard pdf-lib par rôle référencé
   (`StandardFonts`, aucun repli police libre — mesure 4 de la preuve 4a
   reprise et re-confirmée par un test dédié), délègue le calcul de mise en
   page à `document-layout-planner.ts` (voir CA2), puis exécute
   `page.drawText()` par bloc. Débordement du bloc de lignes : recopie
   `continuation_page_index` (ou `page_index` si absente), insérée juste
   après la page qui porte le bloc — `computeDocumentPageCount()` **réutilisée
   telle quelle** depuis `document-templates/application/document-field-map-validator.ts`
   (déplacée depuis l'éditeur 4b, qui la ré-exporte désormais, consigne
   explicite du cadrage : ne pas dupliquer ce calcul).

2. **Séparation moteur pur / planification pure — testabilité.** — **fait,
   ajout à l'architecture prévue.** `document-layout-planner.ts` calcule TOUT
   le routage des champs (familles `quote.`/`customer.` une fois sur leur
   page, `totals.` sur la dernière page produite, `page.` sur toutes les
   pages), l'insertion des pages de continuation et le repli/troncature du
   texte (`layoutLines`/`truncateToWidth`), **sans aucune dépendance à
   `pdf-lib`** : une mesure de largeur de texte est injectée
   (`TextMeasurer`). `quote-document-renderer.ts` ne fait plus que charger le
   fond, embarquer les polices, appeler le planificateur avec
   `font.widthOfTextAtSize()` comme mesure réelle, puis exécuter le plan.
   Choix fait après avoir buté sur une incompatibilité `pdfjs-dist`/pool de
   threads Vitest (voir « Ce qui n'a pas pu être vérifié »).

3. **Table `quote_documents`, RLS testée réellement, append-only,
   `template_id` obligatoire.** — **fait.**
   `supabase/migrations/20260909040000_gescom_e10_10b_4c_quote_documents.sql` :
   `quote_id` unique (`on delete cascade`), `template_id not null`
   (`on delete restrict` — rend enfin ATTEIGNABLE la branche `in_use` de
   `api_delete_document_pdf_template`, jusque-là inatteignable faute de cette
   table), contrainte `storage_path` canonique, trigger
   `quote_documents_assert_same_tenant` (même patron que le correctif
   qa-review B1 de 4b), RLS `quote_documents_select` (lecture atelier ouverte
   à tout membre), **aucune policy d'écriture** + `revoke insert, update,
   delete ... from anon, authenticated` + `grant select, insert ... to
   service_role` (même discipline exacte que `outbox_events`). Fonction
   `api_get_storefront_quote_document` (security definer, `p_opaque_token`,
   même patron que `api_get_storefront_quote` de b-1) pour la lecture
   PORTAIL — jamais une policy ouverte au rôle `anon`, conformément au
   contrat. **Testé réellement** : `tests/sql/gescom-e10-10b-4c-quote-documents.sql`,
   exécuté contre Supabase local (Docker disponible dans cet environnement,
   contrairement aux sessions précédentes) — 15 scénarios, tous verts :
   isolation inter-tenant en lecture, append-only (insert/update/delete
   refusés à un admin authentifié), trigger de cohérence tenant (quote_id ET
   template_id), branche `in_use` désormais atteignable, et les quatre causes
   indiscernables de `api_get_storefront_quote_document` (draft, autre
   client, autre tenant, jeton invalide) — toutes rendent un jeu de lignes
   vide. Exécuté aussi en séquence avec 4a/4b (`gescom-e10-10b-4a`/`4b`) sans
   régression.

4. **Branchement sur `sendQuote` — génération avant transition d'état,
   jamais sur un renvoi.** — **fait.** `CommercialQuotesService.send()`
   (`src/modules/commercial-quotes/application/commercial-quotes-service.ts`) :
   au **premier** envoi seulement (`!isResend`), relit le devis complet
   (`findDetailById`), et si au moins une ligne existe, appelle
   `QuoteDocumentsService.generateForFirstSend()` **avant**
   `repository.sendQuote()`. C'est cet ordre — pas une transaction
   distribuée — qui garantit « le devis reste `draft` » en cas d'échec :
   `repository.sendQuote()` n'est simplement jamais atteint. `show_discounts`
   (résolu ou déjà enregistré) filtre les champs remise/prix-avant-remise
   **avant** d'atteindre le moteur (E10.10b-1 décision 3, appliquée une
   seule fois, jamais dans la carte de champs).

5. **Règle d'échec asymétrique — 500 `quote.document_generation_failed`,
   idempotence non « terminée ».** — **fait.**
   `QuoteDocumentsService.generateForFirstSend()` rend `null` si aucun
   gabarit éligible (condition à QUATRE termes tenue par
   `DocumentTemplatesRepository.findEligibleTemplateForGeneration()` :
   `document_type='quote'`, `status='ready'`, `is_active`, `is_default`, ET
   `has_field_map`) — cas nominal, l'envoi continue sans pièce jointe. Si un
   gabarit ÉTAIT éligible et que la génération/le stockage échoue, lève
   `QuoteDocumentGenerationFailedError`, traduite par
   `commercial-quotes-routes.ts` en 500 `quote.document_generation_failed`
   (pas 502). Aucune entrée d'idempotence « terminée » n'est nécessaire côté
   applicatif : `gescom-middleware.ts` appelle déjà `safeRelease` (pas
   `complete`) sur toute erreur qui remonte jusqu'à lui — comportement
   générique du socle, vérifié par les tests de contrat existants, pas
   modifié ici.

6. **`GET /quotes/{quoteId}/documents` — deux codes 404 distincts.** —
   **fait.** `src/server/api/quote-documents-routes.ts` : vérifie d'abord
   l'existence du devis (`CommercialQuotesService.getSummary`) → 404
   `quote.not_found` sinon ; puis la présence du document
   (`QuoteDocumentsService.getForQuote`) → 404
   `quote.document_not_generated` sinon. Testé par
   `tests/contract/quote-documents.contract.test.ts`.

7. **`GET /storefront-quotes/{quoteId}/documents` — 404 indiscernable.** —
   **fait.** Une seule branche : `QuoteDocumentsService.getForStorefrontSession()`
   rend `null` sur toutes les causes confondues, traduit en 404
   `quote.not_found` unique, jamais un code distinct.

8. **Extension `ResendQuoteSentEmailSender` — 2×2, corps « sans pièce
   jointe » inchangé.** — **fait, textes NON validés par Arnaud (voir
   écarts).** `QuoteSentEmail.document: QuoteSentEmailDocument | null` ajouté
   au port (`quote-sent-notification-consumer.ts`) ; le corps existant
   (`isResend` × pas de document) n'a **pas été touché** — mêmes assertions
   de test qu'avant ce lot, toutes vertes. Deux nouveaux textes ajoutés pour
   `document !== null` (premier envoi / renvoi), rédigés par ce lot faute de
   validation commerciale disponible dans cette session — signalé
   explicitement, à faire relire avant mise en production (même exigence que
   §8.13sexies pour le premier jeu de textes).

9. **Attachement Resend — forme vérifiée sur la documentation réelle,
   Context7 indisponible.** — **fait, avec dérogation documentée.** Aucun
   outil Context7 n'était exposé dans cet environnement d'exécution. Au lieu
   de coder de mémoire d'entraînement (interdit par la règle absolue du
   projet), la documentation ET le schéma OpenAPI **officiels et actuels**
   de Resend ont été récupérés par accès réseau direct
   (`https://resend.com/openapi.json`, `https://resend.com/docs/dashboard/emails/attachments.md`,
   le 2026-09-09) : champ `attachments: [{ content, filename, content_type? }]`,
   `content` en **base64**, limite de 40 Mo par e-mail après encodage. Codé
   tel quel dans `ResendQuoteSentEmailSender`.

10. **Téléchargement UNE FOIS par événement, pas par destinataire.** —
    **fait, testé.** `QuoteSentNotificationConsumer.consume()` appelle
    `QuoteDocumentAttachmentGateway.findAttachment()` **une seule fois**,
    avant la boucle `Promise.all(recipients.map(...))`, et réutilise le même
    objet pour chaque envoi. Test dédié :
    `tests/modules/commercial-quotes/quote-sent-notification-consumer.test.ts`
    (« telecharge le document UNE SEULE FOIS par evenement »).

11. **Génération avant l'écriture de l'événement outbox.** — **fait, par
    construction.** La génération a lieu **avant** `repository.sendQuote()`,
    lui-même appelé **avant** `this.outbox.publish({ name: 'quote.sent', ... })`
    dans `CommercialQuotesService.send()` — l'ordre du code EST la preuve,
    aucune réorganisation supplémentaire n'était nécessaire.

12. **Devis déjà envoyés sans document — 404 pour toujours, aucune reprise
    rétroactive.** — **fait, par absence de mécanisme, pas par garde
    explicite.** Aucune opération publique de génération n'est exposée
    (contrat), et `generateForFirstSend()` n'est appelée que par
    `CommercialQuotesService.send()` au premier envoi. Un devis `sent` avant
    E10.10b-4c n'a et n'aura jamais de ligne `quote_documents` : les deux
    `GET .../documents` rendent 404 indéfiniment. Vérifié par construction
    (aucun chemin de code ne peut produire l'inverse) et par le scénario SQL
    5 (devis `draft`/sans document → jeu de lignes vide).

## Ce qui est livré

- **Migration** : `supabase/migrations/20260909040000_gescom_e10_10b_4c_quote_documents.sql`
  (table `quote_documents`, bucket `quote_documents`, trigger de cohérence
  tenant, RLS, `api_get_storefront_quote_document`).
- **Module `quote-documents`** (`src/modules/quote-documents/`) :
  - `api/contracts.ts` — schéma `QuoteDocument`, alignement contrat.
  - `application/document-value-formatting.ts` — formatage FR (dates courtes,
    montants avec espace insécable, taux en pourcentage).
  - `application/document-field-value-resolver.ts` — résolution
    `DocumentFieldId`/`DocumentLineFieldId` → valeur imprimable, filtrage
    `show_discounts` déjà fait par l'appelant.
  - `application/document-layout-planner.ts` — planification PURE (routage,
    débordement, repli/troncature), sans `pdf-lib`.
  - `application/quote-document-renderer.ts` — exécution `pdf-lib` réelle.
  - `application/quote-documents-repository.ts` — port + erreurs de domaine.
  - `application/quote-documents-service.ts` — orchestrateur
    (génération/lecture).
  - `application/customer-document-data-gateway.ts` — assemble les données
    client à partir de `CustomersRepository` (E10.4) déjà existant, aucune
    nouvelle requête.
- **Adaptateurs Supabase** :
  - `src/adapters/supabase/quote-documents-repository.ts` (table + bucket
    `quote_documents`, URL signée 300 s).
  - `src/adapters/supabase/quote-document-attachment-gateway.ts` (octets
    base64 pour Resend, distinct de la représentation « URL signée »).
  - Extension de `src/adapters/supabase/document-templates-repository.ts` :
    `findEligibleTemplateForGeneration()` (condition à quatre termes,
    télécharge le fond + relit la carte).
- **Routes** : `src/server/api/quote-documents-routes.ts` (2 opérations),
  enregistrées dans `gescom-routes.ts`.
- **Extension `commercial-quotes`** : `commercial-quotes-service.ts` (send),
  `commercial-quotes-routes.ts` (500 `quote.document_generation_failed`),
  `quote-sent-notification-consumer.ts` (port `document`/`QuoteDocumentAttachmentGateway`).
- **Extension Resend** : `src/adapters/resend/quote-sent-email-sender.ts`
  (2×2, `attachments`).
- **Composition** : `supabase/functions/magrit-api/index.ts` (réordonné pour
  construire `documentTemplatesRepository`/`quoteDocumentsService` avant
  `commercialQuotesService`), `src/server/api/outbox-dispatch-composition.ts`
  (`SupabaseQuoteDocumentAttachmentGateway` câblé sur le drain).
- **Déplacement (pas de duplication)** : `computeDocumentPageCount()` de
  `document-templates/ui/workspace/field-editor/pdf-coordinates.ts` vers
  `document-templates/application/document-field-map-validator.ts` (ré-
  exportée à l'identique pour ne rien casser côté éditeur 4b).

## Écarts remontés — signalés, pas dissimulés

- **E1 — `quote.customer_reference` : aucune colonne source.** Le contrat
  publie ce `DocumentFieldId`, mais `commercial_quotes` ne porte aucun champ
  de ce nom (vérifié : ni dans `20260901000600` ni dans aucune migration
  ultérieure d'E10.3/E10.9/E10.10a). Le moteur ne l'imprime **jamais**
  (valeur absente = rien d'imprimé, comme le veut le contrat) — mais un
  imprimeur qui positionnerait ce champ sur son gabarit ne verrait donc
  jamais rien s'y afficher. Combler ce trou est une story sur le module
  `commercial-quotes` (ajouter la colonne), hors périmètre de 4c.
- **E2 — `line.product_config_summary` : repli générique, pas une mise en
  forme métier.** Aucun mapping business (gamme → « 200 ex. — 135g couché
  brillant ») n'existe dans le dépôt pour transformer un `product_config`
  JSON arbitraire en résumé lisible. `summarizeProductConfig()` produit un
  résumé générique (paires clé/valeur des champs primitifs du premier
  niveau). Documenté en tête de `document-field-value-resolver.ts`.
- **E3 — Textes Resend « avec pièce jointe » non validés par Arnaud.** Rédigés
  par ce lot par nécessité (le contrat exige 4 libellés distincts dès cette
  livraison), mais la rédaction commerciale n'a pas été revue — à faire
  avant mise en production, même exigence que pour le premier jeu de textes
  (§8.13sexies).
- **E4 — Ordre des pages de continuation, non explicité par le contrat.**
  Le contrat dit que le moteur « recopie » `continuation_page_index` sans
  dire où l'insérer parmi les pages déjà produites. Choix retenu : la copie
  s'insère juste après la page qui porte le bloc de lignes, et les pages du
  fond qui suivaient (ex. CGV) restent après, dans leur ordre d'origine —
  y compris si `continuation_page_index` désigne une page dédiée, qui
  apparaît alors DEUX fois (sa position normale ET la/les copie(s) de
  reprise). Testé et documenté explicitement (`document-layout-planner.test.ts`).
- **E5 — Léger décalage entre `quote_documents.generated_at` et
  `commercial_quotes.sent_at`.** Le contrat dit qu'ils « coïncident par
  construction » ; en pratique, `generated_at` est l'horloge applicative lue
  juste avant l'appel à `repository.sendQuote()`, qui écrit `sent_at = now()`
  côté Postgres quelques millisecondes plus tard. Aligner les deux
  exactement demanderait de faire accepter un timestamp explicite à
  `api_send_commercial_quote()` (fonction déjà déployée, E10.10a) — jugé hors
  périmètre pour un écart de l'ordre de la milliseconde, sans conséquence
  fonctionnelle. Signalé plutôt que corrigé sans mandat.
- **E6 — Aucune UI de téléchargement (atelier/portail).** Le tableau de
  décomposition du contrat (§8.18 §6) mentionne un « bouton de
  téléchargement à l'atelier et au portail » pour 4c ; la liste « Périmètre
  de cette sous-story » transmise pour ce lot ne le mentionne pas et se
  limite au moteur, à la table, au branchement, à l'e-mail et aux deux `GET`.
  Interprété comme une réduction de périmètre délibérée pour cette
  livraison — à confirmer, et à couvrir par une story de suivi si ce n'est
  pas le cas.
- **E7 — Séparation moteur/planificateur non prévue au cadrage initial.**
  Le contrat décrit `renderQuoteDocument` comme une fonction unique. Une
  tentative de test end-to-end du rendu réel via `pdfjs-dist` (déjà
  dépendance du dépôt, 4b) a échoué sous le pool de threads de Vitest
  (`DataCloneError` dans le « fake worker » de pdfjs-dist — voir section
  suivante) : la logique de placement a donc été extraite dans
  `document-layout-planner.ts`, une fonction pure sans dépendance à
  `pdf-lib`, testée exhaustivement sans jamais ouvrir de fichier PDF. Le
  moteur public (`renderQuoteDocument`) garde la même signature et le même
  comportement — c'est un refactor interne, pas un changement de contrat.

## Ce qui n'a pas pu être vérifié dans cette session

- **Rendu textuel réel extrait d'un PDF produit (`pdfjs-dist`).** Tentative
  faite (voir E7) : `pdfjs-dist/legacy/build/pdf.mjs` sous Node fonctionne en
  script autonome mais lève `DataCloneError: Cannot transfer object of
  unsupported type` dans le pool de threads de Vitest (`structuredClone` du
  « fake worker » interne à pdfjs-dist). Contourné en séparant la logique de
  placement (testée exhaustivement, sans PDF) du mécanisme d'écriture
  (testé avec `pdf-lib` réel : nombre de pages, absence d'exception, pas de
  lecture de texte).
- **Exécution HTTP bout en bout de l'Edge Function `magrit-api`.** Docker et
  `deno` étaient disponibles dans cet environnement (amélioration par
  rapport aux sessions précédentes) : `deno check` a été exécuté avec succès
  sur `magrit-api/index.ts` **et** `magrit-outbox-dispatcher/index.ts`
  (vérification statique complète du graphe de modules, y compris l'import
  `npm:pdf-lib`). Une tentative de démarrage réel via l'Edge Runtime local a
  en revanche échoué pour une raison **préexistante et sans rapport avec ce
  lot** : `supabase_edge_runtime_magritoff-v5` embarque un parseur de module
  plus ancien qui rejette une syntaxe de `src/types/database.types.ts`
  (`export type Enums<...`), fichier jamais touché par cette story. Aucun
  test bout-en-bout HTTP réel n'a donc pu être obtenu, comme documenté pour
  les lots précédents — mais la vérification statique va plus loin que ce
  qui avait été possible jusqu'ici.

## Tests exécutés

- `pnpm typecheck` — vert.
- `pnpm test:architecture` — 144/144.
- `pnpm test:contract` — 309/309 (301 avant ce lot + 8 nouveaux, dont les
  deux opérations `documents`).
- `pnpm gen:api:check` — vert (aucune dérive, le contrat n'a pas été
  modifié par ce lot).
- `pnpm vitest run tests --exclude "tests/storage/**" --exclude "tests/e2e/**"` —
  1869 passés, 36 skippés (dont les nouveaux tests unitaires du moteur, du
  planificateur, du formatage, du resolveur, du service, et les mises à jour
  des tests existants de `commercial-quotes`/Resend/outbox-dispatch).
- `pnpm test:storefront:sql` (fichier dédié `gescom-e10-10b-4c-quote-documents.sql`,
  exécuté directement contre Supabase local, Docker démarré dans cette
  session) — **15/15 scénarios verts**. Rejoué en séquence avec
  `gescom-e10-10b-4a-document-pdf-templates.sql` et
  `gescom-e10-10b-4b-document-pdf-template-fields.sql` : aucune régression.
  Le script agrégé `pnpm test:storefront:sql` (tous les fichiers du dépôt)
  échoue plus tôt dans la liste pour des raisons **préexistantes et sans
  rapport** avec ce lot (absence d'un second utilisateur Auth pré-seedé pour
  d'autres scénarios, un fichier `legacy-shop-only-write-freeze.sql`
  manifestement obsolète référençant le rôle `owner` retiré depuis
  `20260814000200`) — signalé, pas corrigé (hors périmètre).
- `deno check` sur `magrit-api/index.ts` et `magrit-outbox-dispatcher/index.ts` — vert.

## Dette introduite, points à faire confirmer

- Textes Resend « avec pièce jointe » (E3) à faire valider par Arnaud avant
  production.
- `quote.customer_reference` (E1) et mise en forme métier de
  `line.product_config_summary` (E2) restent des trous de données, pas des
  bugs de ce lot — stories de suivi à ouvrir si l'un des deux devient
  bloquant pour un imprimeur pilote.
- UI de téléchargement (E6) : à confirmer si elle doit être ajoutée à ce lot
  ou faire l'objet d'une story dédiée.
- `legacy-shop-only-write-freeze.sql` référence le rôle `owner`, retiré
  depuis `20260814000200_admin_unique.sql` — fichier de test obsolète,
  détecté à l'occasion de cette session, signalé pour nettoyage futur (hors
  périmètre de 4c).

## qa-review round 2 — Changes Requested, corrigé

Cinq bloquants (B1/B2/B3/B5 remontés directement par la qa-review, B4 tranché
par l'architecte avec un bug additionnel B4-bis trouvé en instruisant B4).
Traités dans une seule passe, tous les gates rejoués intégralement (aucun
résultat de la revue initiale réutilisé).

- **B1 — BLOQUANT, la story était entièrement non fonctionnelle.**
  `SupabaseQuoteDocumentsRepository` recevait le client `authenticated`
  (`client`) en 1er argument dans `supabase/functions/magrit-api/index.ts`,
  alors que la migration `20260909040000` révoque `insert` sur
  `quote_documents` pour `authenticated` — `sendQuote` échouait
  SYSTÉMATIQUEMENT en 500 dès qu'un gabarit était éligible. **Corrigé** :
  `SupabaseQuoteDocumentsRepository` prend désormais DEUX clients
  (`privilegedClient` service_role, `storefrontClient` anon) — `client`
  authenticated n'y est plus jamais passé. `documentTemplatesStorageClient`
  (service_role, déjà instancié pour `document-templates`) est réutilisé tel
  quel. Le filtre `.eq('tenant_id', tenantId)` de `findByQuoteId` est
  **conservé et documenté** comme seule barrière d'isolation en lecture une
  fois le client privilégié en place. **Régression impossible à repasser
  inaperçue** : `tests/architecture/quote-documents-composition-boundaries.test.ts`
  (lit `magrit-api/index.ts` comme du texte, vérifie que le 1er argument est
  `documentTemplatesStorageClient` et jamais `client`, et que cette variable
  est bien construite avec `serviceRoleKey`) + scénario SQL positif
  (`gescom-e10-10b-4c-quote-documents.sql`, section 2bis : un INSERT sous
  `service_role` réussit — le scénario 2 existant prouvait déjà que
  `authenticated` est refusé, il manquait la preuve complémentaire que le
  rôle réellement utilisé, lui, fonctionne).

- **B2 — BLOQUANT, régénération et génération rétroactive possibles.**
  `const isResend = exists.status === 'sent'; if (!isResend) { ...génère... }`
  déclenchait la génération sur TOUT statut différent de `sent` — y compris
  `accepted`/`rejected`/`converted`. Un rejeu de `sendQuote` sur un devis déjà
  `accepted` aurait régénéré (et, avec l'ancien `upsert:true`, écrasé) le
  document de janvier avec les données du jour. **Corrigé** : la condition
  est désormais `exists.status === 'draft'` (premier envoi STRICT).
  `upsert: true` retiré de `store()` — un second dépôt sur le même chemin
  échoue désormais explicitement (500) plutôt que d'écraser silencieusement,
  contrepartie assumée et documentée (un rejeu après un échec **mi-chemin**
  upload-réussi/insert-échoué échouera lui aussi, cas rarissime rendu
  structurellement improbable par ailleurs par B4-bis). Testé :
  `tests/modules/commercial-quotes/commercial-quotes-service.test.ts`
  (nouveau fichier, 4 statuts vérifiés un par un — `draft` déclenche,
  `sent`/`accepted`/`rejected`/`converted` ne déclenchent jamais).

- **B3 — BLOQUANT, panne de stockage traitée comme « pas de gabarit ».**
  `findEligibleTemplateForGeneration` traitait TOUTE erreur de téléchargement
  du fond (objet absent, panne réseau, 5xx) comme « pas de gabarit éligible »
  — repli silencieux interdit par la règle (j). **Corrigé** : seul un 404
  Storage EXPLICITE (`statusCode === '404'`, forme vérifiée par exécution
  réelle contre Supabase Storage local — `StorageApiError { status: 400,
  statusCode: '404', message: 'Object not found' }`) reste traité comme
  « pas de gabarit » ; toute autre erreur est LEVÉE. Testé :
  `tests/adapters/supabase/document-templates-repository.test.ts` (nouveau
  fichier — voir aussi le point non bloquant ci-dessous, traité dans le même
  fichier).

- **B5 — BLOQUANT, un caractère hors CP1252 rendait un devis définitivement
  inenvoyable.** `pdf-lib` (police standard WinAnsi) lève `WinAnsi cannot
  encode "…"` sur "Łukasz", "ș/Ț", "✓", tout emoji — prouvé par exécution
  réelle. **Corrigé** : nouveau module
  `document-text-sanitization.ts` (`sanitizeForStandardPdfFont`/
  `sanitizeFieldValues`), appliqué en DEUX endroits (défense en profondeur) —
  à la résolution des valeurs (`document-field-value-resolver.ts`, point
  d'entrée normal) ET juste avant `drawText()` dans le moteur (filet de
  sécurité). Stratégie vérifiée par exécution réelle : les caractères déjà
  WinAnsi (accents français, `€`, `œ`, guillemets, tirets, points de
  suspension — bloc spécial Windows-1252 0x80-0x9F) ne sont **jamais**
  touchés ; les lettres « à barre » sans décomposition Unicode (Ł/ł, Đ/đ)
  sont translittérées explicitement ; le reste est décomposé (NFKD) et
  débarrassé de ses diacritiques combinantes (couvre č/ř/š/ž/ą/ę/ș/ț...) ;
  ce qui reste hors répertoire devient `?`. `\n` (césure structurelle du
  bloc de lignes) est explicitement préservé. Testé :
  `tests/modules/quote-documents/document-text-sanitization.test.ts`
  (nouveau) + test de bout en bout RÉEL (pdf-lib) dans
  `quote-documents-service.test.ts` (nom client polonais + désignation de
  ligne avec `✓`, génération vérifiée aboutie).

- **B4 — arbitré par l'architecte : « résoudre une fois, en SQL, et
  transmettre ».** `valid_until` était lue AVANT `api_send_commercial_quote`,
  qui la résout elle-même — sur le cas le plus courant (validité par défaut
  configurée, aucune date saisie), le PDF partait avec une date VIDE pendant
  que le courriel (qui relit la valeur à la remise) en annonçait une.
  **Corrigé**, migration `20260909050000_gescom_e10_10b_4c_qa_b4_valid_until_resolution.sql` :
  (1) `resolve_quote_default_valid_until(tenant_id, current)` — fonction SQL
  pure, `stable`, UNIQUE endroit où ce calcul existe désormais ; (2)
  `api_resolve_commercial_quote_valid_until(tenant_id, quote_id)` — LECTEUR,
  `security definer` ET `stable`, **aucune écriture** ; (3)
  `api_send_commercial_quote` passe à **cinq** arguments
  (`p_resolved_valid_until` ajouté, appliqué tel quel s'il est fourni,
  recalculé seulement s'il est nul) — **l'ancienne fonction à quatre
  arguments est supprimée** (`drop function`, ne coexiste jamais avec la
  nouvelle). `CommercialQuotesService.send()` appelle le lecteur AVANT de
  générer, transmet la MÊME valeur au moteur et à `sendQuote()`. Aucun
  changement de contrat (`SendQuoteCommand` n'accepte toujours pas
  `valid_until`). Un renvoi n'est pas concerné (testé explicitement). Testé :
  `commercial-quotes-service.test.ts` (ordre des appels
  `resolveValidUntilForSend` → `renderForFirstSend` → `sendQuote`, valeur
  identique transmise aux deux derniers) + SQL réel
  (`gescom-e10-10a-quote-send-duplicate.sql`, 7 sites d'appel adaptés à la
  nouvelle signature avec `null` en 5e argument — comportement PRÉSERVÉ à
  l'identique, rejoué intégralement, aucune assertion changée de sens).

- **B4-bis — BLOQUANT (même famille que B1/B2), trouvé par l'architecte en
  instruisant B4.** `generateForFirstSend()` persistait le document (bucket +
  ligne `quote_documents`) **avant** `repository.sendQuote()` : un échec
  ultérieur de l'envoi (If-Match périmée, garde de statut, transition
  concurrente) laissait un document ORPHELIN sur un devis resté `draft` —
  modifiable — de sorte qu'un rejeu sur une ligne corrigée pouvait faire
  recevoir au client le PDF de la version PÉRIMÉE (contrainte d'unicité
  `quote_id`, la ligne existante aurait été réutilisée). **Corrigé** par
  l'option « produire en mémoire, persister après succès confirmé » (l'autre
  option acceptable par l'architecte — compenser par suppression après
  échec — a été écartée : `quote_documents` n'accorde même pas le grant
  `delete` à `service_role`, ce qui aurait exigé d'affaiblir l'append-only
  pour rien). `QuoteDocumentsService.generateForFirstSend()` est scindée en
  deux méthodes : `renderForFirstSend()` (rend le PDF EN MÉMOIRE, ne touche
  ni bucket ni table) et `persistRendered()` (stocke, appelée UNIQUEMENT
  après le succès confirmé de `repository.sendQuote()`). Une persistance qui
  échoue APRÈS un envoi déjà réussi ne fait plus échouer l'opération entière
  (best-effort documenté : le devis est réellement envoyé, seule la pièce
  jointe manquera, l'événement `quote.sent` part quand même). Testé :
  `commercial-quotes-service.test.ts` (« un envoi qui ÉCHOUE après une
  génération RÉUSSIE ne persiste RIEN — aucun appel à `persistRendered` » ;
  « ordre vérifié : sendQuote PUIS persistRendered, jamais l'inverse » ;
  « un échec de persistance après succès ne fait pas échouer l'opération »)
  + `quote-documents-service.test.ts` (`renderForFirstSend` ne stocke jamais,
  quel que soit le cas).

### Réserves non bloquantes traitées dans la même passe

- `findEligibleTemplateForGeneration` était appelée HORS du `try` dans
  `quote-documents-service.ts` — une erreur SQL y remontait en `Error` nue,
  jamais traduite en `QuoteDocumentGenerationFailedError`. **Corrigé** : cet
  appel vit désormais DANS le `try` de `renderForFirstSend()` (fusionné avec
  la correction B4-bis puisque cette méthode a de toute façon été réécrite).
  Testé : `quote-documents-service.test.ts` (« panne réseau transitoire du
  service Storage » → `QuoteDocumentGenerationFailedError`, pas une `Error`
  nue).
- Fichier orphelin possible dans le bucket si `store()` dépose le PDF avant
  que l'insert échoue : documenté explicitement en commentaire dans
  `quote-documents-repository.ts` (sans risque de sécurité, bucket privé) —
  non corrigé plus avant, la fenêtre s'étant déjà réduite avec le retrait de
  `upsert:true` (B2) et le déplacement de toute la persistance après succès
  de l'envoi (B4-bis), qui rendent ce cas résiduel plus rare encore.
- 4e terme de la condition d'attachement (`has_field_map`) : le code était
  déjà correct, mais aucun test ne le prouvait — tous les tests existants
  injectaient un faux `findEligibleTemplateForGeneration`. **Ajouté** :
  `tests/adapters/supabase/document-templates-repository.test.ts` (nouveau
  fichier, 6 scénarios sur l'implémentation Supabase réelle — carte vide →
  `null`, placements seuls → éligible, `lines_block` seul → éligible, aucun
  gabarit → `null`, 404 Storage → `null`, autre panne Storage → levée).
- `summarizeProductConfig` exposait des clés techniques brutes
  (`clariprint_product_id: 4471`) sur un document remis au client. **Corrigé**
  (coût faible) : les clés `id`/`*_id` sont désormais filtrées avant
  impression.

### Gates rejoués intégralement (round 2), aucun résultat antérieur réutilisé

- `pnpm typecheck` — vert.
- `pnpm gen:api:check` — vert (contrat non modifié par ce correctif).
- `pnpm test:architecture` — **146/146** (34 fichiers, +1 :
  `quote-documents-composition-boundaries.test.ts`).
- `pnpm test:contract` — **309/309** (17 fichiers, inchangé en nombre — les
  corrections ne touchent aucun contrat).
- `pnpm vitest run tests --exclude "tests/storage/**" --exclude "tests/e2e/**"` —
  **1899/1899** passés, 36 skippés (+30 tests nets par rapport au rapport
  précédent : nouveaux fichiers `commercial-quotes-service.test.ts`,
  `document-templates-repository.test.ts`, `document-text-sanitization.test.ts`,
  `quote-documents-composition-boundaries.test.ts`, plus les cas ajoutés dans
  les fichiers existants).
- **Base de données réinitialisée à zéro** (`pnpm db:local:reset`, ~100
  migrations rejouées depuis le début, dont les 5 de ce lot) — **zéro
  erreur** à l'application. Puis, avec les variables `dblink_host`/
  `dblink_password` de l'invocation officielle et un utilisateur Auth
  pré-seedé (signup manuel simulé, comme documenté pour l'environnement) :
  - `tests/sql/gescom-e10-10b-4a-document-pdf-templates.sql`,
    `...-4b-...`, `...-4c-quote-documents.sql` (18 scénarios au total pour
    4c, dont les 2 nouveaux de B1) — **tous verts**, exécutés en séquence
    sans régression.
  - `tests/sql/gescom-e10-10a-quote-send-duplicate.sql` (7 sites d'appel
    adaptés à la signature à 5 arguments de `api_send_commercial_quote`) —
    **intégralement vert**, aucune assertion changée de sens.
  - `gescom-e10-12-quote-conversion.sql` et `gescom-e10-14-order-step-changes.sql`
    (nécessitent `dblink`) — verts avec les variables correctement fournies.
  - Plusieurs fichiers PRÉEXISTANTS (`gescom-e10-3`, `gescom-e10-5`,
    `gescom-e10-6`, `gescom-e10-9`, `gescom-e10-11`,
    `gescom-devis-unification-pim-triggers`, `storefront-credential-activation`,
    `legacy-shop-only-write-freeze`) échouent dans cet environnement de
    session fraîchement réinitialisée faute d'un historique d'utilisateurs
    Auth réels créés par le flux d'inscription (ou, pour
    `legacy-shop-only-write-freeze.sql`, à cause du rôle `owner`, retiré
    depuis `20260814000200`, jamais mis à jour dans ce fichier) — **sans
    rapport avec ce lot**, confirmé par le fait qu'ils échouent de la même
    façon sur `main`/avant ce correctif, et par le contenu même des messages
    d'erreur (« second utilisateur Auth requis », pas une assertion
    fonctionnelle gescom).
- `deno check --config supabase/functions/magrit-api/deno.json
  supabase/functions/magrit-api/index.ts` — vert.
- `deno check --config supabase/functions/magrit-outbox-dispatcher/deno.json
  supabase/functions/magrit-outbox-dispatcher/index.ts` — vert.

### Fichiers créés/modifiés par ce correctif (en plus de la livraison initiale)

- `supabase/migrations/20260909050000_gescom_e10_10b_4c_qa_b4_valid_until_resolution.sql` (nouveau).
- `src/adapters/supabase/quote-documents-repository.ts` (B1, B2 — deux clients, `upsert` retiré).
- `src/adapters/supabase/document-templates-repository.ts` (B3 — distinction 404/autre panne).
- `src/adapters/supabase/commercial-quotes-repository.ts` (B4 — `resolveValidUntilForSend`, `sendQuote` à 5 arguments).
- `src/modules/commercial-quotes/application/commercial-quotes-repository.ts` (interface, B4).
- `src/modules/commercial-quotes/application/commercial-quotes-service.ts` (B2, B4, B4-bis — réécriture de `send()`).
- `src/modules/quote-documents/application/quote-documents-service.ts` (B4-bis — scission `renderForFirstSend`/`persistRendered`).
- `src/modules/quote-documents/application/document-text-sanitization.ts` (nouveau, B5).
- `src/modules/quote-documents/application/document-field-value-resolver.ts` (B5 — sanitization appliquée ; cosmétique `summarizeProductConfig`).
- `src/modules/quote-documents/application/quote-document-renderer.ts` (B5 — sanitization défense en profondeur).
- `src/modules/quote-documents/index.ts` (exports).
- `supabase/functions/magrit-api/index.ts` (B1 — câblage du client service_role).
- `tests/sql/gescom-e10-10b-4c-quote-documents.sql` (scénario 2bis, B1).
- `tests/sql/gescom-e10-10a-quote-send-duplicate.sql` (7 sites d'appel adaptés, B4).
- `tests/contract/_fakes/commercial-quotes-repository.fake.ts` (B4 — `resolveValidUntilForSend`, `sendQuote` à 5 arguments).
- `tests/contract/_fakes/quote-documents-service.fake.ts` (B4-bis — renommage des méthodes).
- Nouveaux fichiers de test : `tests/architecture/quote-documents-composition-boundaries.test.ts` (B1),
  `tests/modules/commercial-quotes/commercial-quotes-service.test.ts` (B2/B4/B4-bis),
  `tests/adapters/supabase/document-templates-repository.test.ts` (B3 + has_field_map),
  `tests/modules/quote-documents/document-text-sanitization.test.ts` (B5).
- Mis à jour : `tests/modules/quote-documents/quote-documents-service.test.ts` (renommage + cas B5 bout-en-bout),
  `tests/modules/quote-documents/document-field-value-resolver.test.ts` (inchangé dans son fond, vérifié toujours vert).

## Statut final — Approved par la qa-review, un point additif fermé avant transmission

**R1 (non bloquant, purement additif, corrigé sans nouvelle revue complète)** —
le `catch {}` entourant `persistRendered()` (B4-bis, best-effort après un
envoi déjà réussi) avalait l'échec sans aucune trace. Corrigé :
`console.error('[CommercialQuotesService] document perdu (persistance
echouee apres envoi reussi, quote=...)', cause)`, même patron que
`bestEffortOutbox(..., console.error ...)` déjà câblé dans la composition.
Le commentaire qui affirmait à tort qu'« aucune information n'est perdue
silencieusement » est corrigé : le document EST perdu, définitivement
(génération unique, jamais régénérée — `GET .../documents` rendra 404 pour
toujours sur ce devis). Comportement fonctionnel INCHANGÉ (l'envoi reste
best-effort sur ce point précis, pour ne pas faire échouer un envoi déjà
réellement réussi) — seule la journalisation est ajoutée. Vérifié :
`pnpm typecheck` vert, `tests/modules/commercial-quotes/commercial-quotes-service.test.ts`
(11/11) et `tests/contract/commercial-quotes.contract.test.ts` (43/43)
toujours verts.
