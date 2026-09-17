---
id: T07.1
epic: T-07 — Canva
source: notion
notion_url: https://app.notion.com/p/357d0131973c8172b5d3e63a1c226efa
---
# T07.1 — Connexion OAuth Canva Connect API

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [T07.1 — Connexion OAuth Canva Connect API](https://app.notion.com/p/357d0131973c8172b5d3e63a1c226efa) · extrait le 17/09/2026 · page modifiée le 05/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| T-07 — Canva | Sprint 3 | P1 | S | Pas commencé | Claude code | Pro+ | DesignO 21/04 | — |

### Description fonctionnelle (Notion)

**En tant qu'**utilisateur final d'un imprimeur Pro, **je veux** me connecter à Canva depuis le storefront Magrit, **afin de** créer mon visuel sans changer d'application.

##### Critères d'acceptation

- Intégration via **Canva Connect API** (officielle, partenariat développeur).
- Authentification OAuth 2.0 : le client final se connecte avec son compte Canva (ou en crée un).
- Gestion des tokens, refresh, révocation.

##### Modèle partenariat

- Partenariat développeur Canva Connect API.
- À explorer : inscription au programme « Canva Apps » pour visibilité marketplace.

##### Décision produit

Magrit ne développe **PAS** de design studio natif. Canva, Adobe Express et Figma occupent ce marché avec des centaines de millions en R&D. Magrit fournit le gabarit technique correct, Canva fait son métier de design.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent T07.1

_Aucun fichier du dépôt ne cite cet identifiant._
