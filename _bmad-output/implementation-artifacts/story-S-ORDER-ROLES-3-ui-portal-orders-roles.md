---
story_id: S-ORDER-ROLES-3
parent_story: S-ORDER-ROLES (overview)
epic: 3 — Module Commandes (extension scope rôles)
title: UI PortalOrders tabs filtrés par rôle + admin catalog rôles tenant
status: spec-ready (post Phase 0.4 cadrage qualité, 2026-05-22)
created_at: 2026-05-22
target_branch: beta/v5
agent: TBD (Dev hat, Sprint 6, avec Sally UX consult préalable)
size: M (2-3j)
prd_ref: _bmad-output/planning-artifacts/prd.md (FR18-24)
predecessors: [S-ORDER-ROLES-1 livré, S-ORDER-ROLES-2 livré]
successors: [S3.5 Audit trail UI]
sprint_cible: Sprint 6 (roadmap qualité-first)
ux_consult_required: Sally avant dev (DoD principe #5)
---

# Story S-ORDER-ROLES-3 — UI PortalOrders tabs filtrés + admin catalog rôles

## Contexte

Troisième et dernière sous-story de S-ORDER-ROLES. Apporte les **interfaces user-facing** : (1) la refonte de `PortalOrders` avec 4 tabs filtrés par rôle (cf. Q10 Arnaud), (2) l'UI admin tenant pour gérer le catalog rôles (créer/configurer Validateur 1, Validateur 2..., assigner capabilities, choisir notify_policy), (3) le hook front `useOrderRoles(orderId)` qui expose les permissions UI pour les composants enfants.

Voir [story-S-ORDER-ROLES-roles-commande.md](story-S-ORDER-ROLES-roles-commande.md) pour le contexte business complet.

**Dépend critiquement** de S-ORDER-ROLES-1 et -2 livrés.

## Story (user story)

**As an** acheteur B2B, validateur N+1 ou admin tenant,
**I want** une interface claire qui (a) me montre uniquement les commandes pertinentes à mon rôle, (b) me laisse déclencher les bonnes actions selon mes capabilities, (c) permet à l'admin de configurer le workflow de validation propre à mon tenant,
**So that** mon usage quotidien des commandes B2B reflète la chaîne de validation qui existe vraiment dans mon organisation.

## Acceptance Criteria

### AC1 — Sally UX wireframes avant dev (DoD principe #5)

**Given** la story commence par une session Sally UX
**When** Sally produit les wireframes
**Then** sont validés par Arnaud :
- Layout PortalOrders avec 4 tabs : "Mes commandes" / "À valider" / "À approuver" / "À produire" (ordre + microcopy)
- Empty states par tab (acheteur sans commande, validateur sans commande à valider, etc.)
- Affichage par ligne : informations + 1-3 actions contextuelles selon les capabilities du user sur la commande (boutons Valider / Annuler / Modifier / Exporter)
- UI admin catalog rôles (nouvelle page `/t/:slug/admin/order-roles`) : liste rôles existants + bouton "Ajouter validateur" + modale création (nom auto-rempli "Validateur X", 4 toggles capabilities, dropdown notify_policy, scope tenant/shop)
- Microcopy en français cohérent avec brand voice Magrit (direct, concret)

**And** les wireframes sont sauvegardés dans `.design-handoff/wireframes/S-ORDER-ROLES-3-*.png` (ou Figma export)

### AC2 — Hook `useOrderRoles(orderId)` exposé front

**Given** le front a besoin de connaître les rôles + capabilities du user authn sur une commande donnée
**When** un composant React appelle `useOrderRoles(orderId)`
**Then** le hook retourne :
```typescript
{
  loading: boolean,
  roles: Array<{ definitionId, name, capabilities, notifyPolicy, orderingIndex }>,
  capabilities: {
    canValidate: boolean,
    canCancel: boolean,
    canModify: boolean,
    canExport: boolean,
  },
  isPasser: boolean,  // user_id = tenant_orders.customer_email (heuristique acheteur)
  isProducer: boolean,  // role.name = 'Producteur' assigné non-révoqué
  refresh: () => void,
}
```

**And** le hook utilise `useQuery` (TanStack ou équivalent) avec cache invalidation sur les events Supabase Realtime des tables `tenant_order_roles` (si pertinent) OU refresh manuel post-action.

### AC3 — Refonte `PortalOrders.tsx` avec 4 tabs filtrés

**Given** la page `/shop/:slug/orders` existante (livrée S-DUAL-READ + S-DASHBOARD-ORDERS-DUAL)
**When** le user authn arrive sur la page
**Then** elle expose 4 tabs (shadcn `<Tabs>`) :
- **"Mes commandes"** : SELECT tenant_orders WHERE customer_email = auth.email() OR user_id ∈ tenant_order_roles WHERE role.name = 'Acheteur'
- **"À valider"** : SELECT tenant_orders JOIN tenant_order_roles WHERE user_id = auth.uid() AND capabilities->>'can_validate' = 'true' AND status IN ('pending', 'awaiting_validation_*')
- **"À approuver"** : tabs visible UNIQUEMENT si le user a un rôle avec `capabilities.can_validate=true` ET `ordering_index = MAX(role.ordering_index) FOR tenant` (= validateur final). Sinon tab masqué.
- **"À produire"** : tab visible UNIQUEMENT si le user a un rôle 'Producteur' assigné sur des commandes. Affiche commandes status `validated` non encore `shipped`. Sinon tab masqué.

**And** chaque tab affiche un badge avec le compteur (ex : "À valider (3)").
**And** les tabs masqués (À approuver, À produire) ne consomment pas de SQL inutile (lazy load).

### AC4 — Boutons actions par ligne selon capabilities

**Given** une ligne commande dans un tab
**When** elle est rendue
**Then** elle expose 1-3 boutons d'action selon les capabilities du user sur cette commande :
- `can_validate=true` ET status='pending' → bouton "Valider"
- `can_cancel=true` ET status IN ('draft', 'pending') → bouton "Annuler"
- `can_modify=true` ET status='draft' → bouton "Modifier"
- `can_export=true` (toujours) → bouton "Exporter" (3 dots menu : PDF devis / PDF facture / CSV récap)

**And** chaque clic déclenche la RPC correspondante S-ORDER-ROLES-2 (ex : "Valider" → `transition_tenant_order_status(orderId, 'validated')`).
**And** post-RPC succès, le hook `useOrderRoles` est rafraîchi + toast de confirmation (Sally validated microcopy).
**And** post-RPC échec (autorisation, transition illégale), toast d'erreur clair avec le message renvoyé par la RPC.

### AC5 — Page admin catalog rôles `/t/:slug/admin/order-roles`

**Given** un admin tenant arrive sur cette nouvelle page
**When** elle est rendue
**Then** elle expose :
- Liste tabulaire des rôles existants (Acheteur, Producteur, + Validateurs créés) avec colonnes : Nom / Capabilities (badges visuels) / Notify policy / Scope (tenant/shop) / Actions (Modifier / Archiver)
- Bouton "Ajouter validateur" → modale création
- Modale création : nom auto-rempli "Validateur X" éditable (validation unicité par tenant), 4 toggles capabilities, dropdown notify_policy (3 options), select scope (tenant / shop avec dropdown shops), bouton "Créer" qui appelle `assign_tenant_order_role` (ou plutôt création row `tenant_role_definitions` via INSERT direct admin OK car RLS l'autorise)
- Modale modification équivalente, appelle `update_tenant_order_role_capabilities` pour changer capabilities ou direct UPDATE pour changer notify_policy / name
- Archivage : UPDATE `archived_at = now()` (soft delete, conserve l'historique audit)

**And** la page est accessible uniquement aux admins tenant (`tenant_members.permissions.can_invite=true` OU is_super_admin, à confirmer avec Arnaud — pourrait être nouvelle permission `can_manage_order_roles`).

### AC6 — Audit a11y axe-core (DoD principe #10)

**Given** 2 nouvelles routes user-facing : `/shop/:slug/orders` (refonte) + `/t/:slug/admin/order-roles` (nouvelle)
**When** `pnpm a11y:scan` les inclut
**Then** 0 violation WCAG A + AA sur ces 2 routes.

**And** `pnpm a11y:scan` (script existant R9) est étendu pour inclure ces 2 routes en plus des 3 actuelles.

### AC7 — Tests vitest hooks + composants

**Given** un harness vitest + RTL
**When** les tests sont exécutés
**Then** au moins 10 cas couvrent :
- `useOrderRoles` : user sans rôle, user avec 1 rôle, user avec 2 rôles (cumul Q2), capability refresh post-RPC
- `<PortalOrders>` tabs : visibilité conditionnelle "À approuver" / "À produire", compteur badge correct
- `<OrderRoleAdminPage>` : modale création nom auto "Validateur X", validation unicité, toggle capabilities

### AC8 — TF Notion (4+ cas)

- "Tab 'À valider' affiche uniquement les commandes pertinentes au validateur"
- "Bouton 'Valider' déclenche la transition pending → validated et rafraîchit l'UI"
- "Admin tenant ajoute un validateur via modale et le voit dans le catalog"
- "Capability `can_modify=false` cache le bouton Modifier sur les commandes"

## Out of scope (à traiter ailleurs)

- ❌ Notifications email Resend par transition → S-N1-APPROVAL
- ❌ Modale historique statuts (audit trail UI) → S3.5
- ❌ Workflow chained automatique (post-validation automatique) → S-N1-APPROVAL
- ❌ UI gestion `tenant_order_status_definitions` (statuts custom) → Sprint 8+ si demandé

## Tasks

- [ ] Task 1 — Sally UX session : wireframes 4 tabs + modale création + microcopy
- [ ] Task 2 — Implémenter `useOrderRoles` hook + TanStack Query setup
- [ ] Task 3 — Refonte `PortalOrders.tsx` avec 4 tabs + boutons actions contextuels
- [ ] Task 4 — Nouvelle page `OrderRoleAdminPage.tsx` (route `/t/:slug/admin/order-roles`)
- [ ] Task 5 — Composant `<OrderRoleCreateModal>` + validation Zod
- [ ] Task 6 — Tests vitest + RTL (10+ cas)
- [ ] Task 7 — Étendre `pnpm a11y:scan` aux 2 nouvelles routes + corriger violations si présentes
- [ ] Task 8 — Ajouter testIds dans `src/app/lib/testIds.ts` (scope `order_role`)
- [ ] Task 9 — 4 TF Notion AC8

## DoD spécifique

- [ ] Sally UX wireframes validés Arnaud AVANT dev (principe #5)
- [ ] Story doc écrit AVANT démarrage code (principe #9)
- [ ] testIds stables déclarés dans `testIds.ts` (convention §4.3 project-context)
- [ ] Audit a11y axe-core 0 violation sur 2 nouvelles routes (principe #10)
- [ ] Story scindée à < 3j (principe #7, ici 2-3j ✅ mais à surveiller)
- [ ] TF Notion 4+ créés en parallèle (principe #8)
- [ ] Smoke E2E parcours acheteur AI joué post-livraison : login boutique → ajouter panier → submitCart → valider commande draft via "Valider" → vérif transition status (principe #3)
- [ ] Checkpoint récap obligatoire à la fin de cette story (clôt Sprint 6 mi-parcours, principe #2)

## References

- [Overview S-ORDER-ROLES](story-S-ORDER-ROLES-roles-commande.md)
- [S-ORDER-ROLES-1 schéma DB](story-S-ORDER-ROLES-1-schema-db-rls.md) — prérequis
- [S-ORDER-ROLES-2 RPC + audit](story-S-ORDER-ROLES-2-rpc-transitions-audit.md) — prérequis
- [PortalOrders existant] — `src/app/components/shop/portal/PortalOrders.tsx` (livré S-DUAL-READ)
- [DashboardOrders] — `src/app/components/dashboard/DashboardOrders.tsx` (livré S-DASHBOARD-ORDERS-DUAL)
- [.design-handoff/designs/05 - Portail B2B.html] — workflow N+1 design hi-fi de référence
- [Pattern shadcn Tabs] — déjà utilisé dans plusieurs Dashboard*.tsx
