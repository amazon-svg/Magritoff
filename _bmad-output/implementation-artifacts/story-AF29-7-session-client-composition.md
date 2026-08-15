---
id: AF29.7
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [AF29.6]
---
# AF29.7 — Composer la façade Session Magrit dans un root unique

## Résultat livré

- `ModuleClientsProvider` crée l'unique façade Session de l'application ;
- bootstrap, paramètres tenant, sous-espaces, redirection de slug et acceptation
  d'invitation consomment l'instance injectée ;
- ces écrans ne construisent plus de façade depuis le transport HTTP ;
- un garde-fou confine le constructeur au composition root.

Cette façade concerne la session workspace Magrit existante. Elle ne définit
pas le futur modèle d'authentification des clients boutique, dont les comptes
restent strictement propres à chaque boutique selon la spécification dédiée.
