---
id: AF29.9
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [AF29.8]
---
# AF29.9 — Verrouiller la composition des clients API React

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Résultat livré

- un garde-fou parcourt tout `src/app` et détecte les constructions de classes
  dont le nom se termine par `ApiClient` ;
- seuls `ApiRuntimeContext` pour le transport et `ModuleClientsContext` pour
  les façades métier peuvent contenir ces constructions ;
- toute réintroduction dans un composant, hook ou contexte métier fait échouer
  immédiatement `pnpm test:architecture`.

Les tests spécialisés par domaine restent présents pour documenter les
intentions locales. Ce verrou transversal protège aussi les futurs clients qui
ne seraient pas encore connus de la liste actuelle.
