---
id: UM6.2
epic: EPIC-UM-STORE-IDENTITY
status: done
branch: feat/storefront-identity-um2
depends_on: [UM6.1]
---
# UM6.2 — Consulter ses commandes depuis le portail boutique

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

- route portail compatible avec la session storefront HttpOnly ;
- validation du cookie côté BFF puis dans une primitive SQL `SECURITY DEFINER`
  étroite ;
- filtrage simultané sur `shop_id` et `shop_customer_account_id` ;
- retour limité aux cent dernières commandes du compte ;
- aucun rôle Magrit implicite : seul l'onglet `mine` est alimenté, les vues de
  validation, approbation et production restent vides ;
- hub « Mon compte » et bandeau de dernière commande activés par la session
  storefront, sans dépendre d'un utilisateur Supabase Auth ;
- maintien sans changement du portail Magrit historique et de ses rôles ;
- exclusion volontaire des commandes legacy non encore rattachées à un compte ;
- test SQL avec deux comptes de la même boutique démontrant l'absence de fuite.

Cette story couvre la liste du portail. L'ouverture, l'édition et les actions
sur une commande restent protégées par l'ancien créateur Magrit et seront
migrées dans UM6.3.
