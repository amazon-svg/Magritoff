---
story_id: Q20
epic: Sprint 5 — Gestion commerciale (E10) / chantier boutique « chaîne des prix Magrit → panier », défaut remonté point 9
title: Un devis Clariprint survit à la configuration qui aurait dû le remplacer
status: round 2 — corrections après rejet qa-review, en attente de nouvelle qa-review distincte
branch: feat/gescom-q20-devis-survit-configuration
base_round1: origin/main 03933044 (HEAD au moment de la création de branche)
agent: dev-story (Sonnet 5)
cadrage_opposable: docs/api/CONVENTIONS.md §8.25 point 9 (ligne Q20), point 12 (a) constat 3
commits: [voir git log de la branche]
---

# Story Q20 — un devis Clariprint ne survit pas à la configuration

## ROUND 2 — corrections après rejet qa-review

Le round 1 a été **rejeté**. La qa-review a rejoué les gates et les quatre
tests du round 1 : les chiffres étaient exacts, les tests vivants et rouges
pour la bonne raison — dit sans réserve dans son rapport — et le correctif de
`buildConfiguredProduct` a été confirmé **à garder tel quel**. Deux défauts
bloquants et trois points de rédaction ont motivé le rejet. Tous corrigés
dans ce round.

**DÉFAUT 1 (bloquant, corrigé)** — mon correctif du renouvellement
(`rebuildCartFromOrderItems`) ne filtrait que la **moitié** de l'objet
assemblé :

```ts
const mergedConfig = {
  ...(product.config ?? {}),                                  // NON filtré
  ...(isConfigured ? clariprintOptionsRest : snapshotWithoutQuote),  // filtré
};
```

Un `clariprintQuote` posé dans `product.config` — la **config catalogue
courante**, pas le snapshot de commande — survivait au premier spread sans
jamais passer par le filtre. Mesuré par la qa-review : produit catalogue à
40 € portant `clariprintQuote { success: true, priceHT: 35 }`, item sans
devis dans son snapshot → ligne renouvelée à 35 €, source `clariprint`, alors
que le catalogue dit 40 €. Chemin atteignable par l'API publiée :
`createShopProductCommandSchema`/`updateShopProductCommandSchema`
(`src/modules/shops/api/contracts.ts:45-48`) déclarent `config: z.record(
z.string(), z.unknown())`, sans clé interdite — un membre de l'atelier peut
poser ce champ par un simple appel. **Corrigé** : le filtre porte désormais
sur le `mergedConfig` **assemblé**, une seule fois, après les deux spreads —
aucune des deux sources ne peut plus rouvrir le chemin. Un test dédié
(`Q20 qa-review défaut 1`) isole ce second chemin (snapshot de commande SANS
devis, config catalogue AVEC un devis) et a été rejoué ROUGE sur le code du
round 1, puis VERT après correction.

**DÉFAUT 2 (bloquant, corrigé)** — le correctif du renouvellement changeait
le prix payé par l'acheteur, en silence. Mesuré par la qa-review : sur un
renouvellement **strictement identique**, l'acheteur avait payé 35 €, le
panier renouvelé affichait 40 €, étiqueté ferme (`library_cached`), **sans
aucun avertissement**. Décider « aucun devis ne survit à un renouvellement »
revient à poser la durée de validité du devis à zéro — un arbitrage de fond
réservé à Q17-b, que ce lot ne prétend pas trancher. **Corrigé** en rendant
le changement **visible**, par le canal d'avertissement du renouvellement qui
existe déjà (Q14-a, bandeau à sections) plutôt qu'en inventant un écran :
`rebuildCartFromOrderItems` compare désormais, pour chaque ligne reconstruite,
le prix réellement payé (`item.unit_price_ht`) au prix fraîchement résolu
(`resolveCartLinePricing`), et rend la liste des noms de produits dont le
prix a changé (`priceChanged`). `renewalBannerSections` gagne une **troisième
section** (`'price-changed'`), jamais fusionnée avec les deux autres — la
question n'est pas la même (« le prix est-il ferme ? » vs « le prix a-t-il
changé depuis l'achat ? »). Câblée de bout en bout :
`useStorefrontOrderLifecycle` (état `renewalPriceChanged`) →
`PublicShop.tsx` → `PortalCart.tsx` (nouvelle section, nouveau
`data-testid` `cart-renewal-price-changed-section` déclaré dans
`testIds.ts`). Un renouvellement à prix strictement identique ne produit
aucun avertissement (testé) ; un renouvellement à prix différent en produit
un, même quand la nouvelle source est ferme (testé).

**Trois points de rédaction corrigés** :

- Le motif donné round 1 pour le panier atelier
  (`ProductCard.tsx`/`CartContext.tsx`) était **faux**, même si la conclusion
  (« hors périmètre ») restait juste. `CartProduct.clariprintQuote` **est**
  un champ déclaré (`CartContext.tsx:32-35`), pas un état de hook, et
  `CartButton.tsx` en tire le prix de ligne. La vraie raison, vérifiée : `
  addToCart` de `useCart()` (`CartContext.tsx:67`) **n'a aucun appelant** dans
  `src/` — seuls `items`, `removeFromCart`, `clearCart`, `getTotalPrice` sont
  destructurés depuis `useCart()` (`CartButton.tsx:19`) — ce panier ne peut
  donc pas être rempli. Et `resetClariprintQuote()` n'est pas appelé « à
  chaque édition » : seulement au clic « Sauvegarder et fermer »
  (`ProductCardEditer.tsx:65-69`). Section « Chemins vérifiés et jugés sains »
  corrigée ci-dessous.
- Le test round 1 « cas légitime » (`buildConfiguredProduct — cas légitime`)
  n'appelait **jamais** `buildConfiguredProduct` : il restait vert quand on
  cassait le correctif — une tautologie sur `resolveCartLinePricing`, pas une
  garde. Corrigé de deux façons : (i) le test est renommé et son
  commentaire dit maintenant explicitement ce qu'il vérifie ET ce qu'il ne
  vérifie pas ; (ii) une **vraie** garde de câblage est ajoutée,
  `tests/architecture/build-configured-product-single-callsite.test.ts` —
  garde AST (même technique que `cart-line-single-constructor.test.ts`) qui
  vérifie que `buildConfiguredProduct` n'est appelé **par son nom** nulle
  part ailleurs dans `src/` que dans `confirm()` de
  `useProductConfigurator.ts`. **Limite déclarée**, mesurée par la qa-review
  et rejouée verte contre la garde : un appel par **alias d'import**
  (`{ buildConfiguredProduct as bcp }`) ou par **import de namespace**
  (`cfg.buildConfiguredProduct(...)`) lui échappe. Elle couvre la régression
  réelle — quelqu'un recâble la fonction dans la carte produit — pas
  l'évasion délibérée.
- Deux constats consignés ci-dessous pour l'architecte (demandés par la
  qa-review), non corrigés par ce lot : voir « Constats non corrigés,
  remontés à l'architecte ».

## Le défaut, tel que cadré (round 1, inchangé)

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

## Correctif recommandé par l'architecte, appliqué tel quel (round 1, confirmé gardé par la qa-review)

`buildConfiguredProduct` **supprime** `clariprintQuote` de la configuration
qu'il produit — une configuration neuve n'a pas de devis tant qu'elle n'en a
pas obtenu un. La fonction n'écrivait déjà elle-même aucun `clariprintQuote`
(son prix vit dans `price_ht`, via `resolveFinalPriceHT`), donc un
`clariprintQuote` hérité de la configuration d'origine ne pouvait de toute
façon jamais correspondre à la configuration produite.

## Autre chemin trouvé en instruisant (point 1 de la commande) — CORRIGÉ dans ce lot, durci au round 2

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
- **Round 2** : et, comme le défaut 1 l'a montré, aussi depuis `product.config`
  (la config catalogue courante), pas seulement le snapshot de commande.

Donc : un produit ajouté « tel quel » avec un `clariprintQuote` légitime (règle
d'ajout direct, `canAddAsIs`), OU un produit catalogue sur lequel un
`clariprintQuote` a été posé par API, voit ce devis — potentiellement vieux
de semaines, ou jamais valide pour ce produit — ressurgir dans le panier
reconstruit d'un renouvellement, avec la même étiquette `'clariprint'`
trompeuse. C'est un « renouvellement de commande », exactement l'un des trois
chemins que la commande demandait de vérifier.

**Corrigé (round 2)** : `clariprintQuote` est exclu du `mergedConfig`
**assemblé**, une seule fois, après fusion du snapshot de commande ET de la
config catalogue courante — ni l'une ni l'autre source ne peut plus rouvrir
le chemin. Un renouvellement retombe sur `library_cached` ou `prix_marche`
au lieu de réafficher un vieux prix Clariprint comme ferme, **et l'acheteur
en est informé** quand ce nouveau prix diffère du prix payé (voir Défaut 2).

## Chemins vérifiés et jugés SAINS (rien à corriger) — corrigé au round 2

- **`toPackLine`/`packLine`** (`cartLine.ts`) : spreadent `product.config`
  (ou le `mergedConfig` déjà assaini) tel qu'il leur arrive. Sans risque une
  fois que les deux producteurs (`buildConfiguredProduct`,
  `rebuildCartFromOrderItems`) ne laissent plus passer `clariprintQuote` par
  erreur.
- **`PortalCatalog.tsx:231`** : c'est l'**origine légitime** du
  `clariprintQuote` d'une suggestion (calculé pour SA configuration exacte).
  Ne doit pas être touché — Q20 porte sur ce qui arrive APRÈS, pas sur ce
  point de pose.
- **`ProductCard.tsx`/`CartContext.tsx`** (panier atelier, second panier
  indépendant nommé dans `cartLine.ts`) — **motif corrigé (round 2, point de
  rédaction qa-review)** : `CartProduct.clariprintQuote` **est** un champ
  déclaré (`CartContext.tsx:32-35`), et `CartButton.tsx:60/199` en tire le
  prix de la ligne et celui du devis affiché — ce n'est PAS un état de hook.
  La vraie raison de l'innocuité, vérifiée : `addToCart` de `useCart()`
  (`CartContext.tsx:67`, exposé ligne 95) **n'a aucun appelant** dans `src/` —
  seul `CartButton.tsx:19` consomme `useCart()`, et il ne destructure que
  `items, removeFromCart, clearCart, getTotalPrice`, jamais `addToCart` — ce
  panier ne peut donc pas être rempli aujourd'hui, sa surface est morte.
  `resetClariprintQuote()` n'est par ailleurs pas appelé « à chaque édition »
  mais seulement au clic « Sauvegarder et fermer »
  (`ProductCardEditer.tsx:65-69`) — précision sans incidence sur la
  conclusion (le panier reste inatteignable), mais l'affirmation d'origine
  était fausse et est corrigée ici.
- **`projects-service.ts:178`** (import HopeStudio,
  `clariprintQuote: { priceHT: amount }`) : dette déjà nommée et distincte
  (§8.25 point 3.7 (7), rattachée à Q15), pas le chemin de Q20.
- **`serializeQuotePayload.ts`/`quote-rendering.ts`** : lecture seule pour
  affichage/sérialisation de devis déjà envoyés, aucune écriture, aucun
  risque de survie à une reconfiguration.

## Cas légitime préservé (point 2 de la commande) — précision round 2

Le chemin d'ajout direct au panier (`canAddAsIs`,
`src/modules/catalog/ui/storefront/addAsIs.ts`, arbitrage Arnaud du 16/09)
**n'appelle jamais** `buildConfiguredProduct` : un produit ajouté « tel
quel » ne passe pas par le configurateur, donc son `clariprintQuote`
(légitimement posé pour SA configuration réelle au moment de l'ajout) n'est
jamais rogné par ce correctif. Aucune tension trouvée entre les deux
exigences — le fix touche uniquement le chemin de reconfiguration et le
chemin de renouvellement, jamais l'ajout direct.

**Round 2 — précision sur la preuve.** Le test round 1 qui prétendait
vérifier cela n'appelait pas `buildConfiguredProduct` et restait vert même
correctif cassé (tautologie sur `resolveCartLinePricing`, signalé par la
qa-review). La **vraie** garantie est désormais structurelle :
`tests/architecture/build-configured-product-single-callsite.test.ts`
vérifie par AST TypeScript que le seul appel de `buildConfiguredProduct`
dans tout `src/` est celui, déjà existant, dans `confirm()` de
`useProductConfigurator.ts` — donc jamais depuis le chemin d'ajout direct.
Le test round 1 est conservé, reformulé, comme documentation du comportement
de `resolveCartLinePricing` sur ce cas — pas comme preuve de câblage.

## Constats non corrigés, remontés à l'architecte (demandés par la qa-review round 1)

Ces deux constats ne sont **pas** corrigés par ce lot — ils dépassent le
périmètre de Q20 tel que cadré, et sont consignés ici pour que l'architecte
en décide le rattachement (nouveau lot, ou extension d'un lot existant) :

**(a) Le renouvellement d'un produit CONFIGURÉ était déjà silencieusement
faux avant ce lot, indépendamment de Q20.** Exemple concret : un acheteur
configure un produit à 2 000 exemplaires, paie 250 € (prix Clariprint
obtenu pour CETTE configuration), puis renouvelle la commande. La
configuration snapshotée (`clariprint_options`, quantité comprise) est
préservée telle quelle par `rebuildCartFromOrderItems` (BCP-11), mais le
prix repart de `product.price_ht` catalogue (40 €, un prix pour une
quantité de référence différente), sans que `resolvePrice` ait aucun moyen
de savoir que 40 € ne veut rien dire pour un forfait de 2 000 exemplaires.
Aucun avertissement de ce type précis n'est émis (le nouveau canal
`priceChanged` de ce lot compare des MONTANTS, pas des configurations — il
détecterait bien que 40 ≠ 250 et avertirait, mais la phrase du bandeau
« prix différent de celui payé » ne dit pas à l'acheteur que la
configuration change de base de calcul). Ce défaut existait avant Q20 et
lui est indépendant — il n'est pas corrigé ici.

**(b) Le passif reste entier.** `tenant_order_items.clariprint_options` est
toujours persisté **sans filtrage** par la base (`coalesce(item->
'clariprint_options', '{}'::jsonb)`), et `submitCart` y envoie toujours
`line.product.config` en entier. Les commandes **déjà enregistrées** avant
ce lot gardent leur `clariprintQuote` en base, sans qu'aucune migration ne
les assainisse. Ce lot empêche le `clariprintQuote` déjà stocké de
**ressurgir dans un panier reconstruit** (le symptôme visible), mais ne
retire rien de la base ni du chemin d'écriture (`submitCart`) qui continue
d'y écrire la configuration entière à chaque nouvelle commande. Une future
requête directe sur `tenant_order_items`, ou tout autre code qui lirait ce
JSONB sans passer par `rebuildCartFromOrderItems`, verrait toujours le
`clariprintQuote` stocké.

## Fichiers modifiés

**Round 1 :**
- `src/modules/clariprint/ui/hooks/useProductConfigurator.ts` —
  `buildConfiguredProduct` exclut `clariprintQuote` de `product.config` avant
  de construire la nouvelle `config`.
- `src/modules/orders/ui/storefront/orderRenewal.helpers.ts` —
  `rebuildCartFromOrderItems` exclut `clariprintQuote` du snapshot
  `clariprint_options` fusionné (chemin trouvé en instruisant, ci-dessus).

**Round 2 (nouveau ou étendu) :**
- `src/modules/orders/ui/storefront/orderRenewal.helpers.ts` — DÉFAUT 1 :
  le filtre porte sur `mergedConfig` assemblé (une fois, après les deux
  spreads), plus DÉFAUT 2 : nouveau champ `priceChanged: string[]` sur
  `RebuildResult`, calculé par comparaison `item.unit_price_ht` vs
  `resolveCartLinePricing(line).unitPriceHt` (tolérance 0.005), et
  `renewalBannerSections` gagne un troisième paramètre/section
  `'price-changed'`.
- `src/modules/orders/ui/hooks/useStorefrontOrderLifecycle.ts` — nouvel état
  `renewalPriceChanged`, réinitialisé aux mêmes points que
  `renewalPriceNotFirm` (changement de `slug`, `submitCart` réussi,
  `dismissRenewalWarnings`), exposé dans la valeur de retour du hook.
  Commentaire faux corrigé (« `unit_price_ht` n'est pas utilisé » → il l'est
  désormais).
- `src/modules/orders/ui/storefront/PortalCart.tsx` — prop
  `renewalPriceChanged`, passée à `renewalBannerSections`, troisième branche
  du `data-testid` de section.
- `src/modules/shops/ui/storefront/PublicShop.tsx` — destructure et passe
  `renewalPriceChanged` au `PortalCart`.
- `src/shared/presentation/testIds.ts` — nouvelle clé
  `cartRenewalPriceChangedSection: 'cart-renewal-price-changed-section'`.

## Fichiers de test modifiés/créés

**Round 1 :**
- `tests/hooks/useProductConfigurator.test.ts` — tests Q20 sur
  `buildConfiguredProduct` (non-régression + reproduction du parcours
  complet).
- `tests/components/shop/portal/orderRenewal.helpers.test.ts` — tests Q20
  sur le renouvellement (produit configuré / non configuré).

**Round 2 (nouveau ou étendu) :**
- `tests/architecture/build-configured-product-single-callsite.test.ts`
  (nouveau) — garde AST : `buildConfiguredProduct` n'est appelé que dans
  `useProductConfigurator.ts`.
- `tests/hooks/useProductConfigurator.test.ts` — le test « cas légitime »
  est renommé et son commentaire dit maintenant explicitement qu'il ne
  vérifie PAS le câblage (corrigé du point de rédaction qa-review).
- `tests/components/shop/portal/orderRenewal.helpers.test.ts` — quatre
  tests ajoutés : DÉFAUT 1 (clariprintQuote posé sur la config catalogue,
  pas le snapshot de commande) ; DÉFAUT 2 × 2 (prix identique → aucun
  avertissement ; prix différent → avertissement même si ferme, plus la
  vérification de la section `renewalBannerSections`) ; `unit_price_ht`
  null → aucune comparaison possible, aucun avertissement. Les deux tests
  Q20 round 1 sont complétés d'une assertion sur `r.priceChanged`. **Les
  six assertions nouvelles/modifiées ont été rejouées sur le code du round 1
  (stash temporaire de `orderRenewal.helpers.ts` seul, protocole worktree
  respecté : tag unique, sha capturé, `apply` puis `drop`) : les 6
  échouent**, confirmant que la reproduction des deux défauts est réelle.
- `tests/components/shop/ShopProductCard.addAsIsWiring.test.ts` — deux
  assertions Q14-a préexistantes mises à jour pour la forme à trois branches
  (appel à `renewalBannerSections`, ternaire du `data-testid` de section) ;
  trois assertions ajoutées pour le troisième canal (`renewalPriceChanged`) :
  transmission réelle par `PublicShop`, remise à zéro aux trois mêmes sites
  que les deux autres canaux, `setRenewalPriceChanged(priceChanged)` appelé
  sans recopie locale.

## Gates rejouées (résultats réels, commandes lancées dans ce lot, round 2)

- `pnpm typecheck` → vert, aucune sortie d'erreur (`tsc --noEmit -p
  tsconfig.modular.json`).
- `pnpm test:architecture` → 50 fichiers, 462 tests, tous verts (49→50
  fichiers, +1 : la nouvelle garde AST
  `build-configured-product-single-callsite.test.ts`).
- `pnpm test` (suite complète) → 325 fichiers passés, 12 skip ; 3361 tests
  passés, 88 skip (skips connus, non liés à ce lot).
- `pnpm test:contract` → 23 fichiers, 434 tests, tous verts.

**Effet de bord détecté et corrigé pendant ce round** : étendre
`renewalBannerSections`/`PortalCart.tsx` à une troisième section a cassé
deux assertions texte préexistantes dans
`tests/components/shop/ShopProductCard.addAsIsWiring.test.ts` (Q14-a round 2/3,
gardes de câblage textuelles sur la forme exacte de l'appel à
`renewalBannerSections` et du ternaire à deux branches du `data-testid` de
section) — attendu, puisque ce lot change réellement cette forme. Les deux
assertions ont été mises à jour pour la forme à trois branches, et trois
assertions supplémentaires ajoutées (transmission de `renewalPriceChanged`
par `PublicShop`, remise à zéro aux trois mêmes sites, appel de
`setRenewalPriceChanged(priceChanged)` sans recopie locale) pour que la garde
reste aussi stricte sur le troisième canal qu'elle l'était sur les deux
premiers. Rejoué : 13/13 verts sur ce fichier après correction.

Aucun appel Clariprint réel déclenché par ce lot : tous les tests ajoutés
sont des tests de fonctions pures ou des assertions texte sur les sources,
aucun gateway réseau n'est sollicité.

## Critères d'acceptation

1. Le défaut nommé par le cadrage (Q20) est corrigé à l'endroit recommandé
   par l'architecte (`buildConfiguredProduct`) — **fait**, confirmé gardé
   par la qa-review round 1.
2. Recherche active d'autres chemins de survie d'un `clariprintQuote` —
   **fait** : un second chemin réel trouvé (renouvellement) et corrigé,
   **puis durci** (round 2) après que la qa-review a montré qu'il restait
   entrouvert par l'autre moitié du merge ; quatre autres chemins vérifiés
   et jugés sains, documentés ci-dessus (motif du panier atelier corrigé au
   round 2).
3. Cas légitime (`canAddAsIs`) non cassé — **fait**, garanti par une **vraie**
   garde de câblage AST (round 2), pas seulement par une assertion sur
   `resolveCartLinePricing`.
4. Aucun appel Clariprint ajouté — **fait**, tests unitaires purs uniquement.
5. Test reproduisant le parcours complet, rouge sur le code d'avant chaque
   correctif, vert après — **fait**, pour les trois défauts corrigés
   (configuration, renouvellement défaut 1, renouvellement défaut 2).
6. Aucun prix changé en silence — **fait (round 2)** : tout changement de
   prix au renouvellement est désormais signalé par le bandeau existant.
7. Gates rejouées et rapportées avec des chiffres lus dans la sortie réelle
   des commandes — **fait** (voir section ci-dessus et rapport final).
