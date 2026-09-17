---
id: E1.5
epic: E1 — Clariprint
source: notion
notion_url: https://app.notion.com/p/357d0131973c814ab4c2fcfeb35c8d18
---
# E1.5 — Interrogation Clariprint depuis Excel

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [E1.5 — Interrogation Clariprint depuis Excel](https://app.notion.com/p/357d0131973c814ab4c2fcfeb35c8d18) · extrait le 17/09/2026 · page modifiée le 18/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| E1 — Clariprint | Sprint 3 | P2 | L | Pas commencé | Xavier | Enterprise | Vision Produit 15/04 | — |

### Description fonctionnelle (Notion)

**En tant qu'**utilisateur entreprise, **je veux** interroger Clariprint depuis Excel et enrichir mes fichiers directement, **afin de** travailler dans mon outil quotidien sans changer de contexte.

##### Articulation

Recoupement direct avec [T-08](https://www.notion.so/349d0131973c81738671e9e3e7808dfe) — Module Catalogues Excel de l'offre Enterprise. Les deux stories sont traitées conjointement.

##### Critères pressentis

- Add-in Excel signé (Microsoft Office Store).
- Authentification SSO ou clé API.
- Formules natives `=MAGRIT.QUOTE(...)`, `=MAGRIT.PRODUCT(...)`.
- Mode batch sur sélection de cellules.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent E1.5

_Aucun fichier du dépôt ne cite cet identifiant._
