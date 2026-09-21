---
id: E4.3
epic: E4 — Mini-shop
source: notion
notion_url: https://app.notion.com/p/357d0131973c8101b0bffb041fc0cb67
---
# E4.3 — Terminal de paiement Stripe

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [E4.3 — Terminal de paiement Stripe](https://app.notion.com/p/357d0131973c8101b0bffb041fc0cb67) · extrait le 17/09/2026 · page modifiée le 05/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| E4 — Mini-shop | Sprint 4 | P2 | M | Pas commencé | Claude code | Pro+ | Vision Produit 15/04 | — |

### Description fonctionnelle (Notion)

**En tant qu'**utilisateur Pro, **je veux** intégrer un terminal de paiement pour les transactions en ligne, **afin de** clôturer le cycle commercial avec encaissement.

##### Orientation technique

- **Stripe** en priorité (couverture Europe + France, PCI-DSS géré par Stripe).
- Alternative étudiée : **Stancer** (acteur français, ancrage FR).
- Paiement CB, SEPA, Apple Pay, Google Pay.
- Factures automatiques, conformité e-invoicing FR (échéance 2026-2027).

##### Articulation

À rapprocher de E9.8 (Billing Stripe par tenant) : **même fournisseur Stripe**, mais l'un facture les commandes shop (B2B/B2C), l'autre facture l'abonnement Magrit. Architecture à mutualiser.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent E4.3

- `SPRINT_HANDOFF.md`
- `_bmad-output/implementation-artifacts/sprint-status-2026-05-17.md`
- `_bmad-output/implementation-artifacts/story-P0.11-tenant-order-items-product-id-nullable.md`
- `_bmad-output/implementation-artifacts/story-P0.5-adr-orders-model-migration.md`
- `_bmad-output/implementation-artifacts/story-S-MIGRATION-ORDERS-bascule-tenant-orders.md`
- `_bmad-output/planning-artifacts/architecture.md`
- `_bmad-output/planning-artifacts/epics.md`
- `_bmad-output/planning-artifacts/prd.md`
- `supabase/migrations/20260509000100_e1_orders_v1_1.sql`
