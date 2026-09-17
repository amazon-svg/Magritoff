---
id: UM7.2
epic: EPIC-UM-STORE-IDENTITY
status: done
branch: feat/storefront-identity-um2
depends_on: [UM7.1]
---
# UM7.2 — Exposer le rapport de migration via l’API Magrit

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Objectif

Permettre au backoffice de contrôler la migration des anciens utilisateurs
`shop_only` sans lecture directe de Supabase depuis React et sans exposer les
tables d’audit privées.

## Résultat

- contrat partagé et strict pour chaque ligne du rapport ;
- méthode du module `shop-customers` et adaptation Supabase confinée au
  repository ;
- route authentifiée
  `GET /api/v1/tenants/{tenantId}/shop-customer-migration-report` ;
- contrôle serveur `can_manage_shop_customers` conservé dans la RPC ;
- client API disponible pour une future surface de contrôle UM7.3 ;
- aucun déclenchement de migration depuis le navigateur : le rapport reste une
  lecture d’exploitation.

## Validation

- mapping SQL vers contrat camelCase ;
- test serveur/client sur une ligne auditée ;
- scénario SQL du rapport avec capability explicite ;
- typecheck et tests de frontières API.
