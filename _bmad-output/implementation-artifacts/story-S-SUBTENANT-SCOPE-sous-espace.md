---
story_id: S-SUBTENANT-SCOPE
epic: Multi-tenant gouvernance (clarification scope sous-espace)
title: Périmètre fonctionnel sous-espace (filiale vs espace client B2B)
status: spec-pending-validation
created_at: 2026-05-11
target_branch: beta/v5
agent: TBD
size: à déterminer après cadrage
prd_ref: _bmad-output/planning-artifacts/prd.md (multi-tenancy)
predecessors: [E9.4 rename espace livré, TenantContext createSubTenant existant]
successors: []
---

# Story S-SUBTENANT-SCOPE — Périmètre fonctionnel sous-espace

## Contexte

Demande Arnaud 2026-05-11 :
> *"Je ne suis pas sur de bien comprendre le concept de 'sous-espace' qu'en est-il ?"* — puis : *"Ok il faut créer une ou des stories dédiées à cette fonction qu'on en précise bien le périmètre."*

## État technique actuel (existant non documenté côté usage)

- Table `tenants` a une colonne `parent_tenant_id uuid references tenants(id)`
- Fonction `createSubTenant({ parentTenantId, slug, name })` dans `TenantContext.tsx:109`
- **Héritage des droits** : les owners/admins/members d'un tenant parent voient automatiquement les sous-tenants (`inheritedFromParent: true` dans `tenants` retourné par `TenantContext`). Les `partner` du parent n'héritent **pas**.
- **2 cas d'usage techniques** documentés dans le commentaire du code (ligne 109) : *"filiale OU espace client B2B"*
- Aucune story BMAD active n'étend ce concept aujourd'hui. Le périmètre fonctionnel exact n'est pas formalisé.

## Question : qu'est-ce qu'on veut vraiment ?

Deux usages très différents techniquement convergents :

### Usage A — Sous-espace = filiale d'un imprimeur multi-sites

```
[Tenant racine "Imprimerie Dupont SA"]
  ├─ [Sous-tenant "Site Paris"]
  ├─ [Sous-tenant "Site Lyon"]
  └─ [Sous-tenant "Site Bordeaux"]
```

**Caractéristiques** :
- Les sous-tenants partagent la **même marque commerciale** que le parent
- Le parent (HQ) a accès aux données consolidées (commandes, stats, factures)
- Les sous-tenants ont chacun leurs propres clients/shops/commandes mais consolident vers HQ
- Personnel : peut bouger d'un site à l'autre (même org)
- Facturation : centralisée HQ ou par site selon convention

### Usage B — Sous-espace = espace client B2B (boutique privée)

```
[Tenant racine "Imprimerie IPA"]
  ├─ [Sous-tenant "ERAM"]  ← un de ses clients B2B
  ├─ [Sous-tenant "Décathlon"]  ← un autre client B2B
  └─ [Sous-tenant "Auchan"]  ← etc.
```

**Caractéristiques** :
- Les sous-tenants représentent les **clients finaux** de l'imprimeur
- Chaque sous-tenant a sa propre boutique privée (`/shop/<slug>` brandée à ses couleurs)
- L'imprimeur (HQ) gère les commandes que ces clients passent, applique ses propres tarifs négociés, transmet le brief de production
- Les **users du client final** se connectent à leur sous-tenant uniquement (`access_scope='shop_only'`), ne voient PAS les autres clients de l'imprimeur
- Cas actuel ERAM dans Imprimerie IPA selon ta description

## Questions à arbitrer

| # | Question | Décision attendue Arnaud |
|---|---|---|
| Q1 | On supporte **les 2 cas d'usage** dans le même modèle technique (parent_tenant_id) ou on les distingue (ex: enum `sub_tenant_type` ∈ `subsidiary` / `b2b_client_space`) ? | À trancher |
| Q2 | Si distinction : quelles différences comportementales ? (UI, permissions, facturation, héritage) | Tableau différentiel à fournir |
| Q3 | Périmètre **B2B client space** : qui crée le sous-tenant (l'imprimeur depuis son dashboard ? le client final via un onboarding self-service ?) | À trancher |
| Q4 | Périmètre **B2B client space** : qui paye Magrit ? (l'imprimeur seul ou client+imprimeur partagés ?) | À aligner avec pricing Magrit |
| Q5 | Le sous-tenant a-t-il un compte Magrit propre (`tenant_members` séparé) ou hérité du parent ? | Probablement séparé pour B2B clients |
| Q6 | **Visibilité parent → enfant** : par défaut un user du parent voit tous les sous-tenants ? Ou opt-in / opt-out par sous-tenant ? | À trancher (RLS) |
| Q7 | **Visibilité enfant → parent** : un user shop_only du sous-tenant ERAM voit-il quelque chose de "IPA HQ" ? (Magrit branding inclus ? identité juridique ?) | Probablement opaque (privacy) |
| Q8 | **Migration de scope** : un sous-tenant peut-il devenir tenant racine indépendant (ex: client qui veut quitter l'imprimeur) ? Trajectoire de sortie ? | Politique commerciale Magrit |
| Q9 | **Hiérarchie N+1 ou N+** : on reste à 2 niveaux (parent → enfants directs) ou on supporte la profondeur arbitraire (ex: HQ → région → site) ? | Recommandation : 2 niveaux MVP |
| Q10 | UI : où apparaît la liste des sous-tenants ? (sidebar dashboard ? page dédiée `Mes sous-espaces` ?) | Wireframe utile |
| Q11 | Quels indicateurs consolidés veut voir le parent ? (CA total / sous-tenant, nb commandes, top produits, etc.) | Liste à fournir |

## Hypothèses de travail (à valider)

1. **Modèle technique** : conserver `parent_tenant_id` simple (1 niveau), ajouter colonne `sub_tenant_type` ∈ `subsidiary | b2b_client_space | none` (default `none`).
2. **Usage A (filiale)** : héritage drits **automatique** (owner parent = owner enfant), facturation consolidée parent.
3. **Usage B (B2B client space)** : héritage **opt-in** (le parent décide qui voit quoi), facturation parent paye, le client final est juste invité.
4. **UI parent dashboard** : section dédiée "Mes sous-espaces" avec liste + bouton "Créer un sous-espace" + bouton "Inviter un client B2B" (raccourci création + invitation owner).
5. **RLS étendue** : ajout de helpers pour distinguer "membre direct" vs "membre hérité" dans les policies sensibles.

## Tasks (à compléter après validation arbitrage Q1-Q11)

- [ ] **Task 0 — Arbitrage Q1-Q11 par Arnaud + PM John BMAD**
- [ ] Task 1 — Migration `tenants.sub_tenant_type` enum + index
- [ ] Task 2 — Helpers RLS `is_subtenant_member_direct(tenant_id)` + adaptations policies
- [ ] Task 3 — UI section "Mes sous-espaces" dans DashboardTenantSpaces existant (cf. routes.tsx)
- [ ] Task 4 — Flow "Inviter un client B2B" (sous-tenant b2b_client_space + invitation owner avec email pro)
- [ ] Task 5 — Dashboard consolidé parent (KPI CA / commandes par sous-tenant)
- [ ] Task 6 — Tests RLS + cas TF Notion

## Out of scope explicite

- Comptabilité multi-entités / refacturation interne (V2+)
- Migration d'un sous-tenant vers tenant racine indépendant (politique commerciale, Vision V2+)
- Hiérarchies profondes > 2 niveaux (MVP reste à 2)
- Partage de catalogues entre sous-tenants (V2+)

## References

- [Source: src/app/contexts/TenantContext.tsx#L109] — `createSubTenant` existant
- [Source: src/app/contexts/TenantContext.tsx:78-82] — interface `TenantWithMembership` avec `inheritedFromParent`
- [Source: src/app/components/dashboard/DashboardTenantSpaces.tsx] — composant existant pour gérer les espaces (à étendre)
- [Source: supabase/migrations/*tenant*.sql] — schéma `tenants.parent_tenant_id` existant
- [Source: docs/project-context.md#L57-L64] — multi-tenancy strict, RLS helpers
