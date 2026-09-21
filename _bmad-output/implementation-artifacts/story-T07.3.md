---
id: T07.3
epic: T-07 — Canva
source: notion
notion_url: https://app.notion.com/p/357d0131973c81249320d407cf0830dd
---
# T07.3 — Export PDF print-ready + preflight automatique

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [T07.3 — Export PDF print-ready + preflight automatique](https://app.notion.com/p/357d0131973c81249320d407cf0830dd) · extrait le 17/09/2026 · page modifiée le 05/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| T-07 — Canva | Sprint 3 | P1 | M | Pas commencé | Xavier | Pro+ | DesignO 21/04 | — |

### Description fonctionnelle (Notion)

**En tant que** plateforme, **je veux** récupérer le PDF print-ready depuis Canva et le valider en preflight, **afin de** garantir un fichier production-compatible sans intervention de l'imprimeur.

##### Critères d'acceptation

- Lorsque le client finalise son design dans Canva, déclenchement de l'export **via l'API Canva** au format PDF print-ready.
- Récupération du PDF dans Magrit, rattachement au bon de commande.
- **Preflight automatique** : vérification dimensions, bleed, résolution, transparence, profils colorimétriques.
- En cas d'anomalie : retour en Canva avec indication précise du problème.

##### Dépendances

- T07.1 (OAuth)
- E1 / E8 (spécifications produit Clariprint pour preflight)

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent T07.3

_Aucun fichier du dépôt ne cite cet identifiant._
