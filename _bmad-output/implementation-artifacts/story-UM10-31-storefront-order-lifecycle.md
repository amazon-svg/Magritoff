---
id: UM10.31
epic: EPIC-UM-STORE-IDENTITY
status: done
branch: feat/storefront-identity-um2
depends_on: [UM10.30]
---
# UM10.31 — Isoler le cycle commandes du storefront

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Problème

La surface `PublicShop` pilotait encore directement le client Orders : lecture
de la dernière commande, renouvellement du panier, création atomique,
idempotence, classification de permission et remise à zéro au changement de
boutique. Ce mélange empêchait une séparation nette entre vue et fonctionnalité.

## Résultat

- `useStorefrontOrderLifecycle` devient la façade React des commandes de la
  boutique ;
- la session utilisée reste exclusivement la session storefront portée par le
  cookie HttpOnly, jamais le bearer Magrit ;
- la dernière commande est chargée avec annulation à la destruction ;
- le renouvellement reconstruit le panier via le helper métier existant ;
- la création conserve commande atomique, prix résolu côté panier et clé
  d'idempotence renouvelée après succès ;
- états de confirmation, avertissements et idempotence sont réinitialisés à
  chaque changement de slug ;
- `PublicShop` ne dépend plus directement de `useStorefrontOrdersApi`.

## Validation

- garde-fous d'architecture déplacés vers la nouvelle façade ;
- tests ciblés du submit, de l'isolation par boutique et du transport anonyme ;
- typecheck, suite Vitest complète et build de production.
