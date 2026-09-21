---
id: T07.4
epic: T-07 — Canva
source: notion
notion_url: https://app.notion.com/p/357d0131973c811980c2f74feac821c9
---
# T07.4 — Parcours intégré dans le storefront imprimeur

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [T07.4 — Parcours intégré dans le storefront imprimeur](https://app.notion.com/p/357d0131973c811980c2f74feac821c9) · extrait le 17/09/2026 · page modifiée le 05/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| T-07 — Canva | Sprint 4 | P1 | M | Pas commencé | Claude code | Pro+ | DesignO 21/04 | — |

### Description fonctionnelle (Notion)

**En tant qu'**utilisateur final, **je veux** un parcours fluide qui me propose Canva sans m'imposer de l'utiliser, **afin de** garder le choix d'un PDF existant ou d'une commande sans visuel.

##### Critères d'acceptation

- Bouton « Créer avec Canva » affiché en étape de configuration produit, bien visible mais pas obligatoire.
- Alternatives toujours offertes :
  - Upload d'un PDF existant (preflight T07.3 appliqué dans les deux cas)
  - Commande sans visuel (l'imprimeur contactera le client)
- Sauvegarde du design Canva dans l'espace client (pour réassort, v2 du fichier).

##### Performance

Ouverture de Canva pré-configuré en < 5 s après clic. Fallback : si l'API Canva est indisponible, upload PDF existant reste accessible.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent T07.4

_Aucun fichier du dépôt ne cite cet identifiant._
