---
id: T01.4
epic: T-01 — Corporate Portal
source: notion
notion_url: https://app.notion.com/p/357d0131973c81509a51e45ec246dd47
---
# T01.4 — Workflow de validation multi-niveaux

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [T01.4 — Workflow de validation multi-niveaux](https://app.notion.com/p/357d0131973c81509a51e45ec246dd47) · extrait le 17/09/2026 · page modifiée le 05/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| T-01 — Corporate Portal | Sprint 2 | P0 | L | Pas commencé | Claude code | Corporate | DesignO 21/04 | — |

### Description fonctionnelle (Notion)

**En tant que** commandeur dans un département, **je veux** soumettre une commande qui suivra automatiquement le circuit de validation paramétré, **afin de** n'avoir rien d'autre à faire après avoir passé ma commande.

##### Critères d'acceptation

- Chaque niveau de validation déclenché selon seuils montant ET catégorie (ex : \< 500 € → auto, 500-5 000 € → N+1, \> 5 000 € → N+1 puis achats).
- Notifications email + in-app aux valideurs concernés.
- Interface valideur avec vue en lot (valider/rejeter 10 commandes en une session).
- Commentaires obligatoires en cas de rejet.
- Délégation temporaire d'un valideur (congés) paramétrable.
- SLA de validation configurable avec alerte dépassement.

##### Modèle de données

- `ValidationRule`, `ValidationStep`, `OrderApproval`.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent T01.4

_Aucun fichier du dépôt ne cite cet identifiant._
