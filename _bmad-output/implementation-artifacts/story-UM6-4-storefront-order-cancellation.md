---
id: UM6.4
epic: EPIC-UM-STORE-IDENTITY
status: done
branch: feat/storefront-identity-um2
depends_on: [UM6.3]
---
# UM6.4 — Annuler une commande depuis le compte boutique

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

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
