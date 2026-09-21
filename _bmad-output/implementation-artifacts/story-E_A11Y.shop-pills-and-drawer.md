---
id: E_A11Y.shop-pills-and-drawer
epic: E4 — Mini-shop
source: notion
notion_url: https://app.notion.com/p/35dd0131973c81bcabc7f86cba835416
---
# E_A11Y.shop-pills-and-drawer — aria-pressed pill-all + aria-modal drawer

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [E_A11Y.shop-pills-and-drawer — aria-pressed pill-all + aria-modal drawer](https://app.notion.com/p/35dd0131973c81bcabc7f86cba835416) · extrait le 17/09/2026 · page modifiée le 11/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| E4 — Mini-shop | Sprint 4 | P1 | XS | Pas commencé | Claude code | Toutes | Cas de test KO | — |

### Description fonctionnelle (Notion)

##### Origine

Story issue de la **Campagne TF Sprint 3 du 11/05/2026** — réserves a11y P1 cumulables sur TF-57 ✅ et TF-63 ✅.

- Fiche TF source 1 : [TF-57 — Pilules gammes filtre additif](https://www.notion.so/35dd0131973c81f98bdbdc46d848b70d)
- Fiche TF source 2 : [TF-63 — Drawer panier slide-right](https://www.notion.so/35dd0131973c81e78d5cdaff5bf4e993)

##### Contexte

Le pill `shop-gamme-pill-all` n'a aucun `aria-pressed` (ni `"true"` ni `"false"`) dans aucun état. Pattern toggle-group WCAG recommande `aria-pressed="true"` quand pill-all est actif (`selectedGammes.length === 0`).

Le composant `shop-cart-drawer` (Sheet shadcn) n'expose pas `aria-modal="true"` malgré `role="dialog"`. Les lecteurs d'écran ne signaleront pas la modalité du drawer.

Périmètre : [src/app/components/shop/PublicShop.tsx](src/app/components/shop/PublicShop.tsx) (pill-all l. 351-359), [src/app/components/shop/portal/PortalCart.tsx](src/app/components/shop/portal/PortalCart.tsx) (Sheet shadcn).

##### User story

En tant que **Acheteur shop_only** utilisateur de lecteur d'écran (NVDA, JAWS, VoiceOver), je veux que le filtre « Tout » indique son état actif/inactif et que le drawer signale sa modalité, afin de naviguer la boutique B2B avec une assistance WCAG niveau AA.

##### Critères d'acceptation

1. **Given** je suis sur `/shop/<slug>` sans filtre sélectionné, **When** j'inspecte `shop-gamme-pill-all`, **Then** son `aria-pressed` est exactement **`"true"`**.
2. **Given** je clique sur 1-2 pills gammes, **When** j'inspecte `shop-gamme-pill-all`, **Then** son `aria-pressed` est exactement **`"false"`**.
3. **Given** je clique `shop-cart-icon`, **When** le drawer s'ouvre, **Then** `shop-cart-drawer` a **`role="dialog"`**** ET ****`aria-modal="true"`** simultanément.
4. **Given** un test axe ou pa11y, **When** je scan la page boutique, **Then** **0 violation WCAG** sur `aria-pressed` ou `aria-modal`.
5. **0 régression** comportementale : TF-57 filtre additif + localStorage OK, TF-63 drawer slide-right + Esc OK.
6. **Re-test TF-57 + TF-63** valident les nouveaux attributs aria.

##### Spécifications API / data

- [src/app/components/shop/PublicShop.tsx](src/app/components/shop/PublicShop.tsx) : ajouter `aria-pressed={selectedGammes.length === 0}` sur le composant pill-all.
- [src/app/components/shop/portal/PortalCart.tsx](src/app/components/shop/portal/PortalCart.tsx) : ajouter `aria-modal="true"` sur le Sheet via prop shadcn.
- Pas d'endpoint, pas de SQL, pas de featureFlag.
- Pas de nouveau testid.
- **Commit unique cumulable** : `feat(v5): a11y aria-pressed pill-all + aria-modal drawer`.

##### Dépendances

- Aucun prérequis bloquant. À fenêtre résiduelle si capacité Sprint 4.

##### Estimation

**XS (\< 2 h)**. 2 modifs ponctuelles + scan axe + re-test 2 TF.

##### Plan de test

- **TF existants à re-jouer** : [TF-57](https://www.notion.so/35dd0131973c81f98bdbdc46d848b70d) + [TF-63](https://www.notion.so/35dd0131973c81e78d5cdaff5bf4e993).
- **Smoke axe** : scan manuel via extension Chrome axe sur localhost:5177/shop/xyfjjo-q6kekm.
- **Test vitest** : assertion `aria-pressed` + `aria-modal` dans `ShopLayout.helpers.test.ts` ou test dédié.

##### Définition de « terminé »

- Code mergé sur `beta/v5`.
- vitest 162/162 verts.
- Re-test TF-57 et TF-63 OK avec assertions aria validées.
- CR campagne suivante mentionnant la résolution.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent E_A11Y.shop-pills-and-drawer

- `_bmad-output/implementation-artifacts/story-R9-refacto-a11y-light-axe-ci.md`
