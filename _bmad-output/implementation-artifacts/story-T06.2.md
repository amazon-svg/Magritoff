---
id: T06.2
epic: T-06 — Parc & monétisation
source: notion
notion_url: https://app.notion.com/p/357d0131973c811980c1db32eb3e5531
---
# T06.2 — Prix marché Magrit (agrégat anonymisé, k-anonymity ≥ 10)

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [T06.2 — Prix marché Magrit (agrégat anonymisé, k-anonymity ≥ 10)](https://app.notion.com/p/357d0131973c811980c1db32eb3e5531) · extrait le 17/09/2026 · page modifiée le 05/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| T-06 — Parc & monétisation | Sprint 2 | P0 | L | Pas commencé | Claude code | Toutes | DesignO 21/04 | — |

### Description fonctionnelle (Notion)

**En tant qu'**utilisateur (même Freemium), **je veux** un prix marché de référence pour mes devis, **afin de** disposer d'un benchmark même sans avoir paramétré mon propre parc.

##### Critères d'acceptation

- Agrégation anonymisée des prix calculés par l'ensemble des parcs Pro actifs, par famille produit et configuration.
- **Anonymisation stricte** : seuils minimum de répondants par agrégat (k-anonymity ≥ 10) pour empêcher toute ré-identification.
- Percentile par défaut (médiane), avec accès aux percentiles P25/P75 dès Pro.
- Mise à jour quotidienne.
- Indicateur de fraîcheur de la donnée et de taille d'échantillon pour chaque famille produit.

##### Dépendances

- T06.1 doit être opérationnel et avoir attiré ≥ 10 parcs Pro actifs par famille pour atteindre la k-anonymity

##### Red flag

Confiance imprimeur : la réussite dépend entièrement de la confiance dans l'anonymisation. **Audit externe recommandé avant V1** avec un tiers certifié.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent T06.2

_Aucun fichier du dépôt ne cite cet identifiant._
