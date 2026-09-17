---
id: T06.3
epic: T-06 — Parc & monétisation
source: notion
notion_url: https://app.notion.com/p/357d0131973c81898b02e9c3ce0cc3cd
---
# T06.3 — Gestion des panels (curated + personnalisés)

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [T06.3 — Gestion des panels (curated + personnalisés)](https://app.notion.com/p/357d0131973c81898b02e9c3ce0cc3cd) · extrait le 17/09/2026 · page modifiée le 05/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| T-06 — Parc & monétisation | Sprint 4 | P0 | L | Pas commencé | Claude code | Pro+ | DesignO 21/04 | — |

### Description fonctionnelle (Notion)

**En tant que** donneur d'ordre ou imprimeur Pro+, **je veux** gérer des panels d'imprimeurs (curated ou personnalisés), **afin de** calculer un prix sur mon écosystème fournisseur ou benchmark concurrence.

##### Cas d'usage cible

Royal Canin (acheteur packaging) doit faire produire 500 000 boîtes carton alimentaires. Il a un panel de 12 fournisseurs (Europe / Amériques / Asie). Il crée un « panel Royal Canin Monde » dans Magrit, y ajoute ses 12 fournisseurs (soit Pro Magrit, soit invités), et obtient pour chaque brief le prix individuel de chacun des 12 fournisseurs.

##### Fonctionnalités

- **Panels Magrit curated** : pré-définis par AGE (« packaging alimentaire FR », « grand format Europe », « impression numérique Nouvelle-Aquitaine », « certifiés Imprim'Vert »).
- **Panels personnalisés** : créés par l'utilisateur (imprimeur ou donneur d'ordre).
- **Invitation d'imprimeurs hors-Magrit** dans un panel privé : envoi invitation email avec code d'activation Pro offert X mois.
- **Droits d'accès** : un imprimeur peut **refuser** de figurer dans un panel non-créé par lui. Consentement explicite.
- Mode « panel ouvert » (inclus dans tous les panels Magrit curated) vs « panel fermé » (uniquement sur invitation spécifique).

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent T06.3

_Aucun fichier du dépôt ne cite cet identifiant._
