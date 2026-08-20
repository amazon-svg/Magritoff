---
id: UM2.5
epic: EPIC-UM-STORE-IDENTITY
priority: P1
status: done
branch: feat/storefront-identity-um2
depends_on: [UM2.4]
---
# UM2.5 — Exposer la connexion storefront par le BFF

## Résultat livré

- port applicatif aligné sur la transaction atomique SQL ;
- adaptateur Supabase serveur vers `api_authenticate_shop_customer` ;
- route `POST /api/v1/storefront/{shopSlug}/session` sans Bearer Magrit ;
- erreur neutre Problem Details 401 pour tout refus ;
- jeton converti en cookie `HttpOnly` et absent du JSON ;
- `Cache-Control: no-store` sur toute connexion réussie ;
- cookie `Secure` distant et repli HTTP explicite pour Supabase Docker local ;
- composition dans `magrit-api`, toujours sans `service_role`.

Le checkout n’utilise pas encore cette route : l’activation des credentials, la
lecture de session et la déconnexion doivent être livrées avant la bascule UX.
