---
id: AF29.2
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [AF29.1]
---
# AF29.2 — Composer les façades Shops dans un root unique

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Résultat livré

- la façade Shops de la session courante est créée dans
  `ModuleClientsProvider` ;
- éditeur, visuels, contexte boutique, storefront, catalogue, redirection et
  acceptation d'invitation consomment cette instance partagée ;
- le checkout demande au composition root une façade liée au jeton tout juste
  obtenu après identification ;
- le checkout ne connaît plus `ShopsApiClient` ni la fabrique de transport ;
- toutes les constructions Shops sont confinées à `ModuleClientsContext` ;
- un garde-fou couvre la façade courante et le cas post-authentification.

Cette distinction conserve le correctif fonctionnel des parcours où la session
React n'a pas encore reçu le nouveau jeton, sans disperser de nouveau la
composition HTTP dans les composants.
