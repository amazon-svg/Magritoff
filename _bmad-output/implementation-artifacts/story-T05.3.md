---
id: T05.3
epic: T-05 — Help System
source: notion
notion_url: https://app.notion.com/p/357d0131973c81d78431ea491d2bcd9d
---
# T05.3 — Aide conversationnelle Marguerite (Cmd+K)

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [T05.3 — Aide conversationnelle Marguerite (Cmd+K)](https://app.notion.com/p/357d0131973c81d78431ea491d2bcd9d) · extrait le 17/09/2026 · page modifiée le 05/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| T-05 — Help System | Sprint 4 | P1 | M | Pas commencé | Claude code | Toutes | DesignO 21/04 | — |

### Description fonctionnelle (Notion)

**En tant qu'**utilisateur, **je veux** poser une question en langage naturel à Marguerite depuis n'importe où dans l'application, **afin d'**obtenir une réponse personnalisée sur ma situation.

##### Critères d'acceptation

- Icône Marguerite dans le header, accès par raccourci `Cmd/Ctrl + K`.
- Prompt libre : « comment je limite les templates d'un département ? », « pourquoi mon budget département affiche-t-il 0 ? »
- Marguerite connaît : la page courante, le rôle de l'utilisateur, le plan Magrit, la doc produit, l'historique récent d'actions.
- Réponse structurée avec étapes cliquables qui naviguent l'utilisateur dans l'UI quand possible (« Pour limiter les templates, allez dans Configuration \> Templates \> filtres. Cliquez ici pour y aller directement »).
- Escalade vers support humain si Marguerite ne peut pas répondre (génère un ticket pré-rempli avec le contexte).

##### Différenciateur vs DesignO

DesignO n'offre que des vidéos YouTube + descriptions statiques. Magrit ajoute aide conversationnelle contextualisée au rôle et au plan.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent T05.3

_Aucun fichier du dépôt ne cite cet identifiant._
