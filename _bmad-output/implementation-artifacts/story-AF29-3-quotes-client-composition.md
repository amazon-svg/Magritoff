---
id: AF29.3
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [AF29.2]
---
# AF29.3 — Composer les façades Quotes dans un root unique

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Résultat livré

- les façades Quotes et QuoteTemplates sont créées une seule fois dans
  `ModuleClientsProvider` avec le transport authentifié partagé ;
- le panier, la modale d'impression et les contextes devis consomment ces
  instances injectées ;
- les composants React ne connaissent plus les constructeurs de ces modules ;
- un garde-fou d'architecture confine leurs constructions au composition root.

Les parcours de création, impression, édition et gestion des modèles conservent
leurs contrats métier et HTTP existants. Cette étape ne modifie que la
composition des dépendances.
