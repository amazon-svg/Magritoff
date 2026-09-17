---
id: T01.1
epic: T-01 — Corporate Portal
source: notion
notion_url: https://app.notion.com/p/357d0131973c8109b7d0c0bb2606da3c
---
# T01.1 — Onboarding d'un client corporate (espace brandé)

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [T01.1 — Onboarding d'un client corporate (espace brandé)](https://app.notion.com/p/357d0131973c8109b7d0c0bb2606da3c) · extrait le 17/09/2026 · page modifiée le 05/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| T-01 — Corporate Portal | Sprint 2 | P0 | M | Pas commencé | Claude code | Corporate | DesignO 21/04 | — |

### Description fonctionnelle (Notion)

**En tant qu'**administrateur Magrit (côté imprimeur/plateforme), **je veux** créer un espace corporate brandé pour un client annonceur en déclarant ses départements, ses administrateurs et ses règles de validation, **afin que** le client soit autonome pour piloter son parc de commandes print.

##### Critères d'acceptation

- Création d'un espace corporate en moins de 5 écrans de paramétrage (logo, couleurs primaires, sous-domaine brandé optionnel).
- Déclaration jusqu'à 50 départements dans un même espace.
- Import en masse d'utilisateurs par CSV (email, rôle, département, budget).
- Activation envoie email aux administrateurs client avec lien d'activation.

##### Dépendances

- E9.4 (rename espace) pour la flexibilité nom/slug
- E9.5 (email invitations) pour l'envoi d'activation
- E9.7 (custom domain) pour le sous-domaine brandé

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent T01.1

_Aucun fichier du dépôt ne cite cet identifiant._
