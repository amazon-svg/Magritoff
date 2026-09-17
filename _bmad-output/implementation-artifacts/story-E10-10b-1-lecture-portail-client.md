---
id: E10.10b-1
epic: E10 — Gestion commerciale
status: done
branch: feat/gescom-e10-4-entite-client
depends_on: [E10.3, E10.5, E10.9, E10.10a]
blocks: [E10.10b-2, E10.10b-3, E10.10b-4]
---
# E10.10b-1 — Lecture des devis dans le portail client

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [E10.10b-1 — Lecture des devis dans le portail client](https://app.notion.com/p/3d4d0131973c818e9b8debb956e09abe) · extrait le 17/09/2026 · page modifiée le 07/09/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| E10 — Gestion commerciale | Sprint 5 — Gestion commerciale | P1 | L | Terminé | Claude code | Pro+ | WM 01/09/2026 | — |

### Description fonctionnelle (Notion)

**En tant que** client boutique, **je veux** consulter mes devis envoyés/acceptés/refusés/convertis depuis mon espace client, **afin de** ne pas dépendre d'un échange d'email avec mon imprimeur pour retrouver une offre.

##### Statut

Terminé — qa-review round 1, Approuvé (0 bloquant après correction des 3 bloquants identifiés au round 1).

##### Contexte produit

Sous-chantier découpé par l'architecte le 06/09/2026 (§8.13 de `docs/api/CONVENTIONS.md`) à partir du cadrage E10.10b — mettre le devis à disposition dans la boutique du client. **Attention numérotation** : cette story n'est pas liée à la carte Notion existante « E10.10 — Affichage optionnel des remises sur le document de devis » (qui correspond en réalité au périmètre livré par **E10.10a**, actuellement non reflété comme Terminé dans cette carte — à corriger séparément). E10.10b-1/b-2/b-3/b-4 sont un découpage indépendant, propre au dépôt de code, non encore répercuté dans le backlog Notion avant cette création.

Quatre sous-stories retenues, chacune ouvrant un axe technique distinct : **b-1** (ce lot, lecture — élargit le socle d'authentification à un troisième acteur, le client boutique), **b-2** (décision du client, accepter/refuser), **b-3** (notification email, premier relais réel de l'outbox), **b-4** (PDF téléchargeable, décision technique sur le prestataire à prouver avant tout contrat).

##### Critères d'acceptation (contrat §8.13, tous tenus)

1. `storefrontSession` (cookie) reconnu comme troisième mode d'authentification de la façade E10, aux côtés de Bearer JWT et clé de service.
2. `GET /storefront-quotes` : devis envoyés/acceptés/refusés/convertis du client, jamais `draft`.
3. Compte boutique sans interlocuteur rattaché → 200 + liste vide, jamais 403.
4. `GET /storefront-quotes/{quoteId}` : détail complet + lignes + `ETag` publié (en prévision de b-2).
5. 404 indiscernable sur les quatre causes d'invisibilité (identifiant inconnu, devis d'un autre client, d'un autre tenant, encore `draft`).
6. Liste blanche stricte des champs exposés au client (aucun coût, marge, `breakdown`, identifiants internes).
7. `show_discounts` appliqué et filtré **côté serveur** (en SQL, pas en TypeScript), jamais publié comme drapeau.
8. `X-Magrit-Tenant` refusé (pas ignoré) sur une session boutique.
9. Cumul de deux credentials (cookie+Bearer, cookie+clé de service) refusé en 400.
10. Aucune panne de branchement pour un acteur sans scope (`assertScopes()`/`defineGescomRoute()`).
11. Autorisation portée par des fonctions `security definer`, aucune nouvelle policy RLS sur `commercial_quotes`.
12. Session déléguée : lecture autorisée, représentation identique à une session directe.
13. Onglet « Mes devis » rendu au portail client (`PortalQuotes`).

##### Contrat API

| Méthode | Route | Objet |
| --- | --- | --- |
| GET | `/api/v1/storefront-quotes` | Liste paginée par curseur, filtre `status` optionnel |
| GET | `/api/v1/storefront-quotes/{quoteId}` | Détail + lignes, `ETag` publié |

Schémas ajoutés : `StorefrontQuoteStatus`, `StorefrontQuoteTotals`, `StorefrontQuoteLine`, `StorefrontQuote`, `StorefrontQuoteDetail`. Aucun code d'erreur nouveau.

##### Dev Agent Record

###### Agent Model Used

Architecte (cadrage contrat, Claude Opus) → `dev-story` (implémentation, Claude Sonnet) → `qa-review` (Claude Opus, 1 round).

###### Completion Notes

Socle élargi à un troisième principal `ShopCustomerPrincipal` (`kind: 'shop_customer'`), résolu depuis le cookie `__Host-magrit-storefront`. **Round 1 qa-review, 3 bloquants corrigés** : B1 (précédence credential explicite vs cookie passif — la règle de non-cumul initiale mettait hors service tout Sprint 5 pour un membre atelier ayant une session boutique ouverte), B2 (sortie anticipée inconditionnelle d'`assertScopes()` permettant un contournement silencieux de `requiredScopes`), B3 (dette préexistante E10.10a : `CommercialSettingsService` non injecté dans l'edge function, 500 en prod sur tout appel `commercial-settings`).

Décision de sécurité prise seule, à valider en revue : fonctions SQL avec `p_opaque_token` plutôt que `p_shop_customer_account_id` (le cadrage suggérait ce dernier) — ces fonctions étant `grant execute to anon`, un `accountId` fourni tel quel serait un identifiant non authentifié, exploitable par énumération d'UUID.

###### Dette introduite ou héritée

- **v1** (préexistante) : `pnpm test:storefront:sql` échoue sur des cas antérieurs sans rapport (dérive d'environnement local). Cas de cette story exécuté isolément, passe.
- **v2** (préexistante, corrigée au round 1 — voir B3 ci-dessus).
- **v3** : renforcement `tenant_id` dans les fonctions SQL de lecture, laissé en dette explicite — **tranché et clos par E10.10b-2**.

###### Vérifications

`pnpm typecheck` 0 erreur. `pnpm test:contract` 219/219 (+15). `pnpm test:architecture` 143/143. `npx vitest run` 1611 passés / 3 échecs préexistants sans rapport / 36 skip. `tests/sql/gescom-e10-10b-1-storefront-quotes.sql` exécuté réellement (Docker local), 9 scénarios, `ROLLBACK`, 0 erreur.

###### File List

Migration `20260906170000`, module `src/modules/storefront-quotes/` (api/application/adapters/server), `ApiPrincipal` étendu (`src/modules/_shared/application/tenant-resolution.ts`), UI `PortalQuotes` sur `AccountHub`, tests `tests/contract/storefront-quotes.contract.test.ts`, `tests/sql/gescom-e10-10b-1-storefront-quotes.sql`. Détail complet dans `_bmad-output/implementation-artifacts/story-E10-10b-1-lecture-portail-client.md`.

##### QA Results

**Verdict : Approuvé** (round 1). 3 bloquants trouvés et corrigés dans le même round (B1, B2, B3 ci-dessus). Gates rejouées vertes. Aucune réserve bloquante restante ; 3 points de dette tracés (v1 préexistante, v2 close, v3 transférée à b-2 qui l'a close).

##### Change Log

- 2026-09-07 — Page créée dans Notion à partir du story document livré (rétroactif — la story avait déjà été implémentée et validée sur la branche `feat/gescom-e10-4-entite-client`, non mergée vers `main`).
- 2026-09-06 — v1 — Cadrage architecte (§8.13) et livraison qa-review round 1 Approuvé.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

Premier sous-chantier d'E10.10b (mise à disposition du devis dans la
boutique du client), scindé en quatre par l'architecte (§8.13 de
`docs/api/CONVENTIONS.md`) : b-1 lecture (ce lot), b-2 accepter/refuser,
b-3 notification email, b-4 PDF. Le contrat OpenAPI (`storefrontSession`,
`listStorefrontQuotes`, `getStorefrontQuote`, schémas `StorefrontQuote*`)
était déjà écrit par l'architecte au moment de démarrer ce lot ; ce document
couvre l'implémentation (module, migration, routes, tests, UI).

## Ce qui est livré

| Élément | Détail |
|---|---|
| Socle — troisième principal | `ShopCustomerPrincipal` (`kind: 'shop_customer'`, `accountId`/`shopId`/`tenantId`/`customerId`/`sessionKind`/`sessionToken`) ajouté à `ApiPrincipal`. Résolu depuis le cookie `__Host-magrit-storefront`/`magrit-storefront` (réutilise `readStorefrontSessionCookie`, aucune réimplémentation). **Corrigé au round qa-review 1 (B1, §3.6/§8.13ter) :** hors opérations `storefrontSession`, une credential explicite (Bearer ou clé de service) l'emporte sur le cookie, qui est alors ignoré silencieusement (le cookie est posé passivement par le navigateur, un membre Magrit avec une session boutique active continue donc de servir l'atelier) ; sur les opérations `storefrontSession` seules, le cumul cookie+bearer / cookie+clé de service reste refusé en 400 `identity.actor_kind_required`. `X-Magrit-Tenant` sur une session boutique reste refusé en 400 `api.tenant_not_addressable`. |
| `assertScopes()`/`defineGescomRoute()` | Sortie anticipée pour `shop_customer` (pas de scope ni capability), et refus à la définition d'une route de ce mode qui déclarerait `requiredScopes`. **Corrigé au round qa-review 1 (B2, §3.6/§8.13ter) :** cette sortie était inconditionnelle, donc un contournement silencieux de `requiredScopes` sur une route `authentication: 'any'` — fermé en trois couches : `defineGescomRoute()` (inchangé), `createGescomApiHandler()` refuse désormais un `ShopCustomerPrincipal` sur toute route `authentication !== 'shop_customer'` (403 `identity.actor_kind_required`, symétrique de la garde inverse déjà posée), `assertScopes()` ne sort tôt que si `requiredScopes` est vide, refuse sinon (défense en profondeur). |
| `GET /storefront-quotes` | `listStorefrontQuotes` — devis `sent`/`accepted`/`rejected`/`converted` du client rattaché au compte (jamais `draft`), pagination par curseur, filtre `status` optionnel. **Correction round qa-review 1 :** une valeur hors énumération (dont `draft`) n'est PAS traitée comme « liste vide » — elle est réduite à `null` par le schéma Zod (`storefrontQuoteStatusSchema.safeParse`), donc traitée comme une ABSENCE de filtre : le client reçoit la liste COMPLÈTE de ses devis visibles, pas une liste vide. Les deux chemins (façade et défense SQL) sont individuellement corrects, seule cette description l'était mal. Compte sans interlocuteur (`customer_contact_id` NULL, E10.5 CA3) → 200 + liste vide, jamais 403 — ce cas-là, lui, est bien une liste vide. |
| `GET /storefront-quotes/{quoteId}` | `getStorefrontQuote` — détail + lignes, `ETag` publié (pour b-2). 404 `quote.not_found` **indiscernable** sur les quatre causes (identifiant inconnu, devis d'un autre client, d'un autre tenant, encore `draft`). |
| Migration `20260906170000` | Quatre fonctions `security definer`/privée : `api_resolve_shop_customer_principal` (enrichit `api_resolve_shop_customer_session`, **non modifiée**, de `tenant_id`/`customer_id`), `private.commercial_quote_totals` (arithmétique `QuoteTotals`, jamais grantée), `api_list_storefront_quotes`, `api_get_storefront_quote`. Aucune nouvelle policy RLS sur `commercial_quotes`/`commercial_quote_lines` — toute l'autorisation vit dans ces fonctions. |
| `show_discounts` | Filtré **en SQL**, dans la requête elle-même (`case when show_discounts then ... else null end`), jamais en TypeScript : ces fonctions sont `grant execute to anon`, donc joignables hors façade — un filtrage TS seul aurait laissé fuir la remise à un appel RPC direct. |
| Module `src/modules/storefront-quotes/` | `api/contracts.ts` (Zod, liste blanche stricte, aucun champ hors `StorefrontQuote*`), `application/` (service + interface repository), `adapters/supabase/storefront-quotes-repository.ts`, `server/api/storefront-quotes-routes.ts`, enregistré dans `gescom-routes.ts`. |
| UI | Onglet « Mes devis » sur `AccountHub` (`PortalQuotes`, lecture seule : liste + détail dépliable inline, lignes, totaux, TVA). Module enregistré dans le registre de surfaces (`manifest.ts`/`surface-contributions.ts`, route `customer-portal` `account/quotes`) pour que `portalRuntimePaths.accountQuotes` résolve. `AccountSection` gagne `'quotes'`. |
| Tests | `tests/contract/storefront-quotes.contract.test.ts` (16 cas depuis le round qa-review 1, +1 pour le cumul cookie+clé de service CA9 : 200/401/403/400 cumul cookie+bearer/400 cumul cookie+clé de service/400 tenant/404×3 causes/filtre status permissif/ETag). `tests/sql/gescom-e10-10b-1-storefront-quotes.sql` (9 scénarios : visibilité par statut, CA7 liste vide, filtre `draft`, isolation inter-client même tenant, isolation inter-tenant, `show_discounts` filtré, remise globale, session invalide, `private.commercial_quote_totals` non exécutable par `anon`/`authenticated`) — **exécuté réellement** (Docker local disponible sur ce poste). Round qa-review 1 ajoute aussi `tests/contract/gescom-middleware.contract.test.ts` (B1 : Bearer+cookie sur route atelier → 200 ; Bearer+cookie+X-Magrit-Tenant → 200 ; B2 : session boutique seule sur route `any` à scopes requis → 403) et `tests/server/api/magrit-api-composition.test.ts` (B3 : composition réelle de `commercial-settings`). |

## Décision de sécurité prise seul, à faire valider en revue

Le cadrage (§8.13, "Ce que le contrat impose au socle") suggérait des
fonctions `api_list_storefront_quotes(p_shop_customer_account_id, ...)` /
`api_get_storefront_quote(p_shop_customer_account_id, p_quoteId)`. Implémenté
avec `p_opaque_token` à la place (même famille que **toutes** les fonctions
storefront existantes, `api_get_storefront_portal_orders` compris) : ces deux
fonctions sont `grant execute to anon`, donc directement joignables par
PostgREST RPC avec la seule clé anonyme publique, en dehors de toute façade.
Un `accountId` fourni tel quel par l'appelant y serait un identifiant NON
authentifié — n'importe qui aurait pu lire les devis de n'importe quel compte
en énumérant des UUID. `p_opaque_token` (32-512 caractères, format contrôlé)
est la seule valeur qu'un appelant ne peut pas forger ; la fonction
re-vérifie donc elle-même la session (`api_resolve_shop_customer_session`,
non dupliquée). Documenté en détail dans l'en-tête de la migration et dans
`docs/api/CONVENTIONS.md` §8.13bis. Chemin de mise en conformité si
l'architecte préfère la signature initiale : ajouter un second paramètre ne
change rien côté appelant TypeScript.

## Ce qui n'est PAS dans le périmètre

- **Accepter/refuser un devis** (E10.10b-2) — aucune écriture sur
  `commercial_quotes` dans ce lot, `ETag` publié en prévision.
- **Notification email** (E10.10b-3) — aucun relais outbox touché.
- **PDF téléchargeable** (E10.10b-4) — décision technique déjà actée par
  l'architecte (§8.13), pas de code ici.
- Session déléguée : lecture autorisée (même représentation), aucune garde
  d'écriture posée par anticipation — b-2 tranchera séparément.

## Dette introduite ou héritée

| Réf. | Trou | Chemin de mise en conformité |
|---|---|---|
| **v1** | `pnpm test:storefront:sql` (harnais complet) échoue sur `tests/sql/legacy-shop-only-write-freeze.sql` et plusieurs autres cas **antérieurs** à ce lot (dérive d'environnement local accumulée sur plusieurs sessions : contraintes durcies depuis, `protect_last_tenant_admin`, données PIM absentes — aucun rapport entre eux ni avec ce lot). Le cas de CETTE story a été exécuté isolément et passe. | `pnpm db:local:reset` complet sur ce poste, investigation dédiée (hors périmètre de cette story). |
| **v2** | `supabase/functions/magrit-api/index.ts` ne construit ni n'injecte `CommercialSettingsService` dans `gescomServices` — manque **préexistant** à E10.10a, découvert en câblant `storefrontQuotes` à côté (fichier hors `tsconfig`, jamais typechecké). | À corriger avant le prochain déploiement réel de l'edge function. |
| **v3** | `requiredCapabilities: ['storefront-quotes.read.own']` sur la contribution `customer-portal` est purement documentaire (un `ShopCustomerPrincipal` n'a structurellement aucune capability) — cohérent avec `orders.customer-portal.list`, qui a la même propriété. | Aucun. |

## Vérifications

`pnpm typecheck`, `pnpm gen:api:check`, `pnpm test:contract` (219/219, dont
15 nouveaux), `pnpm test:architecture` (143/143), `npx vitest run` (1611
passés, 3 échecs pré-existants sans rapport —
`tests/storage/product_mockups_isolation.test.ts`) — **0 échec inattendu**,
conforme à la prédiction du cadrage (§8.13 : « aucun faux de test n'est mis
en défaut »).

`tests/sql/gescom-e10-10b-1-storefront-quotes.sql` : **exécuté réellement**
(Docker local disponible sur ce poste, migration appliquée via
`supabase db push --include-all`) — les 9 scénarios passent, `ROLLBACK`
final, aucune erreur.

## Critères d'acceptation (contrat §8.13, tenus un par un)

1. `storefrontSession` (cookie) reconnu comme troisième mode d'authentification — **fait**.
2. `GET /storefront-quotes` : devis envoyés/acceptés/refusés/convertis du client, jamais `draft` — **fait**, testé (contrat + SQL).
3. Compte sans interlocuteur → 200 + liste vide, jamais 403 — **fait**, testé (SQL scénario 2, contrat).
4. `GET /storefront-quotes/{quoteId}` : détail complet + `ETag` — **fait**, testé.
5. 404 indiscernable sur les quatre causes — **fait**, testé (contrat `it.each`, SQL scénario 4).
6. Liste blanche stricte des champs exposés (aucun coût, marge, `breakdown`, `warnings`, identifiants internes) — **fait**, schémas Zod `.strict()` fermés sur les seuls champs du contrat.
7. `show_discounts` appliqué côté serveur, jamais publié — **fait**, filtré en SQL (pas seulement en TypeScript), testé (SQL scénario 5).
8. `X-Magrit-Tenant` refusé (pas ignoré) sur une session boutique — **fait**, testé.
9. Cumul cookie/Bearer refusé en 400 — **fait**, testé.
10. `assertScopes()`/`defineGescomRoute()` : aucune panne de branchement pour un acteur sans scope — **fait**, sortie anticipée codée et vérifiée par les tests de contrat (403 explicite, pas un 500/403 accidentel).
11. Autorisation par fonction `security definer`, aucune nouvelle policy RLS sur `commercial_quotes` — **fait**, migration relue et exécutée.
12. Session déléguée : lecture autorisée, même représentation — **fait** (aucun filtrage différencié posé, conforme au point 7 des huit décisions).
13. UI « Mes devis » au portail — **fait**, `PortalQuotes` sur `AccountHub`.
