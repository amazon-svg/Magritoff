---
id: UM2.6
epic: EPIC-UM-STORE-IDENTITY
priority: P1
status: done
branch: feat/storefront-identity-um2
depends_on: [UM2.5]
---
# UM2.6 — Résoudre et révoquer une session storefront

## Résultat livré

- résolution d’une session depuis le hash SHA-256 du cookie opaque ;
- contrôle conjoint compte, boutique, expiration, révocation et type de session ;
- actualisation atomique de `last_seen_at` ;
- prise en charge future des délégations `delegated_only` sans autoriser une
  connexion directe sur ces comptes ;
- révocation idempotente sans révéler l’existence du jeton ;
- primitives accessibles au seul rôle d’infrastructure minimal `anon`.

Les routes GET/DELETE et l’extraction stricte du cookie seront assemblées dans
la story suivante.
