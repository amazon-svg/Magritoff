---
id: AF10
epic: EPIC-8-API-FIRST
priority: P0
status: done
branch: refactor/api-first-foundation
depends_on: [AF9]
---

# AF10 — Administration des membres via l’API

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
