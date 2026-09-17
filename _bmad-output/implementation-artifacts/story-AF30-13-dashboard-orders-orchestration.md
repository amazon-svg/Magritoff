---
id: AF30.13
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: feat/storefront-identity-um2
depends_on: [AF30.12]
---
# AF30.13 — Isoler l'orchestration des commandes dashboard

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Intention

`DashboardOrders` pilote directement la lecture agrégée et toutes les
transitions Orders. L'écran doit conserver uniquement permissions, modales et
présentation des boutiques.

## Critères d'acceptation

- lecture multi-boutiques portée par un hook ;
- annulation, validation, production et expédition portées par le hook ;
- idempotence des transitions conservée ;
- résultats tardifs neutralisés après changement d'espace ou de boutiques ;
- API d'audit transmise explicitement à la table ;
- composant sans client Orders ;
- garde-fou d'architecture, tests, typecheck modulaire et build verts.

## Résultat livré

- `useDashboardOrderManagement` porte lecture multi-boutiques, normalisation UI
  et transitions Orders ;
- les clés d'idempotence restent stables et testées ;
- les rechargements tardifs sont neutralisés après changement de périmètre ou
  démontage ;
- la vue conserve permissions, modales, libellés boutique et API d'audit ;
- le garde-fou API-first interdit le retour du client Orders dans l'écran.

## Validation

- 168 fichiers de tests passés ;
- 1 229 tests passés, 0 ignoré, 0 échec ;
- typecheck modulaire et build de production passés.
