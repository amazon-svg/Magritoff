# Story S2.14 — Mockup-signature de famille comme identité catégorie

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

**Epic** : 2 (extension e-commerce) · **FR** : FR-ECOM-04 · **Sprint** : E1 · **Effort** : S
**Branche** : `beta/v5` · **Statut** : ✅ satisfaite par réutilisation + garantie testée

## Constat
La story est **majoritairement acquise par l'infra existante** (P18 v2) :
- `resolveProductMockupAsset(product)` (`src/app/utils/productMockupAssets.ts`) résout un visuel de famille pour tout produit, **fallback `flyer` garanti** → jamais de card sans visuel (AC1).
- `ShopProductCard` consomme déjà ce visuel (via `resolveProductImage`) comme identifiant visuel de catégorie (AC2, volet card).
- Le mapping `kind → template` + inférence nom/catégorie route déjà les synonymes (affiche→flyer, banner→kakemono, sticker→etiquette).

## Ce qui a été fait cette story
1. [x] Test de garantie `tests/utils/productMockupSignatureFallback.test.ts` (2/2) : URL non vide pour tout input + routage des nouvelles gammes (affiche/banderole/sticker) vers une famille valide.
2. [x] Documentation de la dépendance visuelle (backlog production mockups).

## Reste (hors code — dépendance externe)
- **Production visuelle** : quand de nouvelles gammes obtiennent leur propre mockup-signature (affiches, banderoles, enveloppes, sacs, goodies, packaging plié — cf. mémoire `project_visuels_mockups_p15_livres`), ajouter l'asset + la clé au mapping. Tant qu'elles n'en ont pas, elles routent vers une des 7 familles (dégradé acceptable).
- **AC2 volet méga-menu** : l'usage du mockup-signature dans le méga-menu relève de **S2.18** (Sprint E3).

## Risque tracé
Dépendance de production non-code (visuels par gamme). **Non bloquant** : fallback garanti (testé). À surveiller quand le catalogue s'élargit.
