---
id: UM6.1
epic: EPIC-UM-STORE-IDENTITY
status: done
branch: feat/storefront-identity-um2
depends_on: [UM5.3]
---
# UM6.1 — Rattacher la création de commande au compte boutique

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

- route de création Orders ouverte à une session storefront HttpOnly valide ;
- validation du cookie côté BFF puis nouvelle validation atomique dans
  PostgreSQL avant toute écriture ;
- correspondance stricte entre la boutique de la session et celle du checkout ;
- ajout de `shop_customer_account_id` sur la commande ;
- conservation séparée de `acted_by_magrit_user_id` pour une délégation ;
- commandes directes sans faux utilisateur Magrit dans `created_by` ;
- reçus d'idempotence storefront isolés par compte boutique ;
- maintien du parcours historique Magrit et de sa primitive SQL existante ;
- tests de route, d'architecture et scénario SQL transactionnel.

Cette story migre uniquement la création initiale. La lecture du portail,
l'édition du brouillon, les transitions et les audits doivent encore être
alignés sur `shop_customer_account_id` dans les stories UM6 suivantes.
