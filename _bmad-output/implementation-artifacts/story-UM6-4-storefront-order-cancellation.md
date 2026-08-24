---
id: UM6.4
epic: EPIC-UM-STORE-IDENTITY
status: done
branch: feat/storefront-identity-um2
depends_on: [UM6.3]
---
# UM6.4 — Annuler une commande depuis le compte boutique

- route de transition compatible avec le cookie storefront HttpOnly ;
- autorisation du propriétaire boutique limitée à `draft → cancelled` ;
- refus explicite des transitions internes de validation, production,
  expédition, livraison et facturation ;
- maintien intégral de la primitive Magrit et de ses capabilities pour les
  autres transitions ;
- événement de statut portant `shop_customer_account_id` ;
- `acted_by_magrit_user_id` renseigné uniquement en délégation et aucun faux
  `actor_id` pour une session client directe ;
- reçus d'idempotence d'annulation isolés par compte boutique ;
- notification de transition conservée en best effort, avec acteur Magrit
  nullable pour une action directe ;
- scénario SQL couvrant refus de validation, annulation, audit et rejeu.

UM6.4 ferme le cycle commande minimal du storefront. La lecture de l'historique
d'audit par le client et les références devis/paniers/préférences restent hors
de cette story.
