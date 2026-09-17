---
id: AF26.1
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [AF25.4]
---
# AF26.1 — Déclarer les sorties multi-surfaces du module Orders

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

| TF | Cas de test | Statut | Priorité | Parcours | Cible | Stories liées |
|---|---|---|---|---|---|---|
| [TF-146](https://app.notion.com/3c6d0131973c8175bb95f8df989be5eb) | UM — Option Commandes : accès à l écran Commandes et aux transitions ; sans option, aucune lecture | En cours | P0 — Critique | P03 — Droits granulaires | B5 | UM1 §1.3, migration 20260824000400 (can_manage_tenant_orders), AF26-1 |

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Résultat livré

Le module Orders déclare désormais ses fonctionnalités et capabilities sans
dépendance React :

- storefront : checkout, monté par l’hôte boutique ;
- customer portal : historique des commandes du client, monté par l’hôte ;
- workspace : gestion des commandes du tenant, route lazy du router ;
- backoffice : pilotage production et transitions, prêt pour un composition
  root backoffice dédié.

La route `/dashboard/orders` n’est plus déclarée manuellement dans
`routes.tsx`. Elle provient de `ordersWorkspaceContribution` et son composant
est résolu dans `workspaceRuntimeRoutes`, comme le module Account.

## Limite volontaire

Les vues storefront et portail restent orchestrées dans `PublicShop` : leur
contribution est déclarative avec `mount: host`. Le backoffice est déclaré mais
pas encore monté par une application distincte. Ces déclarations fixent le
contrat d’insertion avant la séparation physique des hôtes.
