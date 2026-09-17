---
id: AF26.4
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [AF26.3]
---
# AF26.4 — Déclarer la sortie workspace de QuoteTemplates

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Résultat livré

- manifeste propre au module QuoteTemplates ;
- feature et capability de gestion des gabarits du tenant ;
- route lazy et navigation « Gabarits de devis » fournies par le registre ;
- suppression de la déclaration correspondante dans `routes.tsx`.

Le module est volontairement limité à `workspace`. Les gabarits intégrés sont
consommés par les autres surfaces, mais leur gestion n’est pas une contribution
storefront, portail client ou backoffice dans le modèle fonctionnel actuel.
