---
id: UM10.24
epic: EPIC-UM-STORE-IDENTITY
status: done
branch: feat/storefront-identity-um2
depends_on: [UM10.23]
---
# UM10.24 — Sortir les shells workspace de l'entrée boutique

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Problème

La racine d'identité Magrit était chargée à la demande, mais le routeur
importait toujours ses principaux shells et écrans de navigation. Une visite
storefront téléchargeait donc une part importante de l'interface workspace sans
l'utiliser.

## Résultat

- `AppShell`, les layouts principal, tenant et dashboard sont chargés à la
  demande ;
- le sélecteur d'espace, le configurateur et la page 404 workspace suivent la
  même règle ;
- chaque point de montage conserve le fallback de route commun ;
- le routeur initial ne dépend plus statiquement des compositions React
  réservées à Magrit.

## Validation

- garde-fou sur l'import dynamique et le montage lazy de `AppShell` ;
- comparaison des chunks de production ;
- typecheck et suite Vitest complète.
