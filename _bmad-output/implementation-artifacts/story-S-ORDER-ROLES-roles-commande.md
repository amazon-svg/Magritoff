---
story_id: S-ORDER-ROLES
epic: 3 — Module Commandes (Order entity user-facing) — extension scope rôles
title: Rôles utilisateur sur une commande (passeur / validateur / approbateur N+1)
status: spec-pending-validation
created_at: 2026-05-11
target_branch: beta/v5
agent: TBD
size: M (à confirmer après revue)
prd_ref: _bmad-output/planning-artifacts/prd.md (FR18-24 Order entity)
predecessors: [S1.4 Order entity tenant_orders livré, S-FIX-6 customer_email + RLS buyer livré]
successors: []
---

# Story S-ORDER-ROLES — Rôles utilisateur sur une commande

## Contexte

Précision Arnaud 2026-05-11 sur le concept "Mes commandes" :
> *"C'est un statut qui doit distinguer la relation à une commande des utilisateurs. Entre celui qui la passe et celui qui la validera, soit activera une fonction relative à cette commande. Pour autant l'utilisateur qui l'a passé doit voir 'ses' commandes."*

Le fix S-FIX-6 (commit `bd564d3`) a livré **le minimum vital** :
- L'acheteur authentifié voit SES commandes (filtre `customer_email = auth.email()` + nouvelle RLS `shop_orders buyer`)
- L'owner shop voit toutes les commandes de sa shop (RLS `shop_orders owner` existante)

**Ce qui manque** : la sémantique métier "rôles dans la commande" pour distinguer :
- **Passeur** : l'acheteur qui a saisi la commande dans le panier
- **Validateur N+1** : le hiérarchique de l'acheteur qui doit approuver avant transmission (workflow corporate déjà mentionné design-handoff §05 *"workflow N+1 → Achats → Magrit"*)
- **Approbateur final / Acheteurs** : le service Achats du client qui transmet à l'imprimeur
- **Producteur** : l'imprimeur Pro propriétaire de la shop qui exécute la commande
- **Activateur de fonction** : tout user qui peut déclencher une action sur la commande (réimprimer, annuler, exporter facture...). Précision Arnaud à confirmer.

Ces rôles doivent gouverner :
- **Visibilité** : qui voit quoi sur la commande (filtre liste, détail, audit trail)
- **Actions** : qui peut faire quoi (valider, annuler, modifier, exporter)
- **Notifications** : qui est notifié à quelle transition de statut

## Story (user story de placeholder, à affiner)

**As a** plateforme B2B Magrit,
**I want** modéliser et instrumenter les rôles utilisateur sur une commande (passeur / validateur N+1 / approbateur Achats / producteur),
**So that** chaque type d'utilisateur accède à la bonne sous-vue, peut déclencher les bonnes actions et reçoit les bonnes notifications.

## Questions à arbitrer AVANT spec finale

| # | Question | Décision attendue Arnaud |
|---|---|---|
| Q1 | Quels sont les rôles canoniques exacts ? Passeur / Validateur N+1 / Approbateur Achats / Producteur — ou autre liste ? | À préciser |
| Q2 | Un même user peut-il cumuler plusieurs rôles sur la même commande ? (ex: passeur **et** validateur si le hiérarchique passe pour lui-même) | À trancher |
| Q3 | Les rôles sont-ils définis **par commande** (assignation dynamique au moment de la création) ou **par appartenance organisationnelle** (membre tenant avec attribut `role_in_orders`) ? | À trancher |
| Q4 | Lien avec `tenant_members.access_scope` (`magrit_full` / `shop_only`) et `permissions` (`can_quote`, `can_order`, `can_invite`) déjà en place ? Extension ou couche séparée ? | À trancher |
| Q5 | "Activer une fonction relative à la commande" — quelles fonctions précises ? (réimprimer, annuler, dupliquer, exporter PDF, télécharger preuve, valider, refuser...) | Liste à fournir |
| Q6 | Les rôles doivent-ils figurer **dans la table `shop_orders`** (colonnes JSONB `roles: {passer_id, validator_id, approver_id}`) ou dans une **table dédiée `shop_order_roles`** (1 row par couple user×commande×rôle) ? | À trancher post-cadrage |
| Q7 | Statuts de la commande (`pending` / `validated` / `cancelled` / `shipped`) sont-ils suffisants ou faut-il en ajouter (`awaiting_validation`, `approved_by_n+1`, `transmitted_to_producer`...) ? | À enrichir |
| Q8 | Audit trail (qui a fait quoi quand) — table `shop_order_events` à créer ? | Probablement oui |
| Q9 | Notifications (email Resend déjà en place E9.5) — quels destinataires à quelles transitions ? | Table décisionnelle à fournir |
| Q10 | UI : tableau `Mes commandes` actuel doit-il avoir des onglets/filtres par rôle (`À valider` / `Mes commandes passées` / `À approuver` / `À produire`) ? | Mockup utile |

## Out of scope explicite (ne pas inclure dans cette story)

- Paiement / facturation (Epic V2+)
- Workflow contractuel client-imprimeur (signature électronique, conditions générales)
- Livraison / suivi colis
- Toute fonctionnalité Cimpress-like multi-pays / multi-monnaie

## Hypothèses de travail (à valider)

1. **Modèle de rôles** : table `shop_order_roles(order_id, user_id, role, assigned_at, assigned_by)` avec `role` ∈ enum (`passer`, `validator_n1`, `approver_buyer`, `producer`, ...).
2. **RLS** : élargir `shop_orders` SELECT pour permettre à tout user listé dans `shop_order_roles` de voir la commande. Conserver `shop_orders buyer` (acheteur initial) et `shop_orders owner` (propriétaire shop).
3. **Statuts étendus** : `draft / awaiting_validation_n1 / validated / awaiting_approval_buyer / approved / transmitted_to_producer / in_production / shipped / delivered / cancelled`.
4. **Audit trail** : table `shop_order_events(order_id, event_type, actor_user_id, payload, occurred_at)`.
5. **UI** : 3 vues filtrées dans `PortalOrders` selon le rôle dominant du user : `Mes commandes` (passer/approver), `À valider` (validator_n1), `À produire` (producer). Visibilité gérée côté RLS.
6. **Notifications** : email Resend (E9.5 déjà livré) déclenché par triggers/edge function sur transitions de statut. Destinataires selon roles.

## Tasks (à compléter après validation arbitrage Q1-Q10)

- [ ] **Task 0 — Arbitrage Q1-Q10 par Arnaud + PM John BMAD**
- [ ] Task 1 — Migration SQL : `shop_order_roles` + extension statuts + `shop_order_events`
- [ ] Task 2 — RPC `assign_order_role()` + `transition_order_status()` (matrice transitions légales)
- [ ] Task 3 — RLS update `shop_orders` SELECT par jointure `shop_order_roles`
- [ ] Task 4 — Helpers front `useOrderRoles(orderId)` + permissions UI
- [ ] Task 5 — Refonte `PortalOrders` avec tabs filtrés par rôle
- [ ] Task 6 — Triggers email Resend par transition de statut
- [ ] Task 7 — Tests RLS + cas TF Notion

## References

- [Source: _bmad-output/planning-artifacts/prd.md] — FR18-24 Order entity
- [Source: _bmad-output/planning-artifacts/architecture.md#L256-L292] — §4.2 RLS Order entity (existant)
- [Source: .design-handoff/designs/05 - Portail B2B.html] — workflow N+1 → Achats → Magrit (design hi-fi)
- [Source: src/app/contexts/TenantContext.tsx] — `tenant_members.access_scope` + `permissions`
- [Source: supabase/migrations/20260418_shop_module.sql] — table `shop_orders` actuelle
- [Source: supabase/migrations/20260511_01_shop_orders_select_buyer.sql] — RLS buyer S-FIX-6
