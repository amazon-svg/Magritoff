---
id: E10.10b-1
epic: E10 — Gestion commerciale
status: done
branch: feat/gescom-e10-4-entite-client
depends_on: [E10.3, E10.5, E10.9, E10.10a]
blocks: [E10.10b-2, E10.10b-3, E10.10b-4]
---
# E10.10b-1 — Lecture des devis dans le portail client

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
| Socle — troisième principal | `ShopCustomerPrincipal` (`kind: 'shop_customer'`, `accountId`/`shopId`/`tenantId`/`customerId`/`sessionKind`/`sessionToken`) ajouté à `ApiPrincipal`. Résolu depuis le cookie `__Host-magrit-storefront`/`magrit-storefront` (réutilise `readStorefrontSessionCookie`, aucune réimplémentation). Cumul cookie+bearer / cookie+clé de service refusé en 400 `identity.actor_kind_required`, `X-Magrit-Tenant` sur ce mode refusé en 400 `api.tenant_not_addressable`. |
| `assertScopes()`/`defineGescomRoute()` | Sortie anticipée pour `shop_customer` (pas de scope ni capability), et refus à la définition d'une route de ce mode qui déclarerait `requiredScopes`. |
| `GET /storefront-quotes` | `listStorefrontQuotes` — devis `sent`/`accepted`/`rejected`/`converted` du client rattaché au compte (jamais `draft`), pagination par curseur, filtre `status` optionnel (valeur hors énumération → liste vide, pas une erreur). Compte sans interlocuteur (`customer_contact_id` NULL, E10.5 CA3) → 200 + liste vide, jamais 403. |
| `GET /storefront-quotes/{quoteId}` | `getStorefrontQuote` — détail + lignes, `ETag` publié (pour b-2). 404 `quote.not_found` **indiscernable** sur les quatre causes (identifiant inconnu, devis d'un autre client, d'un autre tenant, encore `draft`). |
| Migration `20260906170000` | Quatre fonctions `security definer`/privée : `api_resolve_shop_customer_principal` (enrichit `api_resolve_shop_customer_session`, **non modifiée**, de `tenant_id`/`customer_id`), `private.commercial_quote_totals` (arithmétique `QuoteTotals`, jamais grantée), `api_list_storefront_quotes`, `api_get_storefront_quote`. Aucune nouvelle policy RLS sur `commercial_quotes`/`commercial_quote_lines` — toute l'autorisation vit dans ces fonctions. |
| `show_discounts` | Filtré **en SQL**, dans la requête elle-même (`case when show_discounts then ... else null end`), jamais en TypeScript : ces fonctions sont `grant execute to anon`, donc joignables hors façade — un filtrage TS seul aurait laissé fuir la remise à un appel RPC direct. |
| Module `src/modules/storefront-quotes/` | `api/contracts.ts` (Zod, liste blanche stricte, aucun champ hors `StorefrontQuote*`), `application/` (service + interface repository), `adapters/supabase/storefront-quotes-repository.ts`, `server/api/storefront-quotes-routes.ts`, enregistré dans `gescom-routes.ts`. |
| UI | Onglet « Mes devis » sur `AccountHub` (`PortalQuotes`, lecture seule : liste + détail dépliable inline, lignes, totaux, TVA). Module enregistré dans le registre de surfaces (`manifest.ts`/`surface-contributions.ts`, route `customer-portal` `account/quotes`) pour que `portalRuntimePaths.accountQuotes` résolve. `AccountSection` gagne `'quotes'`. |
| Tests | `tests/contract/storefront-quotes.contract.test.ts` (15 cas : 200/401/403/400 cumul/400 tenant/404×3 causes/filtre status permissif/ETag). `tests/sql/gescom-e10-10b-1-storefront-quotes.sql` (9 scénarios : visibilité par statut, CA7 liste vide, filtre `draft`, isolation inter-client même tenant, isolation inter-tenant, `show_discounts` filtré, remise globale, session invalide, `private.commercial_quote_totals` non exécutable par `anon`/`authenticated`) — **exécuté réellement** (Docker local disponible sur ce poste). |

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
