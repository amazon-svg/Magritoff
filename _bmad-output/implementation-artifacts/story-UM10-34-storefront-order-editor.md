---
id: UM10.34
epic: EPIC-UM-STORE-IDENTITY
status: done
branch: feat/storefront-identity-um2
depends_on: [UM10.33]
---
# UM10.34 — Isoler l'éditeur de commande storefront

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Résultat

- `useStorefrontOrderEditor` charge le brouillon et annule les lectures obsolètes ;
- quantités, prix, suppressions et total HT sont gérés dans la fonctionnalité ;
- la sauvegarde atomique conserve sa clé d'idempotence et ses erreurs métier ;
- `PortalOrderEditor` devient un dialogue de rendu sans accès au client Orders ;
- aucune identité Magrit ou Supabase Auth n'est introduite dans ce parcours.

## Validation

- garde-fous d'architecture sur le transport storefront ;
- suite Vitest complète, typecheck et build de production.
