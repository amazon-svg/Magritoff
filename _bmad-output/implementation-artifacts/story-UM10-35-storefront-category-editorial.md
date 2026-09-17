---
id: UM10.35
epic: EPIC-UM-STORE-IDENTITY
status: done
branch: feat/storefront-identity-um2
depends_on: [UM10.34]
---
# UM10.35 — Isoler l'éditorial de catégorie storefront

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Résultat

- `useStorefrontCategoryEditorial` devient la façade de l'enrichissement IA ;
- le slug boutique et le cookie storefront restent les seules clés d'accès ;
- le cache `sessionStorage` est centralisé par famille ;
- un timeout de douze secondes garantit le repli vers le socle déterministe ;
- `PortalCatalog` ne connaît plus le client Diagnostics.

## Validation

- garde-fous API-first et séparation storefront/workspace adaptés ;
- suite Vitest complète, typecheck et build de production.
