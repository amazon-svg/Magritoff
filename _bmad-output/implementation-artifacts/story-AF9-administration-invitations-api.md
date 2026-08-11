---
id: AF9
epic: EPIC-8-API-FIRST
priority: P0
status: done
branch: refactor/api-first-foundation
depends_on: [AF8]
---

# AF9 — Administration des invitations via l’API

## Résultat livré

- `GET /api/v1/tenants/{tenantId}/invitation-options` pour les rôles et
  boutiques proposés par la modale ;
- `GET /api/v1/tenants/{tenantId}/invitations` pour les invitations en attente ;
- `POST /api/v1/invitations/{invitationId}/resend` pour le renvoi ;
- `DELETE /api/v1/invitations/{invitationId}` pour la révocation auditée ;
- contrats camelCase indépendants du schéma PostgreSQL ;
- contrôle de visibilité RLS avant tout renvoi utilisant l’adaptateur legacy ;
- suppression dans l’UI des noms de tables et de l’Edge Function de renvoi ;
- baseline abaissée de 10 à 5 références dans `DashboardUsers` depuis AF8 et
  de 2 à 0 dans `InviteUserModalV2` (l’import Auth transitoire reste présent).

## Sécurité

Le serveur utilise le client Supabase porté par le JWT utilisateur. La RLS
réserve lecture et suppression aux owner/admin du tenant ou au super-admin.
Le renvoi vérifie d’abord que l’invitation est visible avant de déléguer à
l’ancienne fonction d’email utilisant le service role.

## Dette suivante

- internaliser l’envoi Resend et supprimer les appels Edge imbriqués ;
- migrer le CRUD des membres et son audit ;
- sortir le rafraîchissement Auth Supabase restant de la modale.

## Validation

- tests des quatre opérations du client API ;
- tests des routes, de l’identité serveur et des paramètres de chemin ;
- garde-fous d’architecture sur les tables et Edge Functions retirées de l’UI ;
- typecheck modulaire, suite complète et build de production.
