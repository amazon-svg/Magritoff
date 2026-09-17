---
id: T01.5
epic: T-01 — Corporate Portal
source: notion
notion_url: https://app.notion.com/p/357d0131973c81508c64d75634b9426a
---
# T01.5 — Bibliothèque de templates validés / brand consistency

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [T01.5 — Bibliothèque de templates validés / brand consistency](https://app.notion.com/p/357d0131973c81508c64d75634b9426a) · extrait le 17/09/2026 · page modifiée le 05/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| T-01 — Corporate Portal | Sprint 4 | P0 | L | Pas commencé | Claude code | Corporate | DesignO 21/04 | — |

### Description fonctionnelle (Notion)

**En tant que** Brand Manager chez un annonceur, **je veux** restreindre les templates accessibles aux commandeurs aux seuls templates validés par la marque, **afin de** garantir la cohérence de l'image sans avoir à valider chaque commande individuellement.

##### Critères d'acceptation

- Catalogue de templates brandés rattaché à l'espace corporate.
- Chaque template peut être restreint à certains départements.
- Zones de personnalisation verrouillées vs éditables définies au niveau template par le Brand Manager (ex : logo figer, texte libre sur 2 champs, couleurs dans palette validée uniquement).
- Validation automatique de commande si 100% du template est verrouillé (sauf texte libre) et budget OK.
- Historique des versions de template avec rollback.

##### Dépendances

- T-07 (Canva) pour le moteur de zones éditables
- E8.3 (gabarits 2D) pour la base technique

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent T01.5

_Aucun fichier du dépôt ne cite cet identifiant._
