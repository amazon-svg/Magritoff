---
id: AF27.4
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [AF27.2]
---
# AF27.4 — Injecter la passerelle Clariprint depuis le runtime navigateur

## Constat

Après la sortie de Supabase hors de `src/app`, quatre consommateurs Clariprint
importaient ou construisaient encore directement l'adaptateur HTTP. Certains
utilisaient ainsi un `FetchApiClient` autonome au lieu du transport authentifié
partagé par la session courante.

Le type de réponse Clariprint était en outre dupliqué entre le module API et un
utilitaire du front.

## Résultat livré

- contrat `ClariprintPricingGateway`, erreur typée et wrapper de repli placés
  dans le module Clariprint ;
- type de résultat UI aligné sur le contrat `/api/v1` du module ;
- fabrique d'adaptateur Clariprint ajoutée au runtime navigateur ;
- `BrowserServicesProvider` compose la passerelle avec le client API
  authentifié courant ;
- `PortalCatalog`, `PortalProduct`, `useClariprintProduct` et
  `useProductConfigurator` consomment la passerelle injectée ;
- aucun de ces consommateurs ne connaît désormais l'adaptateur HTTP concret ;
- exports historiques de l'adaptateur conservés pour compatibilité des tests
  et des zones non encore migrées.

## Garde-fous

- l'architecture interdit le retour de l'import Clariprint concret dans les
  quatre consommateurs migrés ;
- le wrapper métier est testé avec une passerelle injectée (succès, absence de
  configuration, erreur typée) ;
- le runtime est le seul endroit qui construit `ClariprintHttpAdapter` avec le
  client `/api/v1` partagé.
