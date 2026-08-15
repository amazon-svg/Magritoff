---
id: AF27.5
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [AF27.4]
---
# AF27.5 — Injecter la passerelle de l'assistant

## Résultat livré

- la passerelle assistant fait partie du runtime navigateur ;
- `BrowserServicesProvider` l'expose avec les autres services applicatifs ;
- `ChatInterface` et `PortalCatalog` ne chargent plus le singleton HTTP
  concret ;
- les deux parcours continuent de demander au contrat métier la connexion SSE
  `/api/v1`, avec le jeton de la session courante ;
- un garde-fou d'architecture impose cette frontière.

La lecture du flux SSE reste pour l'instant dans `useClaudeSseStream`. Une
future tranche pourra déplacer ce protocole dans la passerelle si le besoin de
changer de transport apparaît ; ce lot isole déjà le choix de l'endpoint.
