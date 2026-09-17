---
id: E4.1
epic: E4 — Mini-shop
source: notion
notion_url: https://app.notion.com/p/357d0131973c8178bdcdf71bf526b790
---
# E4.1 — Création et gestion de panier

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [E4.1 — Création et gestion de panier](https://app.notion.com/p/357d0131973c8178bdcdf71bf526b790) · extrait le 17/09/2026 · page modifiée le 05/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| E4 — Mini-shop | Sprint 3 | P1 | M | Pas commencé | Claude code | Pro+ | Vision Produit 15/04 | — |

### Description fonctionnelle (Notion)

**En tant qu'**utilisateur Pro, **je veux** créer un panier de produits à partir de mes devis et le modifier avant validation, **afin d'**accumuler plusieurs devis avant transformation en commande.

##### Critères d'acceptation

- Depuis un devis Magrit, bouton « Ajouter au panier ».
- Panier persistent par utilisateur, accessible depuis tout écran.
- Modifications : quantité, configurations, suppression, duplication de ligne.
- Recalcul automatique du prix total à chaque modification.
- Sauvegarde auto, restauration inter-sessions.
- API REST : `POST /cart/items`, `PATCH /cart/items/{id}`, `DELETE /cart/items/{id}`, `GET /cart`.

##### Positionnement

**Pas un Shopify-killer** — outil transactionnel simple, livré clé en main, pour les imprimeurs sans storefront. Compétition exclue avec [T-03](https://www.notion.so/349d0131973c81c1aa05d7b07ae41512) (sync eCommerce pour ceux qui ont déjà Shopify).

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent E4.1

- `_bmad-output/planning-artifacts/prd.md`
