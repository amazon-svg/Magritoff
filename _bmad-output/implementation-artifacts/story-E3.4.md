---
id: E3.4
epic: E3 — UX & streaming
source: notion
notion_url: https://app.notion.com/p/357d0131973c815e9516c94c7abeb411
---
# E3.4 — UX simplifiée saisie données imprimeur

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [E3.4 — UX simplifiée saisie données imprimeur](https://app.notion.com/p/357d0131973c815e9516c94c7abeb411) · extrait le 17/09/2026 · page modifiée le 05/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| E3 — UX & streaming | Sprint 2 | P0 | M | Pas commencé | Claude code | Freemium+ | Vision Produit 15/04 | — |

### Description fonctionnelle (Notion)

**En tant qu'**utilisateur imprimeur, **je veux** une UX simplifiée de saisie de données avec paramétrage léger et intuitif, **afin de** convertir Freemium → Starter → Pro sans friction.

##### Contexte

Plus la saisie est légère, plus le taux de complétion est élevé. Story prérequise à la conversion freemium → payant.

##### Critères d'acceptation

- Saisie guidée par Marguerite (wizard conversationnel, pas formulaire de 200 champs).
- Progression visible (X% complété / Y% à compléter).
- Sauvegarde auto à chaque étape, reprise possible plus tard.
- Démarrage rapide : les 5 premières questions permettent déjà de produire des devis approximatifs.
- Passage à 100% progressif avec valorisation à chaque palier (20%, 50%, 80%, 100%).

##### Articulation

Fort lien avec [T-06](https://www.notion.so/349d0131973c81398f17ff2c629d65be) : E3.4 = UX minimale Freemium, T-06 = structure complète Pro.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent E3.4

- `SPRINT_HANDOFF.md`
- `docs/project-context.md`
