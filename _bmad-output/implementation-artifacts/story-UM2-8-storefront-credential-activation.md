---
id: UM2.8
epic: EPIC-UM-STORE-IDENTITY
status: done
branch: feat/storefront-identity-um2
depends_on: [UM2.7]
---
# UM2.8 — Activer un credential boutique par jeton

- jeton aléatoire 256 bits, seul son SHA-256 est conservé ;
- émission réservée aux utilisateurs Magrit avec `can_manage_shop_customers` ;
- durée bornée entre quinze minutes et sept jours ;
- un seul jeton actif par compte ;
- activation publique neutre, à usage unique et protégée par vérification factice ;
- mot de passe `bcrypt-sha256-v1`, versionné et remplaçable ;
- passage atomique du compte à `active` et révocation des anciennes sessions.

UM3 branchera l’envoi email et le lien d’activation sur ces primitives.
