---
id: AF29.6
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [AF29.5]
---
# AF29.6 — Composer les derniers clients hors identité

## Résultat livré

- les façades Conversations, Commercial et Diagnostics sont créées dans
  `ModuleClientsProvider` ;
- l'historique conversationnel et la gestion commerciale utilisent leurs
  instances injectées ;
- le panneau de diagnostic et le catalogue boutique partagent la même façade
  Diagnostics ;
- un garde-fou confine les trois constructeurs au composition root.

Cette tranche termine la centralisation des clients sans dépendance au modèle
d'identité. Session, Roles, Members et Invitations restent réservés au chantier
fonctionnel séparant strictement les utilisateurs Magrit des comptes boutique.
