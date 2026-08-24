---
id: UM2.7
epic: EPIC-UM-STORE-IDENTITY
status: done
branch: feat/storefront-identity-um2
depends_on: [UM2.6]
---
# UM2.7 — Lire et fermer la session storefront

- extraction stricte du cookie selon la politique locale ou sécurisée ;
- `GET /api/v1/storefront/session/current` avec réponse sans cache ;
- `DELETE /api/v1/storefront/session/current` idempotent ;
- révocation serveur avant effacement systématique du cookie ;
- adaptateur Supabase des primitives UM2.6 ;
- support contractuel des sessions directes et déléguées.

Le checkout reste inchangé jusqu’à la livraison du parcours d’activation.
