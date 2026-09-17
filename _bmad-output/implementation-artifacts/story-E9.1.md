---
id: E9.1
epic: E9 — Multi-tenant & gouvernance
source: notion
notion_url: https://app.notion.com/p/357d0131973c81a5b984c571aaa33b6b
---
# E9.1 — Renommer onglet « Clients » → « Utilisateurs » dans le dashboard d'espace

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> **Source qui fait foi : Notion** — [E9.1 — Renommer onglet « Clients » → « Utilisateurs » dans le dashboard d'espace](https://app.notion.com/p/357d0131973c81a5b984c571aaa33b6b) · extrait le 17/09/2026 · page modifiée le 05/05/2026.
> Copie destinée à tout intervenant (développement, QA, revue, agent) : lire ce périmètre avant la partie implémentation. En cas d'écart, Notion prévaut. Le statut Notion peut retarder sur la livraison réelle, décrite plus bas.

| Epic | Sprint | Priorité | Effort | Statut Notion | Assigné à | Offre | Source | Ordre |
|---|---|---|---|---|---|---|---|---|
| E9 — Multi-tenant & gouvernance | Sprint 1 | P0 | S | Terminé | Claude code | Toutes | Demande 05/05 | — |

### Description fonctionnelle (Notion)

**En tant qu'**admin d'un espace Magrit, **je veux** que l'onglet historique « Clients » soit renommé « Utilisateurs » dans le dashboard, **afin d'**aligner la terminologie avec la nouvelle gestion des accès utilisateurs (E9.2-E9.3).

##### Contexte

Dans Beta 3, l'onglet « Clients » du dashboard désigne les contacts/clients du tenant (CRM imprimeur). Avec l'arrivée de la gestion utilisateurs par espace (E9.2), il devient « Utilisateurs » : les personnes à qui on donne accès à l'espace ou à une boutique.

##### Critères d'acceptation

- L'onglet sidebar « Clients » devient « Utilisateurs » dans toutes les Betas (B1, B2, B3).
- Route `dashboard/clients` → `dashboard/users` avec redirection 301 sur les anciens liens.
- Les contenus actuels (CRM contacts) restent accessibles dans cet onglet, agrégés avec la nouvelle gestion utilisateurs (E9.2).
- Les liens dans Sidebar, breadcrumb, navigation interne sont mis à jour.

##### Dépendances

- E9.2 (CRUD utilisateurs)
- E9.3 (droits granulaires)

##### Hors périmètre

La logique CRM « contact client » existante n'est pas supprimée — elle cohabitera dans le nouvel onglet sous une section « Contacts CRM » (à découper en story séparée si besoin).

### Cas de test fonctionnels rattachés (Notion)

| TF | Cas de test | Statut | Priorité | Parcours | Cible | Stories liées |
|---|---|---|---|---|---|---|
| [TF-5](https://app.notion.com/358d0131973c8198afcdc351f91c0166) | Premier login admin et arrivée sur l espace (chat Magrit, sidebar, page Utilisateurs) | OK | P0 — Critique | P01 — Onboarding premier login | B4 | E9.1, E9.6 |
| [TF-6](https://app.notion.com/358d0131973c812f8ed0d816c7c48f11) | Redirections de compatibilité du dashboard (/clients, /members → /users ; /profile, /preferences → /account) | OK | P1 — Importante | P01 — Onboarding premier login | B4 | E9.1 |
| [TF-7](https://app.notion.com/358d0131973c81d5b49feca4a615c1d8) | Premier login d'un user shop_only redirige vers /shop/:slug | Obsolète | P0 — Critique | P01 — Onboarding premier login | B4 | E9.1, E9.3 |
| [TF-9](https://app.notion.com/358d0131973c81f9844ec438d49b4be9) | Inviter un utilisateur Magrit (profil utilisateur + option) et activer l invitation | OK | P0 — Critique | P02 — Gestion utilisateurs | B4 | E9.1, E9.2, E9.3 |

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Implémentation — état constaté dans le dépôt

> Aucun story document d'implémentation propre à cette story n'existait au 17/09/2026. Cette partie recense ce que le dépôt en contient ; elle est à compléter par l'agent `dev-story` lorsque la story est développée.

### Fichiers du dépôt qui citent E9.1

- `SPRINT_HANDOFF.md`
