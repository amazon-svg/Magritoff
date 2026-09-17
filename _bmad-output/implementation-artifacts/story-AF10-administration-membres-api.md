---
id: AF10
epic: EPIC-8-API-FIRST
priority: P0
status: done
branch: refactor/api-first-foundation
depends_on: [AF9]
---

# AF10 — Administration des membres via l’API

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Résultat livré

- nouveau module `members` avec contrats, client, service et repository ;
- `GET /api/v1/tenants/{tenantId}/members` ;
- changement de rôle via `PATCH .../{userId}/role` ;
- mise à jour du scope, des boutiques et permissions via `PATCH .../{userId}/access` ;
- retrait via `DELETE .../{userId}` ;
- audit exécuté dans l’adaptateur serveur avec l’opérateur dérivé du JWT ;
- protection serveur des owners, y compris contre un appel HTTP forgé ;
- `DashboardUsers.tsx` ne connaît plus Supabase et sort de la baseline brownfield.

## Sécurité et limites

Le client Supabase serveur conserve le JWT utilisateur : les politiques RLS
restent la dernière barrière. Les routes n’acceptent aucun identifiant
d’opérateur dans leur body. Les écritures et l’audit restent deux opérations
successives pendant cette tranche ; leur regroupement transactionnel pourra
être réalisé par une commande SQL dédiée.

## Validation

- tests du client API sur les quatre opérations ;
- tests des routes sur l’identité serveur et la protection owner ;
- garde-fou d’architecture interdisant le retour de Supabase dans le dashboard ;
- typecheck modulaire, suite complète et build de production.
