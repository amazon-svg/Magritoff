---
id: E4.fix-TF54
epic: E4 — Mini-shop
source: notion
notion_url: https://app.notion.com/p/35cd0131973c81e29cadf3708c798834
---
# Fix TF-54 — PortalCart CartSummary expose badge global Prix marché

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [Fix TF-54 — PortalCart CartSummary expose badge global Prix marché](https://app.notion.com/p/35cd0131973c81e29cadf3708c798834) · extrait le 17/09/2026 · page modifiée le 10/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| E4 — Mini-shop | Sprint 4 | P1 | S | Pas commencé | Claude code | Toutes | Cas de test KO | — |

### Description fonctionnelle (Notion)

##### Origine

Story de correctif issue de la **Campagne TF Sprint 3 du 10/05/2026** — cas TF-54 marqué KO partiel.

- Fiche TF source : [TF-54 — PortalCart total HT non-zero et badge global Prix marché](https://www.notion.so/35bd0131973c81eba990cd2326412352)
- CR campagne : [CR Campagne TF — Sprint 3 — 10/05/2026](https://www.notion.so/35cd0131973c81c79413d58217baa3e2)
- Page passerelle : [📊 Campagnes de tests](https://www.notion.so/35cd0131973c81f7823bf9fd34411363)

##### Symptôme

Sur la storefront ERAM (`/shop/xyfjjo-q6kekm`, tenant imprimerie-ipa), ajout au panier d'un Flyers A5 recto-verso (1000 ex.). Le PortalCart calcule correctement les montants :

- Ligne : 181 440 € TTC
- Sous-total HT : 151 200 €
- TVA (20%) : 30 240 €
- Total TTC : 181 440 €

La chaîne `resolvePrice()` propage donc bien jusqu'au calcul cart — le mécanisme de fallback marché est correctement câblé côté valeur (critère 1 du test = OK).

**Mais le bloc Récapitulatif n'expose aucun badge global « Prix marché »** alors que la ligne du panier provient d'un produit en estimation Magrit (Clariprint a renvoyé un négatif filtré, cf. observation TF-50). L'acheteur peut signer une commande sans comprendre que le prix peut bouger à la validation imprimeur — défaut de transparence (critère 2 du test = KO).

##### Hypothèse code

Le composant `CartSummary` ne lit pas le flag `hasMarketPrice` sur les line items, ou le lit mais ne le propage pas en agrégat. Il faudrait ajouter une dérivation du type `cart.hasAnyMarketPriceLine = lineItems.some(li => li.hasMarketPrice)` puis afficher conditionnellement un badge global avec rappel du sous-texte explicatif.

##### Fichiers cibles probables

- `apps/web/src/components/shop/CartSummary.tsx` (ou équivalent)
- Logique cart : `apps/web/src/state/cartStore.ts` ou hook `useCart()` — ajouter le calcul dérivé `hasAnyMarketPriceLine`
- Réutilisation du même `MarketPriceBadge` que TF-51 (cf. story Fix TF-51)

##### Fix attendu

Dans `CartSummary`, lire le flag dérivé du cart et afficher un badge global « Prix marché » au-dessus ou à côté du Sous-total HT, avec rappel court « *Au moins une ligne en estimation Magrit* » et lien dépliable vers le sous-texte explicatif complet (même wording que sur la ProductPage — cf. TF-53 OK comme référence visuelle).

**Cohérence applicative** : même composant Badge, même tonalité orange, même sémantique « Prix marché » que dans le bouton Add to cart déjà OK. Pas d'invention de wording spécifique au cart.

##### Anomalie connexe d'instrumentation

Ajouter `data-testid="cart-summary"`, `cart-summary-market-badge`, `cart-summary-market-subtext` pour permettre l'automatisation IA Chrome de la prochaine campagne TF.

##### Critères d'acceptation à valider en re-test

1. Avec un panier contenant au moins une ligne issue d'un produit en prix marché, le bloc Récapitulatif affiche un badge global « Prix marché » dans le même style visuel que la ProductPage.
2. Avec un panier 100 % Clariprint OK, le badge n'apparaît pas (test de non-régression).
3. Avec un panier mixte (1 ligne marché + 1 ligne Clariprint), le badge apparaît (le `some()` doit fonctionner).
4. Le total HT/TTC reste correct dans tous les cas — pas de régression sur le calcul existant.
5. La fiche [TF-54](https://www.notion.so/35bd0131973c81eba990cd2326412352) doit pouvoir basculer en OK lors de la prochaine campagne TF.
6. Bonus testid : les 3 selectors d'instrumentation sont posés.

##### Définition de « terminé »

- Code mergé sur `beta/v5`
- Re-test TF-54 joué et OK tracé dans la base 🧪 Cahiers de tests fonctionnels Magrit
- CR campagne suivante mentionnant le passage KO → OK

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent E4.fix-TF54

_Aucun fichier du dépôt ne cite cet identifiant._
