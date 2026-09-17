---
id: UM10.9
epic: EPIC-UM-STORE-IDENTITY
status: done
branch: feat/storefront-identity-um2
depends_on: [UM10.2, UM10.7]
---
# UM10.9 — Injecter la fiscalité dans le configurateur storefront

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Problème

Le panier, le checkout et la fiche produit utilisaient déjà le régime fiscal du
catalogue public, mais le moteur partagé `useProductConfigurator` consultait
encore `TenantContext`. L’overlay et la page gamme pouvaient donc calculer le TTC
avec l’espace Magrit courant plutôt qu’avec la boutique visitée.

## Résultat

- le configurateur reçoit désormais un taux explicite et ne lit plus
  `TenantContext` ;
- `PublicShop` propage le taux du contrat `PublicShopCatalog` au catalogue, à
  l’overlay et à la page gamme ;
- l’atelier Magrit transmet séparément le taux de son tenant ;
- le taux métropole reste un fallback défensif pour les appels hors contexte.

## Validation

- garde-fou fiscal étendu à tous les composants de configuration boutique ;
- tests purs du configurateur et tests d’architecture ;
- typecheck, suite Vitest et build de production.
