---
id: T03.1
epic: T-03 — Sync eCommerce
source: notion
notion_url: https://app.notion.com/p/357d0131973c81f2a885d3fe26223c26
---
# T03.1 — Connexion et authentification eCommerce (Shopify/Woo/Magento/BigC)

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [T03.1 — Connexion et authentification eCommerce (Shopify/Woo/Magento/BigC)](https://app.notion.com/p/357d0131973c81f2a885d3fe26223c26) · extrait le 17/09/2026 · page modifiée le 05/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| T-03 — Sync eCommerce | Sprint 3 | P0 | M | Pas commencé | Claude code | Pro+ | DesignO 21/04 | — |

### Description fonctionnelle (Notion)

**En tant qu'**intégrateur technique (client ou presta), **je veux** connecter un storefront Shopify/Woo/Magento/BigC à Magrit en fournissant les clés d'API, **afin de** démarrer la synchronisation en moins de 30 minutes.

##### Critères d'acceptation

- Écran dédié par plateforme avec liste exacte des credentials requis et URL de doc officielle.
- Test de connexion immédiat avec message d'erreur clair (pas de « error 500 »).
- Support OAuth 2.0 quand la plateforme le permet (Shopify, BigCommerce).
- Support API key + secret pour WooCommerce et Magento.
- Stockage chiffré des credentials (vault).
- Rotation des clés avec rappel automatique avant expiration.

##### Pattern d'architecture

Connecteurs modulaires avec interface commune `EcommerceConnector`. Chaque plateforme implémente `authenticate`, `fetchOrders`, `fetchCustomers`, `fetchProducts`, `pushStatus`, `subscribeWebhooks`.

##### Ordre d'implémentation

Shopify (le plus demandé) → WooCommerce (volume PME FR) → Magento (gros comptes) → BigCommerce (US/export).

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent T03.1

_Aucun fichier du dépôt ne cite cet identifiant._
