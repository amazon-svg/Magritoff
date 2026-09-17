---
id: AF30.11
epic: EPIC-8-API-FIRST
priority: P2
status: done
branch: feat/storefront-identity-um2
depends_on: [AF30.10]
---
# AF30.11 — Isoler les diagnostics de plateforme

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Intention

`DiagnosticPanel` pilote directement les appels Diagnostics Clariprint et IA.
La modale doit seulement afficher les résultats résolus et déclencher les tests.

## Critères d'acceptation

- états Clariprint et IA portés par un hook ;
- commandes Diagnostics absentes de la modale ;
- résultats tardifs ignorés après fermeture ;
- format des erreurs visible conservé ;
- composant sans client Diagnostics ;
- garde-fou d'architecture, tests, typecheck modulaire et build verts.

## Résultat livré

- `usePlatformDiagnostics` porte les deux commandes Diagnostics et leurs états
  indépendants ;
- les résultats tardifs sont ignorés après fermeture de la modale ;
- le format historique des erreurs réseau reste inchangé ;
- le garde-fou API-first interdit le retour du client Diagnostics dans la vue.

## Validation

- 167 fichiers de tests passés ;
- 1 227 tests passés, 0 ignoré, 0 échec avec deux workers afin de ne pas saturer
  le PostgreSQL Docker local ;
- typecheck modulaire et build de production passés.
