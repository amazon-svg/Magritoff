---
story_id: S-ORDER-ROLES-3
parent_story: S-ORDER-ROLES (overview)
epic: 3 — Module Commandes (extension scope rôles)
title: UI PortalOrders tabs filtrés par rôle + admin catalog rôles tenant
status: ux-ready (Sally UX wireframes livrés 2026-06-08 — attente arbitrage Arnaud Q1/Q2/Q3 avant dev)
created_at: 2026-05-22
ux_session: 2026-06-08 (Sally)
target_branch: beta/v5
agent: TBD (Dev hat, Sprint 6+, post arbitrage Arnaud Q1/Q2/Q3)
size: M (2-3j) — hook livré Sprint 6 commit a8114ee, reste UI + page admin + modale + tests
prd_ref: _bmad-output/planning-artifacts/prd.md (FR18-24)
predecessors: [S-ORDER-ROLES-1 livré, S-ORDER-ROLES-2 livré, useOrderRoles hook livré commit a8114ee]
successors: [S3.5 Audit trail UI livrée wire-ups f49926b]
sprint_cible: Sprint 6+ (roadmap qualité-first — reprend après tranchage Q1/Q2/Q3)
ux_consult_required: Sally avant dev (DoD principe #5) — ✅ livré 2026-06-08
wireframes:
  - .design-handoff/wireframes/S-ORDER-ROLES-3-portal-orders.md
  - .design-handoff/wireframes/S-ORDER-ROLES-3-admin-roles.md
  - .design-handoff/wireframes/S-ORDER-ROLES-3-create-modal.md
---

# Story S-ORDER-ROLES-3 — UI PortalOrders tabs filtrés + admin catalog rôles

## Résumé exécutif (Sally — 2026-06-08)

**Objectif** : rendre user-facing la couche workflow paramétrable (`tenant_role_definitions` + `tenant_order_roles`) déjà livrée Sprint 6. Trois écrans à construire — (1) refonte **PortalOrders** côté boutique avec 4 tabs filtrés ("Mes commandes" / "À valider" / "À approuver" / "À produire") + boutons actions contextuels résolus par `useOrderRoles + canDoAction` ; (2) nouvelle page admin tenant **`/t/:slug/admin/order-roles`** qui matérialise le catalog rôles + un rail visuel du circuit + une matrice users×rôles (lecture seule renvoyant vers page Users existante) ; (3) **modale unique** `<RoleEditorDialog>` qui gère création et édition d'un rôle (nom auto "Validateur X" éditable, 4 toggles capabilities, 3 options notify_policy, segmented control scope tenant/boutique avec Combobox boutique). Pattern UI : shadcn Tabs/Dialog/ToggleGroup/Combobox, lucide-react icons, Tailwind v4. Microcopy FR direct sans jargon ("Suivant" plutôt que `chain_next`, "Tout l'espace" plutôt que `scope=tenant`).

**Trois décisions ouvertes à trancher par Arnaud (recommandations Sally argumentées dans les wireframes)** :
- **Q1 — Permission d'accès page admin catalog rôles** → recommandation `can_manage_roles` (nouvelle permission, sémantique propre, déjà préparée dans `OrderCapability` enum du hook).
- **Q2 — Ordre des 4 tabs PortalOrders** → recommandation `Mes commandes → À valider → À approuver → À produire` (ordre chronologique du workflow, "Mes commandes" en premier par convention SaaS).
- **Q3 — Scope conflict (1 rôle = 1 boutique ou multi-boutiques)** → recommandation `1 définition = 1 scope unique`, duplication assistée pour les workflows répétés sur plusieurs boutiques.

**Actions concrètes immédiates** (post-validation Arnaud) :
1. Trancher Q1/Q2/Q3 (15 min de lecture des 3 wireframes + 1 réponse Arnaud).
2. Démarrer story Dev sur la base des wireframes (3 composants à construire : `<PortalOrdersTabbed>`, `<OrderRoleAdminPage>`, `<RoleEditorDialog>`).
3. Migration SQL accompagnante : ajout permission `can_manage_roles` aux 5 presets seedés + RPC `get_portal_orders_counters` pour les badges.

---

## Contexte

Troisième et dernière sous-story de S-ORDER-ROLES. Apporte les **interfaces user-facing** : (1) la refonte de `PortalOrders` avec 4 tabs filtrés par rôle (cf. Q10 Arnaud), (2) l'UI admin tenant pour gérer le catalog rôles (créer/configurer Validateur 1, Validateur 2..., assigner capabilities, choisir notify_policy), (3) le hook front `useOrderRoles(orderId)` qui expose les permissions UI pour les composants enfants.

Voir [story-S-ORDER-ROLES-roles-commande.md](story-S-ORDER-ROLES-roles-commande.md) pour le contexte business complet.

**Dépend critiquement** de S-ORDER-ROLES-1 et -2 livrés.

## Story (user story)

**As an** acheteur B2B, validateur N+1 ou admin tenant,
**I want** une interface claire qui (a) me montre uniquement les commandes pertinentes à mon rôle, (b) me laisse déclencher les bonnes actions selon mes capabilities, (c) permet à l'admin de configurer le workflow de validation propre à mon tenant,
**So that** mon usage quotidien des commandes B2B reflète la chaîne de validation qui existe vraiment dans mon organisation.

## Acceptance Criteria

### AC1 — Sally UX wireframes avant dev (DoD principe #5) — ✅ LIVRÉ 2026-06-08

**Given** la story commence par une session Sally UX
**When** Sally produit les wireframes
**Then** sont validés par Arnaud :
- Layout PortalOrders avec 4 tabs : "Mes commandes" / "À valider" / "À approuver" / "À produire" (ordre + microcopy)
- Empty states par tab (acheteur sans commande, validateur sans commande à valider, etc.)
- Affichage par ligne : informations + 1-3 actions contextuelles selon les capabilities du user sur la commande (boutons Valider / Annuler / Modifier / Exporter)
- UI admin catalog rôles (nouvelle page `/t/:slug/admin/order-roles`) : liste rôles existants + bouton "Ajouter validateur" + modale création (nom auto-rempli "Validateur X", 4 toggles capabilities, dropdown notify_policy, scope tenant/shop)
- Microcopy en français cohérent avec brand voice Magrit (direct, concret)

**And** les wireframes sont sauvegardés dans `.design-handoff/wireframes/S-ORDER-ROLES-3-*.md` (ASCII lo-fi dev-ready, pas de hi-fi Figma MVP).

**Livrés 2026-06-08 (Sally)** :
- [`S-ORDER-ROLES-3-portal-orders.md`](../../.design-handoff/wireframes/S-ORDER-ROLES-3-portal-orders.md) — écran acheteur 4 tabs + actions par ligne + microcopy + RPC compteurs
- [`S-ORDER-ROLES-3-admin-roles.md`](../../.design-handoff/wireframes/S-ORDER-ROLES-3-admin-roles.md) — page admin catalog + rail visuel + matrice users×rôles + recommandation Q1
- [`S-ORDER-ROLES-3-create-modal.md`](../../.design-handoff/wireframes/S-ORDER-ROLES-3-create-modal.md) — modale unique création/édition + recommandation Q3

**Trois questions ouvertes (recommandations Sally argumentées dans les wireframes)** :

| # | Question | Recommandation Sally | Argument résumé |
|---|---|---|---|
| **Q1** | Permission accès page admin catalog rôles : `can_invite` (existant) ou `can_manage_roles` (nouveau) ? | **`can_manage_roles`** | (a) déjà dans `OrderCapability` enum hook, (b) separation of concerns lesson 2026-05-25 §users, (c) sécurité — un office manager peut inviter sans toucher au workflow. |
| **Q2** | Ordre des 4 tabs PortalOrders ? | `Mes commandes → À valider → À approuver → À produire` | Ordre chronologique du workflow, "Mes commandes" en premier par convention SaaS Linear/Notion/Jira, compteurs badges rendent le scan rapide. |
| **Q3** | Scope conflict : 1 rôle multi-boutiques ou 1 rôle par boutique ? | **1 définition = 1 scope unique** + duplication assistée | Schéma actuel (`scope_shop_id` singleton) l'impose, clarté UX (rail visuel séparé par card), V2+ si volume justifie array `scope_shop_ids`. |

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

- [x] Task 1 — Sally UX session : wireframes 4 tabs + modale création + microcopy (livré 2026-06-08)
- [x] Task 2 — Implémenter `useOrderRoles` hook (livré Sprint 6 commit `a8114ee`)
- [ ] Task 2-bis — Arnaud tranche Q1/Q2/Q3 (15 min lecture wireframes)
- [ ] Task 2-ter — Migration SQL `can_manage_roles` permission + RPC `get_portal_orders_counters` (~0,5 j)
- [ ] Task 3 — Refonte `PortalOrders.tsx` avec 4 tabs (`<PortalOrdersTabbed>`) + boutons actions contextuels
- [ ] Task 4 — Nouvelle page `<OrderRoleAdminPage>` (route `/t/:slug/admin/order-roles`)
- [ ] Task 5 — Composant `<RoleEditorDialog>` (création + édition partagé) + validation Zod
- [ ] Task 6 — Tests vitest + RTL (10+ cas — voir wireframes pour la liste détaillée)
- [ ] Task 7 — Étendre `pnpm a11y:scan` aux nouvelles routes : `/shop/<slug>/orders?tab=*` (4 variants) + `/t/<slug>/admin/order-roles`
- [ ] Task 8 — Ajouter testIds dans `src/app/lib/testIds.ts` — nouveau scope `orderRole` + extensions `shop.ordersTab*` (listes exhaustives dans les wireframes)
- [ ] Task 9 — 4 TF Notion AC8 + cas additionnels recommandés par Sally (cohérence inter-écrans DashboardOrders vs PortalOrders)

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
- [Wireframes Sally 2026-06-08 — PortalOrders 4 tabs](../../.design-handoff/wireframes/S-ORDER-ROLES-3-portal-orders.md)
- [Wireframes Sally 2026-06-08 — Page admin catalog rôles](../../.design-handoff/wireframes/S-ORDER-ROLES-3-admin-roles.md)
- [Wireframes Sally 2026-06-08 — Modale création/édition](../../.design-handoff/wireframes/S-ORDER-ROLES-3-create-modal.md)
- [Hook useOrderRoles livré Sprint 6 commit a8114ee](../../src/app/hooks/useOrderRoles.ts) — voir enum `OrderCapability` ligne 32 (déjà inclut `can_manage_roles`)
- [PortalOrders existant à refondre](../../src/app/components/shop/portal/PortalOrders.tsx) — livré S-DUAL-READ
- [DashboardOrders côté admin tenant](../../src/app/components/dashboard/DashboardOrders.tsx) — livré S-DASHBOARD-ORDERS-DUAL (à harmoniser, cf. wireframe portal §Cohérence inter-écrans)
- [Design hi-fi 05 Portail B2B](../../.design-handoff/designs/05%20-%20Portail%20B2B.html) — référence visuelle workflow N+1 (stepper figé adapté en stepper dynamique dans les wireframes)
- [Pattern shadcn Tabs] — déjà utilisé dans plusieurs Dashboard*.tsx
- [Pattern Combobox shadcn] — déjà utilisé dans OrderHistoryTable filtre Boutique (S3.1)
