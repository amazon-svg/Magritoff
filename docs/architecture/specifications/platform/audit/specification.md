# Module plateforme `audit`

**Statut :** candidate  
**Version :** 0.1

## Responsabilité

Enregistrer une trace append-only des actions sensibles et fournir une lecture tenant-scoped exploitable par le support et les utilisateurs autorisés.

## Non-responsabilités

- remplacer les logs techniques ;
- stocker des secrets ;
- décider une autorisation ;
- conserver automatiquement un snapshot métier complet ;
- devenir un bus d'événements.

## Contrat public

```ts
export type AuditRecordInput = Readonly<{
  actor: ActorContext;
  action: string;
  resource: ResourceRef;
  occurredAt: string;
  before?: Readonly<Record<string, unknown>>;
  after?: Readonly<Record<string, unknown>>;
  metadata?: Readonly<Record<string, unknown>>;
}>;

export interface AuditService {
  append(record: AuditRecordInput): Promise<Result<void, AuditError>>;
  list(query: AuditQuery): Promise<Result<Page<AuditRecord>, AuditError>>;
}
```

## Règles

- les enregistrements sont append-only ;
- l'audit partage la transaction métier lorsque la traçabilité est obligatoire ;
- les champs techniques et financiers sont filtrés selon une allow-list ;
- `before`/`after` ne doivent pas recopier des documents volumineux ou secrets ;
- `requestId`, tenant, acteur, action et ressource sont obligatoires ;
- les consultations de données financières auditées respectent elles-mêmes les droits financiers.

## Actions Clariprint Data initiales

- création, modification et archivage d'un fournisseur ou d'une ressource ;
- modification d'une aptitude ou d'un paramètre économique ;
- validation et publication ;
- création, promotion et archivage d'un sandbox ;
- import confirmé ;
- livraison ou nouvelle tentative vers le solveur.

## Critères d'acceptation

- [ ] `AUD-VAL-01` Un enregistrement ne peut être modifié par l'API applicative.
- [ ] `AUD-VAL-02` Une action sensible et son audit réussissent ou échouent ensemble lorsque requis.
- [ ] `AUD-VAL-03` Toute entrée possède acteur, tenant, request ID, action et ressource.
- [ ] `AUD-VAL-04` Les champs sensibles sont filtrés avant persistance.
- [ ] `AUD-VAL-05` Une lecture d'audit ne traverse jamais un tenant.
- [ ] `AUD-VAL-06` Le support peut corréler une action avec les logs techniques sans exposer de secret.
