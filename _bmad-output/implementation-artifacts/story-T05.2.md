---
id: T05.2
epic: T-05 — Help System
source: notion
notion_url: https://app.notion.com/p/357d0131973c81399d95eaacc4298ae8
---
# T05.2 — Panneau d'aide de l'écran courant (raccourci ?, F1)

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [T05.2 — Panneau d'aide de l'écran courant (raccourci ?, F1)](https://app.notion.com/p/357d0131973c81399d95eaacc4298ae8) · extrait le 17/09/2026 · page modifiée le 05/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| T-05 — Help System | Sprint 3 | P1 | M | Pas commencé | Claude code | Toutes | DesignO 21/04 | — |

### Description fonctionnelle (Notion)

**En tant qu'**utilisateur, **je veux** ouvrir un panneau d'aide contextualisé sur l'écran où je suis, **afin de** trouver rapidement comment faire ce que j'ai besoin de faire.

##### Critères d'acceptation

- Raccourci clavier `?` (focus hors champ texte) ou `F1` pour ouvrir.
- Panneau latéral qui n'occulte pas l'écran principal (width \~380px, fermé par Escape).
- Contenu structuré : « Sur cet écran, vous pouvez : … » puis liste d'actions courantes avec pas-à-pas.
- Recherche plein texte dans toute la doc.
- Feedback inline : « Cette aide vous a-t-elle aidé ? » (oui/non sans popup).

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent T05.2

_Aucun fichier du dépôt ne cite cet identifiant._
