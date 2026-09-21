---
id: UM0.1
epic: EPIC-UM-STORE-IDENTITY
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: []
---
# UM0.1 — Verrouiller les contrats d’identité boutique

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Résultat livré

- ADR distinguant utilisateur Magrit, client boutique et délégation ;
- module `shop-customers` séparé de `members` ;
- contrat d’unicité `(shop_id, normalized_email)` ;
- contrats de session directe et déléguée ;
- contrat de l’action unifiée sans mot de passe ni jeton dans le JSON ;
- manifeste multi-surface avec capability dédiée à la délégation ;
- tests des invariants d’identité, d’isolation par boutique et de secret.

Aucune route, table ou migration destructive n’est activée dans cette story.
