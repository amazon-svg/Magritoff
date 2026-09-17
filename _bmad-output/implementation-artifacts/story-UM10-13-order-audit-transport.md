---
id: UM10.13
epic: EPIC-UM-STORE-IDENTITY
status: done
branch: feat/storefront-identity-um2
depends_on: [UM6.5, UM10.4]
---
# UM10.13 — Injecter explicitement le transport d’audit commande

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Problème

La modale d’historique de commande acceptait un client Orders facultatif, mais
appelait toujours le hook workspace Magrit pour construire son fallback. Une
surface storefront correctement configurée n’envoyait pas de bearer Magrit,
mais restait néanmoins couplée au contexte authentifié du backoffice.

## Résultat

- `OrderAuditTrailModal` exige désormais un `OrdersApiClient` explicite ;
- `OrderHistoryTable` propage ce port obligatoire ;
- le portail injecte son client storefront fondé sur le cookie HttpOnly ;
- le dashboard injecte séparément son client workspace avec bearer Magrit ;
- aucun composant d’audit partagé ne choisit implicitement une identité.

## Validation

- garde-fou d’architecture contre le retour de `useOrdersApi` dans la modale ;
- vérification des deux injections storefront et dashboard ;
- typecheck et suite Vitest complète.
