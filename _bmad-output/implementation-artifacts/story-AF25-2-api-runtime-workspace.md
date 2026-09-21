---
id: AF25.2
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [AF25.1]
---
# AF25.2 — Injecter le runtime API dans workspace et backoffice

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Résultat livré

- migration des dashboards tenant, commandes, boutiques, PIM, gammes,
  utilisateurs, rôles et règles commerciales ;
- migration des hooks de rôles de commande et de capabilities ;
- migration du panneau de diagnostic ;
- suppression des lectures de session devenues inutiles dans ces composants ;
- les clients fonctionnels continuent d’appartenir à leurs modules, mais
  reçoivent tous le transport du composition root React.

## Exception bornée

`InviteUserModalV2` reconstruit encore un transport après
`refreshSession()`. Ce chemin garantit que la commande d’invitation part avec
le jeton fraîchement renouvelé sans attendre un nouveau rendu React. Il est
désormais l’unique construction directe autorisée dans workspace et fera
l’objet d’une évolution du runtime (`withAccessToken` ou rotation interne) dans
un lot dédié.

Un garde-fou d’architecture fige cette exception à un seul fichier.
