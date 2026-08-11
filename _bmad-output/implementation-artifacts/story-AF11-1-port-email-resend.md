---
id: AF11.1
epic: EPIC-8-API-FIRST
priority: P0
status: done
branch: refactor/api-first-foundation
depends_on: [AF10.2]
---

# AF11.1 — Isoler l’envoi d’invitation de Supabase

## Résultat livré

- port métier `InvitationEmailSender` indépendant du fournisseur ;
- adaptateur `ResendInvitationEmailSender` isolant URL, authentification et
  format des messages Resend ;
- renvoi exécuté directement depuis `magrit-api` après contrôle RLS de
  l’invitation et de son tenant ;
- suppression de l’appel imbriqué à
  `make-server-e3db71a4/send-invitation-email` ;
- maintien du lien manuel lorsque la clé manque ou que Resend refuse l’envoi.

## Limite volontaire

La création initiale utilise encore temporairement `invite-member`. Elle
regroupe aujourd’hui la capability `can_invite`, la validation des rôles,
l’idempotence et l’insertion avec token. Son remplacement exige une commande
SQL sécurisée ou un outbox transactionnel ; il ne doit pas être remplacé par
un simple insert service-role qui contournerait la RLS.

## Validation

- tests de l’adaptateur sans clé et avec réponse Resend réussie ;
- garde-fou interdisant le retour de l’ancienne fonction de renvoi ;
- typecheck modulaire, suite complète et build de production.
