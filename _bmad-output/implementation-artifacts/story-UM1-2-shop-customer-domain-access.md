---
id: UM1.2
epic: EPIC-UM-STORE-IDENTITY
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [UM1.1]
---
# UM1.2 — Domaine et accès workspace des comptes boutique

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Résultat livré

- port repository et service `ShopCustomersService` sans dépendance Supabase ;
- création métier normalisée et détection de doublon limitée à une boutique ;
- capabilities `can_manage_shop_customers` et
  `can_impersonate_shop_customer` pour Owner/Admin ;
- conservation de ces capabilities lors de l’édition d’un rôle canonique ;
- policies RLS scopées par `shop_id → tenant_id` ;
- droits d’écriture limités aux colonnes métier, sans mutation possible du
  `shop_id` ni de l’identité Auth technique ;
- aucun accès `anon`, aucune suppression et aucun accès storefront direct.

Les routes HTTP et l’adaptateur Supabase ne sont pas encore activés. Ils feront
l’objet du prochain incrément avec tests de repository et erreurs HTTP.
