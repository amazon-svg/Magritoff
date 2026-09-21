---
id: AF4
epic: EPIC-8-API-FIRST
priority: P0
status: review
branch: refactor/api-first-foundation
depends_on: [AF1, AF2]
---

# AF4 — API de lecture Orders

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Objectif

Créer le premier module métier vertical API-first : contrats HTTP indépendants de PostgreSQL, service applicatif, repository Supabase exclusivement serveur et adaptateurs UI pour les listes tenant, les quatre vues portail et l audit trail.

## Critères d acceptation

1. Les modèles HTTP Orders ne réexportent aucun type Supabase ou row PostgreSQL.
2. `GET /api/v1/tenants/{tenantId}/orders` agrège les cohortes `shop_orders` et `tenant_orders`.
3. `GET /api/v1/shops/{shopId}/orders` agrège compteurs, workflow, détails et cohorte historique.
4. `GET /api/v1/orders/{orderId}/audit` normalise les événements de statut et de rôles.
5. Le repository fournisseur reste sous `src/adapters/supabase` et utilise le client RLS de l acteur.
6. `DashboardOrders`, `PortalOrders` et le helper d audit consomment le client API partagé.
7. La baseline front baisse et les contrats handler/client sont testés.

## Résultat

- module `src/modules/orders` avec contrats Zod, client, ports et service ;
- routes composées dans la fonction Edge `magrit-api` ;
- adaptateur `SupabaseOrdersRepository` côté serveur uniquement ;
- OpenAPI complété ;
- lectures UI migrées sans modifier les commandes de workflow ;
- baseline exacte : 41 fichiers importeurs et 168 appels directs, contre 42 et 175 avant AF4.

## Hors périmètre assumé

Les mutations de draft et de statut restent temporairement directes. AF5 doit les remplacer par des commandes transactionnelles et idempotentes avant leur retrait complet du front en AF7.

## Validation réalisée

- typecheck modulaire : réussi ;
- 799 tests réussis, 87 ignorés ;
- build Vite de production : réussi ;
- runtime Edge local : health 200, route protégée 401 sans acteur, lecture portail authentifiée 200 avec quatre datasets valides.
