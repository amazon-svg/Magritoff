---
id: AF30.2
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: feat/storefront-identity-um2
depends_on: [AF30.1]
---
# AF30.2 — Isoler l'orchestration des sous-espaces

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

| TF | Cas de test | Statut | Priorité | Parcours | Cible | Stories liées |
|---|---|---|---|---|---|---|
| [TF-157](https://app.notion.com/3c6d0131973c81d38eeef3f8682763d5) | UM — Sous-espaces : seul un admin du parent hérite ; un utilisateur avec options n hérite de rien | OK | P1 — Importante | P03 — Droits granulaires | B5 | UM1 §2.5, migration 20260824000500 (is_subtenant_member_inherited), AF30-2 |

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Résultat livré

- `useSubTenantManagement` porte chargement, création, suppression et états
  réseau des sous-espaces ;
- `DashboardTenantSpaces` ne connaît plus le client Session et conserve la
  présentation, les droits et la confirmation destructive ;
- la normalisation du slug est centralisée et couverte par des tests ;
- le changement de tenant réinitialise le formulaire et invalide les lectures
  en vol ;
- une réponse tardive de création ou suppression ne peut pas modifier l'écran
  d'un autre tenant.

## Validation

- tests de normalisation et garde-fou API-first adaptés ;
- suite Vitest complète, typecheck et build de production.
