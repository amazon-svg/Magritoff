---
id: E10.19a
epic: E10 — Gestion commerciale
status: done
branch: feat/gescom-e10-4-entite-client
depends_on: [E10.10b-4a, E10.10b-4b, E10.12, E10.13, E10.16]
blocks: [E10.19b]
---
# E10.19a — Le gabarit de bon de commande (contrat servi, base + palette)

Contrat écrit par l'architecte (`docs/api/CONVENTIONS.md` §8.20, quatre
arbitrages d'Arnaud du 2026-09-10). Périmètre **strict** de cette
sous-story, repris tel que découpé au contrat (§8.20 §7) : élargissement du
`check` `document_type`, valeurs `order.*` **et leur garde 422 par type**
(fenêtre unique, contrat §4), palette de l'éditeur 4b filtrée par type,
`findEligibleTemplateForGeneration` généralisée par type de document, jeu
d'exemple de commande pour l'aperçu, **plus** les deux colonnes gelées de la
décision (D) — `commercial_orders.show_discounts`/`customer_reference`,
recopiées à la conversion, ajoutées au trigger d'immuabilité, rétro-remplies.
**Aucun document produit** — c'est E10.19b, qui n'a pas démarré.

**Cette story a fait l'objet d'un round de `qa-review` "Rejeté"** (un
bloquant majeur B1, un bloquant moyen B2, deux mineurs m1/m2), traité en
intégralité — voir la section dédiée ci-dessous. Les trois décisions
produit d'Arnaud (gabarit distinct par type, accusé de commande côté client,
action explicite de production, remises affichées) étaient déjà confirmées
tenues et prouvées par la qa-review — non retouchées.

## Ce qui est livré

| Élément | Détail |
|---|---|
| Migration `20260910000100` | (1) `document_pdf_templates.document_type` : `check` élargi à `in ('quote','order')`, aucune migration de structure (l'index unique partiel `(tenant_id, document_type) where is_default` portait déjà un défaut par type depuis 4a). (2) `document_pdf_template_fields.field` : `check` élargi aux cinq valeurs `order.*` (défense en profondeur, la garde sémantique par type vit en TypeScript). (3) `commercial_orders.show_discounts boolean not null default false` (recopiée de `commercial_quotes.show_discounts` à la conversion, backfillée pour les commandes déjà converties) et `commercial_orders.customer_reference text` (nullable, **aucune source amont** — écart de données assumé, voir plus bas). (4) `commercial_orders_immutable()` recréée : les deux colonnes rejoignent la liste des colonnes GELÉES. (5) `api_convert_commercial_quote(uuid, uuid)` recréée — **quatrième** `create or replace` de cette fonction, bâtie sur la version **E10.16** (pas la version E10.12 d'origine, voir « écart trouvé et corrigé » plus bas), avec deux ajouts bornés : `show_discounts` lu sous le même verrou `for update`, `show_discounts`/`customer_reference` insérés sur la ligne créée. |
| Garde 422 par type (`document-field-map-validator.ts`) | `validateDocumentFieldMap(pages, command, documentType = 'quote')` — nouveau troisième paramètre. Un `quote.*` sur un gabarit `order`, ou un `order.*` sur un gabarit `quote`, est refusé (`placements[i].field`). Les familles `customer.`/`totals.`/`page.` valent pour les deux types ; `line.*` (colonnes du bloc de lignes) n'est pas concerné (contrat : une ligne de commande porte les mêmes attributs qu'une ligne de devis). Posée **dans le même lot** que l'ajout des cinq valeurs `order.*` à `documentFieldIdSchema` — la seule fenêtre où cette garde n'est pas un durcissement rétroactif (CA13). |
| Contrats Zod (`document-templates/api/contracts.ts`) | `documentTypeSchema` élargi à `['quote','order']` ; `documentFieldIdSchema` gagne les cinq valeurs `order.*` (`order.number`, `order.created_at`, `order.quote_number`, `order.customer_reference`, `order.expected_delivery_date`). |
| `findEligibleTemplateForGeneration` généralisée | Signature élargie `(tenantId, documentType)` sur l'interface `DocumentTemplatesRepository`, l'adaptateur Supabase (`.eq('document_type', documentType)`, plus de `'quote'` codé en dur) et le port `DocumentTemplateForGenerationPort` du module `quote-documents` (`documentType: 'quote'` figé côté appelant — ce module ne sert que des devis). Préalable imposé par le contrat §7 : sans lui, un tenant important un gabarit `order` aurait pu voir ses **devis** partir dessus si l'ordre de tri l'avait désigné. |
| Palette de l'éditeur (`field-catalog.ts`, `PaletteFieldsPanel.tsx`) | `FieldFamilyId` gagne `order` ; `FIELD_CATALOG` gagne les cinq entrées `order.*` (libellés FR) ; `FIELD_FAMILY_ORDER_BY_DOCUMENT_TYPE` (nouveau) fixe l'ordre d'affichage par type — un gabarit `order` ne propose jamais les quatre `quote.*`, et réciproquement. `PaletteFieldsPanel` reçoit un prop `documentType`, filtre le catalogue et le dénominateur du compteur en conséquence. |
| Jeu d'exemple de commande (`sample-quote.ts`, `PreviewOverlay.tsx`, `DocumentTemplateFieldsPage.tsx`) | `SampleDocumentFields` passé de `Record` exhaustif à `Partial<Record<...>>` (un jeu de devis n'a aucune raison de porter les cinq clés `order.*`, et réciproquement — `exactOptionalPropertyTypes` l'imposait). `COMMON_FIELDS` factorise les familles partagées (`customer.`/`totals.`/`page.`). `SAMPLE_ORDER`/`SAMPLE_ORDER_LONG` ajoutés (mêmes deux lignes courtes / 22 lignes longues que le devis). `DashboardDocumentTemplateFields` choisit le jeu selon `template.document_type` et passe `documentTypeLabel` (`'devis'`/`'commande'`) à `PreviewOverlay`, dont la copie était jusqu'ici câblée en dur sur « devis ». |
| Routes (`document-templates-routes.ts`) | Message d'erreur de `parseDocumentType` mis à jour (« quote ou order », plus « quote » seul). Aucun changement de code d'erreur, aucun changement de forme HTTP. |
| Écran de paramétrage (`DocumentTemplatesPage.tsx`, qa-review B1) | Sélecteur de type (`<select>`, testid `document-template-add-type-select`, options « Devis »/« Bon de commande », défaut `quote`) dans le formulaire de création — `api.create({ name, document_type, is_default })` porte désormais la valeur choisie, plus jamais implicitement `'quote'`. Badge de type dans chaque ligne de la liste (testid `document-template-type-badge`, `data-document-type`). `api.list()` reste sans filtre : la liste affiche les deux types mélangés, distingués par le badge — pas d'onglets, pas de filtre, périmètre minimal suffisant pour que le chemin produit existe. |

## Écart trouvé et corrigé (avant remise) : la première version régressait E10.13/E10.16

En écrivant la migration, `api_convert_commercial_quote` a d'abord été
recréée à partir de la version **E10.12** (`20260908010000`) — celle
disponible dans le fil de la conversation au moment de rédiger le contenu.
**Erreur, trouvée par exécution réelle** : cette fonction a déjà été
`create or replace`-ée **deux fois** depuis, par E10.13 (`current_production_
step_id`, étape de production initiale) et par E10.16 (`customer_contact_id`,
interlocuteur recopié depuis `decided_by_account_id`). Rejouer la version
E10.12 aurait donc **supprimé silencieusement** ces deux fonctionnalités déjà
en service.

**Détecté par `pnpm test:storefront:sql`**, pas par relecture : après un
`pnpm db:local:reset` complet suivi de l'exécution de la suite, deux fichiers
échouaient — `gescom-e10-16-order-contact-and-delivery.sql` (« customer_
contact_id inattendu NULL, attendu l'interlocuteur X ») et deux autres
(`gescom-e10-14-order-step-changes.sql`, `gescom-e10-17a-order-files.sql`)
sur une violation `NOT NULL` de `show_discounts` — cette seconde classe de
panne parce que ces deux fichiers insèrent `commercial_orders` **directement**
(sans passer par la RPC), et la première version de la colonne (nullable puis
`set not null` sans défaut) ne leur laissait aucune valeur de repli.

**Corrigé en deux temps** :
1. `api_convert_commercial_quote` reconstruite à partir de la version
   **réellement en base** (`20260909010000`, E10.16), avec uniquement les
   deux ajouts bornés d'E10.19a — comparé trait pour trait avec cette
   version pour vérifier qu'aucune garde, aucun ordre d'opération n'a bougé.
2. `commercial_orders.show_discounts` porte désormais `default false` (même
   valeur que `commercial_quotes.show_discounts`) — pas par confort
   d'écriture, mais parce que d'autres fixtures de tests SQL du dépôt
   insèrent des lignes `commercial_orders` sans passer par la RPC. Le défaut
   ne change rien au chemin nominal : la fonction écrit toujours la valeur
   réellement recopiée du devis source, jamais ce défaut.

Après correction, `pnpm db:local:reset` (chaîne complète, 84 migrations) et
la relecture individuelle de chaque fichier SQL potentiellement affecté sont
**vertes** — voir tableau des tests exécutés.

## Écart de données assumé, dit plutôt que masqué : `customer_reference` n'a aucune source

Le contrat §10 dit que `customer_reference` est « RECOPIÉE DU DEVIS à la
conversion, comme `show_discounts` ». **Vérifié dans le dépôt avant
d'écrire la migration** : **aucune colonne `customer_reference` n'existe sur
`commercial_quotes`** — ni dans les migrations E10.3/E10.9/E10.10a, ni
ailleurs. C'est un écart **déjà documenté** dans le code, dans les mêmes
termes, pour le champ jumeau côté devis :
`src/modules/quote-documents/application/document-field-value-resolver.ts`
(« `quote.customer_reference` : AUCUNE colonne de ce nom n'existe sur
`commercial_quotes`… combler ce trou est une story distincte sur le module
`commercial-quotes` »).

**Décision prise, cohérente avec ce précédent** : la colonne
`commercial_orders.customer_reference` est ajoutée (le contrat l'exige,
`order.customer_reference` est publié au catalogue), reste **nullable**, et
vaut **NULL sur toute commande** — y compris au rétro-remplissage, qui n'a
donc rien à faire pour cette colonne. Combler la source amont
(`commercial_quotes.customer_reference`) est **hors périmètre** de cette
story : c'est une story distincte sur le module `commercial-quotes`, signalée
ici plutôt que devinée. Le moteur (E10.19b) n'imprimera rien pour ce champ
tant que cette source n'existera pas (règle « valeur absente = rien
imprimé »), exactement comme `quote.customer_reference` aujourd'hui.

## qa-review round 1 (« Rejeté ») → corrections

### B1 — MAJEUR, aucun chemin produit ne créait un gabarit `order` → corrigé

**Constat exact.** Le formulaire de création
(`DocumentTemplatesPage.tsx`) ne portait que `name`/`is_default` ;
`document_type` restait implicite (défaut `'quote'` du schéma Zod), et
aucune colonne de la liste n'affichait le type. Conséquence confirmée :
tout le code livré pour `order` (`FIELD_FAMILY_ORDER_BY_DOCUMENT_TYPE`,
`SAMPLE_ORDER`/`SAMPLE_ORDER_LONG`, libellé « commande » de
`PreviewOverlay`) était **inatteignable depuis le produit** — seul un
`insert` SQL direct (le fichier de test) créait un gabarit `order`. E10.19b
aurait rendu `order.document_template_missing` en permanence.

**Corrigé** — `document_type` fait maintenant partie du chemin produit,
sans changement de contrat (déjà accepté par `createDocumentPdfTemplateCommandSchema`
et la route) :
- Un `<select>` (testid `document-template-add-type-select`, « Devis »/
  « Bon de commande », défaut `quote`) dans le formulaire de création ;
  `handleCreate()` transmet `document_type: newDocumentType` à `api.create()`.
- Un badge de type par ligne (testid `document-template-type-badge`,
  `data-document-type`) dans la liste — `api.list()` reste sans filtre
  (les deux types apparaissent mélangés, distingués par le badge), pas
  d'onglets : périmètre minimal qui rend le chemin réellement traversable,
  sans anticiper une UI de tri qu'aucun cas de test Notion ne demande.
- Deux nouveaux `data-testid` déclarés dans `src/shared/presentation/testIds.ts`
  (`addTypeSelect`, `typeBadge`), jamais improvisés en dur dans le composant.
- Texte d'en-tête de l'écran mis à jour (« devis ou d'un bon de commande —
  deux gabarits distincts, chacun avec son propre défaut »).

**Non traité, sur décision explicite du périmètre annoncé** : aucun onglet
« Devis »/« Commande », aucun filtre de liste — la garde qa ne demandait
que l'existence d'un chemin produit pour créer/distinguer les deux types,
ce que le sélecteur + le badge suffisent à couvrir. Un filtre par type
resterait un raffinement UX, pas une correction du défaut structurel signalé.

### B2 — MOYEN, `findEligibleTemplateForGeneration(tenantId, documentType)` non prouvée, tests cassés → corrigé

**Constat exact, vérifié à l'identique.** Les 6 appels de
`tests/adapters/supabase/document-templates-repository.test.ts` étaient
restés à un seul argument (`findEligibleTemplateForGeneration(TENANT)`),
invisibles sous `pnpm typecheck` (`tsconfig.modular.json` n'inclut pas
`tests/`) et sous `vitest` (pas de typecheck), mais réels sous
`pnpm typecheck:all` (6× `TS2554`). Plus grave : le faux client de ce
fichier avait un `eq: () => builder` muet, donc même en écrivant le bon
nombre d'arguments, **aucun test ne prouvait** que `documentType` atteignait
réellement `.eq('document_type', documentType)` côté adaptateur.

**Corrigé** :
- Les 6 appels portent désormais `(TENANT, 'quote')`.
- `fakeClient()` enregistre chaque appel `eq(colonne, valeur)` sur
  `document_pdf_templates` dans un tableau `eqCalls`, exposé par la
  fonction.
- Deux nouveaux tests (`describe` dédié) appellent la méthode avec
  `'quote'` puis `'order'` et vérifient que `eqCalls` contient exactement
  `['document_type', 'quote']` (jamais `'order'`) et réciproquement — la
  preuve explicite que le contrat §8.20 §7 exige (« sans lui, un devis
  pourrait partir sur le gabarit d'une commande »).
- Vérifié après correction : `pnpm typecheck:all` ne signale plus aucune
  erreur sur ce fichier (les 6 `TS2554` ont disparu). Les ~90 erreurs
  restantes de `typecheck:all` sont **pré-existantes et sans rapport**
  (même classe d'erreur `Id<string>`/`brand<T>()` répétée à l'identique
  sur 18 autres fichiers `tests/contract/*.contract.test.ts`, aucun touché
  par cette story) — `typecheck:all` n'était déjà pas une base verte avant
  ce lot ; `document-templates.contract.test.ts` porte une seule occurrence
  de cette même classe d'erreur pré-existante, inchangée par mes
  modifications.

### m1 — copie FR dégradée sur le chemin devis (`PreviewOverlay.tsx`) → corrigée

`"Simuler un(e) {documentTypeLabel} long(ue) (2 pages)"` remplacé par deux
libellés conditionnels complets : `« Simuler un devis long (2 pages) »`
(inchangé pour un gabarit `quote`) et `« Simuler une commande longue
(2 pages) »` (nouveau, gabarit `order`).

### m2 — titre de test mensonger (`field-catalog.test.ts`) → corrigé

Le titre affirmait « couvre EXACTEMENT les 25 valeurs de DocumentFieldId »
alors que l'énumération en compte 30 depuis l'ajout des `order.*` — seule
l'assertion (dynamique contre `documentFieldIdSchema.options`) était
correcte, pas le texte. Titre reformulé : « couvre EXACTEMENT les valeurs
de DocumentFieldId (30 depuis E10.19a, `order.*` inclus), sans doublon ».

## Critères d'acceptation (périmètre de la sous-story, tenus un par un)

1. **Gabarit PDF de type `order`, même mécanisme que le devis, un défaut par
   type.** — **fait.** `document_type` élargi, aucune migration de
   structure, un tenant peut avoir un défaut `quote` **et** un défaut
   `order` simultanément — vérifié par exécution SQL réelle (scénario 1 du
   test dédié). **Chemin produit réel depuis la correction B1** : le
   formulaire de création choisit le type, la liste l'affiche — un
   gabarit `order` n'est plus créable qu'en SQL direct.
2. **Garde 422 sur `replaceDocumentPdfTemplateFields` quand le type de champ
   ne correspond pas au type de gabarit.** — **fait.** `validateDocument
   FieldMap` refuse un `quote.*` sur `order` et un `order.*` sur `quote`,
   posée dans le même lot que les valeurs (fenêtre unique CA13). Testé en
   unitaire (validator), en contrat (bout en bout via la route), et en base
   (le `check` élargi de `document_pdf_template_fields.field` accepte les
   cinq valeurs, refuse toujours `order.status`).
3. **Les deux colonnes gelées sur `commercial_orders`** (`show_discounts`,
   `customer_reference`), recopiées à la conversion, trigger d'immuabilité
   étendu, rétro-remplissage. — **fait.** `show_discounts` recopiée
   **réellement** (prouvé sur deux devis, `true` puis `false`, pas une
   valeur constante) ; `customer_reference` NULL, écart de données assumé
   ci-dessus ; les deux colonnes refusent toute modification directe
   (`order.immutable`) après conversion ; `status`/`updated_at` restent
   mutables (regression guard, le trigger entier a été recréé).
4. **Ces deux colonnes ne sont PAS publiées sur `CommercialOrderDetail`.** —
   **fait**, sans changement de contrat requis : le mapper de l'adaptateur
   (`toCommercialOrderDto`) construit le DTO champ par champ, jamais par
   spread — les deux colonnes neuves n'ont aucun chemin de fuite même si le
   `select('*')` sous-jacent les lit.
5. **Migration SQL versionnée, réversible.** — **fait**, `20260910000100`,
   bloc de réversibilité en pied de fichier (SQL de retrait commenté, comme
   tout le dépôt — le CLI Supabase ne gère pas de bloc `down`).

## Ce qui n'est pas dans le périmètre (rappel du contrat §8.20 §9)

- **Aucun document produit** — pas de table `order_documents`, pas de
  `generateOrderDocument`/`getOrderDocument`, pas de moteur de rendu de
  commande, pas de bouton « Produire le bon de commande ». C'est E10.19b.
- **Aucun envoi de courriel**, aucun relais de `quote.converted`.
- **Aucune surface client** (`/storefront-orders` n'existe toujours pas).

## Dette introduite, points à faire confirmer

| Réf. | Point | Chemin de mise en conformité / statut |
|---|---|---|
| **D1** | `commercial_orders.customer_reference` n'a aucune source amont sur `commercial_quotes` — vaut NULL sur toute commande, y compris futures, tant qu'une story distincte n'ajoute pas la donnée côté devis. | Assumé et **dit dans la migration** (commentaire de colonne) et ici. Même famille que `quote.customer_reference`, déjà signalée par E10.10b-4c. Aucune action requise pour E10.19a — la colonne existe, prête à recevoir la valeur le jour où la source existera, sans changement de schéma supplémentaire. |
| **D2 (héritée, sans rapport)** | `pnpm test:storefront:sql` (script complet) échoue dès `storefront-session-lifecycle.sql` sur une base fraîchement réinitialisée (exige un `auth.users` préexistant), puis, après ajout d'un utilisateur de secours, échoue sur `legacy-shop-only-write-freeze.sql` (rôle `owner` déprécié depuis `20260814000300`) — deux pannes **sans rapport** avec E10.19a, déjà documentées comme dette de sensibilité à l'état local par E10.10b-4a/E10.13/E10.17a. | Hors périmètre de cette story — signalé pour qu'il ne soit pas reperdu. Mon cas SQL (`gescom-e10-19a-order-document-template.sql`) est auto-suffisant et a été rejoué isolément et enchaîné avec tous les cas E10.12/13/14/16/10b-4a/4b/4c/17a affectés par ma migration : 0 erreur. |
| **D3 (héritée, sans rapport)** | `tests/storage/product_mockups_isolation.test.ts` échoue (3 tests, « Bucket not found ») après le `pnpm db:local:reset` de cette story — bucket créé hors des migrations versionnées, cause déjà établie par E10.10b-4a/E10.17a. | Hors périmètre. |

## Tests exécutés — TOUS les gates rejoués depuis le début après correction qa-review

| Commande | Résultat |
|---|---|
| `pnpm typecheck` | **vert**, 0 erreur |
| `pnpm typecheck:all` | Les **6 `TS2554`** signalées par la qa-review (B2, `document-templates-repository.test.ts`) ont **disparu**. ~90 erreurs **résiduelles, pré-existantes et sans rapport** (même classe `Id<string>`/`brand<T>()` répétée à l'identique sur 18 fichiers `tests/contract/*.contract.test.ts` non touchés par cette story, `@ts-expect-error` inutilisés dans des tests boutique, etc.) — `typecheck:all` n'était pas une base verte avant ce lot, confirmé en isolant les erreurs par fichier. |
| `pnpm gen:api:check` | **vert**, aligné (`openapi/magrit-core.v1.yaml` non touché par cette story) |
| `pnpm test:architecture` | **vert**, 34 fichiers / 146 tests |
| `pnpm test:contract` | **vert**, 18 fichiers / **332 tests** (dont 3 scénarios E10.19a dans `document-templates.contract.test.ts` : `order.*` refusé sur `quote`, `order.*` accepté sur `order`, `quote.*` refusé sur `order`) |
| `pnpm vitest run tests/architecture tests/contract tests/adapters/supabase/document-templates-repository.test.ts tests/modules/document-templates tests/modules/quote-documents` | **vert**, 63 fichiers / **598 tests** (+8 par rapport à la remise initiale : 2 nouveaux scénarios `eqCalls` B2, plus les 6 tests déjà comptés dont le typage était cassé) |
| `pnpm test` (suite complète) | **1981 passés / 36 skip / 3 échecs pré-existants** (`tests/storage/product_mockups_isolation.test.ts`, D3 ci-dessous, sans rapport avec ce lot ; +2 par rapport à la remise initiale, les deux tests B2) |
| `pnpm db:local:reset` | **exécuté réellement**, chaîne complète des 85 migrations (dont la nouvelle), 0 erreur — inchangé par ce round (aucune migration retouchée) |
| `tests/sql/gescom-e10-19a-order-document-template.sql` | **exécuté réellement** contre Postgres local, rejoué après ce round (inchangé) : **0 erreur**, `ROLLBACK` propre. 5 scénarios : (1) `document_type` élargi + défaut par type simultané ; (2) `field` élargi aux 5 `order.*`, `order.status` toujours refusé ; (3) `show_discounts` recopié réellement (true puis false), `customer_reference` NULL ; (4) immuabilité des deux colonnes gelées, `status` reste mutable ; (5) RLS inter-tenant reverifiée sur un gabarit `order`. |
| `tests/sql/gescom-e10-12-quote-conversion.sql`, `-13-production-steps.sql`, `-14-order-step-changes.sql`, `-16-order-contact-and-delivery.sql`, `-10b-4a/4b/4c`, `-17a-order-files.sql` | **rejoués individuellement lors de la remise initiale** (voir « écart trouvé et corrigé ») : **0 erreur**, aucune régression. Non concernés par ce round (aucune migration retouchée pour B1/B2/m1/m2). |

## Fichiers créés/modifiés

**Créés** :
- `supabase/migrations/20260910000100_gescom_e10_19a_order_document_template.sql`
- `tests/sql/gescom-e10-19a-order-document-template.sql`

**Modifiés** :
- `src/modules/document-templates/api/contracts.ts` (`documentTypeSchema`, `documentFieldIdSchema`)
- `src/modules/document-templates/application/document-field-map-validator.ts` (garde 422 par type)
- `src/modules/document-templates/application/document-templates-repository.ts` (`findEligibleTemplateForGeneration` généralisée)
- `src/modules/document-templates/application/document-templates-service.ts` (transmet `template.document_type` au validateur)
- `src/adapters/supabase/document-templates-repository.ts` (`findEligibleTemplateForGeneration(tenantId, documentType)`)
- `src/modules/quote-documents/application/quote-documents-service.ts` (port élargi, appel figé sur `'quote'`)
- `src/server/api/document-templates-routes.ts` (message d'erreur `document_type`)
- `src/modules/document-templates/ui/workspace/field-editor/field-catalog.ts` (`FieldFamilyId`, `FIELD_CATALOG`, `FIELD_FAMILY_ORDER_BY_DOCUMENT_TYPE`)
- `src/modules/document-templates/ui/workspace/field-editor/PaletteFieldsPanel.tsx` (filtrage par `documentType`)
- `src/modules/document-templates/ui/workspace/field-editor/sample-quote.ts` (`SampleDocumentFields`, `COMMON_FIELDS`, `SAMPLE_ORDER`/`SAMPLE_ORDER_LONG`)
- `src/modules/document-templates/ui/workspace/field-editor/PreviewOverlay.tsx` (copie générique `documentTypeLabel`)
- `src/modules/document-templates/ui/workspace/field-editor/DocumentTemplateFieldsPage.tsx` (choix du jeu d'exemple + `documentType` par type de gabarit)
- `tests/contract/_fakes/document-templates-repository.fake.ts` (`document_type: DocumentType`, `findEligibleTemplateForGeneration`)
- `tests/contract/document-templates.contract.test.ts` (3 scénarios E10.19a)
- `tests/modules/document-templates/document-field-map-validator.test.ts` (4 scénarios E10.19a)
- `tests/modules/document-templates/field-catalog.test.ts` (3 scénarios E10.19a)
- `scripts/test-storefront-sql.sh` (ajout du cas SQL de ce lot)

**Modifiés au round qa-review (B1 + B2 + m1 + m2)** :
- `src/modules/document-templates/ui/workspace/DocumentTemplatesPage.tsx` (sélecteur `document_type` au formulaire de création, badge de type par ligne, texte d'en-tête — B1)
- `src/shared/presentation/testIds.ts` (`documentTemplate.addTypeSelect`, `documentTemplate.typeBadge` — B1)
- `src/modules/document-templates/ui/workspace/field-editor/PreviewOverlay.tsx` (libellés conditionnels complets, plus d'accord entre parenthèses — m1)
- `tests/adapters/supabase/document-templates-repository.test.ts` (6 appels corrigés en `(TENANT, 'quote')` ; `fakeClient()` enregistre `eqCalls` ; 2 nouveaux tests prouvant `document_type` transmis — B2)
- `tests/modules/document-templates/field-catalog.test.ts` (titre du test corrigé — m2)

**Non touchés (rappel R5)** : `openapi/magrit-core.v1.yaml`, `src/platform/api/generated/magrit-core.v1.ts` — le contrat était déjà écrit par l'architecte, aucun endpoint neuf n'est codé dans cette sous-story. Aucune migration SQL retouchée par ce round.
