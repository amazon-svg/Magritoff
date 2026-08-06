# Spécifications d'architecture modulaires

**Statut :** proposition à valider  
**Document parent :** [`../../ARCHITECTURE_KERNEL_MODULES_SERVICES.md`](../../ARCHITECTURE_KERNEL_MODULES_SERVICES.md)

## Ordre de dépendance

```text
kernel
  ↓
platform/identity, tenant, access, entitlements, audit
  ↓
modules/clariprint-data
  ↓
adaptateurs UI React, API, MCP, Supabase et solveur
```

Les dépendances inverses sont interdites. Le kernel ne connaît aucun module. Un module plateforme ne connaît aucune règle Clariprint. Clariprint Data accède à Supabase et au solveur uniquement par des ports et adaptateurs.

## Index

### Kernel

- [Spécification du kernel](./kernel/specification.md)
- [Règles de dépendances](./kernel/dependency-rules.md)

### Modules plateforme

- [Identity](./platform/identity/specification.md)
- [Tenant](./platform/tenant/specification.md)
- [Access](./platform/access/specification.md)
- [Entitlements](./platform/entitlements/specification.md)
- [Audit](./platform/audit/specification.md)

### Module métier

- [Clariprint Data](./modules/clariprint-data/specification.md)
- [Modèle de domaine](./modules/clariprint-data/domain-model.md)
- [Autorisations](./modules/clariprint-data/authorization.md)
- [Propriété des données](./modules/clariprint-data/data-ownership.md)
- [Capacités métier](./modules/clariprint-data/capabilities/README.md)

## Statut d'une spécification

- `draft` : contenu exploitable mais décisions encore ouvertes ;
- `candidate` : contrat complet soumis à validation ;
- `accepted` : contrat autorisé pour implémentation ;
- `implemented` : contrat couvert par le code et ses preuves ;
- `superseded` : remplacé par une version plus récente.

Une spécification `draft` peut guider un spike ou un prototype jetable. Une migration de schéma ou une API durable exige le statut `accepted`.
