---
id: AF25.4
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [AF25.3]
---
# AF25.4 — Confinement des transports à jeton fraîchement obtenu

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Résultat livré

`ApiRuntimeContext` expose désormais deux usages :

- `client`, transport partagé suivant la session React courante ;
- `forAccessToken(token)`, transport ponctuel pour une commande exécutée
  immédiatement après connexion, inscription ou renouvellement.

Le checkout et l’envoi d’invitation utilisent cette fabrique. Ils ne
connaissent plus `FetchApiClient`, `globalThis.fetch` ni la stratégie de
construction HTTP.

## Invariant atteint

`ApiRuntimeContext.tsx` est l’unique fichier de `src/app` autorisé à construire
un `FetchApiClient`. Le test d’architecture parcourt toute l’UI et échoue dès
qu’une seconde composition du transport apparaît.
