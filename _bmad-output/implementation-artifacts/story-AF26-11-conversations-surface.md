---
id: AF26.11
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [AF26.10]
---
# AF26.11 — Déclarer la sortie workspace de Conversations

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Résultat livré

- manifeste du module Conversations, adossé au service API existant ;
- feature et capability de consultation de l'historique tenant ;
- route lazy et navigation « Historique » fournies par le registre ;
- suppression de la déclaration correspondante dans `routes.tsx`.

Cette tranche expose uniquement l'historique dans le `workspace`. La surface de
conversation principale reste pour l'instant dans le configurateur tenant et
sera composée séparément lorsque cette surface applicative aura un contrat
explicite dans le registre.
