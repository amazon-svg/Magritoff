---
story_id: S-ORDER-ROLES (overview / index)
epic: 3 — Module Commandes (Order entity user-facing) — extension scope rôles
title: Rôles utilisateur sur une commande — overview + index 3 sous-stories
status: scindée 2026-05-22 — voir sous-stories -1 / -2 / -3
created_at: 2026-05-11
updated_at: 2026-05-22 (post Phase 0.4 cadrage qualité — réponses Q4/Q6 + scission)
target_branch: beta/v5
agent: TBD (Sprint 6)
size: L cumul (5-7j) — scindée en 3 sous-stories M-S
prd_ref: _bmad-output/planning-artifacts/prd.md (FR18-24 Order entity)
predecessors: [S1.4 Order entity tenant_orders livré, S-FIX-6 customer_email + RLS buyer livré, S-MIGRATION-ORDERS livré]
successors: [S-N1-APPROVAL, S3.5 Audit trail UI]
sprint_cible: Sprint 6 (roadmap qualité-first)
sub_stories: [S-ORDER-ROLES-1, S-ORDER-ROLES-2, S-ORDER-ROLES-3]
---

# Story S-ORDER-ROLES (overview) — Rôles utilisateur sur une commande

## ⚠️ Cette story a été scindée le 2026-05-22

Conformément au **principe DoD #7 qualité-first** (`docs/project-context.md` §5.2) — *"Story scindée si effort estimé > 3 jours"* — la story originale S-ORDER-ROLES (effort cumulé estimé 5-7 jours) a été scindée en 3 sous-stories indépendantes mais séquentielles :

| Sous-story | Périmètre | Effort | Fichier |
|---|---|---|---|
| **S-ORDER-ROLES-1** | Schéma DB (3 nouvelles tables) + enum statuts extensibles + RLS | 2j | [story-S-ORDER-ROLES-1-schema-db-rls.md](story-S-ORDER-ROLES-1-schema-db-rls.md) |
| **S-ORDER-ROLES-2** | RPC transitions + audit events `tenant_order_role_events` | 2-3j | [story-S-ORDER-ROLES-2-rpc-transitions-audit.md](story-S-ORDER-ROLES-2-rpc-transitions-audit.md) |
| **S-ORDER-ROLES-3** | UI PortalOrders tabs filtrés + composants `useOrderRoles` + admin UI catalog rôles | 2-3j | [story-S-ORDER-ROLES-3-ui-portal-orders-roles.md](story-S-ORDER-ROLES-3-ui-portal-orders-roles.md) |

**Cette page** sert d'index + capture les décisions transverses et les réponses aux questions expertes Arnaud (Q1-Q10).

---

## Contexte business

Précision Arnaud 2026-05-11 :
> *"C'est un statut qui doit distinguer la relation à une commande des utilisateurs. Entre celui qui la passe et celui qui la validera, soit activera une fonction relative à cette commande. Pour autant l'utilisateur qui l'a passé doit voir 'ses' commandes."*

Le fix S-FIX-6 (commit `bd564d3`) a livré le minimum vital :
- L'acheteur authentifié voit SES commandes (filtre `customer_email = auth.email()` + RLS `shop_orders buyer`)
- L'owner shop voit toutes les commandes de sa shop (RLS `shop_orders owner` existante)

**Ce qui manque encore** : la sémantique métier "rôles dans la commande" — modélisation + permissions + workflow + audit.

## Arbitrages Arnaud (Q1-Q10) — décisions finales

| # | Question | Décision finale Arnaud + Claude (Architect) |
|---|---|---|
| **Q1** | Rôles canoniques | **2 rôles de base** : Acheteur / Producteur. **Validateurs N modulaires** entre les deux, créés dynamiquement via bouton "Ajouter validateur" → nom auto "Validateur X" (X = compteur incrémenté). Pour chaque validateur, l'admin tenant attribue 4 droits paramétrables parmi `{can_validate, can_cancel, can_modify, can_export}`. Pour chaque étape, l'admin choisit la `notify_policy` : `chain_next` (seul le suivant dans la chaîne) ou `all_roles` (tout le monde) ou `none`. |
| **Q2** | Cumul de rôles | **Oui**, un même user peut cumuler plusieurs rôles sur la même commande (ex : passeur + validateur si le hiérarchique passe pour lui-même). |
| **Q3** | Définition rôles : par commande vs par appartenance | **Par appartenance** : les rôles sont définis au niveau **boutique OU tenant**. Granularité multi-niveaux. L'admin choisit le scope par rôle (`scope='tenant'` ou `scope='shop'` avec `scope_shop_id`). |
| **Q4** | Lien avec `tenant_members.access_scope` + `permissions` existants | **Couche séparée, PAS extension de `tenant_members.permissions`**. Recommandation Claude (Architect) validée Arnaud 2026-05-21. Voir §"Décision Q4 — couche séparée" ci-dessous. |
| **Q5** | Actions sur la commande | Liste arrêtée : **Annuler / Réimprimer / Mettre au panier (renouveler) / Dupliquer / Exporter / Imprimer le devis / Accéder à la facture / Signaler un problème**. Les capabilities `{can_validate, can_cancel, can_modify, can_export}` mappent un sous-ensemble. Le reste (réimprimer, mettre au panier, dupliquer, imprimer devis, accéder facture, signaler problème) reste régi par les droits structurels `tenant_members.permissions` existants (`can_quote`, `can_order`, `can_invite`) sans toucher à la nouvelle couche rôles. |
| **Q6** | Modèle DB rôles : JSONB sur `tenant_orders` vs table dédiée | **Table dédiée `tenant_order_roles`** (1 row par couple user × commande × rôle). Recommandation Claude (Architect) validée Arnaud 2026-05-21. Voir §"Décision Q6 — table dédiée" ci-dessous. |
| **Q7** | Statuts commande | **Système extensible** sur la base de la liste de départ (`pending` / `validated` / `cancelled` / `shipped`). L'admin tenant peut **ajouter des statuts custom** via UI dédiée. Implémentation : table `tenant_order_status_definitions` (enum extensible par tenant) + matrice transitions `tenant_order_status_transitions`. |
| **Q8** | Audit trail | **Oui** : table `tenant_order_role_events` (transitions de rôles assignés/révoqués) **+** la table `tenant_order_status_events` existante (livrée S1.4) pour les transitions de statuts. Les deux tables coexistent, l'audit UI (S3.5) lit les deux en UNION. |
| **Q9** | Notifications par transition | Gouvernées par `notify_policy` configurable par rôle (cf. Q1). Edge function `order-workflow-step` (S-N1-APPROVAL, Sprint 6) déclenche les notifications Resend selon la `notify_policy` du rôle actif sur la transition. |
| **Q10** | UI tabs PortalOrders | **4 tabs filtrés** : "Mes commandes" (rôles Acheteur OU Producteur sur la commande) / "À valider" (rôle Validateur N avec `can_validate=true`) / "À approuver" (rôle Validateur final avec `can_validate=true` ET `ordering_index` max du tenant) / "À produire" (rôle Producteur). Mockup Sally requis avant dev (DoD principe #5). |

---

## Décision Q4 — couche séparée des rôles workflow

**Décision finale validée Arnaud 2026-05-21** : la nouvelle couche rôles workflow est **complètement séparée** de `tenant_members.permissions`.

### Pourquoi

Le système actuel ([20260505_02_e9_user_permissions.sql](../../supabase/migrations/20260505_02_e9_user_permissions.sql)) modélise des **droits structurels d'appartenance** (autorisation statique liée à la place dans l'organisation). La nouvelle couche modélise une **autorisation contextuelle liée à un workflow paramétrable par tenant**. Radicalement différent.

### 4 raisons décisives

1. **Évolution séparée** — Sprint 8+ dédié workflow validation = modifier `tenant_role_*` sans toucher au cœur authn/authz tenant.
2. **Cardinalité** — `tenant_members.permissions` = 1 ligne par user. Tes rôles = N rôles par tenant config (Validateur 1, Validateur DAF, etc.). C'est un **catalog**, pas un attribut user.
3. **Audit** — les transitions de rôles doivent laisser une trace (`tenant_order_role_events`). En JSONB sur `tenant_members`, l'audit devient illisible.
4. **RLS lisibilité** — la policy `tenant_orders_select` ([20260509_01_e1_orders_v1_1.sql:114](../../supabase/migrations/20260509_01_e1_orders_v1_1.sql)) est déjà longue. La complexifier avec parsing JSONB = anti-pattern.

### Conception cible (4 tables nouvelles, `tenant_members` intact)

```
tenant_members  (existant — ne pas modifier)
   ↓ (un user appartient à un tenant)

tenant_role_definitions  (NOUVEAU — catalog des rôles paramétrés par tenant)
   id, tenant_id, name ("Validateur 1", "Validateur DAF", "Acheteur", "Producteur"...),
   capabilities {can_validate, can_cancel, can_modify, can_export} jsonb,
   notify_policy ('chain_next' | 'all_roles' | 'none'),
   ordering_index int,
   scope ('tenant' | 'shop'),
   scope_shop_id uuid nullable

tenant_role_assignments  (NOUVEAU — qui occupe quel rôle, indépendant commande)
   id, role_definition_id, user_id, assigned_at, assigned_by

tenant_order_roles  (NOUVEAU — qui occupe quel rôle SUR UNE COMMANDE)
   id, order_id, role_definition_id, user_id, assigned_at, assigned_by, revoked_at

tenant_order_role_events  (NOUVEAU — audit trail transitions de rôles)
   id, order_id, role_definition_id, user_id, event_type ('assigned' | 'revoked' | 'capability_updated'),
   actor_user_id, payload jsonb, occurred_at
```

**Bénéfice secondaire** : cette couche métier devient **réutilisable** pour d'autres workflows futurs (validation devis, validation chargement Canva, validation publication boutique, etc.) sans toucher au cœur authz.

**ADR à formaliser au Sprint 6** : ADR §4.12 "Couche rôles workflow séparée de tenant_members.permissions" dans `architecture.md`. Bloque toute tentative future de mélanger les deux couches.

---

## Décision Q6 — table dédiée `tenant_order_roles`

**Décision finale validée Arnaud 2026-05-21** : table dédiée, 1 row par couple user × commande × rôle. JSONB sur `tenant_orders` est explicitement refusé.

### 4 raisons décisives

1. **Audit et traçabilité** (Q8 = oui) — soft delete via `revoked_at`, audit natif via `tenant_order_role_events`. JSONB perd la temporalité.
2. **Scalabilité requêtes** — "toutes les commandes que je dois valider" devient `SELECT order_id FROM tenant_order_roles WHERE user_id = auth.uid() AND role_definition_id IN (...) AND revoked_at IS NULL` — index simple. JSONB = GIN possible mais fragile au refactoring.
3. **RLS** — extension policy SELECT triviale en table dédiée (`OR exists (select 1 from tenant_order_roles where ...)`). JSONB = parsing JSON dans la policy = SQL imbuvable + perf dégradée.
4. **Cumul de rôles (Q2 = oui)** — JSONB type `{ "passer": "uid_a", "validator_1": "uid_a" }` est limite (même UID, 2 rôles). Table dédiée = 2 rows, naturel en relationnel.

### Schéma cible canonique

```sql
CREATE TABLE public.tenant_order_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES tenant_orders(id) ON DELETE CASCADE,
  role_definition_id uuid NOT NULL REFERENCES tenant_role_definitions(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  assigned_by uuid NOT NULL REFERENCES auth.users(id),
  revoked_at timestamptz NULL,
  UNIQUE (order_id, role_definition_id, user_id)
);
CREATE INDEX ON tenant_order_roles (user_id) WHERE revoked_at IS NULL;
CREATE INDEX ON tenant_order_roles (order_id);
```

**L'UNIQUE** garantit qu'un user ne se voit pas attribuer 2 fois le **même** rôle sur la même commande, mais peut avoir plusieurs rôles **différents** (conformément à Q2).

**Anti-pattern formellement à éviter** : *"on commence en JSONB pour aller vite, on migrera plus tard"* — la dette est garantie. Le schéma initial doit être correct.

---

## Out of scope explicite (cette overview ET les 3 sous-stories)

- Paiement / facturation (Epic V2+)
- Workflow contractuel client-imprimeur (signature électronique, conditions générales)
- Livraison / suivi colis
- Toute fonctionnalité Cimpress-like multi-pays / multi-monnaie
- Statuts custom UI admin (l'admin peut créer `tenant_order_status_definitions` via SQL en Sprint 6, mais l'UI de gestion sera Sprint 8+ si demandé)

---

## Cohérence cross-roadmap

Cette story (3 sous-stories) est planifiée **Sprint 6** (roadmap qualité-first). Effort cumulé Sprint 6 : S-ORDER-ROLES-1 (2j) + S-ORDER-ROLES-2 (2-3j) + S-ORDER-ROLES-3 (2-3j) + S-N1-APPROVAL (2j) + S3.5 Audit trail UI (1.5j) = ~10-12j sur 5 stories. Sprint le plus chargé, surveillance fine du **checkpoint impératif après chaque sous-story** (DoD principe #2).

S-N1-APPROVAL (Sprint 6) **dépend** de S-ORDER-ROLES-1 (schéma `tenant_role_definitions` + `notify_policy`) et S-ORDER-ROLES-2 (RPC transitions).

S3.5 Audit trail UI (Sprint 6) **dépend** de S-ORDER-ROLES-2 (`tenant_order_role_events` enrichi).

---

## References

- [Source: roadmap qualité-first](../planning-artifacts/roadmap-v1.1-qualite-first-2026-05-21.md) — Sprint 6
- [Source: rétrospective Sprint 4](retrospective-sprint4-2026-05-20.md) — §5 questions expertes Q4/Q6 argumentées
- [Source: docs/project-context.md §5.2] — DoD étendue qualité-first
- [Source: _bmad-output/planning-artifacts/prd.md] — FR18-24 Order entity
- [Source: _bmad-output/planning-artifacts/architecture.md] — §4.10 ADR-ORDERS-1 (bascule tenant_orders + dual-read)
- [Source: .design-handoff/designs/05 - Portail B2B.html] — workflow N+1 → Achats → Magrit (design hi-fi)
- [Source: supabase/migrations/20260509_01_e1_orders_v1_1.sql] — schéma `tenant_orders` + RLS livrée S1.4
- [Source: supabase/migrations/20260505_02_e9_user_permissions.sql] — `tenant_members.permissions` (à NE PAS étendre, cf. Q4)
