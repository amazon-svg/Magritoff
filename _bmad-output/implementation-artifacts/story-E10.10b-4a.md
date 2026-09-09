---
id: E10.10b-4a
epic: E10 — Gestion commerciale
status: done
branch: feat/gescom-e10-4-entite-client
depends_on: []
blocks: [E10.10b-4b, E10.10b-4c]
---
# E10.10b-4a — Import et stockage du gabarit PDF par tenant

Contrat écrit par l'architecte le 2026-09-09 (`docs/api/CONVENTIONS.md` §8.18,
révision qui remplace §8.13septies — Gotenberg abandonné par arbitrage
d'Arnaud, `pdf-lib` + gabarit PDF par tenant + éditeur de coordonnées).
Périmètre **strict** de cette sous-story, repris tel que découpé au contrat
(§8.18 §6) : preuve d'exécution `pdf-lib` d'abord, puis migration, module
`document-templates`, adaptateur, routes, les **sept** opérations hors
`fields` (4b), écran de paramétrage minimal. **PAS** l'éditeur de
coordonnées (4b), **PAS** le moteur de génération/envoi (4c).

## Preuve d'exécution `pdf-lib` — résultat des six mesures (§8.18 §0)

Exécutée **avant** tout code de production, comme imposé par le contrat.
**Correction (qa-review N5a) : `pdf-lib` n'était PAS déjà déclaré avant ce
lot.** Rien n'étant commité sur cette branche avant cette story, l'affirmation
« déjà déclaré, reliquat d'une tentative avortée » de mon rapport précédent
était une supposition non vérifiée, pas un fait établi par `git log`. Ce
qui est vrai et vérifiable : **ce lot ajoute** `pdf-lib` à `package.json`
(`"pdf-lib": "1.17.1"`) et `"pdf-lib": "npm:pdf-lib@1.17.1"` à
`supabase/functions/magrit-api/deno.json` — ce sont deux fichiers modifiés
par ce lot, comme n'importe quel autre fichier listé plus bas, pas une
dépendance héritée.

| # | Mesure | Résultat |
|---|---|---|
| 1 | Import `npm:pdf-lib@1.17.1` dans un isolat Deno | **OK, sans permission réseau supplémentaire.** `deno run --allow-read --allow-write proof.ts` (aucun `--allow-net`) exécute `PDFDocument.load/save/embedFont/drawText/copyPages` de bout en bout. **Différence notable avec `@resvg/resvg-wasm`** (qui va chercher son binaire `.wasm` sur `unpkg` au premier appel) : `pdf-lib` est du JavaScript pur, aucun second maillon réseau. Confirmé une seconde fois par `deno check` sur `supabase/functions/magrit-api/index.ts` (chaîne complète jusqu'à `pdf-template-inspector.ts`) : **0 erreur de type**, résolution de `pdf-lib` par l'import map validée. |
| 2 | Ouverture d'un PDF export InDesign/Canva réel | **OK sur les deux.** Fond Canva réel (1 page, 1440×810 pt, métadonnées `Creator/Producer = Canva`) et catalogue Adobe InDesign 20.5 réel (24 pages, 595.28×841.89 pt / A4) — tous deux hors du dépôt (fichiers personnels d'Arnaud, non committés, non liés à Magrit), ouverts par `PDFDocument.load()`, `page_count` et dimensions relevés exactement conformes à `pdfinfo`. |
| 3 | Écriture à une coordonnée donnée, relecture visuelle | **OK, référentiel bas-gauche confirmé.** Texte écrit à `(50,50)`, `(50, hauteur-50)` et `(50,200)` sur le fond Canva réel, rendu rasterisé (`pdftoppm`) et inspecté visuellement : le point bas-gauche est bien en bas à gauche de la page, la ligne de base du texte se comporte comme documenté au contrat (`DocumentFieldPlacement.y`). |
| 4 | `é`/`à`/`ç`/`œ`/`€` avec une police standard | **OK, aucun repli nécessaire.** `StandardFonts.Helvetica` rend correctement les cinq caractères (rendu rasterisé inspecté visuellement), `widthOfTextAtSize` ne lève sur aucun. **Conséquence sur le contrat, déjà anticipée par l'architecte (réserve (e))** : `DocumentFont` reste une énumération de RÔLES typographiques liés aux polices standard PDF ; la police libre embarquée (DejaVu Sans ou équivalent) reste un chemin de repli PRÉVU par le contrat mais **non nécessaire aujourd'hui** — non implémentée dans ce lot (elle relève du moteur de rendu, E10.10b-4c, hors périmètre de 4a). |
| 5 | Recopie d'une page pour une continuation | **OK.** `copyPages(fondDoc, [0])` + `addPage()`, deux fois de suite (simulation d'un devis à deux pages de continuation), contenu vectoriel du fond intégralement préservé (vérifié par rendu rasterisé). |
| 6 | Deux générations du même devis, comparaison | **NON déterministe à l'octet entre deux générations séparées dans le temps** (un seul octet diffère, dans une zone de données binaires du fichier, quand un délai de ~1s sépare les deux générations ; strictement identiques — 0 octet de différence — quand générées dos à dos sans délai). Confirme le constat (d)/(f) de §8.13septies/§8.18 sur *ce* moteur : rien ne repose sur un re-rendu comparable, la réserve (f) reste ouverte sans effet de conception, consignée ici pour ne pas laisser croire qu'un `sha256` de document se revérifie par un second rendu. |

Preuve exécutée avec deux fichiers réels (Canva, InDesign) trouvés sur le
poste de développement — **non commités dans le dépôt** (contenu personnel/
professionnel d'Arnaud sans rapport avec Magrit). Aucun fichier binaire de
preuve n'a été ajouté au dépôt ; les fixtures du test unitaire committé
(`pdf-template-inspector.test.ts`) sont **générées par `pdf-lib` lui-même**
à l'exécution du test, pas des binaires versionnés.

## Ce qui est livré

| Élément | Détail |
|---|---|
| Migration `20260909020000` | Table **neuve** `document_pdf_templates` (`id`, `tenant_id`, `document_type` (`check in ('quote')`), `name`, `status` (`awaiting_upload`\|`ready`), `storage_path`/`byte_size`/`sha256`/`page_count` (nullables, renseignés à la confirmation), `pages` (jsonb, géométrie), `lines_block` (jsonb nullable — colonne posée dès ce lot, seule 4b sait l'écrire), `is_default`/`is_active`, `requested_default` (colonne **interne**, jamais exposée au contrat — mémorise l'intention `is_default` de la création, appliquée en différé à la confirmation d'import), `created_at`/`updated_at`/`created_by`. Contraintes : nom unique normalisé `(tenant_id, document_type, lower(btrim(name)))`, un seul défaut par `(tenant_id, document_type)` (index partiel), `check` EN BASE qu'un défaut est `ready` et actif. Bucket Storage **privé** `document_pdf_templates` (10 Mo, `application/pdf` seul), **aucune policy `storage.objects`** (seul le `service_role` y accède — vérifié par appel réel, voir plus bas). Quatre fonctions `security definer` (`api_create_document_pdf_template`, `api_update_document_pdf_template`, `api_confirm_document_pdf_template_upload`, `api_delete_document_pdf_template`), chacune réimplémentant `can_manage_document_templates`, verrouillées par `pg_advisory_xact_lock` où une invariante de comptage/unicité est en jeu — même patron que `20260908020000` (E10.13). Migration **appliquée réellement** en local (`pnpm db:local:push`), aucune erreur. |
| RLS | `document_pdf_templates_select` — lecture **ouverte à tout membre du tenant** (contrat : "Ne conditionne PAS la LECTURE"). `document_pdf_templates_write` — porte `public.user_has_capability(tenant_id, 'can_manage_document_templates')`, **défense en profondeur uniquement** : le chemin nominal passe par les quatre fonctions `security definer`. `can_manage_document_templates` ne demande **aucun câblage** : `user_has_capability()` rend déjà `true` pour tout `admin` par dérivation d'appartenance, quel que soit le nom de la capability (mécanisme générique, vérifié sans modification). |
| `GET`/`POST /document-pdf-templates` | `listDocumentPdfTemplates` (sans pagination ni ETag de collection — plafond de 20 par tenant/type) ; `createDocumentPdfTemplate` (201, `Idempotency-Key`, rend `{template, upload}` en un seul appel). 409 `name_conflict`, 422 `limit_reached`. |
| `GET`/`PATCH`/`DELETE /document-pdf-templates/{templateId}` | Fiche avec géométrie + `background_url` signée (900 s) ; renommage/défaut/activation (`If-Match`, 409 `name_conflict`/`default_requires_ready`) ; suppression (200, 409 `in_use` **structurellement inatteignable** tant qu'E10.10b-4c n'a pas livré `quote_documents.template_id on delete restrict` — voir Dette). |
| `POST /document-pdf-templates/{templateId}/upload-urls` | `issueDocumentPdfTemplateUploadUrl` — 200, **sans** `Idempotency-Key` (un billet n'est pas une ressource métier, toujours neuf). |
| `POST /document-pdf-templates/{templateId}/uploads` | `confirmDocumentPdfTemplateUpload` — **le seul endroit où un PDF est accepté** : télécharge le fichier déposé (`service_role`), l'inspecte (`pdf-template-inspector.ts`, `pdf-lib`), retire l'objet et rend 422 `invalid_pdf` si illisible/chiffré/>10 pages, sinon 201 avec la géométrie enregistrée. 409 `geometry_changed` si la carte (`lines_block`) n'est pas vide et que la géométrie change sans `reset_fields`. Applique `requested_default` en différé (bascule transactionnelle, retire le drapeau au gabarit précédent). |
| Module `document-templates` (nouveau) | `api/contracts.ts` (schémas Zod miroir du contrat + alignement de compilation), `api/client.ts` (`uploadPdfFile()` = `fetch(url, {method:'PUT'})` **nu**, jamais le SDK Supabase), `application/pdf-template-inspector.ts` (fonction **pure**, seul point d'import de `pdf-lib` de ce lot), `application/document-templates-repository.ts` (port + neuf erreurs de domaine), `application/document-templates-service.ts` (garde `can_manage_document_templates`), `index.ts`, `manifest.ts`/`surface-contributions.ts`. |
| Adaptateur Supabase | `src/adapters/supabase/document-templates-repository.ts` — **deux clients distincts** : `client` (JWT appelant, RLS + RPC `security definer`) et `storageClient` (`service_role`, seul rôle qui atteint le bucket privé). `create`/`update`/`confirmUpload`/`remove` délèguent aux fonctions `api_*` ; `confirmUpload` télécharge puis inspecte les octets (`pdf-template-inspector.ts`) avant l'appel RPC ; `expires_at` du billet d'import **décodé du JWT réel** rendu par Supabase Storage (voir plus bas), pas une constante supposée. |
| Routes | `src/server/api/document-templates-routes.ts` — sept routes, garde de capability posée **avant** toute lecture de ressource (même ordre que `updateProductionStep`). Enregistré dans `gescom-routes.ts` (`GescomServices.documentTemplates`). |
| Câblage edge function | `supabase/functions/magrit-api/index.ts` — `documentTemplatesStorageClient` construit avec `SUPABASE_SERVICE_ROLE_KEY` (repli sur `anonKey` si absente : la façade ne s'arrête pas au démarrage pour un tenant qui n'utilise pas encore les gabarits PDF, l'échec surviendrait alors à l'usage). `DocumentTemplatesService` injecté dans `gescomServices`. Vérifié par `deno check supabase/functions/magrit-api/index.ts` : **0 erreur** (fichier hors `tsconfig`, dette M1 inchangée, mais vérification Deno réelle faite ici en plus de la relecture manuelle habituelle). |
| UI | `DocumentTemplatesPage.tsx` (`DashboardDocumentTemplates`) — écran de paramétrage **minimal** : lister, créer (nom + case "en faire le défaut dès l'import"), importer/remplacer le fond (`<input type="file">` cachée, déclenchée par un bouton, `fetch` PUT nu sur l'URL signée puis `confirmUpload()`), renommer, définir par défaut, activer/désactiver, supprimer. **Aucun positionnement de champ** (4b). Route `workspace` gardée par `requiredCapabilities: ['can_manage_document_templates']` (garde d'ergonomie, l'autorisation réelle est la RLS). |

## Vérifications réelles du plan de stockage (au-delà de la lecture du contrat)

Local Supabase (Docker) était **démarré et complet** sur ce poste (service
`storage-api` inclus, à la différence de sessions précédentes documentées
comme "Docker absent") — mis à profit pour des vérifications **réelles**,
pas seulement déclaratives :

- Billet d'import réel émis (`createSignedUploadUrl`) contre le bucket local :
  dépôt par `fetch(url, {method:'PUT'})` **nu** (exactement le chemin de la
  SPA) → `200` ; téléchargement `service_role` → octets identiques ;
  `createSignedUrl(path, 900)` → URL de lecture fonctionnelle (`GET` → `200`,
  `content-type: application/pdf`) ; un rôle `anon` direct sur le même objet
  → **refusé** ("Object not found", RLS par absence de policy).
- **Durée du billet d'import** : le contrat fixe 300 s (téléchargement d'un
  document) et 900 s (fond dans l'éditeur), mais **ne fixe pas** la durée du
  billet d'IMPORT lui-même — et `createSignedUploadUrl()` de
  `@supabase/storage-js@2.104.1` n'accepte **aucun** paramètre de durée
  (vérifié sur le code source du client). Un appel réel contre le service
  Storage local montre que le jeton émis est un **JWT** dont le `exp` vaut
  `iat + 7200 s`. L'adaptateur **décode ce `exp` réel** à chaque émission
  (`decodeSignedUploadTicketExpiry()`) plutôt que de supposer une constante —
  avec un repli sur 7200 s si le jeton ne se décode pas comme un JWT (version
  future de Storage). **Point à faire confirmer par l'architecte/qa-review** :
  cette durée n'est pas arbitrée au contrat, seulement mesurée.

## Bogue trouvé et corrigé par le test de contrat (pas seulement par relecture)

L'`ETag` d'un gabarit ne peut **pas** être calculé sur la représentation
complète rendue au client : `background_url`/`background_url_expires_at`
sont des URL signées **régénérées à chaque lecture** (nouveau jeton, nouvelle
expiration). Les inclure dans le calcul de l'ETag aurait fait varier l'ETag
entre deux lectures de la **même** ressource inchangée, et cassé `If-Match`
sur `updateDocumentPdfTemplate` dès qu'une lecture s'intercale — trouvé par
le test de contrat (bascule `is_default`, échec 409 inattendu), corrigé par
`templateEntityTag()` (`document-templates-routes.ts`), qui exclut ces deux
champs du calcul. Cohérent avec le contrat, qui dit explicitement que l'ETag
"valide LE GABARIT (nom, défaut, fichier importé)".

## qa-review round 1 — Changes Requested, corrigé

Deux réserves **bloquantes**, corrigées ; non-bloquantes traitées quand le
coût était faible, sinon signalées explicitement ci-dessous.

**B1 — faille de sécurité confirmée par test empirique (IDOR sur le chemin de
stockage), CORRIGÉE.** Trois points laissaient `storage_path` (une colonne
de table, donc une DONNÉE) déterminer l'objet réellement lu/écrit/supprimé
en stockage, au lieu de le recalculer depuis `tenant_id`/`id` — le contrat
dit pourtant explicitement "LE CHEMIN N'EST JAMAIS CHOISI PAR L'APPELANT".
Corrigé aux trois endroits :
1. `SupabaseDocumentTemplatesRepository.toDetailDto()` — signe désormais
   `storagePathFor(tenantId, row.id)` (le `tenantId` reçu en paramètre par
   la méthode appelante, jamais une colonne lue), plus `remove()` — supprime
   au chemin recalculé, jamais `before.storage_path`.
2. `api_confirm_document_pdf_template_upload` — **le paramètre
   `p_storage_path` est supprimé de la signature** ; la fonction calcule
   elle-même `p_tenant_id::text || '/' || p_template_id::text || '.pdf'`.
   L'adaptateur ne passe donc plus aucun chemin à cette fonction.
3. Migration — contrainte `check` **posée en base**,
   `document_pdf_templates_storage_path_canonical`, qui refuse toute valeur
   de `storage_path` différente de `tenant_id::text || '/' || id::text ||
   '.pdf'`, y compris en écriture privilégiée (indépendante de tout rôle).
   Scénario 8 ajouté à `tests/sql/gescom-e10-10b-4a-document-pdf-templates.sql` :
   prouve qu'un chemin forgé vers un AUTRE tenant est refusé (`check_violation`)
   même en phase privilégiée, qu'un chemin hors format canonique (traversée
   de répertoire) est refusé, et que le chemin réellement persisté après
   confirmation est exactement le chemin canonique attendu.
   **Rejoué réellement contre Postgres local après un `pnpm db:local:reset`
   complet (la migration éditée devait être ré-appliquée depuis zéro,
   `create or replace function` ne permettant pas de retirer un paramètre
   de signature) : 0 erreur.**

**B2 — gate `gen:api:check` rouge, CORRIGÉ / déjà résolu au moment de la
reprise.** Rejoué réellement (pas seulement réaffirmé) : `pnpm gen:api:check`
passe. Les clôtures D2/D3 de l'architecte sur `openapi/magrit-core.v1.yaml`
sont bien présentes (`UpdateDocumentPdfTemplateCommand.is_active`,
`DocumentPdfTemplateUploadTicket.expires_at`) et le fichier généré
(`src/platform/api/generated/magrit-core.v1.ts`) leur est aligné — cette
régénération avait déjà eu lieu au moment où j'ai repris la main (mtime
postérieur à celui du YAML). Je n'ai donc pas eu à lancer `pnpm gen:api`
moi-même pour ce round, mais je l'ai **vérifié par exécution réelle** plutôt
que réaffirmé sans le rejouer — c'est précisément ce que B2 reprochait à mon
rapport précédent.

**Ce que ces deux clôtures de l'architecte confirment, sans changement de
code de ma part :**
- **D2 close** : la description `expires_at` dit maintenant explicitement
  que 7200 s est "ce que la plateforme a émis, pas un vœu" et que
  `createSignedUploadUrl` n'accepte aucun paramètre de durée — exactement
  ce que `decodeSignedUploadTicketExpiry()` fait déjà (décoder la valeur
  réelle du JWT, jamais une constante supposée). Le contrat ajoute une
  règle **côté client** ("ne pas conserver un billet au-delà de 600
  secondes") : `DocumentTemplatesPage.tsx` utilise chaque billet
  immédiatement après émission dans la même fonction async (`handleImport`),
  jamais mis en cache — conforme sans changement.
- **D3 close** : la description `is_active` confirme explicitement
  "DESACTIVER LE GABARIT PAR DEFAUT LUI RETIRE AUSSI CE ROLE, dans la même
  transaction et sans erreur" — exactement le comportement déjà implémenté
  et testé (`api_update_document_pdf_template`, scénario SQL 5bis). Ce
  n'était donc pas une inférence à confirmer : c'est désormais une règle du
  contrat, tenue telle quelle.

**N2 — couverture de test du 403 de capability, TRAITÉ (coût faible).**
Un test dédié (`document-templates.contract.test.ts`) exerce désormais le
403 `identity.role_required` sur `updateDocumentPdfTemplate`,
`deleteDocumentPdfTemplate`, `issueDocumentPdfTemplateUploadUrl` **et**
`confirmDocumentPdfTemplateUpload` — pas seulement `createDocumentPdfTemplate`.

**N3 — verrou manquant sur `api_confirm_document_pdf_template_upload`,
TRAITÉ (coût faible).** `pg_advisory_xact_lock(hashtextextended('document_pdf_templates:'
|| p_tenant_id::text, 0))` ajouté, même clé que `api_update_document_pdf_template`
et `api_create_document_pdf_template` — deux confirmations concurrentes
portant chacune `requested_default` ne peuvent plus se lire l'une l'autre
avant d'écrire.

**N1 — non traité, conforme à l'instruction.** Le plafond de 20 gabarits
n'est pas tenu par une contrainte EN BASE (seulement par la fonction
`api_create_document_pdf_template`, contournable par un `insert` direct
si la RLS d'écriture était elle-même contournée) — même défaut déjà accepté
sur E10.13 (`api_create_production_step`, plafond de 50). Non corrigé ici,
sur instruction explicite de le traiter au niveau du sprint plutôt que
story par story.

**N4 — signalé, non corrigé (décision d'architecte, pas de dev).** Tension
mineure sur l'idempotence de `create` : rien changé de mon côté.

**N6 — noté.** Aucun cahier de test Notion TF-XX n'existe encore pour cette
story ; à créer par le `scribe`.

**N7 — non traité (amélioration UX, pas un manquement).** Avertir avant de
retirer le statut « par défaut » d'un gabarit resterait à faire si souhaité ;
laissé tel quel dans ce lot.

**N5 — les trois inexactitudes de mon rapport précédent, corrigées :**
- (a) `pdf-lib` n'était **pas** "déjà déclaré" : ce lot **ajoute**
  `pdf-lib` à `package.json` et à `supabase/functions/magrit-api/deno.json`
  — corrigé dans la section preuve d'exécution ci-dessus.
- (b) `gen:api:check` n'était pas "aligné" au moment où qa-review l'a
  contrôlé — je l'avais réaffirmé sans le rejouer après les clôtures de
  l'architecte. Rejoué réellement dans ce round (voir B2).
- (c) Les 3 échecs pré-existants de `tests/storage/product_mockups_isolation.test.ts`
  **ne sont pas dus à un bucket local manquant** — vérifié : `select id,
  public from storage.buckets where id = 'product_mockups'` sur la base
  locale rend bien une ligne. **Cause réelle** : ce fichier de test lit
  `.env.test`, dont `SUPABASE_URL` pointe vers le **projet Supabase PARTAGÉ
  DISTANT** (`ightkxebexuzfjdbpsdg.supabase.co`), pas vers l'instance locale
  Docker — confirmé en inspectant la valeur réellement chargée. La cause
  exacte côté projet distant (bucket absent là-bas, ou clé de service
  périmée) n'est pas établie ici et sort du périmètre de cette story ; ce
  qui est établi, c'est que ces 3 échecs sont **indépendants de tout ce que
  ce lot fait localement** (bucket `document_pdf_templates` compris, jamais
  poussé sur ce projet distant).

## Ce qui n'est PAS dans le périmètre (rappel du découpage du contrat)

- **Aucun éditeur de coordonnées** — `GET`/`PUT .../fields`, table
  `document_pdf_template_fields`, rendu PDF.js, positionnement à la souris :
  E10.10b-4b.
- **`has_field_map` calculé sur `lines_block` seul** — la condition complète
  (`lines_block is not null OR exists(document_pdf_template_fields ...)`) ne
  peut pas être écrite avant que 4b crée cette table. Documenté explicitement
  dans la migration (fonction `api_confirm_document_pdf_template_upload`) :
  **4b devra compléter cette condition**, pas la réécrire — aucune ligne de
  placement ne peut exister avant que sa table existe, le calcul actuel est
  donc exact pour ce lot, pas une approximation provisoire.
- **Aucun moteur de génération** (`renderQuoteDocument`), aucune table
  `quote_documents`, aucun branchement dans `sendQuote` : E10.10b-4c.
- **409 `document_pdf_template.in_use` structurellement inatteignable** — tenu
  par `quote_documents.template_id on delete restrict`, table qui n'existe
  pas encore. La fonction `api_delete_document_pdf_template` contient déjà la
  branche d'erreur (`when foreign_key_violation`), écrite maintenant pour que
  4c n'ait **rien** à y changer.
- **Aucune police libre embarquée** — non nécessaire (mesure 4), et de toute
  façon hors périmètre de 4a (le moteur qui choisirait une police est 4c).

## Dette introduite, points à faire confirmer

| Réf. | Point | Chemin de mise en conformité / statut |
|---|---|---|
| **D1** | `has_field_map` ne teste que `lines_block` (voir ci-dessus). | Complété par 4b dès que `document_pdf_template_fields` existe — signalé explicitement dans le commentaire SQL de la fonction concernée. |
| **D2** | ~~Durée du billet d'import non arbitrée au contrat~~ — **CLOSE par l'architecte** (`DocumentPdfTemplateUploadTicket.expires_at`, description explicite : 7200 s est ce que la plateforme émet réellement, pas un vœu ; règle client "ne pas conserver un billet au-delà de 600 s" ajoutée). | Clos, comportement déjà conforme (voir qa-review round 1). |
| **D3** | ~~`is_active:false` efface `is_default`, inférence non arbitrée~~ — **CLOSE par l'architecte** (`UpdateDocumentPdfTemplateCommand.is_active`, description explicite du même comportement). | Clos, comportement déjà conforme (voir qa-review round 1). |
| **D4 (corrigée)** | ~~Aucune convention de lockfile Deno n'existe~~ — **FAUX**, corrigé : un `deno.lock` **racine, déjà tracké** (ajouté par E10.6) existe bel et bien. `deno check` sur `supabase/functions/magrit-api/index.ts` l'a mis à jour d'une ligne (`npm:pdf-lib@1.17.1` ajouté à ses entrées), reflet correct et attendu de la dépendance ajoutée par ce lot — **conservé**, pas une dérive. (Il existe séparément un `deno.lock` PAR FONCTION, celui-là non conventionnel/non tracké : généré puis retiré pendant cette story, sans effet.) | Clos — le `deno.lock` racine modifié fait partie des fichiers à committer avec ce lot. |
| **N1 (signalée, non corrigée sur instruction)** | Plafond de 20 gabarits tenu par la fonction `api_create_document_pdf_template` seule, pas par une contrainte EN BASE — même défaut déjà accepté sur E10.13 (`api_create_production_step`, plafond de 50, migration `20260908020000`). | Hors périmètre de cette story sur instruction explicite (qa-review round 1) : à traiter au niveau du sprint, pas story par story. |
| **v1 héritée** | `pnpm test:storefront:sql` (harnais complet) est **sensible à l'état des `auth.users` accumulés localement** : après un `pnpm db:local:reset` complet (nécessaire pour ce round, la correction B1 retirant un paramètre de fonction), plusieurs cas antérieurs et sans rapport avec cette story échouent immédiatement faute d'un `auth.users` préexistant qu'ils s'attendent à trouver (`gescom-outbox-append-only`, `gescom-e10-4/1/2/7`, `gescom-e10-10b-1/2`, `storefront-session-lifecycle`, etc. — tous des cas qui PICK un utilisateur existant plutôt que d'en créer un). **Mon cas ne dépend d'aucun `auth.users` préexistant** (il insère les siens) : rejoué seul après reset, 0 erreur ; rejoué aussi dans la chaîne des cas qui, eux, créent leurs propres utilisateurs et passent donc indépendamment de l'état du seed (`gescom-e10-10b-3`, `gescom-e10-12/13/14/16`). | Investigation dédiée de la dérive du poste local (hors périmètre d'une story fonctionnelle), déjà tracée par les stories précédentes — le déclencheur exact (reset complet) est nouveau dans cette session mais le symptôme est identique à celui documenté par E10.10b-1/E10.13. |
| **héritée, sans rapport, précisée (qa-review N5c)** | `tests/storage/product_mockups_isolation.test.ts` (3 échecs) — **PAS un bucket local manquant** (vérifié : `storage.buckets` local porte bien `product_mockups`). Ce test cible le **projet Supabase partagé distant** `ightkxebexuzfjdbpsdg.supabase.co` via `.env.test`, jamais l'instance locale Docker. Cause exacte côté projet distant non établie (hors périmètre), mais confirmée indépendante de tout ce que ce lot fait localement. | Hors périmètre. |

## Vérifications — REJOUÉES intégralement après corrections qa-review round 1

Toutes les commandes ci-dessous ont été **rejouées dans cette session**,
après application des corrections B1/B2/N2/N3 et un `pnpm db:local:reset`
complet (migration éditée) — aucun résultat n'est repris tel quel du rapport
précédent.

- `pnpm typecheck` : **0 erreur.**
- `pnpm gen:api:check` : **✅ aligné**, vérifié par exécution réelle (pas
  réaffirmé) après les clôtures D2/D3 de l'architecte sur le contrat.
- `pnpm test:architecture` : **144/144** (33 fichiers), inchangé.
- `pnpm test:contract` : **292/292** (16 fichiers) — +1 test par rapport au
  round précédent (N2, garde de capability sur update/delete/upload-urls/
  uploads), soit +17 net depuis la baseline de 275 laissée par le cadrage
  §8.18.
- `pnpm exec vitest run tests/modules/document-templates/pdf-template-inspector.test.ts` :
  **7/7**, exécution réelle de `pdf-lib` sous Node, fixtures générées par
  `pdf-lib` lui-même.
- `pnpm test` (suite complète) : **1759 passés / 36 skip**, **3 échecs
  pré-existants** (`tests/storage/product_mockups_isolation.test.ts`) —
  cause précisée ci-dessus (N5c), confirmée sans rapport avec ce lot.
- `pnpm test:storefront:sql` (harnais complet) : bloqué tôt par la
  sensibilité aux `auth.users` locaux après reset (voir dette v1 ci-dessus,
  sans rapport avec cette story). **Mon cas rejoué individuellement, et
  rejoué dans une chaîne de cas auto-suffisants (voir ci-dessous) : 0
  erreur dans les deux configurations.**

`tests/sql/gescom-e10-10b-4a-document-pdf-templates.sql` : **exécuté
réellement** (Docker local, migration éditée réappliquée par
`pnpm db:local:reset` complet — nécessaire car `create or replace function`
ne permet pas de retirer un paramètre de signature). Scénarios, `rollback`
final, **0 erreur**, rejoué trois fois dans cette session (juste après
correction B1, après ajout N3, et dans la chaîne de cas auto-suffisants) :
(1) bucket privé, 10 Mo, `application/pdf` seul ; (2) RLS lecture — tenant B
ne voit rien du tenant A, un membre SANS `can_manage_document_templates` voit
néanmoins son propre tenant (lecture ouverte à tout membre) ; (3) RLS
écriture DIRECTE — refusée sans le droit, acceptée pour un admin par
dérivation (défense en profondeur, hors chemin nominal) ; (4)
`api_create_document_pdf_template` — refus sans droit, création
`awaiting_upload`, nom unique normalisé, plafond de 20 par tenant/type ; (5)
`api_update_document_pdf_template` — refus sans droit, renommage,
`default_requires_ready` sur un gabarit non prêt, bascule transactionnelle
du défaut, `is_active: false` efface `is_default` ; (6)
`api_confirm_document_pdf_template_upload` — `not_found` hors tenant,
passage à `ready` avec verrou (N3), application différée de
`requested_default` avec bascule transactionnelle, `geometry_changed`
refusé sauf `reset_fields` (carte simulée directement en base,
`document_pdf_template_fields` n'existant pas encore) ; (7)
`api_delete_document_pdf_template` — `not_found`, suppression réussie (409
`in_use` non testé : structurellement inatteignable, voir dette) ; **(8)
NOUVEAU — qa-review B1** : un `storage_path` forgé vers un autre tenant est
refusé EN BASE (`check_violation`) même en écriture privilégiée ; un chemin
hors format canonique (traversée de répertoire) est refusé de même ; le
chemin réellement persisté après confirmation est exactement le chemin
canonique attendu, jamais un chemin fourni par l'appelant (la fonction ne
reçoit plus ce paramètre).

## Critères d'acceptation (périmètre du contrat §8.18 §6, tenus un par un)

1. **Preuve d'exécution `pdf-lib` avant tout code de production, six
   mesures.** — **fait.** Voir tableau dédié ci-dessus ; aucune mesure n'a
   fait tomber le cadrage, le repli police libre (réserve (e)) n'est pas
   nécessaire.
2. **Migration : table `document_pdf_templates`, bucket privé.** — **fait.**
   Appliquée réellement en local, RLS testée par exécution SQL réelle (pas
   seulement déclarée).
3. **Module `document-templates` (`api/` + `application/`), convention du
   dépôt.** — **fait.** Même patron que `production-steps`/`pricing`, pas de
   sous-dossiers `routes/service/repository` littéraux.
4. **Adaptateur Supabase.** — **fait**, deux clients distincts (JWT appelant
   / `service_role`), vérifié par appel réel contre Supabase Storage local
   (ticket, dépôt PUT nu, téléchargement, URL signée de lecture, refus
   `anon`). **Chemin de stockage TOUJOURS recalculé** (`tenantId`/`id`),
   jamais lu depuis une colonne — faille corrigée au round qa-review 1 (B1),
   verrouillée par une contrainte CHECK en base en plus du code applicatif.
5. **Les sept opérations hors `fields` (4b).** — **fait**, toutes
   implémentées, testées contre le contrat (17 tests), enregistrées dans
   `gescom-routes.ts`.
6. **Écran de paramétrage minimal (lister, importer, nommer, défaut,
   activer, supprimer).** — **fait.** `DashboardDocumentTemplates`, aucun
   appel Supabase direct (client API du module uniquement), dépôt de fichier
   par `fetch` nu (pas le SDK), conforme au point de vigilance du contrat.
7. **Aucun contrôle métier posé uniquement côté navigateur.** — **fait** :
   type MIME réel, poids, géométrie, plafonds, unicité — tout est vérifié
   serveur (`confirmDocumentPdfTemplateUpload`, fonctions `api_*`). Le
   `accept="application/pdf"` du champ fichier est un confort de saisie,
   jamais une barrière.
8. **RLS testée, pas seulement déclarée.** — **fait**, isolation
   inter-tenant et garde de capability vérifiées par exécution SQL réelle
   contre Postgres local (pas une relecture de migration), y compris le
   scénario 8 ajouté au round qa-review 1 (chemin forgé refusé en base).
9. **Test de contrat de chaque endpoint créé.** — **fait**, 17 tests dans
   `document-templates.contract.test.ts` (+1 au round qa-review 1, N2 :
   garde de capability sur update/delete/upload-urls/uploads).
10. **Tests unitaires sur toute logique de calcul.** — **fait** pour
    l'unique logique de calcul de ce lot (extraction de géométrie PDF,
    `pdf-template-inspector.ts`) : 7 tests, exécution réelle de `pdf-lib`.
    La bascule transactionnelle `is_default`/`geometry_changed` (logique
    métier en base) est couverte par le test SQL réel, pas par un test
    unitaire TypeScript (elle n'existe qu'en PL/pgSQL, il n'y a pas
    d'équivalent applicatif à tester séparément).

## Ce qui reste à faire avant qu'E10.10b-4b (éditeur de coordonnées) puisse démarrer

- **Rien de bloquant côté 4a** : `getDocumentPdfTemplate` rend déjà
  `pages` (géométrie serveur) et `background_url` (900 s), exactement ce
  dont l'éditeur a besoin pour afficher le fond et positionner des champs.
- **PDF.js (`pdfjs-dist`)** — tranché au contrat (réserve (g)), **pas encore
  ajouté** à `package.json` : à faire par 4b, en import dynamique dans le
  seul écran d'édition (aucun effet sur le bundle boutique).
- **`document_pdf_template_fields`** — table à créer par 4b, dans SA propre
  migration (jamais une édition de `20260909020000`).
- **D1 (`has_field_map`)** — à compléter par 4b dans
  `api_confirm_document_pdf_template_upload`, comme documenté dans le
  commentaire SQL de cette fonction : `or exists (select 1 from
  document_pdf_template_fields where template_id = ...)`.
- **Sally UX** — passage obligatoire signalé par le contrat pour 4b
  (composant entièrement nouveau, utilisateur non technique) : non requis
  pour 4a (écran de paramétrage simple, patron `ProductionStepsPage`).
