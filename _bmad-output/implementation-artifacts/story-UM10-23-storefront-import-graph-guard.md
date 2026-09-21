---
id: UM10.23
epic: EPIC-UM-STORE-IDENTITY
status: done
branch: feat/storefront-identity-um2
depends_on: [UM10.22]
---
# UM10.23 — Verrouiller le graphe d'import storefront

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Problème

Les contrôles précédents vérifiaient surtout les fichiers de composition pris
isolément. Un réexport ou un import indirect pouvait réintroduire un adaptateur
Supabase dans la racine storefront sans laisser de référence visible dans la
frontière de route.

## Résultat

- un test parcourt récursivement les imports et réexports statiques TypeScript
  depuis `StorefrontRuntimeBoundary` ;
- les imports exclusivement typés sont ignorés comme ils le sont au build ;
- le graphe doit contenir la racine storefront dédiée ;
- le runtime workspace et tous les fichiers `adapters/supabase` sont interdits
  dans ce graphe.

## Validation

- test d'architecture dédié ;
- vérification du build : les marqueurs Supabase/GoTrue restent confinés au
  chunk `WorkspaceRuntimeBoundary` ;
- typecheck et suite Vitest complète.
