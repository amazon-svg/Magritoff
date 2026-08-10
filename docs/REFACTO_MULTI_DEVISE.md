# Refacto multi-devise — décision et plan

> **Décision Arnaud Mazon, 2026-08-10.** Chaque imprimeur doit pouvoir travailler dans **sa** devise. Sans cela la solution ne peut pas voyager : pas de client en dollars, pas de déploiement hors zone euro. Ce n'est pas une option de confort, c'est une condition d'internationalisation.
>
> Cohérent avec l'arbitrage RP#070826 §6.1 : « chaque imprimeur dispose de sa devise et de son système d'unités de saisie ».
> Aligné sur le type `Money` du noyau Expert Solutions (`{ minorUnits: bigint, currency }`).

---

## 1. État des lieux — mesuré dans le code, pas estimé

| Constat | Mesure |
|---|---|
| Euro câblé en dur (`'EUR'`, `€`, `toFixed(2)`) | **116 occurrences** dans `src/` |
| Fichiers concernés | ~15, dont `priceResolver.ts`, `quote.ts`, `clariprintQuote.ts`, `gammeFloorPrices.ts`, `shopExport.ts`, `schemaOrg.ts` et les écrans de vente |
| Devise en base | **une seule colonne** : `orders.currency char(3) default 'EUR'` — les tenants, produits, prix et coûts n'en ont pas |
| Formatage | **deux helpers concurrents** : `formatPrice()` (priceResolver) et `formatEuro()` (ProductOverlay.helpers, 8 fichiers) — ce dernier force `currency: "EUR"` |
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

### Tranche 1 — La devise existe et s'affiche *(prérequis de tout le reste)*
- Colonne `currency char(3) not null default 'EUR'` sur `tenants` ; exposée par le contexte tenant côté front.
- **Un helper unique** `formatMoney(amount, currency, locale)` ; `formatEuro()` supprimé et ses 8 appelants migrés.
- Purge des `€` et `EUR` littéraux des écrans : la devise vient du tenant.
- Effet immédiat : un imprimeur en dollars voit des dollars partout. Les montants restent en `number` à ce stade — c'est assumé.

### Tranche 2 — Les coûts de production passent en `Money`
- Périmètre : Parc machine et modèle de coût (taux horaires, plaque, clic, encre au m², forme, consommables).
- C'est la tranche **la moins risquée** : le Parc machine ne touche pas la base (persistance locale de maquette), donc aucune migration de schéma à défaire.
- Conversion en entrée de service applicatif ; aucun `number` monétaire ne franchit une frontière de module.

### Tranche 3 — Le chemin de prix de vente
- `resolvePrice()` et sa hiérarchie `clariprint > library_cached > prix_marche > zero` rendent un `Money`.
- Règles de Gestion commerciale : marge et remise restent des ratios, appliqués à un `Money` avec la règle d'arrondi retenue.
- Adaptateur Clariprint : la devise devient explicite dans le contrat d'échange.

### Tranche 4 — Documents et export
- Devis, panier, commandes, export boutique, `schema.org` : devise portée par le document, plus jamais déduite.
- `orders.currency` existe déjà — à raccorder au lieu d'être ignorée.

## 4. Ce qui reste à trancher avec Expert Solutions

| # | Question | Pourquoi ça compte |
|---|---|---|
| 1 | **Règle d'arrondi** — par ligne ou sur le total ? | Conséquence commerciale directe : deux règles = deux prix pour le même devis |
| 2 | Statut des pourcentages — ratio `number` ou type dédié | Décision de modèle ; notre proposition : ratio |
| 3 | Rythme d'adoption du `Money` du noyau | Nous proposons tranche par tranche, pas de bascule globale |
| 4 | Nombre de décimales par devise | Toutes les devises n'ont pas 2 décimales (JPY : 0) — le `bigint` en unités mineures le gère, l'affichage doit suivre |

## 5. Points de vigilance

- **Les prix de marché par défaut** (décision WM#040826) sont calibrés en euros. Servis à un imprimeur en dollars, ils seront faux. Deux options : les cantonner à la zone euro, ou les marquer explicitement comme indicatifs et convertis à la charge de l'utilisateur. À décider avant tout déploiement hors zone euro.
- **Les grilles papier et transport** sont négociées dans une devise donnée : la devise doit être portée par la grille, pas par le tenant qui l'importe.
- **La bibliothèque machines** porte des coûts par défaut indicatifs en euros — même réserve.
