---
id: AF25.1
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [AF24.5]
---
# AF25.1 — Centraliser le runtime API des contextes React

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Problème

Chaque contexte reconstruisait un `FetchApiClient`, accédait à la session et
recâblait le jeton. La configuration du transport était ainsi dispersée dans
les modules d’état globaux et difficile à remplacer par surface.

## Résultat livré

- `ApiRuntimeProvider` est monté sous `AuthProvider` et au-dessus des providers
  fonctionnels ;
- une seule instance de transport same-origin est créée par session ;
- Session, PIM, Conversations, Libraries, produits de bibliothèque, Shops,
  Quotes et QuoteTemplates utilisent le transport injecté ;
- les clients métier restent définis dans leurs modules respectifs ;
- un garde-fou interdit désormais `new FetchApiClient` dans tous les autres
  contextes React.

Cette étape ne fusionne pas les contextes et ne change aucun parcours UX. Elle
prépare un composition root distinct pour chaque surface tout en gardant un
transport commun et remplaçable.
