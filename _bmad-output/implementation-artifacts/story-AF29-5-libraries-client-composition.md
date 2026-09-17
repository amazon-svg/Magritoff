---
id: AF29.5
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [AF29.4]
---
# AF29.5 — Composer les façades Libraries dans un root unique

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Résultat livré

- les façades Libraries et LibraryProducts sont créées dans
  `ModuleClientsProvider` avec le transport partagé ;
- `LibraryContext` reçoit les deux instances via des hooks dédiés ;
- le contexte ne construit plus directement de client de module ;
- un garde-fou confine les deux constructeurs au composition root.

Le CRUD des bibliothèques, les opérations bulk et la génération de produits
depuis le PIM conservent leurs contrats et comportements existants.
