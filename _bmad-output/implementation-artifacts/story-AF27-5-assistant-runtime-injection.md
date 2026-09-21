---
id: AF27.5
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [AF27.4]
---
# AF27.5 — Injecter la passerelle de l'assistant

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Résultat livré

- la passerelle assistant fait partie du runtime navigateur ;
- `BrowserServicesProvider` l'expose avec les autres services applicatifs ;
- `ChatInterface` et `PortalCatalog` ne chargent plus le singleton HTTP
  concret ;
- les deux parcours continuent de demander au contrat métier la connexion SSE
  `/api/v1`, avec le jeton de la session courante ;
- un garde-fou d'architecture impose cette frontière.

AF27.7 a ensuite déplacé la lecture du flux SSE elle-même dans la passerelle.
Le hook ne conserve plus que le cycle de vie React et l'annulation.
