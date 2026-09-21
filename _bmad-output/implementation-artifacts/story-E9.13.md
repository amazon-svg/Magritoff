---
id: E9.13
epic: E9 — Multi-tenant & gouvernance
source: notion
notion_url: https://app.notion.com/p/357d0131973c8140ac58d78f4618c927
---
# E9.13 — Refonte PortalShop /shop/:slug en portail B2B premium

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [E9.13 — Refonte PortalShop /shop/:slug en portail B2B premium](https://app.notion.com/p/357d0131973c8140ac58d78f4618c927) · extrait le 17/09/2026 · page modifiée le 05/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| E9 — Multi-tenant & gouvernance | Sprint 3 | P1 | L | Pas commencé | Claude code | Pro+ | Beta 3 livraison | — |

### Description fonctionnelle (Notion)

**En tant qu'**utilisateur d'une boutique B2B, **je veux** une expérience portail moderne et professionnelle, **afin de** travailler dans un environnement aligné avec le standard ERP-like défini en B2 (handoff design).

##### Contexte

La route publique `/shop/:slug` est restée en layout v1 simple sur Beta 3 (ProductCard basique, panier minimal). La refonte design de B2 (portail ERP-like corporate, ProductCard 2-col stacked, dark mode boutique) n'a pas encore été propagée à PortalShop sur B3.

##### Critères d'acceptation

- Layout 3 colonnes : navigation gammes (gauche), grille produits (centre), panier sticky (droite).
- ProductCard variante boutique : visuel + nom + réf + bouton « Configurer & ajouter » (ouvre QuoteModal).
- Filtres : kind Clariprint, gamme, recherche texte.
- Header brandé : logo tenant + nom boutique + (si user shop_only — cf. E9.3) menu utilisateur compact.
- Dark mode actif par défaut sur les boutiques (décision design B2).
- Responsive desktop-first (cible : acheteurs B2B sur poste fixe).

##### Dépendances

- E9.3 (scope `shop_only`) qui rend cette refonte critique pour les utilisateurs B2B externes
- Tokens v2 déjà définis (`Magritoff-v2/src/styles/tokens.css`) — à réutiliser tels quels

### Cas de test fonctionnels rattachés (Notion)

| TF | Cas de test | Statut | Priorité | Parcours | Cible | Stories liées |
|---|---|---|---|---|---|---|
| [TF-37](https://app.notion.com/358d0131973c8105b19de38b42977e3d) | Acheteur shop_only voit la boutique brandée tenant en layout B2B premium | À jouer | P0 — Critique | P09 — Boutique portail B2B | B4 | E9.13 |
| [TF-38](https://app.notion.com/358d0131973c81188970ceb2b00f2399) | ProductCard affiche le prix calculé sur le parc du tenant | KO | P0 — Critique | P09 — Boutique portail B2B | B4 | E9.13, E1.1 |
| [TF-39](https://app.notion.com/358d0131973c8122ba0df43d9b0cff6e) | Demande de devis depuis ProductCard d'une boutique B2B | KO | P1 — Importante | P13 — Devis et gestion commerciale | B4 | E9.13, E1.1 |

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent E9.13

- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/prd.md`
