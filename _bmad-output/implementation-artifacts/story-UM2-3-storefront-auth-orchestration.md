---
id: UM2.3
epic: EPIC-UM-STORE-IDENTITY
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [UM2.2]
---
# UM2.3 — Orchestrer l’authentification storefront

## Résultat livré

- service métier indépendant du fournisseur d’authentification ;
- résolution obligatoire par slug de boutique puis email normalisé ;
- aucune recherche globale par email ;
- vérification factice lorsque boutique ou compte sont absents ;
- erreur identique pour compte absent, secret incorrect, verrouillage ou statut
  non actif ;
- compteur d’échec piloté par un port et remise à zéro après succès ;
- session directe de huit heures, plafonnée contractuellement à vingt-quatre ;
- validation défensive du compte, de la boutique, de l’expiration et du jeton
  opaque retournés par l’infrastructure.

## Non livré dans cette story

La route publique, l’adaptateur SQL et le cookie ne sont pas encore assemblés.
Le checkout reste sur le parcours transitoire afin de ne pas exposer une
authentification partielle.
