---
id: E1.2
epic: E1 — Clariprint
source: notion
notion_url: https://app.notion.com/p/357d0131973c81e9a247f5cdf016c888
---
# E1.2 — API monoproduit dédiée

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [E1.2 — API monoproduit dédiée](https://app.notion.com/p/357d0131973c81e9a247f5cdf016c888) · extrait le 17/09/2026 · page modifiée le 05/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| E1 — Clariprint | Sprint 3 | P0 | M | Pas commencé | Laurent | Technique | Vision Produit 15/04 | — |

### Description fonctionnelle (Notion)

**En tant que** développeur, **je veux** une API monoproduit dédiée qui élimine l'étape de routage, **afin d'**accélérer le traitement quand le produit est déjà identifié.

##### Contexte

Actuellement, toute requête transite par un routeur qui identifie le type produit, ajoutant de la latence. Cette story ajoute une API spécialisée appelée quand le produit est pré-identifié.

##### Critères d'acceptation

- Endpoint `POST /api/v1/quote/monoproduct` avec produit pré-sélectionné en entrée.
- Gain de latence ciblé : -30% vs routeur complet.
- Rétrocompatible : `/quote` continue de fonctionner.
- Documentation Swagger / OpenAPI à jour.

##### Dépendances

- E1.1 (devis textuel) en place
- Validation Expert Solutions avant mise en production

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent E1.2

_Aucun fichier du dépôt ne cite cet identifiant._
