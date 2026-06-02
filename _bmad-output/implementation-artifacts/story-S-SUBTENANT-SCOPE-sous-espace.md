---
story_id: S-SUBTENANT-SCOPE
epic: Multi-tenant gouvernance (filiale imprimeur multi-sites)
title: Sous-tenants = filiales d'un imprimeur multi-sites (Usage A seul, post-élagage 2026-05-21)
status: spec-ready (post Phase 0.6 cadrage qualité, 2026-05-22)
created_at: 2026-05-11
updated_at: 2026-05-22 (post arbitrages Arnaud Q1-Q4 résiduelles)
target_branch: beta/v5
agent: TBD (Dev hat, Sprint 8)
size: S (2j — révisé en bas vs L initialement estimé, l'infra existe déjà)
prd_ref: _bmad-output/planning-artifacts/prd.md (multi-tenancy strict)
predecessors: [E9.4 rename espace livré, TenantContext.createSubTenant existant, trigger 2 niveaux livré 20260424_01]
successors: []
sprint_cible: Sprint 8 (roadmap qualité-first)
context_origin: élagage Arnaud 2026-05-21 (Usage B = espace client B2B → couvert par shops + scope shop_only)
---

# Story S-SUBTENANT-SCOPE — Filiales d'un imprimeur multi-sites

## Contexte post-élagage 2026-05-21

La spec initiale (2026-05-11) couvrait **2 usages** distincts du concept `parent_tenant_id` existant : Usage A (filiale multi-sites) et Usage B (espace client B2B type ERAM dans IPA). **Arnaud a élagué Usage B le 2026-05-21** (rétro Sprint 4) après confirmation architecturale Phase 0.5 que **shops + `access_scope='shop_only'` + `shop_visual_preferences` (S-PIM-VISUELS) couvrent déjà Usage B nativement**, sans avoir besoin de sous-tenants pour ça.

Cette story se concentre donc uniquement sur **Usage A — sous-tenants comme filiales d'un imprimeur multi-sites** :

```
[Tenant racine "Imprimerie Dupont SA"]
  ├─ [Sous-tenant "Dupont Paris"]
  ├─ [Sous-tenant "Dupont Lyon"]
  └─ [Sous-tenant "Dupont Bordeaux"]
```

**Caractéristiques** :
- Les sous-tenants partagent la **même marque commerciale** que le parent
- Le parent (HQ) a accès aux données consolidées (commandes, stats)
- Les sous-tenants ont chacun leurs propres clients/shops/commandes
- Personnel = appartenance à **un seul site à la fois** (cf. Q3 ci-dessous)
- Facturation : par tenant (chaque entité a son abonnement Magrit) — facturation consolidée HQ = arrangement custom hors scope MVP

## État technique actuel (existant non documenté côté usage)

- Table `tenants` a une colonne `parent_tenant_id uuid references tenants(id)` ([20260424_01_tenants_core.sql:30](../../supabase/migrations/20260424_01_tenants_core.sql))
- **Trigger contrainte 2 niveaux max** : `tenants_check_two_levels_only` ([20260424_01_tenants_core.sql:46-50](../../supabase/migrations/20260424_01_tenants_core.sql)) empêche `root → child → grandchild`. Hiérarchie limitée à 2 niveaux.
- Index `tenants_parent_idx` sur `parent_tenant_id` existe.
- Fonction `createSubTenant({parentTenantId, slug, name})` dans [TenantContext.tsx:349](../../src/app/contexts/TenantContext.tsx) (RPC `create_tenant` avec `p_parent_tenant_id`)
- **Héritage des droits** : owners/admins/members d'un tenant parent voient automatiquement les sous-tenants via `inheritedFromParent: true` retourné par `TenantContext` ([TenantContext.tsx:184-191](../../src/app/contexts/TenantContext.tsx)). Les `partner` du parent n'héritent **pas**.
- Composant [DashboardTenantSpaces.tsx](../../src/app/components/dashboard/DashboardTenantSpaces.tsx) existe pour gérer les espaces (à étendre).

**Conclusion d'audit technique** : la **majorité de l'infrastructure existe déjà** (DB + RPC + héritage TenantContext + composant UI). Cette story est essentiellement un **travail d'extension + formalisation + tests**, pas une création from scratch. Effort révisé de L à S (2j).

## Arbitrages Q1-Q4 — décisions finales Phase 0.6 (validées Arnaud 2026-05-22)

| # | Question | Décision Arnaud |
|---|---|---|
| **Q1** | Visibilité parent → enfant | **Héritage total automatique** : tous les membres du parent voient tous les sous-tenants. Comportement actuel `inheritedFromParent` conservé. Simplicité MVP, cohérent "même organisation Imprimerie Dupont SA". |
| **Q2** | Modélisation technique : enum `sub_tenant_type` ? | **Pas d'enum**. `parent_tenant_id IS NOT NULL` suffit pour identifier un sous-tenant. Post-élagage Usage B, on n'a qu'un seul type (filiale). Pas de migration DB nécessaire. |
| **Q3** | Mobilité personnel entre sous-tenants | **Un user appartient à un seul sous-tenant à la fois**. Pour bouger Site Paris → Site Lyon, admin retire de Paris + ajoute à Lyon. Audit clair, pas d'ambiguïté contexte. Le parent reste visible à tous via héritage Q1. |
| **Q4** | Dashboard consolidé parent — niveau ambition MVP | **MVP minimal** : liste des sous-tenants avec 2 totaux par sous-tenant (nombre de commandes du mois + somme CA HT). Pas de drill-down, pas de KPIs sophistiqués. ~0.5j sur 2j de la story. |

## Story (user story)

**As an** admin tenant racine d'un imprimeur multi-sites (ex: Imprimerie Dupont SA),
**I want** créer des sous-tenants (Site Paris / Site Lyon / Site Bordeaux), affecter mon personnel à un site précis, et voir un dashboard consolidé HQ avec les KPIs nb commandes + CA HT du mois par site,
**So that** je peux piloter mon réseau multi-sites depuis Magrit sans avoir à jongler entre N comptes séparés, et mon personnel travaille dans le contexte clair de son site sans confusion.

## Acceptance Criteria

### AC1 — Helper RLS `is_subtenant_member_direct(tenant_id)`

**Given** une migration `20260{XXX}_subtenant_helpers.sql` est créée
**When** elle est appliquée
**Then** un nouveau helper SQL est disponible :

```sql
CREATE OR REPLACE FUNCTION public.is_subtenant_member_direct(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY INVOKER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM tenant_members
    WHERE tenant_id = p_tenant_id
      AND user_id = auth.uid()
  );
$$;
```

**And** un helper miroir `is_subtenant_member_inherited(p_tenant_id uuid)` :

```sql
CREATE OR REPLACE FUNCTION public.is_subtenant_member_inherited(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY INVOKER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM tenants t
    INNER JOIN tenant_members tm ON tm.tenant_id = t.parent_tenant_id
    WHERE t.id = p_tenant_id
      AND t.parent_tenant_id IS NOT NULL
      AND tm.user_id = auth.uid()
      AND tm.role IN ('owner', 'admin', 'member')
  );
$$;
```

**And** un helper `get_user_subtenants(p_parent_tenant_id uuid)` qui retourne la liste des sous-tenants accessibles à l'user authn :

```sql
CREATE OR REPLACE FUNCTION public.get_user_subtenants(p_parent_tenant_id uuid)
RETURNS SETOF tenants
LANGUAGE sql
STABLE SECURITY INVOKER
AS $$
  SELECT t.*
  FROM tenants t
  WHERE t.parent_tenant_id = p_parent_tenant_id
    AND (
      public.is_subtenant_member_direct(t.id)
      OR public.is_subtenant_member_inherited(t.id)
    )
  ORDER BY t.name;
$$;
```

**And** les helpers sont testés vitest (6+ cas : member direct, member hérité depuis parent, partner pas hérité, anonyme bloqué, super_admin OK, cross-tenant pas visible).

### AC2 — Validation appartenance "un seul sous-tenant à la fois" (Q3)

**Given** un user est déjà membre d'un sous-tenant (ex: "Dupont Paris")
**When** l'admin parent tente de l'ajouter à un autre sous-tenant ("Dupont Lyon") via UI ou RPC
**Then** :
- Soit la contrainte est gérée côté **UI seule** (recommandation MVP) : le composant `<AddMemberToSubtenantForm>` détecte si le user est déjà membre d'un autre sous-tenant du même parent, et affiche un message bloquant : *"Cet utilisateur est déjà affecté à 'Dupont Paris'. Pour le déplacer, retirez-le d'abord de Paris avant de l'ajouter à Lyon."*
- Pas de contrainte DB stricte (pas de trigger BD bloquant) — trop rigide pour les cas marginaux légitimes (migration manuelle d'urgence, RPP support, etc.).
- L'UI propose un raccourci "Déplacer vers Lyon" qui fait les 2 actions (retire Paris + ajoute Lyon) atomiquement via RPC `move_user_between_subtenants(user_id, from_tenant, to_tenant)`.

**And** la RPC `move_user_between_subtenants` est créée :

```sql
CREATE OR REPLACE FUNCTION public.move_user_between_subtenants(
  p_user_id uuid,
  p_from_tenant_id uuid,
  p_to_tenant_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_parent_from uuid;
  v_parent_to uuid;
BEGIN
  -- Vérifier que les 2 sous-tenants ont le même parent
  SELECT parent_tenant_id INTO v_parent_from FROM tenants WHERE id = p_from_tenant_id;
  SELECT parent_tenant_id INTO v_parent_to FROM tenants WHERE id = p_to_tenant_id;

  IF v_parent_from IS NULL OR v_parent_to IS NULL OR v_parent_from <> v_parent_to THEN
    RAISE EXCEPTION 'Both subtenants must share the same parent_tenant_id';
  END IF;

  -- Vérifier que l'appelant est admin du parent
  IF NOT EXISTS (
    SELECT 1 FROM tenant_members
    WHERE tenant_id = v_parent_from AND user_id = auth.uid() AND role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Only parent admin can move users between subtenants';
  END IF;

  -- Atomique : delete then insert
  DELETE FROM tenant_members WHERE tenant_id = p_from_tenant_id AND user_id = p_user_id;
  INSERT INTO tenant_members (tenant_id, user_id, role) VALUES (p_to_tenant_id, p_user_id, 'member')
    ON CONFLICT DO NOTHING;
END;
$$;
```

**And** la RPC est testée vitest (4+ cas : OK admin parent, BLOCKED si parents différents, BLOCKED si pas admin parent, BLOCKED si target inexistant).

### AC3 — Extension `DashboardTenantSpaces.tsx` avec section "Mes sous-espaces"

**Given** un admin tenant racine arrive sur `/t/:slug/spaces` (composant existant)
**When** la page rend
**Then** une nouvelle section "Mes sous-espaces" est ajoutée sous la liste actuelle des espaces :
- Liste tabulaire des sous-tenants accessibles via helper `get_user_subtenants(currentTenantId)`
- Colonnes : Nom / Slug / Date création / Nombre de membres / **Nombre de commandes du mois** / **CA HT du mois** (Q4 MVP minimal)
- Bouton "Créer un sous-tenant" → modale création (réutilise wizard E9.6 simplifié : nom + slug, gammes héritées du parent automatiquement)
- Bouton "Gérer" par ligne → navigation vers `/t/:subtenant_slug/dashboard` (changement de contexte)
- Empty state si pas de sous-tenants : "Vous n'avez pas encore créé de sous-espaces. Si votre imprimerie a plusieurs sites, créez un sous-espace par site pour les piloter séparément."

**And** la section "Mes sous-espaces" est **conditionnellement visible** : visible uniquement si l'user authn est `owner` ou `admin` du tenant racine. Cachée pour les `member`/`partner` (qui voient juste leur tenant courant via héritage).

**And** les KPIs (nb commandes du mois + CA HT du mois) sont calculés via 1 query SQL agrégée :

```sql
SELECT
  t.id, t.name, t.slug, t.created_at,
  (SELECT COUNT(*) FROM tenant_members WHERE tenant_id = t.id) AS member_count,
  (SELECT COUNT(*) FROM tenant_orders WHERE tenant_id = t.id AND created_at >= date_trunc('month', now())) AS month_order_count,
  (SELECT COALESCE(SUM(total_ht), 0) FROM tenant_orders WHERE tenant_id = t.id AND created_at >= date_trunc('month', now())) AS month_ca_ht
FROM get_user_subtenants(:parent_tenant_id) t
ORDER BY t.name;
```

### AC4 — Sally UX consult préalable (DoD principe #5)

**Given** la section "Mes sous-espaces" est une nouvelle zone user-facing dans DashboardTenantSpaces
**When** la story démarre
**Then** Sally UX produit en préalable :
- Mockup wireframe layout section "Mes sous-espaces" (table responsive + boutons actions)
- Mockup modale création sous-tenant (réutilisation pattern wizard E9.6 + ajustements pour héritage gammes)
- Mockup empty state (microcopy + visual)
- Mockup confirmation "Déplacer vers Lyon" (modale ou drawer ?)
- Validation Arnaud avant dev

**And** les wireframes sont sauvegardés dans `.design-handoff/wireframes/S-SUBTENANT-SCOPE-*.png` ou Figma export.

### AC5 — Tests vitest RLS + RPC (8+ cas)

**Given** un harness vitest sur 1 tenant racine + 3 sous-tenants + 5 users répartis (admin racine, member Paris, member Lyon, member Bordeaux, partner racine non-hérité)
**When** chaque user tente d'accéder aux sous-tenants
**Then** les assertions tiennent :
- admin racine voit les 3 sous-tenants (via héritage Q1)
- member Paris voit Site Paris (direct) + le racine (héritage normal multi-tenant) mais PAS Lyon ni Bordeaux
- member Lyon = symétrique pour Lyon
- partner racine voit le racine SEULEMENT (cohérent règle actuelle "partner n'hérite pas")
- `move_user_between_subtenants` OK pour admin racine
- `move_user_between_subtenants` BLOCKED pour member non-admin
- Cross-tenant : aucun user d'un autre tenant racine ne voit les sous-tenants Dupont

### AC6 — TF Notion (3+ cas)

- "Admin tenant racine crée un sous-tenant 'Dupont Lyon' depuis DashboardTenantSpaces"
- "Member Paris ne voit PAS les sous-tenants Lyon ni Bordeaux dans son sidebar dashboard"
- "Dashboard consolidé HQ affiche nb commandes + CA HT du mois par sous-tenant"

## Out of scope explicite

- ❌ Comptabilité multi-entités / refacturation interne (Vision V2+)
- ❌ Migration d'un sous-tenant vers tenant racine indépendant (politique commerciale V2+)
- ❌ Hiérarchies profondes > 2 niveaux (trigger DB bloque déjà, MVP confirmé)
- ❌ Partage de catalogues entre sous-tenants (V2+)
- ❌ Drill-down dashboard par sous-tenant (Q4 MVP minimal — Sprint 9+ si demandé)
- ❌ Facturation consolidée HQ unique (chaque tenant a son abonnement Magrit, arrangement custom commercial hors plateforme)
- ❌ Multi-appartenance simultanée d'un user à plusieurs sous-tenants (Q3 tranché contre)
- ❌ Trigger DB bloquant "un seul sous-tenant à la fois" — gestion UI seule, plus souple (AC2)

## Tasks

- [ ] Task 1 — Audit prod read-only : combien de tenants existants ont `parent_tenant_id IS NOT NULL` ? (vérifier qu'on n'a pas de cas legacy étrange à gérer)
- [ ] Task 2 — Migration `subtenant_helpers.sql` : 3 helpers SQL (AC1)
- [ ] Task 3 — RPC `move_user_between_subtenants` (AC2)
- [ ] Task 4 — Sally UX wireframes (AC4) — préalable au code UI
- [ ] Task 5 — Extension `DashboardTenantSpaces.tsx` section "Mes sous-espaces" (AC3)
- [ ] Task 6 — Composant `<AddMemberToSubtenantForm>` avec validation appartenance unique (AC2)
- [ ] Task 7 — Tests vitest RLS + RPC (AC5, 8+ cas)
- [ ] Task 8 — testIds dans `src/app/lib/testIds.ts` (scope `subtenant`)
- [ ] Task 9 — TF Notion (AC6, 3 cas)
- [ ] Task 10 — Audit a11y axe-core sur route `/t/:slug/spaces` (étendre `pnpm a11y:scan`)
- [ ] Task 11 — Mise à jour `docs/project-context.md` §3.3 multi-tenancy avec mention sous-tenants Usage A

## DoD spécifique (DoD étendue qualité-first §5.2)

- [ ] Audit prod préalable (principe #4)
- [ ] Story doc écrit AVANT démarrage code (principe #9, ce doc ✅)
- [ ] Story atomique 2j (principe #7 ✅, révisée de L à S grâce à l'audit infra existante)
- [ ] Sally UX wireframes validés Arnaud AVANT dev (principe #5)
- [ ] testIds stables déclarés (convention §4.3 project-context)
- [ ] Audit a11y axe-core 0 violation sur route `/t/:slug/spaces` étendue (principe #10)
- [ ] TF Notion 3+ en parallèle (principe #8)
- [ ] Smoke E2E parcours acheteur AI joué post-livraison : login → switch sous-tenant → vérification visibilité commandes contextuelle (principe #3)

## Cohérence cross-roadmap

Sprint 8 (roadmap qualité-first) contient également : S-RECONCILE-SUPABASE-MIGRATIONS (1.5j, à faire en premier), ProductCard DRY priceResolver (0.5j), R2-bis ChatInterface sous-composants (1.5j), S-FIX-LIBRARY-UUID + S-FIX-LARGE-CM-FORMATS bundle (1j).

**Effort cumulé Sprint 8 avec cette story** : ~6.5j sur 5-6 stories → confortable dans la cible roadmap (~7-8j).

## References

- [Source: src/app/contexts/TenantContext.tsx:109, 184-191, 349] — héritage actuel + createSubTenant
- [Source: src/app/components/dashboard/DashboardTenantSpaces.tsx] — composant existant à étendre
- [Source: supabase/migrations/20260424_01_tenants_core.sql:30, 46-50] — parent_tenant_id + trigger 2 niveaux
- [Source: docs/project-context.md §3.3 multi-tenancy] — RLS helpers canoniques
- [Source: roadmap-v1.1-qualite-first-2026-05-21.md] — Sprint 8
- [Source: rétrospective Sprint 4 + arbitrage 2026-05-21] — élagage Usage B (couvert par shops + shop_only + S-PIM-VISUELS shop-scoped)
