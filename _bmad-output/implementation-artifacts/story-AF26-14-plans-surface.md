---
id: AF26.14
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [AF26.13]
---
# AF26.14 — Déclarer la sortie workspace de Plans

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Résultat livré

- nouveau manifeste `plans` ;
- feature de consultation et sélection du plan fonctionnel courant ;
- route lazy et navigation « Plan & abonnement » fournies par le registre ;
- suppression de la dernière route écran workspace codée dans `routes.tsx`.

## Limite fonctionnelle explicite

La page actuelle modifie une préférence utilisateur via l'API de session. Elle
ne constitue pas encore un abonnement tenant, ne déclenche aucun paiement et
ne porte aucun cycle de facturation. Le registre décrit donc le sélecteur
existant sans lui attribuer une capability de billing inexistante. Un véritable
module Subscriptions devra remplacer ce mécanisme avant commercialisation.
