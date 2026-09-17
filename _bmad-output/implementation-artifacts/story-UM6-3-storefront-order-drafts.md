---
id: UM6.3
epic: EPIC-UM-STORE-IDENTITY
status: done
branch: feat/storefront-identity-um2
depends_on: [UM6.2]
---
# UM6.3 — Lire et modifier ses brouillons boutique

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

- routes de détail et d'édition compatibles avec le cookie storefront HttpOnly ;
- contexte serveur conservant séparément cookie boutique et session Magrit ;
- autorisation SQL si le compte et la boutique de la session correspondent à
  la commande, sinon repli strict sur le créateur Magrit ;
- aucun ordre de priorité ne permet à un cookie d'élargir les droits Magrit ou
  inversement ;
- édition limitée au statut `draft`, aux lignes appartenant réellement à la
  commande et à des quantités/prix valides ;
- reçus d'idempotence d'édition isolés par compte boutique ;
- maintien des primitives historiques Magrit ;
- scénario SQL prouvant qu'un second compte de la même boutique ne peut lire le
  brouillon du premier.

Les transitions de workflow, dont l'annulation, restent encore basées sur les
rôles Magrit. Leur adaptation au propriétaire boutique est prévue dans UM6.4.
