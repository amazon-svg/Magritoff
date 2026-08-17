---
id: UM6.7
epic: EPIC-UM-STORE-IDENTITY
status: done
branch: feat/storefront-identity-um2
depends_on: [UM6.6]
---
# UM6.7 — Ne pas confondre panne API et absence d'espace

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
