---
id: AF30.1
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: feat/storefront-identity-um2
depends_on: [AF29.9]
---
# AF30.1 — Isoler l'orchestration des paramètres tenant

## Résultat livré

- `useTenantSettingsForm` porte l'état du formulaire, la validation du slug et
  la mutation du module Session ;
- le changement de tenant réinitialise les valeurs et les messages à partir du
  nouvel espace, y compris sans remontage du composant ;
- les droits de modification du nom et du slug restent fournis explicitement
  par la surface workspace ;
- `DashboardTenantSettings` ne connaît plus `useSessionApi` et reste une vue ;
- une sauvegarde réussie n'est pas requalifiée en échec si le rechargement du
  contexte rencontre ensuite une erreur.

## Validation

- garde-fou API-first adapté à la nouvelle frontière ;
- suite Vitest complète, typecheck et build de production.
