---
id: UM6.5
epic: EPIC-UM-STORE-IDENTITY
status: done
branch: feat/storefront-identity-um2
depends_on: [UM6.4]
---
# UM6.5 — Consulter l'historique de sa commande boutique

- route d'historique compatible avec le cookie storefront HttpOnly ;
- autorisation exigeant le compte propriétaire et la boutique exacte ;
- exposition storefront limitée aux transitions de statut de la commande ;
- événements internes d'assignation de rôles exclus de la réponse client ;
- adresse et identifiant de l'acteur Magrit masqués côté storefront ;
- distinction conservée entre action directe du compte boutique et délégation
  Magrit grâce à `shop_customer_account_id` et `acted_by_magrit_user_id` ;
- historique complet existant conservé pour le backoffice Magrit ;
- scénario SQL couvrant l'isolation entre deux comptes, le filtrage des rôles
  et l'absence de fuite de l'identité interne.

UM6.5 termine le cycle minimal de consultation et de gestion des commandes par
le compte boutique. Les références métier vers les devis, paniers et
préférences restent à migrer dans des stories ultérieures.
