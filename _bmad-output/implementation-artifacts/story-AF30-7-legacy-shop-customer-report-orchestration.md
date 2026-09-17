---
id: AF30.7
epic: EPIC-8-API-FIRST
priority: P2
status: done
branch: feat/storefront-identity-um2
depends_on: [AF30.6, UM7.1]
---
# AF30.7 — Isoler le rapport de migration des comptes boutique

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

| TF | Cas de test | Statut | Priorité | Parcours | Cible | Stories liées |
|---|---|---|---|---|---|---|
| [TF-149](https://app.notion.com/3c6d0131973c81e2abadd93317bda387) | UM — Connexion d un ancien accès shop_only : écran Activation boutique nécessaire, plus de redirection boutique | OK | P0 — Critique | P01 — Onboarding premier login | B5 | UM7-1, UM8-1, UM8-2, AF30-5, AF30-7 |

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Intention

`LegacyShopCustomerMigrationSection` pilote directement le client
ShopCustomers et son cycle réseau. La vue doit uniquement afficher un rapport
déjà résolu.

## Critères d'acceptation

- chargement et invalidation au changement de tenant portés par un hook ;
- réponse tardive ignorée ;
- refus ou panne masqués comme auparavant afin de ne pas révéler l'audit ;
- synthèse pending/skipped/orders extraite et testée ;
- composant sans client API ;
- tests, typecheck modulaire et build verts.

## Résultat livré

- `useLegacyShopCustomerMigrationReport` porte la requête, l'annulation logique
  et le masquage fail-closed du rapport privé ;
- `summarizeLegacyMigration` centralise les compteurs pending, skipped et
  commandes rattachées dans une fonction pure testée ;
- `LegacyShopCustomerMigrationSection` ne connaît plus le client
  ShopCustomers ;
- le garde-fou API-first vérifie la nouvelle frontière.

## Validation

- 163 fichiers de tests passés ;
- 1 217 tests passés, 0 ignoré, 0 échec ;
- typecheck modulaire et build de production passés.
