---
id: AF31.1
epic: EPIC-8-API-FIRST
priority: P2
status: done
branch: feat/storefront-identity-um2
depends_on: [AF30.16]
---

# AF31.1 — Isoler les opérations de l’éditeur boutique

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Intention

`DashboardShopEditor` pilotait encore directement le client Shops pour charger
les produits et les tarifs négociés, téléverser le logo ou le fond de marque et
enregistrer un prix spécifique. La vue doit conserver uniquement le formulaire,
les onglets catalogue et les interactions de sélection de fichiers.

## Résultat

- `useShopEditorOperations` porte le chargement conjoint produits/tarifs ;
- les réponses tardives sont ignorées après changement de boutique ;
- la validation et le téléversement des assets de marque sont isolés ;
- les écritures de tarifs négociés mettent à jour un état local cohérent ;
- les erreurs de chargement, d’upload et de prix deviennent visibles dans la vue ;
- `DashboardShopEditor` ne connaît plus `ShopsApiClient` ni son fournisseur.

## Validation

- tests unitaires des transformations, de l’indexation et de la validation fichier ;
- garde-fou API-first composant/hook ;
- 172 fichiers et 1 246 tests passés ;
- typecheck modulaire et build de production passés.
