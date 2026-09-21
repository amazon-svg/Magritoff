---
id: UM10.32
epic: EPIC-UM-STORE-IDENTITY
status: done
branch: feat/storefront-identity-um2
depends_on: [UM10.31]
---
# UM10.32 — Isoler la liste des commandes storefront

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Résultat

- `useStorefrontOrderList` charge exclusivement le dataset `mine` du compte ;
- la façade gère chargement, erreur, rechargement et annulation propriétaire ;
- l'annulation conserve sa clé d'idempotence et sa traduction d'erreur ;
- `PortalOrders` ne connaît plus le client HTTP et se limite au rendu et aux
  dialogues de sélection ;
- aucune action de validation, production ou expédition Magrit n'est exposée.

## Validation

- garde-fous d'architecture du portail Orders adaptés à la nouvelle frontière ;
- suite Vitest complète, typecheck et build de production.
