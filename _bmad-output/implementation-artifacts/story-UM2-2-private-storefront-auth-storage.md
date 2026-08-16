---
id: UM2.2
epic: EPIC-UM-STORE-IDENTITY
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [UM2.1]
---
# UM2.2 — Isoler le stockage d’authentification storefront

## Résultat livré

- schéma PostgreSQL `private`, non exposé à PostgREST ;
- credentials par compte boutique avec schéma versionné `bcrypt-sha256-v1` ;
- compteur d’échecs et verrouillage temporel prévus dans le modèle ;
- sessions par compte et boutique avec hash SHA-256 du jeton opaque ;
- contrainte composite empêchant une session de changer de boutique ;
- modèle direct/délégué conservant l’acteur Magrit pour la suite UM5 ;
- RLS default-deny et absence de grants `anon`/`authenticated` ;
- aucune clé `service_role` ajoutée à `magrit-api`.

## Non livré dans cette story

Les fonctions d’activation, de vérification et d’émission de session restent
fermées. Elles devront être exposées par des primitives étroites, avec limitation
des tentatives, messages neutres et rotation du jeton dans UM2.3. Le SHA-256
préalable évite la limite de longueur bcrypt tout en conservant le hash final dans
le schéma privé.
