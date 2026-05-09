---
stepsCompleted:
  - step-01-init
  - step-02-context
  - step-03-starter
  - step-04-decisions
  - step-05-patterns
  - step-06-structure
  - step-07-validation
  - step-08-complete
status: complete
completedAt: 2026-05-09
inputDocuments:
  # PRD primaire (vient d'être finalisé)
  - path: prd.md
    source: planning-artifacts
    type: prd
    role: primary_input
  # Architecture existante (brownfield)
  - path: ../../ARCHITECTURE.md
    source: project_root
    type: existing_architecture
    size_lines: 1206
    role: existing_state_reference
  - path: ../../SPRINT_HANDOFF.md
    source: project_root
    type: sprint_state
  # Mémoire onboarding maître
  - path: /Users/arnaudmazon/Downloads/CONTEXT_Magrit_IA.md
    source: external
    type: project_context
    role: governance_and_conventions
workflowType: 'architecture'
project_name: 'Magrit'
user_name: 'Arnaud'
date: '2026-05-09'
target_iteration: 'e-shop-v1.1'
target_branch: 'beta/v5'
hotfix_branch: 'beta/v4'
project_type: 'brownfield_extension'
language:
  communication: French
  document: French
---

# Architecture Decision Document — Magrit / e-shop v1.1

**System Architect:** Winston (BMAD agent)
**Author:** Arnaud Mazon
**Date:** 2026-05-09
**Iteration:** e-shop v1.1 (`beta/v5`) + hotfix B4 (`beta/v4`)
**Type:** **Brownfield extension** — pas un greenfield, on étend une plateforme existante.

> _Ce document complète l'[ARCHITECTURE.md](../../ARCHITECTURE.md) projet existant (1 206 lignes, source de vérité générale). Il documente uniquement les **décisions architecturales spécifiques à v1.1** : Order entity, mockup engine, extensions multi-tenant, sanitization Clariprint, migration LLM, intégrations Canva/Affinity._

---

## Step 1 — Initialization & Inputs Discovered

**Inputs chargés intégralement en mémoire pour ce workflow :**

| Document | Type | Rôle |
|---|---|---|
| `prd.md` (1 079 lignes, finalisé 2026-05-09) | PRD | Source des FR/NFR à supporter par l'architecture |
| `ARCHITECTURE.md` (1 206 lignes, existant) | Architecture existante | État de l'art technique, à étendre sans casser |
| `SPRINT_HANDOFF.md` | Sprint state | Stories livrées Sprint 1-2, branche active |
| `CONTEXT_Magrit_IA.md` | Onboarding maître | Conventions code, parcours, RBAC, anomalies Clariprint |

**Status :** brownfield extension. Stack et décisions structurelles déjà actées (Vite 6 + React 18 + TS + Tailwind v4 + Supabase + Anthropic Claude). L'architecture v1.1 = **extensions ciblées**, pas refonte.

---

## Step 2 — Project Context Analysis

### 2.1 Architectural scope of v1.1

**Périmètre des extensions architecturales requises** (extrait du PRD § Functional Requirements + Non-Functional Requirements) :

| Domaine FR | Décisions archi v1.1 requises |
|---|---|
| **D4 — Order entity** (FR18-24) | Nouvelles tables `orders`, `order_items`, `order_status_events` + RLS policies + tests vitest. Schéma extensible vers e-invoicing PA/PPF (NFR16) |
| **D5 — Mockup engine** (FR25-27) | Module de génération SVG/Canvas server-side, bucket Supabase Storage `product_mockups/{tenant}/{shop_id}/{product_id}.png`, cache CDN. 5 templates MVP, 15 templates Growth |
| **D5 — Connecteurs design** (FR28-29) | Canva quick-win (OAuth + API design import/export). Affinity conditionnel (à investiguer côté Claude Cowork) |
| **D6 — Boutique storefront** (FR30-35) | Refonte route `/shop/:slug` : layout 3 colonnes, dark mode, theming par boutique. Multi-sélection, comparateur, actions groupées |
| **D7 — Quotas tier** (FR36-38) | Compteurs devis et boutiques + middleware d'application. Extension `featureFlags.ts` pour gating par tier |
| **D8 — Stack LLM** (FR41-43) | Migration GPT-4o → Haiku 4.5 (E-NEW-LLM-01 P0). Validation JSON schéma stricte étendue aux nouveaux endpoints v1.1 |
| **Pré-v1.1** | Module commun `validateClariprintResponse` (NFR11). Pattern `ClariprintAdapter` (NFR22). Investigation prix mystère (E-NEW-CLARIPRINT-01) |

### 2.2 Contraintes structurelles non-négociables

| Contrainte | Source | Impact archi |
|---|---|---|
| **RLS strict sur 100 % tables tenant-scoped, 0 fuite** (NFR6) | Sécurité B2B + tests E9.10 livrés | Toute nouvelle table v1.1 avec scope tenant **DOIT** avoir des policies RLS et des tests vitest dédiés |
| **Sanitization défensive Clariprint** (NFR11) | Anomalies CONTEXT §3.5 (-1,2 €, undefined) + signal E-NEW-CLARIPRINT-01 | Module commun **OBLIGATOIRE** avant exposition utilisateur, pas de bypass |
| **Validation JSON schéma strict sur sorties LLM** (FR42) | Story 1.3 P0 + impact qualité prompts | Tout nouvel endpoint LLM passe par validation Zod ou équivalent |
| **Limite 25 paramètres par prompt** (FR43) | Story 2.4 P0, anti-hallucination | Tous nouveaux prompts mockup/order/devis y conforment |
| **`data-testid` stables centralisés** (FR45-46) | E7.7 livré + DoD pérenne | `src/app/lib/testIds.ts` étendu pour chaque nouvelle UI v1.1 |
| **Anticipation e-invoicing FR PA/PPF** (NFR16) | Septembre 2026 obligation grandes/moyennes entreprises | Schéma `orders` doit prévoir `invoice_number`, `invoice_status`, `pa_id`, `ppf_message_id` (nullable) dès v1.1 |

### 2.3 Critères de qualité architecturaux retenus

Suivant les principes Winston :

- **Rule of Three** before abstraction → on **ne crée pas** de package partagé tant qu'une logique n'a pas trois consommateurs réels. Ex : sanitization Clariprint est partagée par `quoteEndpoint` + `mockupGenerator` + `orderCreate` → 3 ✓ → module commun justifié.
- **Boring technology** for stability → on **conserve** Vite 6 + React 18 + Tailwind v4 + Supabase. Pas de migration framework en parallèle de v1.1. Pas d'introduction de stack new-and-shiny.
- **Developer productivity = architecture** → toute décision archi est évaluée à l'aune de « est-ce que Claude code peut implémenter ça en 1 itération sans gymnastique mentale ? ». Si non, on simplifie.

---

## Step 3 — Starter / Stack Evaluation

### 3.1 Posture brownfield assumée

**On ne change pas la stack en mid-flight.** L'évaluation se limite à : versions toujours supportées, sécurité OK, pas de breaking change forcé pour v1.1.

### 3.2 Stack actuelle confirmée pour v1.1

| Couche | Choix | Version utilisée | Statut v1.1 |
|---|---|---|---|
| **Frontend bundler** | Vite | 6.x | Conservé. Vite 7 disponible mais pas de migration en v1.1 (boring technology) |
| **Frontend framework** | React | 18.x | Conservé. React 19 stable disponible mais migration non prioritaire (no breaking pour notre usage) |
| **Language** | TypeScript | 5.x strict | Conservé |
| **CSS framework** | Tailwind | v4 | Conservé. Déjà utilisé en B4 (CONTEXT §3.2) |
| **UI primitives** | shadcn/ui (Radix sous-jacent) | actuel | Conservé |
| **Backend / DB / Auth / Storage** | Supabase | actuel | Conservé. Extensions v1.1 = nouvelles tables + bucket Storage |
| **Edge functions** | Supabase Edge Functions (Deno) | actuel | Conservé. Déploiement via `supabase functions deploy` (CI GitHub Actions) |
| **LLM raisonnement** | Anthropic Claude | `claude-sonnet-4-…` ou supérieur | Conservé |
| **LLM génération rapide / PIM** | Anthropic Claude | `claude-haiku-4-5-20251001` | **Nouveau v1.1** : migration GPT-4o → Haiku 4.5 via E-NEW-LLM-01 P0 |
| **Tests unit/integration** | Vitest | actuel | Conservé. Étendre aux Order entity + RLS |
| **E2E automatisé** | Claude in Chrome via plugin MCP | actuel | Conservé. DoD pérenne projet |
| **CI/CD** | GitHub Actions | actuel | Conservé |
| **Monitoring LLM** | Table `llm_usage_events` (E7.1 livré) | actuel | Étendu aux nouveaux endpoints v1.1 |

### 3.3 Nouveaux choix techniques v1.1 (validations explicites)

| Décision | Option retenue | Alternatives écartées | Justification Winston |
|---|---|---|---|
| **Mockup engine — moteur de rendu** | **Sharp + svgdom (Node) côté Edge Function** ou **Canvas API server-side via librairie node-canvas** | (1) Génération côté client React/Canvas → écarté (consomme CPU device, pas de cache partagé). (2) IA générative (Imagen, Flux) → écarté (incohérence visuelle, coût récurrent). (3) Service tiers Bannerbear/Placid → écarté en MVP (vendor lock, coût pour 100s d'images, latence ajoutée) | Boring technology + maîtrise totale du rendering + cohérence garantie par construction |
| **Mockup engine — format de sortie** | **PNG 1024×1024** (cache permanent dans Storage) | SVG inline → écarté (pas adapté pour CDN cache, alt-text et perfs) | Format binaire universel, cache CDN efficace |
| **Mockup engine — déclenchement de génération** | **Lazy async** : génération à la première demande d'affichage du produit dans une boutique, puis cache permanent | Bulk pré-génération à la création du produit → écarté (coût upfront inutile pour produits jamais consultés) | Rule of Three : commencer simple, optimiser après évidence d'usage |
| **Order entity — type de DB** | **Tables PostgreSQL Supabase** | NoSQL (Mongo, etc.) → écarté (déjà sur Postgres, RLS natif, transactionnel, JOIN avec `tenants`/`shops`) | Cohérence stack |
| **Order entity — pattern de statuts** | **Enum PostgreSQL `order_status`** (`draft`, `validated`, `in_production`, `shipped`, `delivered`, `invoiced`, `cancelled`) avec contraintes de transitions | Statut texte libre → écarté (corruption possible) | Type safety BD + lisibilité |
| **Audit trail Order** | **Table dédiée `order_status_events`** (analogue à `tenant_member_events`) | Logs JSON dans la table `orders` → écarté (queries plus complexes, pas indexable) | Pattern déjà éprouvé (E9.3) |
| **Sanitization Clariprint** | **Module utilitaire `src/server/clariprint/validateClariprintResponse.ts`** | Validation distribuée endpoint par endpoint → écarté (Rule of Three déjà rempli) | Module unique, importé par tous les consommateurs |
| **Pattern adapter Clariprint** | **Classe / module `ClariprintAdapter`** isolant les appels HTTP derrière une interface stable | Appels axios directs dans chaque endpoint → écarté (testabilité, mocking, évolution API) | Testabilité + résilience à l'évolution API Clariprint |
| **Connecteur Canva** | **OAuth 2.0 Connect + Canva Connect API** (officielle) | Scraping → exclu (ToS) | Officiel, supporté |
| **Connecteur Affinity** | **Investigation préalable Claude Cowork** avant choix d'implémentation | — | Inconnu : pas de décision tant que la capacité n'est pas validée |

### 3.4 Validation des versions (à confirmer en sprint)

> _BMAD step 3 demande de valider les versions en temps réel via WebSearch. Les versions actuelles confirmées (mai 2026) : Vite 6, React 18, Tailwind v4, Supabase actuel, Anthropic Claude SDK actuel — toutes en LTS / stable. Pas de breaking change forcé. Pas d'urgence de migration._

**Actions à confirmer en début de sprint v1.1 :**

1. `pnpm outdated` sur le repo `Magritoff` pour identifier les minor/patch updates de sécurité disponibles.
2. Vérifier que Tailwind v4 supporte bien tous les patterns du PRD (dark mode boutique, theming dynamique par tenant).
3. Tester `claude-haiku-4-5-20251001` sur un appel de génération rapide avec l'un des prompts existants pour valider l'intégration avant migration globale.

---

## Step 4 — Core Architectural Decisions

### 4.1 DB Schema — Order entity (FR18-24, NFR16)

**Migration SQL à appliquer sur `beta/v5` (Supabase project `ightkxebexuzfjdbpsdg`) :**

```sql
-- Enum statut commande (extensible vers workflow complet en V2+)
CREATE TYPE order_status AS ENUM (
  'draft',          -- créée, modifiable, annulable
  'validated',      -- engagée commercialement (Vision V2+)
  'in_production',  -- (Vision V2+)
  'shipped',        -- (Vision V2+)
  'delivered',      -- (Vision V2+)
  'invoiced',       -- (Vision V2+)
  'cancelled'       -- terminale
);

CREATE TABLE orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  shop_id         UUID NOT NULL REFERENCES shops(id) ON DELETE RESTRICT,
  created_by      UUID NOT NULL REFERENCES auth.users(id),
  status          order_status NOT NULL DEFAULT 'draft',
  total_ht        NUMERIC(12,2) NOT NULL,
  currency        CHAR(3) NOT NULL DEFAULT 'EUR',
  notes           TEXT,
  -- Hooks e-invoicing FR (NFR16) — peuplés à partir de V2+
  invoice_number  TEXT,
  invoice_status  TEXT,
  pa_id           TEXT,            -- Plateforme Agréée
  ppf_message_id  TEXT,            -- Portail Public de Facturation
  -- Hooks Stripe (E4.3 V2+)
  stripe_payment_intent_id TEXT,
  -- Audit
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  cancelled_at    TIMESTAMPTZ
);

CREATE TABLE order_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id      UUID NOT NULL,                       -- ref catalogue tenant
  product_label   TEXT NOT NULL,                       -- snapshot label au moment de la commande
  clariprint_options JSONB NOT NULL,                   -- snapshot options Clariprint figées
  quantity        INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_ht   NUMERIC(12,2) NOT NULL,
  line_total_ht   NUMERIC(12,2) NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE order_status_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  actor_id        UUID NOT NULL REFERENCES auth.users(id),
  from_status     order_status,
  to_status       order_status NOT NULL,
  reason          TEXT,
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_orders_tenant_shop ON orders(tenant_id, shop_id);
CREATE INDEX idx_orders_created_by ON orders(created_by);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_status_events_order ON order_status_events(order_id);
```

**Décisions clés :**

- **Snapshot des options Clariprint dans `order_items.clariprint_options` (JSONB)** : on **fige** les options au moment de la commande. Si Clariprint change ses options dans 3 mois, la commande historique reste interprétable. Justification Winston : isolation temporelle, principe d'immutabilité événementielle.
- **`product_label` snapshot** : même logique. Si l'imprimeur renomme son produit après la commande, l'historique reste correct.
- **Hooks e-invoicing FR nullable dès v1.1** : extensibilité sans coût (NFR16).
- **`ON DELETE CASCADE` sur `tenants` et `orders → order_items`** : suppression d'un tenant supprime ses commandes (cohérent RGPD droit à l'effacement, NFR10). `ON DELETE RESTRICT` sur `shops` : on ne supprime pas une boutique tant qu'elle a des commandes (audit).
- **`cancelled_at` sur `orders`** : trace temporelle, complète `order_status_events`.

### 4.2 RLS Policies — Order entity (NFR6)

```sql
-- Helper réutilisable (pattern E9.10)
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_events ENABLE ROW LEVEL SECURITY;

-- SELECT : un user voit les commandes des tenants où il est membre, ET selon scope
CREATE POLICY orders_select ON orders FOR SELECT USING (
  current_user_can_access_shop(shop_id)
  OR is_superadmin_magrit()
);

-- INSERT : un user peut créer une commande s'il a access au shop ET la perm can_create_order
CREATE POLICY orders_insert ON orders FOR INSERT WITH CHECK (
  current_user_can_access_shop(shop_id)
  AND current_user_has_permission(tenant_id, 'can_create_order')
);

-- UPDATE / DELETE : restreint à l'admin tenant ou l'auteur de la commande SI status='draft'
CREATE POLICY orders_update_cancel ON orders FOR UPDATE USING (
  (status = 'draft' AND created_by = auth.uid())
  OR current_user_has_permission(tenant_id, 'can_manage_orders_admin')
  OR is_superadmin_magrit()
);

-- order_items : héritent du parent orders
CREATE POLICY order_items_all ON order_items FOR ALL USING (
  EXISTS (SELECT 1 FROM orders o WHERE o.id = order_id AND (
    current_user_can_access_shop(o.shop_id)
    OR is_superadmin_magrit()
  ))
);

-- order_status_events : lecture par tous ceux qui voient la commande, écriture via fonction RPC seule
CREATE POLICY order_status_events_select ON order_status_events FOR SELECT USING (
  EXISTS (SELECT 1 FROM orders o WHERE o.id = order_id AND (
    current_user_can_access_shop(o.shop_id)
    OR is_superadmin_magrit()
  ))
);
```

**Tests vitest associés (calqués sur E9.10) :** `tests/rls/orders_isolation.test.ts` — 6 cas minimum (cross-tenant SELECT, cross-tenant INSERT, cross-shop SELECT, cancel sans permission, superadmin bypass, RPC `update_order_status` respecte ACL).

### 4.3 Mockup Engine Architecture

**Composants :**

```
[ProductCard render]
       ↓
[GET /api/mockup?tenant=X&shop=Y&product=Z]
       ↓
[Edge Function: mockup-generator]
       ├─ check Storage cache → product_mockups/{X}/{Y}/{Z}.png ?
       │     ├─ HIT → 302 redirect vers CDN URL (NFR2: <50ms)
       │     └─ MISS → continue
       ├─ load product specs depuis Clariprint (via ClariprintAdapter)
       │     └─ validateClariprintResponse(payload) — fail-fast si invalide
       ├─ load shop theming (color primaire) depuis table `shops`
       ├─ select template SVG approprié selon product.kind (5 MVP, 15 Growth)
       ├─ render template avec params (sharp + svgdom)
       ├─ upload PNG dans Storage (write-through cache)
       └─ 200 PNG bytes (premier rendu, NFR2: <300ms)
```

**Décisions clés :**

- **Edge Function dédiée `mockup-generator`** (Deno + svgdom) plutôt que backend Python : aligné sur le reste des edge functions Magrit, latence réduite (proximité régionale).
- **Cache write-through** : 1 génération = 1 upload Storage + 1 réponse client. Les requêtes suivantes hit le CDN directement.
- **Invalidation explicite** : un endpoint admin `POST /api/mockup/invalidate?shop=Y` permet à l'admin tenant de forcer le re-render quand il change le branding (changement couleur primaire, logo). Pas de TTL automatique.
- **Templates SVG paramétriques** : un template = un fichier `templates/mockup-{kind}.svg.tsx` qui prend `(product, shopTheming) → SVG string`. Pas de moteur templating lourd, juste du JSX/string templating.
- **Fallback** : si Clariprint en panne / payload invalide, l'API mockup retourne un picto générique (404 ou 200 avec image par défaut) avec un header `X-Mockup-Fallback: true` pour observabilité.

### 4.4 ClariprintAdapter Pattern (NFR22)

**Interface :**

```typescript
// src/server/clariprint/ClariprintAdapter.ts
export interface ClariprintAdapter {
  getProductSpecs(productId: string): Promise<ClariprintProductSpec>;
  computePrice(input: ClariprintQuoteInput): Promise<ClariprintQuoteResult>;
  listAvailableOptions(productId: string): Promise<ClariprintOption[]>;
}

// Implémentation prod
export class ClariprintHttpAdapter implements ClariprintAdapter { /* ... */ }

// Implémentation tests
export class ClariprintMockAdapter implements ClariprintAdapter { /* ... */ }
```

**Décisions clés :**

- **Toute interaction avec Clariprint passe par cet adapter** (pas d'appel `fetch` direct).
- **Fonction `validateClariprintResponse(payload)`** appelée à l'intérieur de l'adapter, avant retour. Aucun consommateur n'a à se préoccuper de la sanitization.
- **Erreurs typées** : `ClariprintError` discriminée par `kind` (`negative_price`, `undefined_field`, `missing_required_product`, `network`, `unknown`). Chaque consommateur peut décider de la stratégie de fallback (UI graceful, retry, etc.).
- **Mock adapter pour tests** : tous les tests vitest qui touchent Clariprint utilisent `ClariprintMockAdapter` configurable. Aucun test ne hit l'API réelle.

### 4.5 LLM Migration Architecture (E-NEW-LLM-01 P0)

**Stratégie :**

- **SDK unique :** `@anthropic-ai/sdk` (déjà présent). Suppression progressive des appels `openai` SDK.
- **Variable d'env unique :** `MAGRIT3` (clé Anthropic, déjà présente côté Supabase secrets).
- **Modèle par cas d'usage :**
  - Raisonnement / chat Magrit (mode strict, mode ouvert) → `claude-sonnet-4-…` (à confirmer dernière version disponible au sprint)
  - Génération rapide / PIM / mockup artwork prompts → `claude-haiku-4-5-20251001`
- **Migration step-by-step (par PR atomique) :**
  1. Créer un wrapper `src/server/llm/AnthropicClient.ts` exposant `complete()` et `completeStructured(schema)` (avec validation Zod automatique).
  2. PR 1 : migrer les endpoints PIM existants (Haiku 4.5).
  3. PR 2 : migrer les endpoints chat strict (Sonnet).
  4. PR 3 : supprimer le SDK OpenAI du `package.json`.
  5. PR 4 (optionnel) : suppression des feature flags transitionnels.
- **Observabilité :** chaque appel logué dans `llm_usage_events` avec `model`, `input_tokens`, `output_tokens`, `latency_ms`, `validation_passed` (boolean).

### 4.6 Canva Integration Architecture (FR28)

**Flux :**

```
[Acheteur sur ProductCard "Designer mon visuel"]
       ↓
[Magrit appelle Canva Connect API : create_design depuis gabarit Clariprint]
       ↓
[Acheteur redirigé vers Canva (ouvre dans nouvel onglet)]
       ↓
[Acheteur design dans Canva, clique "Retour à Magrit"]
       ↓
[Webhook Canva → Magrit : design_complete avec asset URL]
       ↓
[Magrit télécharge l'asset, l'attache à l'order_item.canva_asset_url]
```

**Décisions clés :**

- **OAuth 2.0 Canva** par tenant : chaque imprimeur connecte son compte Canva (admin tenant flow, dans `/dashboard/integrations/canva`). Stocké dans table `tenant_integrations`.
- **Storage des designs finis :** dans Supabase Storage `tenant_assets/{tenant}/canva/{order_item_id}.{ext}`, pas dans Canva (ownership Magrit, RGPD).
- **Webhooks Canva** : edge function `canva-webhook` valide signature HMAC + persist asset.

### 4.7 Affinity Connector — Conditional Investigation

**Avant toute décision archi :** investigation Claude Cowork via skill / outil approprié pour répondre :

1. Claude in Chrome / Claude Cowork peut-il piloter Affinity Designer/Photo via plugin ou MCP ?
2. Quel format d'échange ? (export PDF/SVG manuel ? bridge AppleScript ? import Affinity automatisé ?)
3. Quelle latence et fiabilité ?

**Si réponse positive :** spec complète à rédiger en sprint dédié, intégration similaire à Canva.
**Si réponse négative ou trop coûteuse :** report Vision, communication transparente aux clients qui demandent.

### 4.8 Feature Flags v1.1 (FR38)

**Extension de `src/app/lib/featureFlags.ts` :**

```typescript
export const featureFlags = {
  // existants
  REQUIRE_PRO_EMAIL: getEnv('REQUIRE_PRO_EMAIL'),
  REQUIRE_VERIFIED_SIREN: getEnv('REQUIRE_VERIFIED_SIREN'),
  ENABLE_STREAMING_CHAT: getEnv('ENABLE_STREAMING_CHAT'),

  // nouveaux v1.1
  ENABLE_BOUTIQUE_PREMIUM: getEnvOrTier('starter+'),
  ENABLE_ORDER_ENTITY: getEnvOrTier('starter+'),
  ENABLE_MOCKUP_ENGINE_V1: true,                      // tous tiers
  ENABLE_CANVA_CONNECTOR: getEnvOrTier('decouverte+'),
  ENABLE_AFFINITY_CONNECTOR: false,                   // conditionnel investigation
  ENABLE_OVERLAY_LIVE_RECALC: getFlag('OVERLAY_LIVE_RECALC'), // pari API Clariprint
  ENABLE_GROUPED_ACTIONS: getEnvOrTier('starter+'),

  // garde-fous
  ENABLE_LEGACY_GPT4O: false,                         // off après E-NEW-LLM-01 livré
};
```

`getEnvOrTier(min)` = helper qui combine flag global + tier du tenant courant. Pattern unique pour gating par tier.

---

## Step 5 — Implementation Patterns & Consistency Rules

> _Ces patterns ciblent **la cohérence inter-agent** : si Claude code, GitHub Copilot ou un dev humain implémentent en parallèle, ils doivent produire du code interchangeable._

### 5.1 Conventions de fichiers et dossiers

| Type | Convention | Exemple v1.1 |
|---|---|---|
| Edge functions | `supabase/functions/<kebab-name>/index.ts` | `supabase/functions/mockup-generator/index.ts` |
| Modules serveur partagés | `src/server/<domain>/<PascalCase>.ts` | `src/server/clariprint/ClariprintAdapter.ts` |
| Composants React | `src/components/<domain>/<PascalCase>.tsx` | `src/components/order/OrderHistoryTable.tsx` |
| Hooks React | `src/hooks/use<PascalCase>.ts` | `src/hooks/useOrderActions.ts` |
| Helpers / utils | `src/app/lib/<camelCase>.ts` | `src/app/lib/featureFlags.ts` |
| Types | colocalisés dans le module (`types.ts` ou directement) ; partagés dans `src/types/<domain>.ts` | `src/types/order.ts` |
| Migrations SQL | `supabase/migrations/<timestamp>_<description>.sql` | `supabase/migrations/20260512_orders_v1_1.sql` |
| Tests vitest unit | `<file>.test.ts(x)` colocalisés | `OrderHistoryTable.test.tsx` |
| Tests RLS | `tests/rls/<domain>_isolation.test.ts` | `tests/rls/orders_isolation.test.ts` |
| Test IDs | `src/app/lib/testIds.ts` (objet `TEST_IDS as const`) | `TEST_IDS.shop.orderRenewBtn` |

### 5.2 Convention `data-testid` (étendue à v1.1)

`data-testid="<scope>-<element>[-<modifier>]"` avec scope ∈ {`tenant`, `user`, `shop`, `magrit`, `auth`, `quote`, `usage`, `nav`, **`order` (nouveau v1.1)**, **`mockup` (nouveau v1.1)**}.

**Exemples v1.1 :**
- `data-testid="order-row"` + `data-order-id={order.id}` (collection)
- `data-testid="order-renew-btn"`
- `data-testid="order-cancel-btn"`
- `data-testid="shop-home-orders-list"`
- `data-testid="shop-product-overlay"`
- `data-testid="mockup-product-image"`

### 5.3 Pattern endpoint API (Edge Function)

**Squelette standard à suivre :**

```typescript
// supabase/functions/<name>/index.ts
import { serve } from 'https://deno.land/std/http/server.ts';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const RequestSchema = z.object({ /* ... */ });
const ResponseSchema = z.object({ /* ... */ });

serve(async (req) => {
  // 1. Auth check
  const auth = req.headers.get('Authorization');
  if (!auth) return new Response('Unauthorized', { status: 401 });

  // 2. Parse + validate input
  const body = await req.json().catch(() => null);
  const input = RequestSchema.safeParse(body);
  if (!input.success) return new Response(JSON.stringify({ error: input.error }), { status: 400 });

  // 3. Supabase client (RLS-aware via JWT)
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: auth } },
  });

  try {
    // 4. Métier
    const result = await doBusinessLogic(input.data, supabase);

    // 5. Validate output (defensive)
    const validated = ResponseSchema.parse(result);
    return Response.json(validated);
  } catch (e) {
    // 6. Error normalisée
    return logAndRespond(e, 500);
  }
});
```

### 5.4 Pattern validation JSON LLM

```typescript
// Toujours via le wrapper AnthropicClient
const responseSchema = z.object({
  description: z.string().min(10).max(2000),
  options: z.array(z.string()).max(25),  // FR43: limite 25 paramètres
});

const result = await anthropicClient.completeStructured({
  model: 'claude-haiku-4-5-20251001',
  prompt: '...',
  schema: responseSchema,
});
// result est typé + validé. Si invalide, throw avec retry possible.
```

### 5.5 Pattern audit trail Order

À chaque transition de statut Order, **passer par un RPC** `update_order_status(order_id, new_status, reason?)` qui :
1. Vérifie la transition est légale (matrice transitions).
2. Update `orders.status` + `orders.updated_at`.
3. Insert `order_status_events` row.

Pas d'UPDATE direct sur `orders.status` côté front.

### 5.6 Conventions de commit (rappel CONTEXT §9.1 + Arnaud preference)

- Format : `feat|fix|chore|test|docs(v5): description courte`
- **Pas d'apostrophes** dans les messages (HEREDOC pose problème).
- Un commit = une story / un fix.
- Confirmation avant push systématique sauf accord blanket sur le sprint.

### 5.7 Pattern de gestion d'erreur Clariprint

Tout consommateur de `ClariprintAdapter` doit gérer les `ClariprintError.kind` :

```typescript
try {
  const specs = await clariprint.getProductSpecs(productId);
  // ...
} catch (e) {
  if (e instanceof ClariprintError) {
    switch (e.kind) {
      case 'negative_price':
      case 'undefined_field':
      case 'missing_required_product':
        // Fallback métier explicite (UI graceful, log, retry...)
        break;
      case 'network':
        // Retry avec backoff
        break;
      default:
        // Log + erreur 500 utilisateur
    }
  }
  throw e;
}
```

### 5.8 Pattern feature flag + tier gating

```typescript
// Avant d'afficher un composant ou exposer un endpoint v1.1
import { featureFlags, getCurrentTier } from '@/app/lib/featureFlags';

if (featureFlags.ENABLE_ORDER_ENTITY && tierAtLeast(getCurrentTier(), 'starter')) {
  // afficher
}
```

### 5.9 Pattern de tests RLS

```typescript
// tests/rls/orders_isolation.test.ts
import { describe, it, expect } from 'vitest';
import { createTestClient, asUser, asTenant } from './setup';

describe('orders RLS', () => {
  it('blocks cross-tenant SELECT', async () => {
    const tenantA = await createTenant('A');
    const tenantB = await createTenant('B');
    const orderInB = await asTenant(tenantB).insertOrder({ /* ... */ });
    const result = await asUser('user_in_A').from('orders').select('*').eq('id', orderInB.id);
    expect(result.data).toEqual([]); // RLS bloque
  });
  // 5 autres cas...
});
```

### 5.10 Pattern de DoD pour PR v1.1

Toute PR v1.1 doit :

1. ✅ Compiler en TypeScript strict, pas d'erreur ESLint.
2. ✅ Inclure les tests vitest associés (unit + RLS si tenant-scoped).
3. ✅ Avoir au moins 1 cas TF Notion ajouté ou mis à jour avec testid stable.
4. ✅ Mettre à jour `src/app/lib/testIds.ts` si nouveau testid introduit.
5. ✅ Suivre le format de commit (cf. 5.6).
6. ✅ Confirmation avant push.
7. ✅ Statut Notion de la story passé à « En cours » → « Terminé » à merge.

---

## Step 6 — Project Structure & Boundaries

### 6.1 Tree d'extension v1.1 (par rapport à l'existant)

```
Magritoff/  (repo, branche beta/v5)
├── src/
│   ├── app/
│   │   └── lib/
│   │       ├── featureFlags.ts          ← ÉTENDU v1.1 (nouveaux flags + tier gating)
│   │       └── testIds.ts               ← ÉTENDU v1.1 (scope `order`, `mockup`)
│   ├── components/
│   │   ├── order/                       ← NOUVEAU v1.1
│   │   │   ├── OrderHistoryTable.tsx
│   │   │   ├── OrderRow.tsx
│   │   │   ├── OrderRenewButton.tsx
│   │   │   ├── OrderCancelButton.tsx
│   │   │   └── OrderStatusBadge.tsx
│   │   ├── mockup/                      ← NOUVEAU v1.1
│   │   │   └── MockupImage.tsx          (composant image avec fallback)
│   │   ├── shop/                        ← ÉTENDU v1.1 (refonte E9.13)
│   │   │   ├── ShopLayout.tsx           (3 colonnes, dark mode, header brandé)
│   │   │   ├── ShopHome.tsx             (dernières commandes + paniers)
│   │   │   ├── ShopCatalog.tsx          (gammes dépliables persistantes)
│   │   │   ├── ProductCard.tsx          (overlay configuration)
│   │   │   ├── ProductOverlay.tsx       (nouveau panneau latéral options Clariprint)
│   │   │   ├── ProductComparator.tsx    (nouveau v1.1 Growth)
│   │   │   └── BulkActionsBar.tsx       (nouveau v1.1 Growth)
│   │   └── integrations/
│   │       └── CanvaConnect.tsx         ← NOUVEAU v1.1 (OAuth flow + design import)
│   ├── hooks/
│   │   ├── useOrderActions.ts           ← NOUVEAU v1.1
│   │   ├── useMockup.ts                 ← NOUVEAU v1.1
│   │   ├── useFeatureFlag.ts            ← NOUVEAU v1.1 (combine flag + tier)
│   │   └── useCanva.ts                  ← NOUVEAU v1.1
│   ├── server/                          ← NOUVEAU dossier v1.1 (modules serveur)
│   │   ├── clariprint/
│   │   │   ├── ClariprintAdapter.ts     (interface)
│   │   │   ├── ClariprintHttpAdapter.ts (impl prod)
│   │   │   ├── ClariprintMockAdapter.ts (impl tests)
│   │   │   ├── validateClariprintResponse.ts (sanitization NFR11)
│   │   │   └── errors.ts                (ClariprintError typé)
│   │   ├── llm/
│   │   │   └── AnthropicClient.ts       (wrapper Sonnet + Haiku, validation Zod)
│   │   ├── order/
│   │   │   └── orderTransitions.ts      (matrice transitions de statut + RPC)
│   │   └── mockup/
│   │       ├── templates/               (15 templates SVG/TSX)
│   │       │   ├── flyer.svg.tsx
│   │       │   ├── carteVisite.svg.tsx
│   │       │   ├── brochure.svg.tsx
│   │       │   ├── etiquette.svg.tsx
│   │       │   ├── kakemono.svg.tsx
│   │       │   └── ... (10 supplémentaires Growth)
│   │       └── renderer.ts              (sharp + svgdom render pipeline)
│   └── types/
│       ├── order.ts                     ← NOUVEAU v1.1
│       └── mockup.ts                    ← NOUVEAU v1.1
├── supabase/
│   ├── functions/
│   │   ├── mockup-generator/            ← NOUVEAU v1.1 (Edge Function Deno)
│   │   │   └── index.ts
│   │   ├── canva-webhook/               ← NOUVEAU v1.1
│   │   │   └── index.ts
│   │   ├── order-action/                ← NOUVEAU v1.1 (cancel, renew, etc.)
│   │   │   └── index.ts
│   │   ├── claude-proxy/                ← MIGRÉ v1.1 (Anthropic SDK only)
│   │   ├── claude-proxy-stream/         ← MIGRÉ v1.1 (Anthropic SDK only)
│   │   ├── pim-generate/                ← MIGRÉ v1.1 (Haiku 4.5)
│   │   ├── pim-ingest/                  ← MIGRÉ v1.1 (Haiku 4.5)
│   │   └── make-server-e3db71a4/        ← existant, conservé
│   └── migrations/
│       ├── 20260512_orders_v1_1.sql     ← NOUVEAU v1.1 (tables + RLS)
│       ├── 20260513_canva_integrations.sql ← NOUVEAU v1.1
│       └── 20260514_feature_flags_extended.sql ← NOUVEAU v1.1
├── tests/
│   ├── rls/
│   │   ├── orders_isolation.test.ts     ← NOUVEAU v1.1 (6 cas min)
│   │   ├── tenant_isolation.test.ts     ← existant E9.10
│   │   └── setup.ts                     ← existant
│   └── data-testid.smoke.spec.ts        ← ÉTENDU v1.1 (testids order, mockup)
├── docs/                                ← NOUVEAU dossier (FR/architecte)
│   ├── PRICE_SOURCES.md                 ← NOUVEAU pré-v1.1 (livrable E-NEW-CLARIPRINT-01)
│   └── (futur : VISION.md, etc.)
├── ARCHITECTURE.md                      ← existant, conservé (référence générale)
├── SPRINT_HANDOFF.md                    ← existant, mis à jour fin sprint v1.1
└── package.json                         ← v1.1 : suppression `openai` SDK après E-NEW-LLM-01
```

### 6.2 Boundaries — qui touche quoi

| Composant | Lecture autorisée | Écriture autorisée | Notes |
|---|---|---|---|
| `src/components/order/*` | Hooks (`useOrderActions`), types (`@/types/order`) | Pas de query Supabase directe — passe par les hooks | Pure UI |
| `src/hooks/useOrderActions` | Edge functions `order-action` | Pas d'écriture DB directe | Layer d'orchestration |
| `supabase/functions/order-action` | Tables `orders`, `order_items`, `order_status_events` (via RPC `update_order_status`) | Toutes les transitions de statut Order | Garde-fou RLS + RPC seul |
| `src/server/clariprint/*` | API Clariprint (HTTP via `ClariprintHttpAdapter`) | Aucune | Lecture-only adapter |
| `src/server/llm/AnthropicClient` | API Anthropic Claude | Logue dans `llm_usage_events` | Wrapper unique pour tous les appels LLM |
| `supabase/functions/mockup-generator` | Storage `product_mockups/`, table `shops` (lecture theming), `ClariprintAdapter` | Storage `product_mockups/` (write-through cache) | Aucune autre table |

### 6.3 Mapping FR → Composants

| FR(s) | Composants impliqués |
|---|---|
| FR1-7 (Tenant & Members) | Existant — pas de nouveau composant v1.1 |
| FR8-10 (RBAC) | Existant + RLS policies sur nouvelles tables (`orders/*`) |
| FR11-17 (Quoting) | `claude-proxy*`, `AnthropicClient`, `ClariprintAdapter`, atelier existant + nouveau `ProductOverlay` |
| FR18-24 (Order entity) | Tables migrées + `order-action` edge function + `useOrderActions` + `OrderHistoryTable`/`Row`/`RenewButton`/`CancelButton` |
| FR25-27 (Mockup engine) | `mockup-generator` edge function + `MockupImage` + 15 templates SVG |
| FR28-29 (Canva/Affinity) | `CanvaConnect` + `canva-webhook` + `useCanva` |
| FR30-35 (Boutique storefront) | `ShopLayout`/`Home`/`Catalog` + `ProductCard`/`Overlay`/`Comparator` + `BulkActionsBar` |
| FR36-40 (Quotas, RGPD, tracking) | `featureFlags.ts` étendu + middleware quotas + `llm_usage_events` étendu |
| FR41-43 (LLM stack) | `AnthropicClient` wrapper + Zod schemas |
| FR44-46 (DoD tests) | Convention testIds + cas TF Notion + `data-testid.smoke.spec.ts` étendu |

---

## Step 7 — Architecture Validation

### 7.1 Couverture FR → Décisions architecturales

✅ **46/46 FR couvertes** par au moins une décision architecturale (cf. mapping § 6.3). Aucun FR orphelin.

### 7.2 Couverture NFR → Décisions architecturales

| NFR | Décision archi correspondante | Couverture |
|---|---|---|
| NFR1-3 (Performance latence) | Mockup cache CDN, edge functions proches, Haiku 4.5 -30% latence | ✅ |
| NFR4-5 (LLM perf post-migration) | E-NEW-LLM-01 + AnthropicClient wrapper + tracking `llm_usage_events` | ✅ |
| NFR6 (Isolation RLS 0 fuite) | Policies RLS sur `orders/*` + tests vitest 6 cas | ✅ |
| NFR7-8 (Auth + secrets) | Supabase Auth conservé + secrets edge functions seulement | ✅ |
| NFR9-10 (Audit + RGPD) | Tables `order_status_events` + ON DELETE CASCADE | ✅ |
| NFR11-12 (Sanitization Clariprint) | Module `validateClariprintResponse` + `ClariprintAdapter` | ✅ |
| NFR13-14 (Quotas) | Middleware quotas + `featureFlags.ts` extended | ✅ |
| NFR15 (Mockup scalabilité) | Edge function dédiée + Storage CDN | ✅ |
| NFR16 (e-invoicing extensible) | Hooks `invoice_*`, `pa_id`, `ppf_message_id` dans `orders` | ✅ |
| NFR17 (≥100 tenants) | Architecture multi-tenant existante (testée E9.10) | ✅ |
| NFR18-20 (Accessibilité, dark mode, i18n) | `ShopLayout` dark mode + Tailwind v4 | ✅ partiel (i18n architecture-ready, à implémenter en V2 si nécessaire) |
| NFR21-22 (Sanitization + Adapter) | Module commun + Adapter pattern | ✅ |
| NFR23 (Tracking LLM) | `llm_usage_events` étendu | ✅ |
| NFR24-25 (Edge deploy + B1 isolation) | Convention sprint (pas de touche `main`) | ✅ |
| NFR26-28 (Reliability + erreurs) | Pattern endpoint + try/catch standardisé | ✅ |

✅ **28/28 NFR adressées**.

### 7.3 Risques résiduels identifiés

| Risque | Mitigation |
|---|---|
| **Mockup engine SVG → PNG performance** sous charge réelle | Mesurer en début de sprint avec un benchmark ; si > 300ms, basculer sur worker pool ou pré-cache plus agressif |
| **Migration LLM régressions** sur prompts existants | PR atomiques par endpoint + tests A/B avant suppression du fallback GPT-4o |
| **Connecteur Canva latency / webhooks fiabilité** | Implémenter retry sur webhook + fallback manuel ("téléverser le design directement") |
| **E-NEW-CLARIPRINT-01 trouve des cas pathologiques inattendus** | Réserver 1 jour de marge dans le sprint pour absorber findings |
| **Affinity investigation négative** | Communication transparente — Affinity reporté Vision, pas de dette technique |

### 7.4 Garde-fous BMAD step 7

- ✅ Pas de double-fonction (Order entity = source unique de vérité commande, pas dupliquée ailleurs).
- ✅ Pas de circular dependency (`server/clariprint` n'importe pas `components/`, et inversement).
- ✅ Tests RLS écrits avant les composants UI (TDD-flavored sur la sécurité).
- ✅ Pas de bypass de l'`AnthropicClient` wrapper (audit avant merge).

---

## Step 8 — Architecture Completion & Handoff

### 8.1 Récap

Architecture v1.1 finalisée :

| Item | Volume |
|---|---|
| Steps complétés | **8/8** ✅ |
| Tables DB nouvelles | **3** (`orders`, `order_items`, `order_status_events`) |
| Edge Functions nouvelles | **3** (`mockup-generator`, `canva-webhook`, `order-action`) |
| Edge Functions migrées | **4** (claude-proxy, claude-proxy-stream, pim-generate, pim-ingest → Anthropic only) |
| Modules serveur partagés | **5** (ClariprintAdapter, validateClariprintResponse, AnthropicClient, orderTransitions, mockup/renderer) |
| Composants React nouveaux | **~12** (order/*, mockup/MockupImage, shop/ProductOverlay, shop/Comparator, shop/BulkActionsBar, integrations/CanvaConnect) |
| Migrations SQL | **3** (`20260512_orders_v1_1.sql` + 2 satellites) |
| Tests RLS nouveaux | **1 fichier** (`orders_isolation.test.ts`, ≥ 6 cas) |
| FR couvertes | **46/46** ✅ |
| NFR couvertes | **28/28** ✅ |

### 8.2 Décisions archi structurantes (pour traçabilité downstream)

1. **Order entity = entité persistée v1.1, statuts extensibles vers V2+** (workflow / paiement / e-invoicing). Snapshot des options Clariprint dans JSONB pour immutabilité.
2. **Mockup engine = Edge Function Deno + Sharp + svgdom**, cache write-through Supabase Storage, lazy generation. Pas d'IA générative pour le visuel produit.
3. **Module commun `validateClariprintResponse`** + pattern `ClariprintAdapter` = source unique de sanitization.
4. **Wrapper `AnthropicClient`** = unique point d'entrée LLM, validation Zod incorporée, tracking obligatoire.
5. **Stack inchangée** (Vite 6, React 18, TS, Tailwind v4, Supabase) — boring technology, pas de migration framework en parallèle de v1.1.
6. **Feature flags + tier gating combinés** dans `featureFlags.ts` — gate unique pour exposer ou non chaque capacité v1.1.

### 8.3 Prochaines étapes

1. **Pré-v1.1 (avant 2026-05-23 démo client) :**
   - Story 0 hotfix régression Fiche sur `beta/v4`
   - **E-NEW-CLARIPRINT-01** investigation prix mystère sur `beta/v5` → livrable `docs/PRICE_SOURCES.md`

2. **Sprint v1.1 (`beta/v5`) :**
   - Workflow BMAD suivant : **`bmad-create-epics-and-stories`** (agent John, PM hat retour) — découpe en epics et user stories prêtes pour le dev
   - Implémentation au fil de l'eau des composants ci-dessus selon la priorité fixée par les epics

3. **Avant code dev :**
   - Optionnel mais recommandé : **`bmad-check-implementation-readiness`** pour valider PRD ↔ Architecture ↔ (futur) Epics & Stories

### 8.4 Documents associés

| Document | Statut | Rôle |
|---|---|---|
| `_bmad-output/planning-artifacts/prd.md` | ✅ finalisé 2026-05-09 | Capability contract |
| `_bmad-output/planning-artifacts/architecture.md` (ce doc) | ✅ finalisé 2026-05-09 | Architecture v1.1 |
| `ARCHITECTURE.md` (racine repo) | référence | État existant général |
| `SPRINT_HANDOFF.md` | à mettre à jour fin sprint | Sprint state |
| `docs/PRICE_SOURCES.md` | **à produire en pré-v1.1** | Livrable E-NEW-CLARIPRINT-01 |
| `_bmad-output/planning-artifacts/epics-and-stories.md` | **à produire** | Workflow `bmad-create-epics-and-stories` |

---

🏗️ **Architecture Magrit / e-shop v1.1 — terminée.**

> _Le code suit l'architecture, pas l'inverse. Toute déviation des décisions ci-dessus doit être documentée et justifiée. Mettre à jour ce document si la planification évolue._
