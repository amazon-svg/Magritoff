---
id: AF21.2
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [AF21.1]
---
# AF21.2 — Encapsuler le protocole des mockups

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Résultat livré

- port `MockupGateway` dans Shops ;
- construction des chemins de cache indépendante du fournisseur ;
- origine Storage, URL de fonction et clé publique confinées à l'adaptateur ;
- `MockupImage` consomme un blob image et conserve timeout, fallback et vues
  recto/verso ;
- la galerie administrateur consomme une URL de prévisualisation abstraite.

Ce flux reste une passerelle binaire navigateur : le cache public est tenté en
premier, puis le rendu PNG est déclenché uniquement en cas de cache miss. Une
route JSON `/api/v1` n'aurait pas été adaptée à ce protocole d'image.

## Mesures

- helpers mockups : **3 → 0** références Supabase ;
- baseline globale : **7 → 4** références ;
- fichiers importeurs : **4 → 2**.

## Validation UX attendue

Afficher un produit avec cache existant, un produit nécessitant une génération,
les vues recto et verso, un mockup custom et la galerie administrateur. En cas
d'échec du rendu, le fallback schématique doit toujours apparaître.
