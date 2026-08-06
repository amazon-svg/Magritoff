# Capacité `solver-exports`

**Statut :** draft

## Responsabilité

Sérialiser une publication ou un sandbox autorisé selon un contrat versionné, puis la livrer à la destination correspondante de manière observable et idempotente.

## Port solveur

```ts
export interface SolverDatasetPublisher {
  validate(dataset: SolverDataset): Promise<Result<SolverValidationReceipt, SolverError>>;
  deliver(command: DeliverSolverDataset): Promise<Result<SolverDeliveryReceipt, SolverError>>;
}
```

Le port ne calcule ni solution ni prix. Il valide et transporte les données.

## Concepts

- `SolverDataset` ;
- version du schéma ;
- environnement `production` ou `sandbox` ;
- `DeliveryAttempt` ;
- clé d'idempotence ;
- accusé de réception.

## Cas d'usage

- générer et télécharger le JSON ;
- valider localement le contrat ;
- livrer une publication ;
- livrer un sandbox vers le test si autorisé ;
- relancer un échec retentable ;
- consulter l'historique des tentatives.

## Invariants

- source publiée immuable ou sandbox explicitement marqué ;
- contrat validé avant envoi ;
- organisation, publication, schéma et environnement présents ;
- destination déterminée côté serveur, jamais fournie librement par le navigateur ;
- même clé d'idempotence : une seule livraison métier ;
- timeout, refus contractuel, authentification et indisponibilité distingués ;
- un échec de livraison ne modifie pas la publication.

## Observabilité

Chaque tentative enregistre request ID, source, destination logique, schéma, durée, résultat, catégorie d'erreur et receipt, sans stocker de secret.

## Validation

- [ ] Les fixtures valides et invalides passent le contrat partagé.
- [ ] Une destination de production refuse un sandbox.
- [ ] Une nouvelle tentative ne crée pas de doublon métier.
- [ ] Un timeout est retentable selon une politique bornée.
- [ ] Un rejet de schéma n'est pas relancé automatiquement.
- [ ] Le solveur de test accepte le parc de référence.
- [ ] Une livraison échouée laisse la publication intacte et exportable.

## Décisions ouvertes

- snapshot complet ou delta ;
- fichier, endpoint ou les deux ;
- authentification et accusé de réception ;
- compatibilité entre versions ;
- retry, backoff et durée maximale.
