---
id: UM10.38
epic: EPIC-UM-STORE-IDENTITY
status: done
branch: feat/storefront-identity-um2
depends_on: [UM10.37]
---
# UM10.38 — Verrouiller la frontière des vues storefront

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Résultat

- les composants de la surface boutique n'importent plus le contexte des clients
  de module ;
- les hooks clients Shops, Orders, Identity et Diagnostics sont interdits dans
  les vues ;
- l'orchestration asynchrone reste portée par des hooks dédiés et testables ;
- les adaptateurs Supabase demeurent confinés à la couche d'infrastructure.

## Validation

- garde-fou transversal appliqué aux 37 composants TypeScript du storefront ;
- suite Vitest complète, typecheck et build de production.
