---
id: UM2.9
epic: EPIC-UM-STORE-IDENTITY
status: done
branch: feat/storefront-identity-um2
depends_on: [UM2.8]
---
# UM2.9 — Exposer l’activation d’un credential boutique

- commande workspace authentifiée pour générer un jeton d’activation ;
- autorisation `can_manage_shop_customers` conservée dans la primitive SQL ;
- jeton renvoyé explicitement afin de permettre une transmission manuelle ;
- aucun envoi d’email annoncé tant que le port de notification UM3 n’est pas branché ;
- activation publique par jeton avec mot de passe ; à compter de UM2.11, cette
  activation émet aussi la première session storefront ;
- réponse d’échec neutre pour ne pas distinguer jeton inconnu, expiré ou déjà utilisé ;
- réponses et secrets marqués `Cache-Control: no-store`.

## Routes

- `POST /api/v1/tenants/{tenantId}/shops/{shopId}/customers/{customerId}/activation`
- `POST /api/v1/storefront/activation`

Le checkout et l’écran d’activation restent hors de cette story. UM3 pourra
consommer la première route pour envoyer un lien, sans déplacer l’émission du
jeton vers le fournisseur d’email.
