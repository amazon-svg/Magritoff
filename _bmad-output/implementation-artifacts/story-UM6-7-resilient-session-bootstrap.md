---
id: UM6.7
epic: EPIC-UM-STORE-IDENTITY
status: done
branch: feat/storefront-identity-um2
depends_on: [UM6.6]
---
# UM6.7 — Ne pas confondre panne API et absence d'espace

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

- propagation explicite de l'erreur du bootstrap session dans le contexte
  tenant ;
- priorité de l'état d'erreur sur la branche métier `tenants.length === 0` ;
- aucune redirection vers `/tenants/new` quand `/api/v1/session` est
  temporairement indisponible ;
- écran neutre confirmant que la session reste active ;
- bouton de rejeu du bootstrap sans reconnexion ni création d'espace ;
- garde identique sur le sélecteur et les routes tenant ;
- diagnostic local documenté par la disparition du conteneur Edge Runtime,
  produisant des 503 Kong non conformes au contrat Problem Details.

Le démarrage du développement local doit inclure l'Edge Runtime dès que le
proxy Vite cible `functions/v1/magrit-api`.
