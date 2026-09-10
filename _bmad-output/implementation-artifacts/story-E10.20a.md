---
id: E10.20a
epic: E10 — Gestion commerciale
status: done
branch: feat/gescom-e10-4-entite-client
depends_on: [E10.17a]
blocks: [E10.20b]
---
# E10.20a — Le lien public de dépôt : socle et quatrième mode d'authentification

Contrat écrit par l'architecte (`docs/api/CONVENTIONS.md` §8.21, sept points
arbitrés le 2026-09-10, `openapi/magrit-core.v1.yaml` déjà à jour :
`createOrderUploadLink`, `listOrderUploadLinks`, `revokeOrderUploadLink`,
`getOrderUploadLinkContext`, `issueOrderUploadLinkFileUrl`,
`confirmOrderUploadLinkFile`, `securityScheme` `orderUploadLink`). Périmètre
**strict** de cette sous-story, tel que découpé au contrat (§8.21 §5, ligne
E10.20a) : migration (table `commercial_order_upload_links` + fonctions
`api_*`), `securityScheme` `orderUploadLink` et son cloisonnement dans le
middleware, `ApiPrincipal` élargi, les trois opérations d'atelier +
`getOrderUploadLinkContext`, panneau « liens de dépôt » sur la fiche
commande. **AUCUN DÉPÔT POSSIBLE** — c'est explicitement le périmètre
d'E10.20b (`api_confirm_order_file_upload_by_link`, les deux opérations de
dépôt, l'émission de `order.files_submitted`, la page publique de dépôt).

## Écart constaté avec les instructions de la tâche, signalé plutôt que tranché seul

La tâche transmise (point 5) demandait d'implémenter
`issueOrderUploadLinkFileUrl`/`confirmOrderUploadLinkFile` « complètement si
le contrat les décrit précisément, sinon coquille minimale ». Le contrat de
référence explicitement désigné pour cette story
(`docs/api/CONVENTIONS.md` §8.21 §5, tableau de découpage des sous-stories,
ligne **E10.20a** : *« les trois opérations d'atelier + `getOrder
UploadLinkContext`. […] **Aucun dépôt possible.** »*, ligne **E10.20b** :
*« `api_confirm_order_file_upload_by_link`, **les deux opérations de
dépôt**, émission de `order.files_submitted` […] »*) tranche cette question
lui-même, de façon univoque et antérieure à cette implémentation : ces deux
opérations et leur mécanisme SQL sous-jacent (`api_confirm_order_file_
upload_by_link`, qui n'existe pas encore) appartiennent à E10.20b. Les
implémenter ici aurait soit dupliqué un mécanisme que 20b doit poser
proprement (point 7 de la tâche : ne pas forcer la réutilisation
d'`api_confirm_order_file_upload`), soit livré une coquille qui n'aurait rien
prouvé. **Décision : ces deux opérations ne sont pas enregistrées dans
`order-upload-links-routes.ts`.** `tests/contract/gescom-routes.contract.test.ts`
ne vérifie que les routes **enregistrées**, jamais l'exhaustivité des
opérations du contrat (vérifié en lisant le fichier avant de trancher) : ne
pas les enregistrer est donc conforme au CA1, et non une omission.

## qa-review round 1 (« Rejeté ») → corrections

**Audit de sécurité pur jugé PROPRE par la qa-review** (entropie CSPRNG du
jeton, stockage haché sha256 non rejouable, RLS réellement prouvée sur
`anon`/tenant croisé/admin, plafond de 10 vérifié avec 20 créations
concurrentes réelles, révocation immédiatement effective, aucune fuite par
message d'erreur, aucune régression sur `order-files`) — rien à corriger de
ce côté. **Deux bloquants**, tous deux des écarts de conformité au contrat,
pas des failles.

### B1 — BLOQUANT, violation de §3.6 branche 4 (« l'en-tête de lien est IGNORÉ » hors de son mode) → corrigé

**Constat exact.** Dans `readCredential()`
(`tenant-resolution.ts`), quand `X-Magrit-Upload-Link` était présent SANS
credential explicite, il était retenu **inconditionnellement** comme
credential — y compris sur une opération qui ne déclare pas `upload_link` —
et **évinçait un cookie de session boutique valide présenté en même temps**.
Conséquence prouvée : un acheteur avec une session boutique valide, dont une
requête vers une opération `shop_customer` porte aussi cet en-tête (client
partagé, intercepteur global lisant `/depot/:jeton`, rejeu), recevait 403
`identity.actor_kind_required` au lieu d'être servi par son cookie —
exactement la configuration qu'introduira E10.20b (page de dépôt sur la
surface `storefront`, MÊME ORIGINE que la boutique).

**Corrigé** — `readCredential()` prend désormais `isUploadLinkOperation` en
paramètre (comme `resolvePrincipal()` le lui transmet) : l'en-tête de lien
n'est retenu comme credential **que** si l'opération atteinte est
`orderUploadLink` ; sur toute autre opération il est ignoré au sens le plus
strict — il ne fait même plus perdre le cookie, la sélection retombe dessus
exactement comme s'il n'avait jamais été envoyé. **Effet de bord découvert
en corrigeant** : un en-tête de lien SEUL (sans cookie, sans explicite) sur
une route qui ne déclare pas `upload_link` rend désormais 401
`identity.authentication_required` (traité comme une requête non
authentifiée) et non plus 403 — sémantiquement plus juste : l'en-tête
« ignoré » signifie littéralement absent, pas « présent mais refusé ». Les
deux tests qui affirmaient l'ancien 403 ont été corrigés en conséquence
(`gescom-middleware.contract.test.ts`, `order-upload-links.contract.test.ts`)
et documentent pourquoi.

**Preuve, test symétrique ajouté** (demandé par la qa-review) —
`gescom-middleware.contract.test.ts` : cookie de session boutique VALIDE +
en-tête de lien SANS RAPPORT sur une route `shop_customer` → 201, résolu via
le **cookie**, jamais via le lien (`accountId` du cookie retourné, pas de
403).

### B2 — BLOQUANT, dérivation d'idempotence pour `UploadLinkPrincipal` assignée à E10.20a par le contrat (§8.21 §5), absente → corrigée

**Constat exact.** `gescom-middleware.ts` ne dérivait la clé
d'idempotence STOCKÉE que pour `shop_customer`
(`deriveShopCustomerIdempotencyStorageKey`) ; un `UploadLinkPrincipal`
retombait sur la clé brute indexée sur le seul `tenantId`. Le contrat assigne
pourtant explicitement cette dérivation à **E10.20a**, pas à E10.20b (§8.21
§5, ligne E10.20a : « … derivation d'idempotence pour ce principal … »).
Sans correctif, E10.20b aurait réintroduit le défaut de socle déjà trouvé et
corrigé pour `shop_customer` en E10.10b-2 : deux porteurs de liens
**distincts** du même imprimeur choisissant par hasard la même valeur de clé
(ex. « 1 ») auraient partagé la même entrée `{tenantId, key}`.

**Corrigée** — `deriveUploadLinkIdempotencyStorageKey(linkId, presentedKey)`
ajoutée dans `idempotency.ts`, patron **exact** de la fonction jumelle
(`sca.<accountId>.<hash>` → `ulk.<linkId>.<hash>`), branchée dans
`gescom-middleware.ts` (`principal.kind === 'upload_link' ?
deriveUploadLinkIdempotencyStorageKey(principal.linkId, key) : ...`).
Aucune route de ce lot n'a `createsResource: true` sous ce principal
(`getOrderUploadLinkContext` est un GET) : la fonction n'a donc pas encore
d'appelant réel, mais elle est livrée **avant** qu'E10.20b n'enregistre
`confirmOrderUploadLinkFile`, comme le contrat l'exige — un câblage à faire
par 20b, pas une conception à inventer en urgence.

**Preuve, fixture + tests ajoutés** (symétriques exacts des tests
E10.10b-2 déjà en place pour `shop_customer`) —
`gescom-middleware.contract.test.ts` : route fixture
`fixtureConfirmAsUploadLink` (`authentication: 'upload_link'`,
`createsResource: true`) ; deux liens distincts (`link-1`/`link-2`, même
tenant) choisissant la MÊME clé sur deux ressources différentes ne se
bloquent plus mutuellement (201/201, pas de 409) ; la MÊME clé pour le MÊME
lien reste rejouée (`Idempotency-Replayed: true`), pas une seconde écriture.

### N1/N2/N4 — non bloquants, traités

- **N1** (couverture SQL incomplète : scénario 9 annonçait « ni créer ni
  révoquer » mais ne testait que « créer ») — **traité** : scénario 9bis
  ajouté à `gescom-e10-20a-order-upload-links.sql`, qui émet un lien RÉEL sur
  le tenant A puis prouve que l'admin du tenant B ne peut ni le révoquer
  (`permission_denied`, `p_tenant_id` forcé) ni produire d'effet de bord (le
  lien reste vivant après la tentative refusée).
- **N2** (aucun scénario ne prouvait que `anon` ne lit pas la table,
  `token_hash` compris) — **traité** : scénario 10 ajouté, rôle `anon` SANS
  AUCUNE identité (`request.jwt.claims` vide), `select count(*)` rend 0 ligne.
- **N4** (`buildUploadLinkPublicUrl` compose un lien vers `/depot/<jeton>`,
  route qui n'existe pas encore avant E10.20b) — **traité côté UI** :
  `OrderUploadLinksPanel` affiche désormais un avertissement explicite
  (« La page de dépôt sera disponible lors d'une prochaine mise à jour — ne
  transmettez pas encore ce lien à votre client ») dans l'encart du jeton
  fraîchement créé, `data-testid`
  `orderUploadLinks.depotPageNotReadyNotice`. **À rappeler explicitement à
  Arnaud avant toute démonstration** de ce panneau avant la livraison
  d'E10.20b : le lien copié ne mène nulle part avant cette date.
- **N3** (dette préexistante sur `tests/contract/_lint.ts`) — non traité,
  hors périmètre de cette story (confirmé par la qa-review elle-même).

## Ce qui est livré

| Élément | Détail |
|---|---|
| **Quatrième mode d'authentification (socle)** | `src/modules/_shared/application/tenant-resolution.ts` : `UploadLinkCredential`/`UploadLinkPrincipal` (ni rôle, ni scope, ni capability — capacité bornée à une commande, jeton porté par le principal comme `ShopCustomerPrincipal.sessionToken` pour re-vérification par chaque fonction `security definer`), `readCredential()` étendu (en-tête `X-Magrit-Upload-Link`, **mode-dépendant depuis qa-review round 1 B1** : retenu uniquement sur sa propre opération, IGNORÉ — sans évincer le cookie — sur toute autre), `resolvePrincipal()` étendu (`isUploadLinkOperation`, refus 400 du cumul avec une credential explicite — §3.6 branche 4 —, 401 `upload_link.invalid` dédié, cause unique et indistincte), `assertScopes()`/`assertUploadLinkPrincipal()` ajoutés, dérivation d'idempotence `deriveUploadLinkIdempotencyStorageKey()` (`idempotency.ts`, qa-review round 1 B2). |
| **Cloisonnement dans `gescom-middleware.ts`** | `GescomAuthentication` porte `'upload_link'` ; `defineGescomRoute` refuse qu'une route `upload_link` déclare `requiredScopes` ; `createGescomApiHandler` referme le mode dans **les deux sens** (un `UploadLinkPrincipal` sur une route qui ne le déclare pas → 403 ; un acteur d'un autre mode sur une route `upload_link` → 403), symétrique exact du cloisonnement `shop_customer` (E10.10b-1 round 2) ; branche `deriveUploadLinkIdempotencyStorageKey()` sur la dérivation de clé d'idempotence stockée (qa-review round 1, B2). |
| **Code d'erreur `upload_link.invalid`** | Ajouté à `SHARED_PROBLEM_CODES` (socle transverse, pas un domaine `order_upload_link.*` propre — même raison que `scopeForbidden`, E10.5, déjà logé là pour un motif identique : levé par `resolvePrincipal()` lui-même, avant qu'aucun module applicatif ne soit atteint) + helper `uploadLinkInvalid()`. |
| **Migration `20260910000300`** | Table `commercial_order_upload_links` (pas de colonne `tenant_id`, tenant lu par jointure sur `commercial_orders`, même patron qu'`commercial_order_files`) ; RLS lecture ouverte au tenant, **aucune** policy d'écriture (chemin PostgREST direct bloqué, seule voie : les fonctions `security definer`) ; quatre fonctions `api_*` : `api_create_order_upload_link` (verrou avisory sur la commande, plafond de **10** liens vivants sous ce verrou, jeton généré ici — 32 octets aléatoires base64url —, seule l'empreinte sha256 hexadécimale persistée), `api_revoke_order_upload_link` (`upload_link.not_found` si le lien n'est plus vivant, y compris rejoué sur un lien déjà révoqué), `api_resolve_order_upload_link_principal` (`stable`, **sans effet de bord**, GRANT `anon`, consommée par le `PrincipalVerifier`), `api_get_order_upload_link_context` (RE-vérifie le jeton, incrémente `use_count`/pose `first_used_at`/`last_used_at`, GRANT `anon`). |
| **Module `src/modules/order-upload-links/`** | `api/contracts.ts` (Zod aligné sur les types générés — `expires_in_days`/`max_files` en `.default()` pour que le type de *sortie* Zod corresponde au champ non-optionnel du contrat généré malgré son défaut), `application/order-upload-links-repository.ts` (port + 3 erreurs de domaine), `application/order-upload-links-service.ts`, `api/client.ts`, `ui/OrderUploadLinksPanel.tsx`. |
| **Adaptateur Supabase** | `src/adapters/supabase/order-upload-links-repository.ts` — **deux clients distincts**, jamais confondus : `client` (JWT de l'appelant, les trois opérations d'atelier) et `anonClient` (**sans aucun JWT Magrit**, `getContext` — le porteur d'un lien n'a par construction aucune credential Magrit, même raisonnement que `storefrontClient`/E10.10b-1). Réutilise `MAX_UPLOAD_BYTE_SIZE`/`ACCEPTED_CONTENT_TYPES` d'`order-files-repository.ts` (exportées pour l'occasion) plutôt que de les dupliquer — même plafond, même bucket, arbitrage (A) « on ne bouge pas ». |
| **Routes** | `src/server/api/order-upload-links-routes.ts` — quatre opérations enregistrées (`createOrderUploadLink`/`listOrderUploadLinks`/`revokeOrderUploadLink` en `authentication: 'user'`, aucune clé de service — contrat, `security: [bearerAuth]` seul, écart assumé avec `listOrderFiles` qui ouvre aux clés `orders:read` ; `getOrderUploadLinkContext` en `authentication: 'upload_link'`), enregistrées dans `gescom-routes.ts`. |
| **Édge function** | `supabase/functions/magrit-api/index.ts` — composition du service, deux clients passés à l'adaptateur, `Access-Control-Allow-Headers` étendu à `x-magrit-upload-link`. |
| **UI** | `OrderUploadLinksPanel` (module `order-upload-links/ui/`), cinquième section de `OrderDetailPage.tsx` — créer/lister/révoquer un lien ; le jeton en clair n'est affiché **qu'une fois**, dans un encart avec bouton « Copier » (Magrit n'envoie jamais le lien, contrat) ; URL publique composée **côté client** (`<origine>/depot/<jeton>`, jamais par le serveur — plusieurs origines possibles). **Avertissement explicite ajouté (qa-review round 1, N4)** : « La page de dépôt sera disponible lors d'une prochaine mise à jour — ne transmettez pas encore ce lien à votre client », affiché dans le même encart tant qu'E10.20b n'est pas livrée. `data-testid` : scope `orderUploadLinks.*` (voir `testIds.ts`). |

## Critères d'acceptation (périmètre transmis par l'agent appelant, tenus un par un)

1. **Quatrième mode d'authentification, distinct des trois autres, ni utilisateur ni compte boutique.** — **fait.** `UploadLinkPrincipal` (`kind: 'upload_link'`) ajouté à l'union `ApiPrincipal`, résolu depuis l'en-tête `X-Magrit-Upload-Link` par `SupabaseApiPrincipalVerifier.verifyUploadLink()` (appelle `api_resolve_order_upload_link_principal`, jamais de confiance dans un identifiant transmis en clair). Vérifié par 8 tests dédiés dans `tests/contract/gescom-middleware.contract.test.ts` (résolution, 401 indistinct, cloisonnement dans les deux sens, cumul refusé §3.6 branche 4, en-tête ignoré hors mode, `X-Magrit-Tenant` refusé) et par le scénario 7 du cas SQL.
2. **Cloisonnement strict : le porteur du lien n'a accès qu'à la commande ciblée, jamais aux autres commandes du tenant, jamais aux données commerciales au-delà de ce que `getOrderUploadLinkContext` expose.** — **fait.** `UploadLinkPrincipal` porte `orderId`/`tenantId` résolus **depuis le jeton**, jamais choisis par l'appelant ; `getOrderUploadLinkContext` n'a pas de paramètre de commande (« la ressource est désignée par la credential », patron `storefrontSession`) — structurellement incapable d'adresser une autre commande. `OrderUploadLinkContext` ne porte aucun champ commercial (prix, ligne, statut, nom de client) — vérifié par un test dédié (`not.toHaveProperty('customer_name'/'download_url')`) et par le schéma Zod `.strict()` qui rejette tout champ additionnel. Cloisonnement inter-mode couvert aux deux niveaux (socle + module) — voir CA1.
3. **Création/liste/révocation du lien depuis le workspace.** — **fait.** Trois routes `authentication: 'user'`, aucune capability (décision #4, reprise d'E10.17a), plafond de 10 liens vivants **sous verrou avisory**, révocation indiscernable d'un lien inconnu (rejouer échoue au même titre). Vérifié par 15 tests de contrat + scénarios 3 à 6 du cas SQL (RLS écriture directe bloquée pour tout rôle, y compris admin ; plafond ; revocation).
4. **`getOrderUploadLinkContext`.** — **fait.** Rend `printer_name`/`order_number`/`label`/`expires_at`/`max_files`/`deposited_count`/`max_byte_size`/`accepted_content_types` ; incrémente `use_count` et pose `first_used_at`/`last_used_at` à chaque lecture (`first_used_at` figé à la première). 401 `upload_link.invalid` unique et indistinct (absent, inexistant, expiré, révoqué) — arbitrage (F), vérifié explicitement par un test qui prouve les quatre causes rendent le même code.
5. **`issueOrderUploadLinkFileUrl`/`confirmOrderUploadLinkFile`.** — **non implémentées, délibérément, périmètre d'E10.20b.** Voir la section « Écart constaté » ci-dessus : le contrat de référence de cette story (§8.21 §5) les assigne explicitement à 20b, y compris le mécanisme SQL sous-jacent (`api_confirm_order_file_upload_by_link`) que le point 7 de la tâche interdit de forcer par réutilisation. Rien n'est codé, rien n'est enregistré dans le registre de routes — pas une coquille silencieuse, une absence documentée.
6. **Migration Supabase.** — **fait.** `20260910000300_gescom_e10_20a_order_upload_links.sql`, numéro suivant après `20260910000200` (E10.19b), réversible (bloc SQL de retrait en pied de fichier), **rejouée réellement contre Postgres local** (`pnpm db:local:push`) puis testée par `tests/sql/gescom-e10-20a-order-upload-links.sql` (9 scénarios, `ROLLBACK` propre).
7. **Réutilisation d'`order-files` sans forcer celle d'`api_confirm_order_file_upload`.** — **fait.** `MAX_UPLOAD_BYTE_SIZE`/`ACCEPTED_CONTENT_TYPES` réutilisées telles quelles (exportées) plutôt que dupliquées. Aucune tentative de réutiliser `api_confirm_order_file_upload` (dont les trois verrous — `auth.uid()` non nul, appartenance `tenant_members`, libellé lu d'`auth.users` — la rendent structurellement incompatible avec un porteur de lien, constat déjà fait par l'architecte au cadrage) : le mécanisme de dépôt propre au 4ᵉ mode reste **entièrement à écrire par E10.20b**, ce lot ne le préfigure même pas en SQL (aucune fonction `api_confirm_order_file_upload_by_link` posée ici).

## Décision de conception : deux clients Supabase, jamais confondus

`SupabaseOrderUploadLinksRepository` reçoit `client` (porte le JWT de
l'appelant) **et** `anonClient` (`storefrontClient` de l'edge function, sans
aucun JWT Magrit). Les trois opérations d'atelier appellent leurs fonctions
`security definer` via `client` (`auth.uid()` doit être non nul pour
qu'`api_create_order_upload_link`/`api_revoke_order_upload_link`
identifient l'acteur et écrivent l'audit `created_by`/`revoked_by`).
`getContext` appelle `api_get_order_upload_link_context` via `anonClient` :
le porteur d'un lien n'a **par construction** aucune credential Magrit,
utiliser `client` ici ferait dépendre la résolution du lien d'un JWT que
l'appelant légitime n'a jamais — et ferait fuiter, le cas échéant, le JWT
d'un membre qui ouvrirait le lien de son propre client dans le même
navigateur (le cumul est déjà refusé en amont par le middleware, §3.6
branche 4, mais le repository ne doit de toute façon jamais en avoir
besoin). Même raisonnement, mêmes mots que la distinction
`client`/`storefrontClient` d'E10.10b-1.

## Sécurité du jeton — ce qui a été vérifié, pas seulement affirmé

- **Entropie** : 32 octets aléatoires (`extensions.gen_random_bytes(32)`),
  encodés en base64url (`~43` caractères), dans la borne du pattern contrat
  `^[A-Za-z0-9_-]{32,128}$` — même génération que
  `api_authenticate_shop_customer` (storefront), déjà en production.
- **Jamais stocké en clair** : seule l'empreinte sha256 **hexadécimale**
  (`token_hash text`, 64 caractères, `check` de forme) est persistée. Prouvé
  **par exécution réelle**, pas par lecture du code : le scénario 4 du cas
  SQL recalcule `sha256(jeton rendu)` côté test et vérifie l'égalité avec
  `token_hash`, puis vérifie explicitement que `token_hash <> token`.
- **Comparaison en temps constant côté applicatif** : **non applicable ici,
  et c'est volontaire plutôt qu'oublié.** Le jeton n'est jamais comparé
  applicativement — la comparaison est une égalité PostgreSQL sur un index
  `unique` posé sur `token_hash` (SHA-256 déjà appliqué), exactement le
  patron déjà en production pour `shop_customer_sessions.token_hash`
  (`bytea`, égalité indexée) et `shop_customer_activation_tokens`. Aucune
  branche de code applicatif ne compare deux chaînes secrètes octet par
  octet ; la seule primitive de ce type dans le dépôt
  (`timingSafeEqual`, `_shared/application/outbox.ts`) sert la vérification
  de signature HMAC des webhooks, un besoin différent.
- **RLS réellement testée, pas seulement déclarée** : scénario 3 du cas SQL
  prouve qu'**aucun** rôle applicatif — y compris `admin` — ne peut
  `INSERT`/`UPDATE`/`DELETE` directement sur `commercial_order_upload_links`
  (le `revoke` du grant applicatif de base tient, `insufficient_privilege`
  dans les trois cas). Scénario 2 prouve l'isolation inter-tenant en lecture
  (tenant B : 0 ligne vue d'une commande du tenant A).

## Dette introduite

| Réf. | Point | Chemin de mise en conformité |
|---|---|---|
| **D1** | La colonne `deposited_count` sur `commercial_order_upload_links` est un **écart documenté** avec le tableau de colonnes du cadrage architecte (§8.21 §3, écrit *avant* le contrat OpenAPI final) — absente de ce tableau, mais **exigée** par le schéma `OrderUploadLink` du contrat écrit (champ `required`). Ajoutée pour que le contrat soit honoré sans dépendre d'une jointure vers `commercial_order_files` (qui n'a — et n'aura pas dans ce lot — de colonne reliant un fichier à son lien). Reste à `0` dans ce lot (aucun dépôt n'existe encore). | E10.20b devra l'incrémenter **atomiquement** dans `api_confirm_order_file_upload_by_link`, sans avoir besoin d'une jointure vers `commercial_order_files` — c'est explicitement ce que cette colonne rend possible. À vérifier par la qa-review d'E10.20b que l'incrément est bien fait sous verrou, symétriquement au plafond de la commande. |
| ~~**D2**~~ | ~~Dérivation d'idempotence pour `UploadLinkPrincipal` absente~~ — **RÉSOLU en qa-review round 1 (B2, BLOQUANT)** : `deriveUploadLinkIdempotencyStorageKey()` livrée et branchée dans `gescom-middleware.ts`. Voir la section qa-review ci-dessus. | Clos. |
| **D3 (héritée, sans rapport)** | `tests/storage/product_mockups_isolation.test.ts` échoue (3 tests, « Bucket not found ») sur cette base locale — cause déjà établie par les stories précédentes (bucket créé hors des migrations versionnées). Confirmé **pré-existant** : mêmes 3 échecs avant toute modification de cette session (`git stash` + rejeu). | Hors périmètre. |
| **D4 (héritée, sans rapport)** | `pnpm test:storefront:sql` (script complet, séquentiel, `set -e`) échoue dès `tests/sql/legacy-shop-only-write-freeze.sql` (rôle `owner` déprécié par le trigger UM1) puis, une fois ce cas neutralisé pour vérification, dès `tests/sql/storefront-credential-activation.sql` (contrainte NOT NULL déjà en échec avant mes changements) — panne pré-existante de l'état de la base locale, déjà documentée comme dette de sensibilité à l'état local par des stories antérieures (E10.19a/b). Le cas de cette story (`gescom-e10-20a-order-upload-links.sql`) a été rejoué **individuellement, avec succès**, ainsi que les trois cas précédents dans l'ordre du registre (`gescom-e10-17a`/`-19a`/`-19b`) pour prouver l'absence de régression locale. | Hors périmètre — signalé pour qu'il ne soit pas reperdu. |
| **D5 (héritée, sans rapport)** | `pnpm typecheck:all` (couvre `tests/`, contrairement à `pnpm typecheck`) porte une classe d'erreurs pré-existante répétée sur des dizaines de fichiers de test non touchés par cette story (`Id<string>` non convertible sur le patron `brand<T>()`, `Property 'value'/'error'` sur `Result`, tuples `[]` indexés…) — confirmé **pré-existant** par `git stash` + rejeu de `typecheck:all` avant toute modification (151 erreurs avant, 148 après — aucune erreur nouvelle imputable à cette story ; mes deux nouveaux fichiers de test héritent de la même classe d'erreur en copiant un patron `brand<T>()` déjà cassé dans `order-files.contract.test.ts`, fichier sœur déjà commité). | Hors périmètre — dette d'environnement TypeScript antérieure, déjà tracée par la story E10.19b (D6 de sa propre fiche). `pnpm typecheck` (alias CI-bloquant, ne couvre pas `tests/`) reste **vert, 0 erreur**. |
| **D6** | Aucun test de composant React (RTL) pour `OrderUploadLinksPanel` — **conforme au précédent établi** : ni `OrderFilesBlock` ni `OrderDocumentPanel` n'en ont non plus (vérifié : aucun fichier `tests/**/*OrderFilesBlock*`/`*OrderDocumentPanel*`). Couverture actuelle : `data-testid` posés selon la convention documentée, contrat HTTP exercé par `order-upload-links.contract.test.ts`. | Aucun cahier de tests Notion publié à la rédaction de ce lot (comme pour `orderFiles.*`/`orderDocument.*`) — à faire confirmer par le `scribe` dès que le cahier TF existera. |

## Tests exécutés

| Commande | Résultat |
|---|---|
| `pnpm typecheck` (`tsconfig.modular.json`) | **vert**, 0 erreur (rejoué après les corrections B1/B2) |
| `pnpm typecheck:all` (`tsconfig.json`) | Aucune erreur nouvelle imputable à cette story (voir dette D5, inchangé par ce round) |
| `pnpm gen:api:check` | **vert**, aligné (`openapi/magrit-core.v1.yaml` non touché par cette story ni par ce round) |
| `pnpm test:architecture` | **vert**, 34 fichiers / 146 tests |
| `pnpm test:contract` (`vitest run tests/contract`) | **vert**, 20 fichiers / **369 tests** (+3 par rapport à la remise initiale : 1 test symétrique B1 cookie+lien, 2 tests B2 idempotence par lien, dans `gescom-middleware.contract.test.ts` — désormais 33 tests dans ce fichier ; `order-upload-links.contract.test.ts` reste à 15, deux tests réécrits pour le 401 corrigé) |
| `pnpm exec vitest run` (suite complète) | **2036 passés / 36 skip / 3 échecs** (+3 par rapport à la remise initiale) — les 3 échecs restent `tests/storage/product_mockups_isolation.test.ts`, préexistants, sans rapport |
| Migration `20260910000300` | Inchangée par ce round (B1/B2 sont des corrections applicatives TypeScript, aucun SQL retouché) |
| `tests/sql/gescom-e10-20a-order-upload-links.sql` | **rejoué réellement** contre Postgres local après ajout des scénarios 9bis (N1, révocation croisée) et 10 (N2, `anon` ne lit rien) : **0 erreur**, `ROLLBACK` propre, **11 groupes de scénarios** désormais (les 9 initiaux + 9bis + 10) |
| `tests/sql/gescom-e10-17a-order-files.sql`, `-19a-order-document-template.sql`, `-19b-order-documents.sql` rejoués isolément après ce round | **0 erreur**, aucune régression |

## Fichiers créés/modifiés

**Créés** :
- `supabase/migrations/20260910000300_gescom_e10_20a_order_upload_links.sql`
- `src/modules/order-upload-links/api/contracts.ts`
- `src/modules/order-upload-links/api/client.ts`
- `src/modules/order-upload-links/application/order-upload-links-repository.ts`
- `src/modules/order-upload-links/application/order-upload-links-service.ts`
- `src/modules/order-upload-links/index.ts`
- `src/modules/order-upload-links/ui/OrderUploadLinksPanel.tsx`
- `src/modules/order-upload-links/ui/order-upload-links.helpers.ts`
- `src/modules/order-upload-links/ui/index.ts`
- `src/adapters/supabase/order-upload-links-repository.ts`
- `src/server/api/order-upload-links-routes.ts`
- `tests/sql/gescom-e10-20a-order-upload-links.sql` (scénarios 9bis/10 ajoutés en qa-review round 1, N1/N2)
- `tests/contract/order-upload-links.contract.test.ts` (2 tests réécrits en qa-review round 1, B1 : 403→401)
- `tests/contract/_fakes/order-upload-links-repository.fake.ts`

**Modifiés** :
- `src/modules/_shared/api/contracts.ts` (`UPLOAD_LINK_HEADER`)
- `src/modules/_shared/api/index.ts` (export)
- `src/modules/_shared/application/problem.ts` (`SHARED_PROBLEM_CODES.uploadLinkInvalid`, `uploadLinkInvalid()`)
- `src/modules/_shared/application/tenant-resolution.ts` (quatrième mode — `UploadLinkCredential`/`UploadLinkPrincipal`, `readCredential`/`resolvePrincipal`/`assertScopes`/`assertUploadLinkPrincipal` étendus, `assertNoTenantSelectionOnCookieSession` généralisée en `assertNoTenantSelectionOnTenantBearingCredential` ; **qa-review round 1, B1** : `readCredential()` prend `isUploadLinkOperation`, l'en-tête de lien n'est plus retenu ni évinceur du cookie hors de son mode)
- `src/modules/_shared/application/idempotency.ts` (**qa-review round 1, B2** : `deriveUploadLinkIdempotencyStorageKey()` ajoutée, patron exact de `deriveShopCustomerIdempotencyStorageKey`)
- `src/modules/_shared/application/index.ts` (exports, dont `deriveUploadLinkIdempotencyStorageKey`)
- `src/server/api/gescom-middleware.ts` (`GescomAuthentication` porte `'upload_link'`, cloisonnement dans les deux sens ; **qa-review round 1, B2** : branchement de `deriveUploadLinkIdempotencyStorageKey()`)
- `src/server/api/gescom-routes.ts` (service `orderUploadLinks`, routes enregistrées)
- `src/adapters/supabase/api-principal-verifier.ts` (`verifyUploadLink()`)
- `src/adapters/supabase/order-files-repository.ts` (`MAX_UPLOAD_BYTE_SIZE`/`ACCEPTED_CONTENT_TYPES` exportées, réutilisées par E10.20a)
- `src/types/database.types.ts` (entrée manuelle `api_resolve_order_upload_link_principal` — même discipline que l'entrée manuelle d'E10.10b-1, `api_resolve_shop_customer_principal`, en l'absence d'accès pour régénérer depuis le projet réel)
- `supabase/functions/magrit-api/index.ts` (composition `OrderUploadLinksService`, deux clients, CORS `x-magrit-upload-link`)
- `src/shared/presentation/testIds.ts` (scope `orderUploadLinks`, **qa-review round 1, N4** : `depotPageNotReadyNotice`)
- `src/modules/commercial-orders/ui/workspace/OrderDetailPage.tsx` (cinquième section)
- `src/modules/order-upload-links/ui/OrderUploadLinksPanel.tsx` (**qa-review round 1, N4** : avertissement page de dépôt pas encore livrée)
- `scripts/test-storefront-sql.sh` (ajout du cas SQL de ce lot)
- `tests/contract/gescom-middleware.contract.test.ts` (fixture `upload_link` + fixture `upload_link`/`createsResource`, 33 tests au total — **qa-review round 1** : test symétrique B1 cookie+lien, 2 tests B2 idempotence par lien, 1 test réécrit de 403→401 pour le cloisonnement sens 1)
- `tests/sql/gescom-e10-20a-order-upload-links.sql` (**qa-review round 1** : scénarios 9bis/N1 et 10/N2 ajoutés)

**Non touchés (rappel R5)** : `openapi/magrit-core.v1.yaml`,
`src/platform/api/generated/magrit-core.v1.ts`,
`tests/contract/_lint.ts` — le contrat et son lint (`TENANT_BEARING_SCHEMES`)
étaient déjà écrits par l'architecte ; aucun écart constaté entre le contrat
et ce qui devait être implémenté (le seul écart trouvé — la portée des deux
opérations de dépôt — n'est pas un défaut du contrat, il est le contrat lui-
même, mal lu au premier passage de la tâche transmise, voir section dédiée
en tête de fiche). `pnpm gen:api:check` confirme l'alignement.
