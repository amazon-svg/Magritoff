---
story_id: Q20
epic: Sprint 5 — Gestion commerciale (E10) / chantier boutique « chaîne des prix Magrit → panier », défaut remonté point 9
title: Un devis Clariprint survit à la configuration qui aurait dû le remplacer
status: round 1 — en attente de qa-review distincte
branch: feat/gescom-q20-devis-survit-configuration
base: origin/main 03933044 (HEAD au moment de la création de branche)
agent: dev-story (Sonnet 5)
cadrage_opposable: docs/api/CONVENTIONS.md §8.25 point 9 (ligne Q20), point 12 (a) constat 3
commits: [voir git log de la branche]
---

# Story Q20 — un devis Clariprint ne survit pas à la configuration

## Le défaut, tel que cadré

`buildConfiguredProduct` (`src/modules/clariprint/ui/hooks/useProductConfigurator.ts`)
recopiait `product.config` **en entier** (`{ ...(product.config as Record<string,
unknown>), clariprintData: ... }`), `clariprintQuote` compris. Or
`PortalCatalog.tsx:231` pose un `clariprintQuote` sur chaque suggestion faite
par Magrit (prix Clariprint réel obtenu pour la configuration proposée), et le
bouton « Configurer » de cette grille (`:844-847`) passe ce produit à
`useProductConfigurator`. Résultat : l'acheteur configure, change la quantité
et le papier, et `resolveCartLinePricing`
(`src/modules/orders/ui/storefront/cartPricing.ts`) retrouve l'ancien
`clariprintQuote` dans `config`, lui donne priorité sur le `price_ht`
fraîchement recalculé, et `resolvePrice` étiquette ce prix périmé
`'clariprint'` — la source la plus forte de la hiérarchie. Le panier compte le
prix d'avant la configuration, affiché comme si c'était le prix ferme
d'aujourd'hui.

## Correctif recommandé par l'architecte, appliqué tel quel

`buildConfiguredProduct` **supprime** `clariprintQuote` de la configuration
qu'il produit — une configuration neuve n'a pas de devis tant qu'elle n'en a
pas obtenu un. La fonction n'écrivait déjà elle-même aucun `clariprintQuote`
(son prix vit dans `price_ht`, via `resolveFinalPriceHT`), donc un
`clariprintQuote` hérité de la configuration d'origine ne pouvait de toute
façon jamais correspondre à la configuration produite.

## Autre chemin trouvé en instruisant (point 1 de la commande) — CORRIGÉ dans ce lot

Le cadrage ne nomme qu'un seul chemin. En le vérifiant dans le dépôt, un
second chemin réel a été trouvé et corrigé, dans le même esprit :

**Renouvellement de commande** (`rebuildCartFromOrderItems`,
`src/modules/orders/ui/storefront/orderRenewal.helpers.ts`). Vérifié
fichier par fichier :
- `submitCart` (`useStorefrontOrderLifecycle.ts:208`) envoie
  `clariprintOptions: line.product.config` — **la configuration entière**,
  pas un sous-ensemble — comme `clariprintOptions` de la commande.
- `createOrderItemSchema` (`src/modules/orders/api/contracts.ts:82`) accepte
  ce champ en `z.record(z.string(), z.json()).nullable()` : aucun filtrage,
  aucun champ dénommé.
- `api_create_storefront_order` et `api_update_order_draft_for_identity`
  (`supabase/migrations/20260817000100_storefront_order_identity.sql:142`,
  `20260919000100_gescom_q17a_storefront_order_price_revaluation.sql:474/624`)
  persistent `coalesce(item->'clariprint_options', '{}'::jsonb)` **tel quel**
  dans `tenant_order_items.clariprint_options` — pas de filtrage SQL non plus.
- `rebuildCartFromOrderItems` relit ce snapshot et le **fusionne** dans le
  `config` du produit reconstruit (`mergedConfig`), à l'exclusion, avant ce
  lot, de la seule clé `quantity`.

Donc : un produit ajouté « tel quel » avec un `clariprintQuote` légitime (règle
d'ajout direct, `canAddAsIs`) voit ce devis — potentiellement vieux de
semaines — ressurgir dans le panier reconstruit d'un renouvellement, avec la
même étiquette `'clariprint'` trompeuse. C'est un « renouvellement de
commande », exactement l'un des trois chemins que la commande demandait de
vérifier.

**Corrigé** : `clariprintQuote` est désormais exclu du snapshot fusionné,
dans les deux branches (produit configuré et produit non configuré), par le
même principe que l'exclusion déjà en place pour `quantity`. Un
renouvellement retombe sur `library_cached` ou `prix_marche` au lieu de
réafficher un vieux prix Clariprint comme ferme.

## Chemins vérifiés et jugés SAINS (rien à corriger)

- **`toPackLine`/`packLine`** (`cartLine.ts`) : spreadent `product.config`
  tel qu'il leur arrive. Sans risque une fois que les deux producteurs
  ci-dessus (`buildConfiguredProduct`, `rebuildCartFromOrderItems`) ne
  laissent plus passer `clariprintQuote` par erreur.
- **`PortalCatalog.tsx:231`** : c'est l'**origine légitime** du
  `clariprintQuote` d'une suggestion (calculé pour SA configuration exacte).
  Ne doit pas être touché — Q20 porte sur ce qui arrive APRÈS, pas sur ce
  point de pose.
- **`ProductCard.tsx`/`CartContext.tsx`** (panier atelier, second panier
  indépendant nommé dans `cartLine.ts`) : mécanisme différent — `
  clariprintQuote` y est un état de hook (`useClariprintProduct`), pas un
  champ persistant dans `config`, et `resetClariprintQuote` l'invalide déjà
  explicitement à chaque édition (`ProductCardEditer.tsx:67`). Vérifié, hors
  périmètre de ce défaut, structurellement immunisé.
- **`projects-service.ts:178`** (import HopeStudio,
  `clariprintQuote: { priceHT: amount }`) : dette déjà nommée et distincte
  (§8.25 point 3.7 (7), rattachée à Q15), pas le chemin de Q20.
- **`serializeQuotePayload.ts`/`quote-rendering.ts`** : lecture seule pour
  affichage/sérialisation de devis déjà envoyés, aucune écriture, aucun
  risque de survie à une reconfiguration.

## Cas légitime préservé (point 2 de la commande)

Le chemin d'ajout direct au panier (`canAddAsIs`,
`src/modules/catalog/ui/storefront/addAsIs.ts`, arbitrage Arnaud du 16/09)
**n'appelle jamais** `buildConfiguredProduct` : un produit ajouté « tel
quel » ne passe pas par le configurateur, donc son `clariprintQuote`
(légitimement posé pour SA configuration réelle au moment de l'ajout) n'est
jamais rogné par ce correctif. Testé explicitement (voir Tests). Aucune
tension trouvée entre les deux exigences — le fix touche uniquement le
chemin de reconfiguration et le chemin de renouvellement, jamais l'ajout
direct.

## Fichiers modifiés

- `src/modules/clariprint/ui/hooks/useProductConfigurator.ts` —
  `buildConfiguredProduct` exclut `clariprintQuote` de `product.config` avant
  de construire la nouvelle `config`.
- `src/modules/orders/ui/storefront/orderRenewal.helpers.ts` —
  `rebuildCartFromOrderItems` exclut `clariprintQuote` du snapshot
  `clariprint_options` fusionné (chemin trouvé en instruisant, ci-dessus).

## Fichiers de test modifiés

- `tests/hooks/useProductConfigurator.test.ts` — deux tests Q20 ajoutés :
  (1) `buildConfiguredProduct` ne recopie plus `clariprintQuote` ; (2)
  reproduction du parcours complet suggestion → configuration (quantité ET
  papier changés) → panier, vérifiant `unitPriceHt` et `source` — **rejoué
  sur le code d'avant le correctif (stash temporaire des deux fichiers
  source, protocole worktree respecté) : les deux tests échouent bien**,
  confirmant que la reproduction est réelle et non un test qui passerait de
  toute façon. Un troisième test protège le cas légitime (produit ajouté tel
  quel, jamais passé par `buildConfiguredProduct`, garde son devis et sa
  source `'clariprint'`).
- `tests/components/shop/portal/orderRenewal.helpers.test.ts` — deux tests
  Q20 ajoutés pour le chemin de renouvellement (produit configuré et produit
  non configuré), également rejoués et vérifiés ROUGE sur le code d'avant le
  correctif.

## Gates rejouées (résultats réels, commandes lancées dans ce lot)

- `pnpm typecheck` → vert, aucune sortie d'erreur (`tsc --noEmit -p
  tsconfig.modular.json`).
- `pnpm test:architecture` → 49 fichiers, 461 tests, tous verts.
- `pnpm test` (suite complète) → 324 fichiers passés, 12 skip ; 3356 tests
  passés, 88 skip (skips connus, non liés à ce lot — dont le test de
  stockage qui attaque la prod hors worktree principal).
- `pnpm test:contract` → 23 fichiers, 434 tests, tous verts.

Aucun appel Clariprint réel déclenché par ce lot : tous les tests ajoutés
sont des tests de fonctions pures sur des objets `ClariprintQuoteResult`
forgés, aucun gateway réseau n'est sollicité.

## Critères d'acceptation

1. Le défaut nommé par le cadrage (Q20) est corrigé à l'endroit recommandé
   par l'architecte (`buildConfiguredProduct`) — **fait**.
2. Recherche active d'autres chemins de survie d'un `clariprintQuote` —
   **fait** : un second chemin réel trouvé (renouvellement) et corrigé ;
   quatre autres chemins vérifiés et jugés sains, documentés ci-dessus.
3. Cas légitime (`canAddAsIs`) non cassé — **fait**, vérifié par un test
   dédié : ce chemin n'appelle jamais la fonction corrigée.
4. Aucun appel Clariprint ajouté — **fait**, tests unitaires purs uniquement.
5. Test reproduisant le parcours complet, rouge sur `origin/main`, vert après
   correctif — **fait**, pour les deux chemins corrigés (configuration et
   renouvellement).
6. Gates rejouées et rapportées avec des chiffres lus dans la sortie réelle
   des commandes — **fait** (voir section ci-dessus).
