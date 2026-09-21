---
id: AF29.1
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [AF28.2]
---
# AF29.1 — Composer une façade Orders unique dans le front

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Constat

Le transport `/api/v1` était déjà partagé, mais sept composants et hooks
construisaient séparément `OrdersApiClient`. Cette répétition dispersait le
choix de la façade du module dans les surfaces workspace, storefront et portail
client.

## Résultat livré

- `ModuleClientsProvider` devient le composition root des clients de modules ;
- une instance Orders est créée pour le transport authentifié courant ;
- dashboard Commandes, boutique, historique, confirmation, édition, audit et
  hook de rôles reçoivent tous cette même façade ;
- les composants conservent exactement les mêmes appels métier ;
- un garde-fou interdit toute autre construction de `OrdersApiClient` dans
  `src/app`.

## Suite

Étendre progressivement ce composition root aux autres clients de modules en
commençant par Shops, très présent dans le storefront et ses paramètres. Les
clients à jeton ponctuel après authentification restent des cas explicites à
traiter séparément.
