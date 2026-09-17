---
id: E1.fix-TF51
epic: E1 — Clariprint
source: notion
notion_url: https://app.notion.com/p/35cd0131973c8155bbcaef61ca61788a
---
# Fix TF-51 — PricingPanel atelier rend le badge Prix marché

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [Fix TF-51 — PricingPanel atelier rend le badge Prix marché](https://app.notion.com/p/35cd0131973c8155bbcaef61ca61788a) · extrait le 17/09/2026 · page modifiée le 10/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| E1 — Clariprint | Sprint 4 | P0 | S | Pas commencé | Claude code | Toutes | Cas de test KO | — |

### Description fonctionnelle (Notion)

##### Origine

Story de correctif issue de la **Campagne TF Sprint 3 du 10/05/2026** — cas TF-51 marqué KO.

- Fiche TF source : [TF-51 — PricingPanel utilise resolvePrice et affiche badge Prix marché](https://www.notion.so/35bd0131973c81ef8320de1d5f01def2)
- CR campagne : [CR Campagne TF — Sprint 3 — 10/05/2026](https://www.notion.so/35cd0131973c81c79413d58217baa3e2)
- Page passerelle : [📊 Campagnes de tests](https://www.notion.so/35cd0131973c81f7823bf9fd34411363)

##### Symptôme

Sur l'atelier Marguerite (`/t/imprimerie-ipa`), génération d'un devis sur cartes de visite, onglet Prix de la ProductCard. Le composant **PricingPanel** affiche correctement « Prix estimé HT 97.80 € · TVA 19.56 € · Total TTC 117.36 € » et la section « Prix réel Clariprint » avec bouton « Obtenir le prix réel Clariprint » (donc Clariprint non appelé, condition de fallback vérifiée).

Tout fonctionne sauf le rendu visuel attendu en condition de fallback :

- **Aucun badge orange** `bg-orange-100 border-orange-300 text-orange-800` portant le texte « Prix marché »
- **Aucune classe** `inline-flex` correspondante
- **Aucun sous-texte italique** « *prix réel Clariprint à venir* »

##### Hypothèse code

Le label « Prix estimé HT » est probablement codé en dur dans le composant PricingPanel sans appel à `resolvePrice()` — ou en l'appelant mais sans exposer `hasMarketPrice` dans le render. La hiérarchie `clariprint > library_cached > prix_marche > zero` semble appliquée côté valeur (97.80 € est cohérent avec `estimateMarketPriceHT`) mais pas côté présentation visuelle.

##### Fichiers cibles probables

- `apps/web/src/components/atelier/PricingPanel.tsx` (ou équivalent dans la structure du repo `amazon-svg/Magritoff` branche `beta/v5`)
- Composant `MarketPriceBadge` à créer ou réutiliser depuis le storefront B2B (cf. critère de cohérence ci-dessous)

##### Fix attendu

Refactor du composant PricingPanel : appel à `resolvePrice(product)` retournant `{ value, source, hasMarketPrice }`, conditionnel `{hasMarketPrice && <MarketPriceBadge />}` avec les classes spec, plus le sous-texte italique d'accompagnement.

**Critère de cohérence applicative** : le wording et le styling doivent reprendre exactement ce qui est déjà rendu en storefront B2B (cf. TF-53 OK), à savoir libellé « Prix marché » + sous-texte italique orange « *Prix marché (estimation Magrit). Le prix réel Clariprint sera confirmé à la validation de la commande par l'imprimeur.* ». Réutiliser le composant existant si possible.

##### Anomalie connexe d'instrumentation

Le DOM accessibility tree n'expose **pas du tout** le PricingPanel après ouverture (testé via `read_page` et `find` IA Chrome — retours vides). À traiter dans la story E7.7 v1.1 d'instrumentation, indépendamment du fix visuel. Ajouter `data-testid="pricing-panel"`, `pricing-panel-market-badge`, `pricing-panel-market-subtext`.

##### Critères d'acceptation à valider en re-test

1. Sur un produit dont l'appel Clariprint n'a pas été déclenché, le PricingPanel affiche un badge orange visible portant « Prix marché ».
2. Le sous-texte italique d'accompagnement est présent juste sous le bloc tarifaire.
3. Après clic sur « Obtenir le prix réel Clariprint » avec réponse OK, le badge **disparaît** et le label bascule sur la valeur Clariprint (test de bascule).
4. Si l'appel Clariprint retourne une erreur ou un payload sanitizé (cf. TF-50), le badge **reste affiché** et la valeur reste celle du prix marché.
5. La fiche [TF-51](https://www.notion.so/35bd0131973c81ef8320de1d5f01def2) doit pouvoir être basculée en OK lors de la prochaine campagne TF.
6. Bonus testid : les 3 selectors d'instrumentation sont en place et vérifiables via accessibility tree.

##### Définition de « terminé »

- Code mergé sur `beta/v5`
- Re-test TF-51 joué et OK tracé dans la base 🧪 Cahiers de tests fonctionnels Magrit
- CR campagne suivante mentionnant le passage KO → OK

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent E1.fix-TF51

- `_bmad-output/implementation-artifacts/story-R3-refacto-clariprint-adapter-enforcement.md`
