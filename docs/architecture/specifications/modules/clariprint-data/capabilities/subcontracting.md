# Capacité `subcontracting`

**Statut :** draft

## Responsabilité

Définir quelles ressources d'un fournisseur exécutant sont accessibles à un fournisseur client, pendant quelle période et sous quelles autorisations.

## Concepts

- `SubcontractingAgreement` ;
- `AuthorizedMachine` ;
- `MaterialOfferAuthorization` ;
- `TransportGridAuthorization` ;
- période contractuelle.

## Cas d'usage

- créer ou modifier un contrat ;
- autoriser ou retirer une ressource ;
- suspendre ou archiver le contrat ;
- calculer les ressources accessibles à une date ;
- expliquer pourquoi une ressource est accessible ou refusée.

## Invariants

- client et exécutant sont distincts ;
- les deux fournisseurs sont visibles dans le contexte autorisé ;
- les autorisations sont des allow-lists ;
- papier, transport et machines sont autorisés séparément ;
- aucune transitivité implicite ;
- cycles refusés pour le MVP proposé ;
- contrat expiré exclu des nouveaux snapshots ;
- historique conservé dans les publications.

## Transaction

La sauvegarde du contrat et de toutes ses autorisations est atomique. Une mise à jour partielle ne doit pas élargir temporairement l'accès.

## Validation

- [ ] Autoriser une machine n'autorise aucune autre machine.
- [ ] Autoriser une machine n'autorise ni papier ni transport.
- [ ] Un contrat expiré n'alimente pas une nouvelle publication.
- [ ] Une chaîne transitive ne devient jamais accessible par défaut.
- [ ] Un cycle est détecté avant persistance.
- [ ] Une publication historique conserve les autorisations valides à sa date.

## Décisions ouvertes

- partage inter-tenant éventuel d'un même fournisseur ;
- transitivité future ;
- granularité des autorisations matière et transport.

