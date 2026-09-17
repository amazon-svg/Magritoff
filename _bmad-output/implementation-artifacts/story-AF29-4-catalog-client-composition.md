---
id: AF29.4
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [AF29.3]
---
# AF29.4 — Composer la façade Catalog dans un root unique

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Résultat livré

- `ModuleClientsProvider` crée l'unique façade Catalog de l'application ;
- le contexte PIM, l'administration PIM et la gestion des gammes actives
  consomment cette instance injectée ;
- ces écrans ne construisent plus leur propre façade à partir du transport ;
- un garde-fou d'architecture confine la construction au composition root.

Les chargements, ingestions PIM et abonnements de gammes conservent leurs
contrats existants. Le lot ne touche pas à la gestion fonctionnelle des
utilisateurs, rôles, membres ou invitations.
