---
id: UM0.1
epic: EPIC-UM-STORE-IDENTITY
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: []
---
# UM0.1 — Verrouiller les contrats d’identité boutique

## Résultat livré

- ADR distinguant utilisateur Magrit, client boutique et délégation ;
- module `shop-customers` séparé de `members` ;
- contrat d’unicité `(shop_id, normalized_email)` ;
- contrats de session directe et déléguée ;
- contrat de l’action unifiée sans mot de passe ni jeton dans le JSON ;
- manifeste multi-surface avec capability dédiée à la délégation ;
- tests des invariants d’identité, d’isolation par boutique et de secret.

Aucune route, table ou migration destructive n’est activée dans cette story.
