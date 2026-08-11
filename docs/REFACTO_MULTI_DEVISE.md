# Refacto multi-devise — décision et plan

> **Décision Arnaud Mazon, 2026-08-10.** Chaque imprimeur doit pouvoir travailler dans **sa** devise. Sans cela la solution ne peut pas voyager : pas de client en dollars, pas de déploiement hors zone euro. Ce n'est pas une option de confort, c'est une condition d'internationalisation.
>
> Cohérent avec l'arbitrage RP#070826 §6.1 : « chaque imprimeur dispose de sa devise et de son système d'unités de saisie ».
> Aligné sur le type `Money` du noyau Expert Solutions (`{ minorUnits: bigint, currency }`).

**Statut d'avancement**

| Tranche | État | Livré le | Branche |
|---|---|---|---|
| ① La devise existe et s'affiche | ✅ **Livrée** | 2026-08-10 | `feat/multi-devise-t1` |
| ② Les coûts de production passent en `Money` | ⬜ à faire | — | — |
| ③ Le chemin de prix de vente | ⬜ à faire | — | — |
| ④ Documents et export | ⬜ à faire | — | — |

---

## 1. État des lieux — mesuré dans le code, pas estimé

*(relevé initial du 2026-08-10, avant tranche 1)*

| Constat | Mesure |
|---|---|
| Euro câblé en dur (`'EUR'`, `€`, `toFixed(2)`) | **103 occurrences** dans `src/` |
| Fichiers concernés | ~40, dont `priceResolver.ts`, `quote.ts`, `clariprintQuote.ts`, `gammeFloorPrices.ts`, `shopExport.ts`, `schemaOrg.ts` et les écrans de vente |
| Devise en base | **une seule colonne** : `orders.currency char(3) default 'EUR'` — les tenants, produits, prix et coûts n'en ont pas |
| Formatage | **deux helpers concurrents** : `formatPrice()` (priceResolver) et `formatEuro()` (ProductOverlay.helpers, 8 fichiers) — ce dernier force `currency: "EUR"`. **Plus deux copies locales** de `formatEuro` non recensées au relevé initial (`OrderHistoryTable.tsx`, `PortalThankYou.tsx`), soit **quatre** implémentations de formatage au total |
| Montants | tous en `number` flottant : prix, taux horaires, coûts plaque, coût au clic, encre au m², marges et remises |

**Lecture** : la dette est réelle mais **circonscrite**. Il n'y a pas de logique de change à démonter — il n'y en a jamais eu. Le travail est de faire remonter la devise depuis l'imprimeur, et de cesser de la supposer.

## 2. Invariants cibles

1. **La devise appartient à l'imprimeur** (tenant), pas au produit, pas à l'écran, pas au composant. Un devis, une boutique, un catalogue héritent de la devise de leur imprimeur.
2. **Un montant = entier en unités mineures + code devise.** Jamais de flottant sur une somme d'argent. Aligné sur le `Money` du noyau.
3. **Un seul helper de formatage**, la devise en paramètre obligatoire. `formatEuro()` disparaît.
4. **Pas de conversion de taux de change en V1.** Un devis est mono-devise. Le multi-devise dans un même document, et donc les taux, sont hors périmètre — à ouvrir seulement si un client le demande.
5. **Les pourcentages ne sont pas des montants.** Marge et remise restent des ratios ; seuls les montants résultants sont des `Money`.
6. **Une règle d'arrondi unique et documentée.** Deux règles d'arrondi produisent deux prix, donc deux devis : c'est une décision commerciale, pas technique.

## 3. Plan par tranches verticales

Ordre choisi pour que chaque tranche soit livrable seule, sans geler la production (**R5** — souplesse encadrée sur l'existant).

### Tranche 1 — La devise existe et s'affiche *(prérequis de tout le reste)* ✅ LIVRÉE

- Colonne `currency char(3) not null default 'EUR'` sur `tenants` ; exposée par le contexte tenant côté front.
- **Un helper unique** `formatMoney(amount, currency, locale)` ; `formatEuro()` supprimé et ses 8 appelants migrés.
- Purge des `€` et `EUR` littéraux des écrans : la devise vient du tenant.
- Effet immédiat : un imprimeur en dollars voit des dollars partout. Les montants restent en `number` à ce stade — c'est assumé.

**Ce qui a été livré, et ce qui s'est ajouté en cours de route** — voir le story document
[`_bmad-output/implementation-artifacts/story-DEVISE-T1-la-devise-existe.md`](../_bmad-output/implementation-artifacts/story-DEVISE-T1-la-devise-existe.md).

Trois points non prévus au plan initial :

1. **Deux copies locales de `formatEuro`** existaient en plus de celle recensée (`OrderHistoryTable.tsx`, `PortalThankYou.tsx`). Supprimées aussi : il ne reste **qu'un** helper de formatage dans le projet.
2. **La boutique publique** a demandé un chemin dédié. La RLS `tenants_select` interdit à un visiteur anonyme de lire `tenants` : sans traitement, la vitrine d'un imprimeur en dollars aurait affiché des euros — soit précisément ce que la tranche devait supprimer. Résolu par une fonction `SECURITY DEFINER` `shop_currency(slug)` qui n'expose que le code ISO 4217, et un `CurrencyProvider` qui l'injecte dans l'arbre boutique.
3. **`tenants.currency` est éditable** depuis Paramètres de l'espace (owner/admin). Sans écran de saisie, la colonne n'aurait servi à rien : personne n'aurait pu passer en dollars.

### Tranche 2 — Les coûts de production passent en `Money`

- Périmètre : Parc machine et modèle de coût (taux horaires, plaque, clic, encre au m², forme, consommables).
- C'est la tranche **la moins risquée** : le Parc machine ne touche pas la base (persistance locale de maquette), donc aucune migration de schéma à défaire.
- Conversion en entrée de service applicatif ; aucun `number` monétaire ne franchit une frontière de module.
- **Point d'entrée déjà posé par la tranche 1** : les unités du parc machine (`€/h`, `€/kg`, `€/kWh`, `€/job`) passent par `formatCurrencyPerUnit()`. Seul l'affichage suit la devise aujourd'hui ; les valeurs restent des `number`.

### Tranche 3 — Le chemin de prix de vente

- `resolvePrice()` et sa hiérarchie `clariprint > library_cached > prix_marche > zero` rendent un `Money`.
- Règles de Gestion commerciale : marge et remise restent des ratios, appliqués à un `Money` avec la règle d'arrondi retenue.
- Adaptateur Clariprint : la devise devient explicite dans le contrat d'échange.
- **Point d'entrée déjà posé** : `formatPrice(resolution, currency)` prend la devise en paramètre obligatoire.

### Tranche 4 — Documents et export

- Devis, panier, commandes, export boutique, `schema.org` : devise portée par le document, plus jamais déduite.
- `orders.currency` existe déjà — à raccorder au lieu d'être ignorée.
- **Point d'entrée déjà posé** : `renderQuoteHtml({ currency })`, `exportShopToJson(..., currency)`, `productSchema(..., currency)`, `buildGammeJsonLd({ currency })` acceptent tous la devise, et `tenant_orders.currency` est alimentée depuis la boutique au lieu d'être écrite en dur.

## 4. Ce qui reste à trancher avec Expert Solutions

| # | Question | Pourquoi ça compte | État |
|---|---|---|---|
| 1 | **Règle d'arrondi** — par ligne ou sur le total ? | Conséquence commerciale directe : deux règles = deux prix pour le même devis | ⬜ ouverte — bloquante pour la tranche 3 |
| 2 | Statut des pourcentages — ratio `number` ou type dédié | Décision de modèle ; notre proposition : ratio | ⬜ ouverte (tranche 1 a tenu le ratio : marge et remise restent sans devise) |
| 3 | Rythme d'adoption du `Money` du noyau | Nous proposons tranche par tranche, pas de bascule globale | ⬜ ouverte |
| 4 | Nombre de décimales par devise | Toutes les devises n'ont pas 2 décimales (JPY : 0) — le `bigint` en unités mineures le gère, l'affichage doit suivre | ✅ **traitée côté affichage** en tranche 1 (`getCurrencyDecimals`, JPY = 0) ; reste à confirmer côté modèle |

## 5. Le prix marché par zone monétaire — arbitrage du 2026-08-10

> **Décision Arnaud, 2026-08-10** (en réponse au point de vigilance n° 1) :
>
> « Le prix marché sera exprimé en \$ pour les imprimeurs dont la devise sera le \$ et en €
> pour ceux dont elle l'est en €. […] Il verra un prix marché relevant d'imprimeurs ayant la
> **même monnaie que lui**. Autrement dit, nous livrerons des prix marchés **par zone
> monétaire**, et nous **réserverons le droit** de rendre un prix marché d'une monnaie X
> accessible dans une zone Y. Par exemple les pays en € pourront sans doute accéder au prix
> marché de la zone \$. »

Ce n'est pas un aménagement d'affichage : c'est un changement de nature du prix marché.
Il cesse d'être une valeur unique relibellée pour devenir **un jeu de valeurs par zone**.

**Implémenté** dans [`src/app/utils/marketPriceZones.ts`](../src/app/utils/marketPriceZones.ts) :

| Zone | Statut | Sert un prix ? |
|---|---|---|
| **EUR** | `heuristique` — les valeurs historiques (décision 2026-05-09), déplacées sans être retouchées | ✅ oui |
| **USD** | `a_calibrer` — la cible est actée, les prix d'imprimeurs en dollars ne sont pas collectés | ❌ non |
| GBP, CHF, CAD, MAD, JPY | pas de zone | ❌ non |

Trois conséquences structurantes :

1. **Jamais de conversion.** Convertir supposerait un taux de change — hors périmètre
   (invariant #4). Un prix marché est calibré dans sa devise ou n'existe pas.
2. **Pas de zone = pas de prix marché.** La cascade tombe sur `zero` et l'écran affiche
   « Prix sur demande ». C'est volontaire : un manque visible est traitable, un prix faux
   ne l'est pas. C'est précisément le défaut que l'arbitrage corrige.
3. **L'ouverture inter-zones est un droit réservé, pas un comportement actif.** Le champ
   `foreignZoneAccess` existe et est évalué en un seul endroit ; il est vide partout.
   Ouvrir la zone \$ aux imprimeurs en € sera une décision commerciale, zone par zone.

**Ce que la séparation a mis au clair** : la *forme* de l'heuristique (dégressivité par
volume, majoration grammage, verso, pelliculage) est une structure de **coût de
production** — elle ne dépend pas de la devise et reste commune à toutes les zones. Seuls
les **niveaux de prix** sont propres à une zone. Le code respecte maintenant cette
frontière : `resolveMarketPriceFamily()` reconnaît la famille, la zone fournit le niveau.

🔴 **Action de collecte, pas de code** : la zone USD ne servira rien tant qu'un relevé de
prix d'imprimeurs en dollars n'aura pas été produit. Renseigner `basePerUnit` et passer
`status` à `'panel'` suffit alors à l'activer — aucune autre modification n'est nécessaire.

## 6. Points de vigilance

- ~~**Les prix de marché par défaut** sont calibrés en euros~~ → **traité** par l'arbitrage
  du 2026-08-10 (§5). Reste la collecte des données de la zone USD.
- **Les grilles papier et transport** sont négociées dans une devise donnée : la devise doit être portée par la grille, pas par le tenant qui l'importe. **Non traité en tranche 1.**
- **La bibliothèque machines** porte des coûts par défaut indicatifs en euros — même réserve. **Non traité en tranche 1** (`DEFAULT_LABOR_RATE`, `DEFAULT_ENERGY_RATE` restent des valeurs euro affichées avec le symbole du tenant). À reprendre en tranche 2, qui porte précisément sur le modèle de coût.
- **L'abonnement Magrit lui-même** (`DashboardPlan`, 29 €/mois) reste volontairement en euros : c'est le prix facturé par AGE Dvt. à l'imprimeur, pas la devise dans laquelle l'imprimeur travaille avec ses clients. Documenté dans le code.
