---
id: AF28.2
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [AF28.1]
---
# AF28.2 — Composer la confirmation de commande depuis Orders

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Résultat livré

- Orders déclare la route storefront existante `thank-you` ;
- `portalRuntimePaths` résout ce chemin depuis la contribution ;
- parsing et génération d'URL ne contiennent plus le littéral métier ;
- le comportement défensif reste inchangé : un chemin trop profond est
  remplacé par la confirmation canonique, et un accès direct sans identifiant
  de commande reste redirigé vers le catalogue par `PublicShop` ;
- registre, round-trip portail et garde-fou d'architecture sont testés.
