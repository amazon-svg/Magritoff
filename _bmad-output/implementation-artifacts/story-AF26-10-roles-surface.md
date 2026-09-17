---
id: AF26.10
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [AF26.9]
---
# AF26.10 — Déclarer la sortie workspace de Roles

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Résultat livré

- manifeste du module Roles, adossé au service API existant ;
- feature et capability d'administration du workflow de commande ;
- route lazy et navigation « Workflow & rôles » fournies par le registre ;
- suppression de la déclaration correspondante dans `routes.tsx`.

Le module est limité au `workspace`. La capability déclarative documente le
contrat de composition ; la garde historique `can_manage_roles` reste appliquée
par l'écran et la navigation pendant la migration progressive des autorisations.
