---
stepsCompleted:
  - step-01-validate-prerequisites
  - step-02-design-epics
  - step-03-create-stories
  - step-04-final-validation
inputDocuments:
  - path: prd.md
    role: source_of_FR_NFR
    fr_count: 46
    nfr_count: 28
  - path: architecture.md
    role: technical_decisions
    decisions_count: 15
  - path: ../../CONTEXT_Magrit_IA.md
    role: project_context
status: complete
completedAt: 2026-05-09
target_branch: beta/v5
hotfix_branch: beta/v4
target_iteration: e-shop-v1.1
total_epics: 7
total_stories: 30
---

# Magrit / e-shop v1.1 — Epic Breakdown

## Overview

Découpage du PRD (46 FR + 28 NFR) et de l'Architecture v1.1 (15 décisions structurantes) en **7 epics** centrés sur la **valeur utilisateur**, totalisant **30 user stories** sprint-ready avec critères d'acceptance Given/When/Then.

**Mode delivery :** phased (MVP / Growth / Vision tel que verrouillé en PRD step 8). Chaque story est complétable par un dev agent unique. Aucune story ne dépend d'une story future au sein du même epic. Les tables / entités sont créées **uniquement par la première story qui en a besoin**.

**Convention d'identifiant story :** `S{epic}.{seq}` (ex: `S2.3` = epic 2, story 3).

---

## Requirements Inventory

### Functional Requirements (46) — Référence PRD § Functional Requirements

| Domaine | Range FR |
|---|---|
| D1 — Tenants, boutiques, membres | FR1-7 |
| D2 — Contrôle d'accès / permissions | FR8-10 |
| D3 — Devis & configuration produit | FR11-17 |
| D4 — Cycle de vie commandes (Order entity) | FR18-24 |
| D5 — Visuels & workflow design | FR25-29 |
| D6 — Boutique storefront B2B | FR30-35 |
| D7 — Abonnements, quotas, conformité | FR36-40 |
| D8 — Stack LLM & observabilité | FR41-43 |
| D9 — Qualité, tests, DoD | FR44-46 |

### NonFunctional Requirements (28) — Référence PRD § Non-Functional Requirements

| Catégorie | Range NFR |
|---|---|
| Performance | NFR1-5 |
| Security | NFR6-12 |
| Scalability | NFR13-17 |
| Accessibility | NFR18-20 |
| Integration & Reliability | NFR21-25 |
| Reliability | NFR26-28 |

### Additional Requirements (issues d'Architecture)

| Code | Source | Description |
|---|---|---|
| **ADR-1** | Archi §4.1 | Order entity = 3 tables (`orders`, `order_items`, `order_status_events`), enum `order_status`, snapshots Clariprint en JSONB |
| **ADR-2** | Archi §4.2 | Policies RLS `orders/*` + tests vitest ≥ 6 cas |
| **ADR-3** | Archi §4.3 | Mockup engine = Edge Function Deno + Sharp + svgdom, cache write-through Storage |
| **ADR-4** | Archi §4.4 | `ClariprintAdapter` pattern + module commun `validateClariprintResponse` + `ClariprintError` typé |
| **ADR-5** | Archi §4.5 | Wrapper `AnthropicClient` unique, validation Zod incorporée, tracking `llm_usage_events` |
| **ADR-6** | Archi §4.6 | Connecteur Canva via OAuth 2.0 Connect + table `tenant_integrations`, webhook signature HMAC |
| **ADR-7** | Archi §4.7 | Affinity = investigation Claude Cowork préalable obligatoire avant toute implémentation |
| **ADR-8** | Archi §4.8 | Feature flags + tier gating combinés dans `featureFlags.ts` |
| **PRE-1** | PRD § Domain | E-NEW-CLARIPRINT-01 = investigation provenance des prix (livrable `docs/PRICE_SOURCES.md`) — **pré-v1.1 obligatoire** |
| **HOT-1** | PRD § Product Scope | Story 0 hotfix régression Fiche sur `beta/v4` — démo client J+15 (cible 2026-05-23) |

### UX Design Requirements

> _Pas de doc UX dédié pour v1.1 (brownfield, design system B2 déjà en place via `.design-handoff/`). Les UX-DRs sont incluses dans les ACs des stories Epic 2 (Boutique premium) — dark mode, layout 3 colonnes, theming par boutique, accessibilité minimale clavier + alt-text._

### FR Coverage Map (FR → Story)

| FR | Stories couvrantes |
|---|---|
| FR1 | (existant — pas v1.1) |
| FR2 | (existant — pas v1.1) |
| FR3 | (existant — pas v1.1) |
| FR4 | S6.1 (compteur boutiques par tenant + middleware blocage) |
| FR5 | (existant E9.5 livré) |
| FR6 | (existant E9.3 livré) |
| FR7 | (existant — étendu via S3.5 audit Order) |
| FR8 | S3.5 (extension permissions Order) |
| FR9 | (existant — fix `7881bcb`) |
| FR10 | S1.4 (RLS Order entity) + tests S1.4 |
| FR11 | (existant + couvert par S1.3 wrapper LLM) |
| FR12 | (existant + couvert par S1.3 wrapper LLM) |
| FR13 | S1.2 (sanitization Clariprint) |
| FR14 | (existant — pas v1.1) |
| FR15 | S2.4 (overlay ProductCard) |
| FR16 | S2.5 (recalcul live conditionnel) |
| FR17 | S2.6 (publication devis dans boutique cliente) |
| FR18 | S3.2 (création commande depuis panier) |
| FR19 | S3.1 (OrderHistoryTable) |
| FR20 | S3.3 (bouton Renouveler) |
| FR21 | S3.4 (annulation acheteur) |
| FR22 | S3.4 (annulation admin tenant) |
| FR23 | S3.5 (audit trail + RPC) |
| FR24 | S1.4 (schéma `orders` extensible PA/PPF) |
| FR25 | S4.1 (Edge Function mockup-generator) + S4.3 (MockupImage component) |
| FR26 | S4.1 (Storage bucket + cache) |
| FR27 | S4.2 (5 templates MVP) + S4.4 (10 Growth) |
| FR28 | S5.1 (OAuth Canva) + S5.2 (webhook + Storage) + S5.3 (UI design button) |
| FR29 | S5.4 (investigation Affinity conditionnelle) |
| FR30 | S2.1 (ShopLayout 3 colonnes dark mode) |
| FR31 | S2.7 (home boutique enrichie) |
| FR32 | S2.2 (catalogue gammes persistantes) |
| FR33 | S2.8 (multi-sélection) |
| FR34 | S2.9 (comparateur) |
| FR35 | S2.10 (actions groupées) |
| FR36 | S6.2 (compteur devis mensuel + blocage) |
| FR37 | S6.1 (compteur boutiques par tenant) |
| FR38 | S6.3 (featureFlags.ts étendu + tier gating) |
| FR39 | (RGPD pris en charge transversalement par RLS + droits effacement existants) |
| FR40 | S1.3 (wrapper AnthropicClient + tracking étendu) |
| FR41 | S1.3 (wrapper AnthropicClient) + S1.5/1.6/1.7 (migrations endpoints) |
| FR42 | S1.3 (validation Zod incorporée) |
| FR43 | S1.3 (limite 25 paramètres dans wrapper) |
| FR44 | DoD globale (toute story ajoute cas TF Notion) |
| FR45 | DoD globale (testid stables) |
| FR46 | DoD globale (centralisation `testIds.ts`) |
| FR-ECOM-01 | S2.11 (bandeau catégorie couleur-codé) |
| FR-ECOM-02 | S2.12 (badges d état commercial) |
| FR-ECOM-03 | S2.13 (puces attributs PIM) |
| FR-ECOM-04 | S2.14 (mockup-signature de famille) |
| FR-ECOM-05 | S2.15 (bloc Nouveautés home) |
| FR-ECOM-06 | S2.16 (devis en cours + reprise home) |
| FR-ECOM-07 | S2.17 (best-sellers secteur) + ADR §4.14 |
| FR-ECOM-08 | S2.18 (méga-menu 2 niveaux) |
| FR-ECOM-09 | S2.19 (fil d Ariane + facettes légères) |
| FR-ECOM-10 | S2.20 (landing catégorie éditorialisée) |
| FR-ECOM-11 | S2.21 (recherche + fallback Magrit) + ADR §4.15 |
| FR-ECOM-12 | S2.22 (nav intention IA) |
| FR-ECOM-13 | S2.23 (cross-sell home Magrit) |
| FR-ECOM-14 | S2.24 (product finder guidé) |
| FR-ECOM-15 | S2.25 (auto-génération descriptions/SEO) |
| FR-ECOM-16 | S2.26 (fiche rassurance B2B) |
| FR-ECOM-17 | S2.27 (paliers de prix dégressifs) |
| FR-ECOM-18 | S2.28 (Magrit vendeur sur fiche) |
| FR-ECOM-19 | S2.29 (favoris/listes récurrentes) + ADR §4.13 |
| FR-ECOM-20 | S2.31 (consolidation admin boutique) |

**Couverture vérifiée : 46/46 FR v1.1 + 20/20 FR-ECOM ont au moins une story OU sont déjà livrées en sprints précédents.**

---

## Epic List

| # | Epic | User value | Stories | Phase |
|---|---|---|---|---|
| **0** | Pré-sprint Démo Readiness | Imprimeur peut démontrer Magrit à un prospect sans incident | 2 | Pré-v1.1 (`beta/v4` + `beta/v5`) |
| **1** | Stack Foundations (LLM unifié + Clariprint sanitized + Order tables) | Plateforme stable, performante, prête pour la suite | 4 | MVP (`beta/v5`) |
| **2** | Boutique B2B Premium Experience | Acheteur expérimente un portail digne d'un standard pro 2026 | 10 | MVP + Growth (`beta/v5`) |
| **3** | Module Commandes (Order entity user-facing) | Acheteur retrouve et renouvelle ses commandes ; imprimeur trace tout | 5 | MVP (`beta/v5`) |
| **4** | Mockup Engine paramétrique | 100 % des produits ont un visuel cohérent dès J1 | 4 | MVP + Growth (`beta/v5`) |
| **5** | Connecteurs design (Canva quick-win + Affinity conditionnel) | Design délégué aux outils des acheteurs sans studio interne | 4 | Growth (`beta/v5`) |
| **6** | Quotas, feature flags & tier gating | Engagements commerciaux respectés par tier sans friction UX | 3 | MVP (`beta/v5`) |

**Logique d'enchaînement (révisé R3 Implementation Readiness 2026-05-09) :**

```
Epic 0 (pré-sprint S0.1 + S0.2)
   ↓
Epic 1 (Foundations : S1.1 → S1.2 → S1.3 → S1.4)
   ↓
Epic 4 priorité haute (S4.1a → S4.1b → S4.1c → S4.2 → S4.3)  ← NOUVEAU R3 : Mockup avant ProductCard
   ↓
Epics 2 / 3 / 6 en parallèle (Epic 2 S2.3 dépend S4.3 pour MockupImage)
   ↓
Epic 5 + Epic 2 Growth (S2.8-2.10) + Epic 4 Growth (S4.4)
```

**Note R3 :** S2.3 (ProductCard variante boutique) consomme `MockupImage` de S4.3. Pour éviter le blocage parallèle, Epic 4 livre ses 3 premières stories (S4.1a/b/c → S4.2 → S4.3) avant que Epic 2 démarre S2.3. Aucune autre dépendance forward-référencée.

---

## Epic 0 — Pré-sprint Démo Readiness

**Goal :** Permettre à Bruno (imprimeur Pro) de démontrer Magrit à Vincent Gillier (Imprimerie du Roi) le **2026-05-23 au plus tard** sans incident démo-killer, et clarifier la provenance des prix avant d'engager le sprint v1.1 sur des fondations claires.

> _Cette epic est exécutée AVANT le sprint v1.1 principal. La Story 0.1 vit sur `beta/v4` (hotfix). La Story 0.2 vit sur `beta/v5` mais est conduite en parallèle, **précondition obligatoire** avant toute story Epic 1+._

### Story S0.1 — Hotfix régression Fiche home Magrit (sur `beta/v4`)

As an **imprimeur Pro qui prépare une démo client**,
I want que l'onglet "Fiche" depuis une ProductCard sur la home Magrit affiche correctement les informations commerciales,
So that je puisse présenter les détails d'un devis à un prospect sans page blanche.

**Contexte :** régression silencieuse introduite après Sprint 2 (P05/P08). `beta/v4` doit être patchée et redéployée. Pas de propagation vers `beta/v5`.

**Acceptance Criteria :**

**Given** un tenant existant avec ≥ 1 devis sauvegardé en historique
**When** l'utilisateur depuis la home Magrit clique sur une ProductCard d'un devis et clique sur l'onglet "Fiche"
**Then** les infos commerciales du devis s'affichent intégralement (titre, descriptif, conditions tarifaires, marge, délai)
**And** aucune page blanche, aucune erreur console, aucun layout cassé

**Given** la régression Fiche est corrigée
**When** la suite de tests TF Notion P00→P09 est rejouée par Claude in Chrome sur `beta/v4`
**Then** 100 % des cas TF qui passaient avant Sprint 2 passent à nouveau
**And** un nouveau cas TF "ProductCard → Fiche" est ajouté avec testid stable pour prévenir une nouvelle régression

**Given** le fix est mergé sur `beta/v4`
**When** Bruno joue son scénario démo
**Then** le parcours est fluide, sans incident démo-killer

**Branche cible :** `beta/v4` (pas `beta/v5`).
**Effort :** S (≤ 1 jour).
**Date butoir :** 2026-05-23.

### Story S0.2 — Investigation provenance des prix (E-NEW-CLARIPRINT-01)

As an **architecte produit Magrit**,
I want comprendre toutes les sources de prix et infos produits affichées dans Magrit,
So that l'architecture Order entity v1.1 ne soit pas bâtie sur des fondations opaques (anomalie connue : un 2e prix affiché de provenance inconnue, plus le -1,2 € intermittent côté Clariprint).

**Acceptance Criteria :**

**Given** le code Magrit actuel sur `beta/v5`
**When** l'architecte audite tous les composants front qui affichent un prix (atelier, ProductCard, boutique, devis)
**Then** un diagramme de flux 1 page recense **toutes** les sources de prix par écran
**And** un document `docs/PRICE_SOURCES.md` est produit listant : provenance, conditions d'affichage, comportement en cas d'anomalie Clariprint (-1,2 €, undefined, missing)

**Given** Clariprint renvoie un prix négatif ou un payload invalide
**When** l'architecte teste le comportement de la couche IA face à ça
**Then** le comportement actuel est tracé (Clariprint envoie-t-il quand même les infos produits ? La couche IA hallucine-t-elle un prix de fallback ?)
**And** une décision est tranchée avec Arnaud : supprimer le 2e prix / le marquer comme estimation LLM / corriger le fallback

**Given** l'investigation est terminée
**When** l'architecte présente les findings
**Then** Arnaud valide les actions correctives à intégrer en début Epic 1
**And** les éventuelles corrections de bug sont scopées comme tâches additionnelles à Epic 1 (pas une story à part entière, ajustement contextuel)

**Branche cible :** `beta/v5`.
**Effort :** S (1-2 jours investigation + 0,5 jour cleanup).
**Précondition obligatoire avant :** S1.1 (Order entity), S1.2 (sanitization Clariprint), S2.5 (overlay recalcul live).

---

## Epic 1 — Stack Foundations

**Goal :** Mettre en place les modules d'infrastructure qui sous-tendent toutes les features v1.1 : LLM unifié Anthropic, sanitization Clariprint isolée, Order entity DB-side avec RLS, traçabilité observabilité. **Aucun composant utilisateur final livré dans cette epic** — c'est de la fondation technique, prérequis pour Epics 2-6.

### Story S1.1 — Wrapper AnthropicClient + Zod validation + tracking

As a **dev Magrit**,
I want un wrapper unique `AnthropicClient` pour tous les appels LLM avec validation Zod et tracking automatique,
So that les futurs endpoints v1.1 héritent de la sécurité (limite 25 params, schéma JSON strict) et de l'observabilité sans dupliquer la logique.

**Acceptance Criteria :**

**Given** le projet sur `beta/v5`
**When** le dev crée `src/server/llm/AnthropicClient.ts` exposant `complete()` et `completeStructured(schema)`
**Then** le wrapper utilise `@anthropic-ai/sdk` exclusivement
**And** `completeStructured` valide la sortie LLM contre le schéma Zod fourni avant retour
**And** chaque appel insère une ligne dans `llm_usage_events` (model, input_tokens, output_tokens, latency_ms, validation_passed)
**And** la limite de 25 paramètres par prompt est appliquée (FR43, story 2.4 P0)
**And** un test vitest unit couvre `complete()`, `completeStructured()` (valid + invalid schema), tracking insert

**Effort :** S.
**FR couverts :** FR41, FR42, FR43, FR40 (extension `llm_usage_events`).
**ADR :** ADR-5.

### Story S1.2 — ClariprintAdapter + validateClariprintResponse + ClariprintError typé

As a **dev Magrit**,
I want une abstraction `ClariprintAdapter` avec sanitization défensive intégrée et erreurs typées,
So that les endpoints v1.1 (overlay, mockup, order) consomment Clariprint sans risque d'exposition de payloads invalides à l'utilisateur.

**Acceptance Criteria :**

**Given** le projet sur `beta/v5`
**When** le dev crée `src/server/clariprint/` (ClariprintAdapter interface, ClariprintHttpAdapter impl, ClariprintMockAdapter impl, validateClariprintResponse, errors.ts)
**Then** toute interaction avec Clariprint passe par cet adapter (pas d'appel `fetch` direct ailleurs)
**And** `validateClariprintResponse(payload)` retourne `{valid, errors[], sanitized}` et est appelée à l'intérieur de l'adapter avant tout retour
**And** `ClariprintError` est discriminée par `kind` ∈ {`negative_price`, `undefined_field`, `missing_required_product`, `network`, `unknown`}
**And** `ClariprintMockAdapter` est utilisable dans les tests vitest avec scénarios configurables

**Given** Clariprint renvoie un prix négatif (-1,2 €)
**When** un consommateur appelle `clariprint.computePrice(...)`
**Then** le wrapper throw une `ClariprintError({ kind: 'negative_price', ... })` avant d'exposer la valeur

**Effort :** M.
**FR couverts :** FR13.
**NFR couverts :** NFR11, NFR21, NFR22.
**ADR :** ADR-4.
**Précondition :** S0.2 (findings investigation prix peuvent influencer la spec exacte).

### Story S1.3 — Migration GPT-4o → Claude Haiku 4.5 sur endpoints existants

As a **product owner Magrit**,
I want toute "génération rapide" Magrit (PIM, descriptifs, mockup artwork) bascule sur Claude Haiku 4.5 via le wrapper `AnthropicClient`,
So that la qualité des prompts (validation JSON stricte) s'améliore, le coût ÷ 2.5, la latence baisse de 30 %, et la stack devient mono-vendor Anthropic.

**Acceptance Criteria :**

**Given** le wrapper `AnthropicClient` est livré (S1.1)
**When** le dev migre `supabase/functions/pim-generate` et `pim-ingest`
**Then** ces endpoints n'utilisent plus le SDK OpenAI
**And** ils appellent `anthropicClient.completeStructured()` avec le modèle `claude-haiku-4-5-20251001`
**And** les schémas Zod existants sont conservés ou ajustés
**And** un test vitest A/B confirme que les sorties sur 10 prompts de référence sont qualitativement équivalentes ou supérieures à la baseline GPT-4o

**Given** la migration PIM est validée
**When** le dev migre les endpoints chat strict (`claude-proxy`, `claude-proxy-stream`) si encore non-Anthropic
**Then** ces endpoints utilisent `claude-sonnet-4-…` via le wrapper
**And** le streaming SSE est préservé (pas de régression E3.1+E3.2)

**Given** tous les endpoints sont migrés
**When** le dev supprime le SDK `openai` du `package.json`
**Then** `pnpm install` réussit sans dépendance OpenAI
**And** `featureFlags.ENABLE_LEGACY_GPT4O` est définitivement à `false`
**And** la métrique "taux de retries observés en prod" mesurée via `llm_usage_events` montre une réduction ≥ 30 % vs baseline (pleine cible -50 % NFR5 mesurable à 30j)

**Effort :** M.
**FR couverts :** FR41.
**NFR couverts :** NFR4, NFR5.
**Code story :** **E-NEW-LLM-01** (P0 parallèle). À traiter au plus tôt dans le sprint.

### Story S1.4 — Order entity DB schema + RLS + tests vitest

> **⚠️ Note 2026-05-09 (post-application migration) :** les tables SQL portent le préfixe `tenant_*` (ex `public.tenant_orders`, `public.tenant_order_items`, `public.tenant_order_status_events`, RPC `update_tenant_order_status()`) pour éviter la collision avec les tables legacy `public.orders` et `public.shop_orders`. Le naming logique côté code reste **Order** / **OrderItem**. Cf. Architecture §4.1 pour le détail du mapping. Migration appliquée : `supabase/migrations/20260509_01_e1_orders_v1_1.sql`.


As a **dev Magrit**,
I want le schéma Order entity (orders, order_items, order_status_events) appliqué en migration Supabase avec RLS strict et 6 tests d'isolation,
So that toute story aval Epic 3 (user-facing commandes) puisse s'appuyer sur des fondations DB sécurisées et anti-fuite cross-tenant.

**Acceptance Criteria :**

**Given** la migration `supabase/migrations/20260512_orders_v1_1.sql`
**When** le dev applique la migration sur le projet Supabase `ightkxebexuzfjdbpsdg`
**Then** les 3 tables `orders`, `order_items`, `order_status_events` existent avec le schéma défini en Architecture §4.1
**And** l'enum `order_status` existe avec les 7 valeurs
**And** les index sur `tenant_id`, `shop_id`, `created_by`, `status`, `order_id` sont créés
**And** les colonnes hooks e-invoicing (`invoice_number`, `invoice_status`, `pa_id`, `ppf_message_id`) sont nullable et présentes
**And** les `ON DELETE CASCADE` et `RESTRICT` sont conformes à la spec

**Given** les tables sont créées
**When** le dev applique les policies RLS définies en Architecture §4.2
**Then** un user du tenant A ne peut SELECT / INSERT / UPDATE / DELETE aucune ligne du tenant B
**And** un acheteur shop_only voit uniquement les commandes des `allowed_shop_ids`
**And** un superadmin Magrit bypasse les guards (cf. fix `7881bcb`)

**Given** le fichier `tests/rls/orders_isolation.test.ts` existe
**When** vitest exécute la suite de tests
**Then** au moins 6 cas passent : (1) cross-tenant SELECT bloqué, (2) cross-tenant INSERT bloqué, (3) cross-shop SELECT bloqué pour acheteur shop_only, (4) cancel sans permission bloqué, (5) superadmin bypass OK, (6) RPC `update_order_status` respecte la matrice de transitions

**Effort :** M.
**FR couverts :** FR10, FR18-24.
**NFR couverts :** NFR6, NFR9, NFR16.
**ADR :** ADR-1, ADR-2.

---

## Epic 2 — Boutique B2B Premium Experience

**Goal :** Refondre la boutique `/shop/:slug` du proto v1 (Beta 3) vers un portail B2B premium digne des standards d'achat pros 2026 — layout 3 colonnes dark mode, header brandé tenant, catalogue par gammes persistantes, ProductCard avec overlay configuration Clariprint, home enrichie, multi-sélection, comparateur, actions groupées. C'est l'epic le plus volumineux (10 stories socle S2.1-S2.10 **+ 20 stories extension e-commerce standard S2.11-S2.31**, cf. section « Extension Epic 2 » ci-après) parce que tout converge sur les mêmes fichiers `src/components/shop/*` (consolidation justifiée).

### Story S2.1 — ShopLayout 3 colonnes + dark mode + header brandé

As an **acheteur B2B sur la boutique d'un imprimeur**,
I want un layout moderne en 3 colonnes (gammes / produits / panier) en dark mode avec le branding de la boutique en haut,
So that je travaille dans un environnement aligné aux standards corporate 2026.

**Acceptance Criteria :**

**Given** la route `/shop/:slug` chargée pour un tenant configuré (logo + couleur primaire)
**When** la page rend
**Then** un layout 3 colonnes (gauche navigation gammes, centre grille produits, droite panier sticky) s'affiche
**And** le dark mode est actif par défaut (background sombre, text clair)
**And** le header en haut affiche le logo du tenant + nom boutique + (si user shop_only) menu utilisateur compact
**And** les couleurs primaire / secondaire de la boutique cliente sont appliquées dynamiquement (theming)

**Given** un user shop_only authentifié
**When** il accède à `/shop/:slug` d'une boutique non-listée dans `allowed_shop_ids`
**Then** un 403 / redirect propre est rendu (pas de fuite de contenu)

**Given** les data-testid `shop-portal`, `shop-header`, `shop-header-logo`, `shop-nav-gammes`, `shop-grid-products`, `shop-cart-sticky` sont présents et stables
**When** Claude in Chrome rejoue le cas TF P09
**Then** la navigation clavier complète + les contrastes WCAG AA sont vérifiés

**Effort :** M.
**FR couverts :** FR30.
**NFR couverts :** NFR18, NFR19.

### Story S2.2 — Catalogue par gammes dépliables et persistantes

As an **acheteur B2B**,
I want déplier les gammes de produits que je veux explorer et que ma sélection persiste entre interactions,
So that je peux comparer plusieurs gammes sans perdre ma navigation à chaque clic.

**Acceptance Criteria :**

**Given** un tenant avec ≥ 3 gammes souscrites (E9.6) et ≥ 5 produits par gamme
**When** l'acheteur déplie la gamme "cartes commerciales" puis déplie la gamme "brochures"
**Then** les deux gammes restent dépliées, leurs produits visibles dans la grille
**And** l'état déplié persiste sur navigation interne (filtres, recherche, retour de fiche)
**And** l'état déplié est conservé dans `localStorage` pour survivre à un refresh

**Given** plus de 50 produits affichés simultanément
**When** la page rend
**Then** la performance reste fluide (pas de lag scroll perceptible)

**Effort :** S.
**FR couverts :** FR32.

### Story S2.3 — ProductCard variante boutique avec image mockup

As an **acheteur B2B**,
I want voir une ProductCard claire avec visuel + nom + référence + bouton de configuration,
So that j'identifie immédiatement le produit et son visuel cohérent avec la boutique.

**Acceptance Criteria :**

**Given** un produit dans le catalogue boutique
**When** la ProductCard rend
**Then** l'image mockup paramétrique (composant `MockupImage` de S4.3) est affichée en haut de la carte
**And** le nom du produit + sa référence + un bouton "Configurer & ajouter" sont présents
**And** le bouton ouvre l'overlay (S2.4)

**Given** le mockup engine n'a pas encore généré l'image (cache miss)
**When** la ProductCard rend
**Then** un skeleton/placeholder est affiché pendant ≤ 300 ms (NFR2 MVP)
**And** le PNG remplace le skeleton dès qu'il est prêt

**Effort :** S.
**FR couverts :** FR25 (consommation mockup).

### Story S2.4 — Overlay ProductCard avec options Clariprint en `<select>`

As an **acheteur B2B**,
I want un panneau latéral d'édition produit avec toutes les options possibles (format, papier, finition, dorure, etc.) en listes déroulantes,
So that je configure mon produit sans risque d'erreur de saisie libre et avec uniquement les options réellement disponibles chez l'imprimeur.

**Acceptance Criteria :**

**Given** un acheteur clique "Configurer & ajouter" sur une ProductCard
**When** l'overlay s'ouvre en panneau latéral droit
**Then** toutes les options Clariprint du produit sont chargées via `ClariprintAdapter` et affichées en `<select>` HTML (pas de saisie libre)
**And** la quantité est en input numérique avec contraintes min/max selon Clariprint
**And** le prix initial calculé est affiché en temps réel

**Given** des options sont indisponibles selon les choix précédents
**When** l'utilisateur sélectionne une combinaison invalide
**Then** les `<select>` se mettent à jour pour ne montrer que les options valides
**And** un message clair explique l'indisponibilité

**Given** Clariprint renvoie un payload invalide (cf. S1.2)
**When** l'adapter throw une `ClariprintError`
**Then** l'overlay affiche un message d'erreur explicite (pas de spinner infini, NFR28)
**And** la ProductCard ne propose pas la commande tant que les options ne sont pas validées

**Effort :** M.
**FR couverts :** FR15.

### Story S2.5 — Recalcul prix dynamique dans l'overlay (conditionnel API Clariprint)

As an **acheteur B2B**,
I want voir le prix se mettre à jour instantanément quand je change une option dans l'overlay,
So that je comprends immédiatement l'impact tarifaire de mes choix.

**Acceptance Criteria :**

**Given** le feature flag `ENABLE_OVERLAY_LIVE_RECALC` est `true` ET l'API Clariprint supporte le recalcul rapide (< 2s)
**When** l'acheteur change une option (papier, format, finition, quantité)
**Then** le prix HT et TTC se mettent à jour dans l'overlay en ≤ 2 secondes (perçu comme "instantané")
**And** un indicateur de chargement discret est affiché pendant le recalcul

**Given** le feature flag est `false` OU le recalcul prend > 2s
**When** l'acheteur change une option
**Then** le prix précédent reste affiché avec un badge "Recalcul à la validation"
**And** le prix final est calculé au clic sur "Ajouter au panier"

**Given** Clariprint en panne pendant le recalcul
**When** une option est changée
**Then** un message d'erreur clair invite à réessayer
**And** la commande n'est pas bloquée (fallback prix dernière option valide)

**Effort :** M.
**FR couverts :** FR16.
**Note :** **conditionnel** — pari basé sur l'avancement API Clariprint. Si l'API n'est pas prête, cette story bascule en mode "recalcul à validation" sans bloquer.

### Story S2.6 — Publication d'un devis Magrit dans la boutique d'un client

As a **imprimeur Pro depuis l'atelier Magrit**,
I want en un clic publier un devis chiffré dans la boutique B2B d'un de mes clients,
So that mon client le retrouve immédiatement dans son catalogue boutique pour validation/commande.

**Acceptance Criteria :**

**Given** un imprimeur a généré un devis dans l'atelier
**When** il clique "Mettre à jour la boutique de [nom client]"
**Then** un dropdown affiche les boutiques du tenant accessibles à l'imprimeur
**And** la sélection d'une boutique publie le devis sous forme de produit dans le catalogue de cette boutique
**And** la home boutique de ce client est mise à jour (S2.7)
**And** une notification optionnelle email est envoyée au client (réutilise infra Resend E9.5)

**Given** l'imprimeur publie le devis dans une 2e boutique
**When** la 1re publication existe déjà
**Then** un duplicat est créé (un produit par boutique-client, immutable lié à la boutique)

**Effort :** S.
**FR couverts :** FR17.

### Story S2.7 — Home boutique enrichie (dernières commandes + paniers en attente)

As an **acheteur B2B**,
I want que la home de ma boutique affiche mes dernières commandes, mes paniers en attente, et mes fichiers produit en attente de production,
So que je retrouve mes affaires en cours en un coup d'œil sans naviguer.

**Acceptance Criteria :**

**Given** un acheteur connecté avec ≥ 1 commande passée
**When** il arrive sur la home `/shop/:slug`
**Then** une section "Mes 3 dernières commandes" affiche les commandes triées par date desc avec date, nom produit, statut, montant
**And** chaque ligne a un bouton "Renouveler" (S3.3) et "Voir détail"

**Given** l'acheteur a un panier non-validé
**When** la home rend
**Then** une section "Paniers en attente" affiche le panier avec les produits, total HT, et bouton "Reprendre"

**Given** des fichiers produit sont en attente de production (à enrichir post-Order workflow V2+)
**When** la home rend
**Then** la section "Fichiers en attente" est présente mais peut être vide en v1.1 si Order workflow non implémenté
**And** la structure est en place pour accueillir les données quand le workflow sera ajouté (V2+)

**Effort :** M.
**FR couverts :** FR31.

### Story S2.8 — Multi-sélection produits avec checkboxes

As an **acheteur B2B**,
I want sélectionner plusieurs produits à la fois via des checkboxes,
So que je puisse appliquer une action groupée sans répéter chaque action manuellement.

**Acceptance Criteria :**

**Given** la grille produits du catalogue boutique
**When** l'acheteur survole une ProductCard
**Then** une checkbox apparaît en coin
**And** un clic sur la checkbox ajoute/retire la carte à la sélection multi
**And** une barre flottante "N produits sélectionnés" + actions groupées (S2.10) s'affiche en bas

**Given** une sélection active
**When** l'acheteur navigue entre gammes
**Then** la sélection persiste (cohérent avec catalogue persistant S2.2)

**Effort :** S.
**FR couverts :** FR33.

### Story S2.9 — Comparateur de produits côte-à-côte

As an **acheteur B2B**,
I want comparer 2-4 produits côte-à-côte sur leurs caractéristiques (format, papier, finitions, prix),
So que je choisisse le bon produit sans avoir à naviguer entre les fiches.

**Acceptance Criteria :**

**Given** une multi-sélection de 2 à 4 produits (S2.8)
**When** l'acheteur clique "Comparer"
**Then** une vue comparateur s'ouvre en plein écran ou modal large
**And** les attributs clés (format, papier, finitions, délai, prix) sont alignés en colonnes
**And** les différences sont mises en évidence visuellement

**Given** une sélection > 4 produits
**When** l'acheteur clique "Comparer"
**Then** un message demande de réduire la sélection (max 4)

**Effort :** M.
**FR couverts :** FR34.

### Story S2.10 — Actions groupées (téléchargement fiches + devis groupé)

As an **acheteur B2B**,
I want télécharger les fiches techniques de plusieurs produits ou créer un devis groupé en un clic,
So que je gagne du temps sur les commandes multi-produits.

**Acceptance Criteria :**

**Given** une multi-sélection de N produits (S2.8)
**When** l'acheteur clique "Télécharger fiches techniques"
**Then** un fichier ZIP contenant les fiches PDF des N produits est généré et téléchargé
**And** la génération utilise les specs Clariprint via `ClariprintAdapter`

**Given** une multi-sélection
**When** l'acheteur clique "Créer un devis groupé"
**Then** un panier multi-produits est créé directement avec les options par défaut Clariprint
**And** l'acheteur est redirigé vers le panier pour ajustement

**Effort :** M.
**FR couverts :** FR35.

---

## Extension Epic 2 — Boutique standard e-commerce (brainstorming 2026-07-06)

> **Origine :** session brainstorming `_bmad-output/brainstorming/brainstorming-session-2026-07-03-1105.md` (facilitée Mary, cross-pollination Mixam/Onlineprinters/Exaprint + role playing). Objectif Arnaud : rapprocher la boutique des codes e-commerce standard sans casser l ADN Magrit (IA native, deviseur, multi-tenant).
>
> **Décisions d architecture actées** (opposables à toutes les stories ci-dessous) :
> 1. Card = 1 produit configurable (options dans la fiche/overlay S2.4) → filtres LÉGERS uniquement.
> 2. Nav identique acheteur et deviseur/atelier.
> 3. Home unique loggé/non-loggé (affichage adaptatif).
> 4. Boutique neuve = pré-remplie par l opérateur (pas de state vide à gérer).
> 5. PAS de paramétrage manuel opérateur → intelligence DANS LA DONNÉE (PIM + bibliothèques + historique commandes).
> 6. Un seul template général de boutique.
> 7. Rôles = réutilise l existant (S-ORDER-ROLES), pas d extension.
> 8. Écran admin boutique existant → à consolider (S2.31).
>
> **Réutilisation existant (NE PAS refaire) :** re-commande 1-clic = **S3.3 livré** · Mes commandes = **S3.1 livré** (enrichi ici via note S3.1+) · affectation PIM→boutique = **livré** (shop_products + A4 + bibliothèques) · mockups = **Epic 4 + pivot P18 livrés** · comparateur = **S2.9 déjà spécifié** (à coder, non dupliqué) · home dernières commandes + paniers = **S2.7 déjà spécifié** (étendu ici via S2.16).
>
> **FR couverts :** ces stories sont net-neuf au-delà du PRD v1.1 (FR1-46). Marquées `FR-ECOM-*` (à intégrer au PRD lors du prochain `bmad-edit-prd`).
>
> **Séquencement en 5 sprints** (respect DoD : 3-5 stories/sprint, split si > 3j) :
> - **Sprint E1 Lisibilité produit** : S2.11 · S2.12 · S2.13 · S2.14
> - **Sprint E2 Home utile** : S2.15 · S2.16 · S2.17 (+ note S3.1+)
> - **Sprint E3 Navigation** : S2.18 · S2.19 · S2.20 · S2.21
> - **Sprint E4 Différenciateurs IA** : S2.22 · S2.23 · S2.24 · S2.25
> - **Sprint E5 Fiche & confort B2B** : S2.26 · S2.27 · S2.28 · S2.29 (+ activation S2.9)
> - **Transverse** : S2.31 (consolidation admin, à démarrer par un audit)

### Story S2.11 — Bandeau catégorie couleur-codé + pictogramme signature

As an **acheteur B2B**,
I want que chaque produit affiche un repère visuel de sa famille (couleur + pictogramme) cohérent partout,
So that j identifie la catégorie d un produit en une seconde sans lire le titre.

**Acceptance Criteria :**

**Given** un référentiel de familles (Cartes, Flyers, Grand format, PLV, Packaging...) avec une couleur + un pictogramme par famille, dérivé du PIM (pas de saisie manuelle par boutique)
**When** une ProductCard rend dans la grille
**Then** un liseré coloré + le pictogramme de la famille sont affichés sur la carte
**And** le même repère apparaît sur la fiche produit, dans le panier et dans l historique commande (cohérence de bout en bout)

**Given** une famille sans couleur/pictogramme défini au PIM
**When** la carte rend
**Then** un repère neutre par défaut est appliqué (pas de carte cassée)

**Effort :** S.
**FR couverts :** FR-ECOM-01.
**Dépendances :** consomme le référentiel familles PIM ; testIds `shop-card-category-badge` (à déclarer dans `testIds.ts`).

### Story S2.12 — Badges d état commercial sur ProductCard

As an **acheteur B2B**,
I want repérer d un coup d œil les produits nouveaux, best-sellers, éco ou en délai express,
So that je priorise ma sélection sans ouvrir chaque fiche.

**Acceptance Criteria :**

**Given** un produit avec des attributs commerciaux DÉRIVÉS des données (date d ajout récente, volume de commandes, délai Clariprint, tag éco PIM)
**When** la ProductCard rend
**Then** les badges applicables (`Nouveau` / `Meilleure vente` / `Éco` / `Express 24h`) s affichent avec un vocabulaire visuel partagé par catégorie
**And** aucun badge n est saisi manuellement — tous sont calculés (règle « intelligence dans la donnée »)

**Given** un produit sans attribut commercial notable
**When** la carte rend
**Then** aucun badge n est affiché (pas de bruit visuel)

**Effort :** S.
**FR couverts :** FR-ECOM-02.
**Dépendances :** seuils (récence, volume best-seller) → **audit prod avant heuristique** (DoD principe 4) ; réutilisé par S2.15 (nouveautés) et S2.17 (best-sellers).

### Story S2.13 — Puces attributs PIM scan sur ProductCard

As an **acheteur B2B**,
I want voir les 3 attributs clés d un produit directement sur sa carte,
So que je compare rapidement les produits d une même famille sans ouvrir chaque fiche.

**Acceptance Criteria :**

**Given** un produit dont le PIM porte des attributs normalisés par catégorie (ex Flyer : format / grammage / finition)
**When** la ProductCard rend
**Then** jusqu à 3 puces d attributs clés (définies par famille) s affichent sous le titre
**And** les puces sont comparables d un produit à l autre de la même famille

**Given** des attributs PIM manquants
**When** la carte rend
**Then** seules les puces disponibles s affichent (pas de puce vide)

**Effort :** S.
**FR couverts :** FR-ECOM-03.
**Dépendances :** réutilise les 9 champs PIM (mémoire `feedback_pim_marketing_card`) ; NE PAS créer d onglet — enrichit la card + l onglet Fiche existant.

### Story S2.14 — Mockup-signature de famille comme identité catégorie

As an **acheteur B2B**,
I want que le visuel d un produit reflète le type d objet imprimé de sa famille de façon normalisée,
So que je reconnaisse l objet (carte, flyer, kakémono, boîte...) avant même de lire.

**Acceptance Criteria :**

**Given** les mockups pré-brandés P18 v2 (7 gabarits livrés) et l objectif d extension à toutes les gammes
**When** une famille ne dispose pas encore de son mockup-signature
**Then** un fallback générique par famille est utilisé (pas de card sans visuel)
**And** le backlog d extension mockups (affiches, banderoles, enveloppes, sacs, goodies, packaging...) est tracé comme dépendance visuelle

**Given** un mockup-signature disponible pour la famille
**When** la ProductCard et le méga-menu (S2.18) rendent
**Then** le mockup-signature est utilisé comme identifiant visuel de catégorie

**Effort :** S (code) — dépend de la production visuelle (hors code).
**FR couverts :** FR-ECOM-04.
**Dépendances :** consomme Epic 4 (`MockupImage` S4.3) + pipeline P18 v2 ; ne recode PAS le moteur mockup.

### Story S2.15 — Bloc « Nouveautés catalogue » sur la home

As an **acheteur B2B**,
I want voir les derniers produits ajoutés à ma boutique dès la home,
So que j aie une raison de revenir et que je découvre ce qui bouge.

**Acceptance Criteria :**

**Given** une boutique dont le catalogue reçoit de nouveaux produits (affectation PIM/bibliothèque)
**When** l acheteur arrive sur la home `/shop/:slug`
**Then** un carrousel « Nouveautés » affiche les N derniers produits intégrés, triés par date d ajout desc, avec badge `Nouveau` (S2.12)
**And** le tri est DÉRIVÉ de la donnée (date d ajout), sans réglage opérateur

**Given** une boutique sans ajout récent
**When** la home rend
**Then** le bloc se replie proprement (pas de section vide béante)

**Effort :** S.
**FR couverts :** FR-ECOM-05.
**Dépendances :** cohérent avec S2.7 (home) ; badge S2.12.

### Story S2.16 — Home : devis en cours + reprise (extension S2.7)

> **✅ Rescope décidé (Arnaud 2026-07-07) — OPTION C** : `QuotesProvider` est monté dans `AppShell` (dashboard/atelier), pas dans `PublicShop`. Donc **scinder** : « panier / reprise » sur la **home boutique** (`PortalHome`), et « devis en cours » sur la **home dashboard/atelier** (là où `QuotesProvider` est disponible). À implémenter au prochain run.

As an **acheteur B2B**,
I want retrouver sur la home mes devis en attente et mon panier non finalisé,
So que je reprenne mes affaires en cours en un clic.

**Acceptance Criteria :**

**Given** l acheteur a des devis (bibliothèque S-QUOTES livrée) au statut « en cours »
**When** la home rend
**Then** une section « Vos devis en attente » liste les devis avec nom client, montant, date, et bouton « Reprendre » (ouvre l éditeur devis)
**And** la section panier non finalisé de S2.7 reste présente

**Given** aucun devis ni panier en cours
**When** la home rend
**Then** la section ne s affiche pas

**Effort :** S.
**FR couverts :** FR-ECOM-06.
**Dépendances :** étend S2.7 ; réutilise S-QUOTES (`QuotesContext`, `DashboardQuoteEditor`).

### Story S2.17 — Bloc « Best-sellers de votre secteur »

> **⏸️ REPORTÉE / allégée POC (audit 2026-07-07, décision Arnaud)** : `tenants.siren_data` est **vide** (aucun NAF) et `tenant_order_items.product_id` est NULL (produit = `product_label`). **Décision Arnaud : Magrit = POC/démo → NE PAS construire de dépendance INSEE ni de blocage sur le signal secteur.** La dimension « secteur » est abandonnée pour cette version. Si un bloc best-sellers est souhaité pour la démo, livrer une version **démo-friendly simple** (top `product_label` commandés de la boutique, ou données de démo) — jamais un pipeline d enrichissement réel. La cible secteur k-anonymisée (ADR §4.14) reste documentée pour une éventuelle version production ultérieure, sans effort maintenant.

As an **acheteur B2B**,
I want voir les produits les plus commandés par des boutiques de mon secteur,
So que je m inspire des choix éprouvés sans configuration.

**Acceptance Criteria :**

**Given** l historique de commandes multi-tenant et le secteur du tenant courant (ex industrie/retail)
**When** la home rend
**Then** un bloc « Best-sellers de votre secteur » affiche les produits les plus commandés par des profils similaires, calculé automatiquement
**And** aucune curation manuelle n est requise (inféré des données)

**Given** volume de données insuffisant pour inférer un secteur
**When** la home rend
**Then** un fallback « Produits populaires » (best-sellers globaux boutique) est affiché

**Effort :** M.
**FR couverts :** FR-ECOM-07.
**Dépendances :** **audit prod** (volume commandes, définition secteur) avant heuristique (DoD principe 4) ; anti-fuite cross-tenant (agrégat anonymisé, RLS).

### Story S2.18 — Méga-menu 2 niveaux illustré

As an **acheteur B2B**,
I want un menu de navigation qui montre familles + sous-catégories avec un visuel,
So que je vois toute l arborescence sans multiplier les clics.

**Acceptance Criteria :**

**Given** un catalogue structuré en familles + sous-catégories (dérivé PIM)
**When** l acheteur survole/ouvre une famille dans le menu
**Then** un panneau affiche les sous-catégories en colonnes + une vignette vedette (mockup-signature S2.14)
**And** le méga-menu s auto-illustre depuis les données (pas de configuration boutique)

**Given** navigation clavier + lecteur d écran
**When** l acheteur parcourt le méga-menu
**Then** l accessibilité AA est respectée (focus visible, aria) — DoD principe 10 (route acheteur)

**Effort :** M.
**FR couverts :** FR-ECOM-08.
**Dépendances :** coexiste/relaie la sidebar gammes S2.2 ; consomme S2.14.

### Story S2.19 — Fil d Ariane + filtres à facettes légers

As an **acheteur B2B**,
I want un fil d Ariane et quelques filtres simples pour affiner la liste,
So que je me repère et réduis le catalogue sans repartir de zéro.

**Acceptance Criteria :**

**Given** une page catégorie/grille produits
**When** elle rend
**Then** un fil d Ariane `Accueil > Famille > Sous-catégorie` est affiché et cliquable
**And** un panneau de filtres LÉGERS (famille, usage/intention, délai, gamme de prix) généré depuis le PIM est disponible
**And** les filtres n incluent PAS les variantes techniques fines (car card = produit configurable, décision archi 1)

**Given** une combinaison de filtres sans résultat
**When** l acheteur applique les filtres
**Then** un état vide clair propose de réinitialiser ou « Demander à Magrit » (pont vers S2.21)

**Effort :** M.
**FR couverts :** FR-ECOM-09.
**Dépendances :** facettes dérivées PIM ; pont Magrit S2.21.

### Story S2.20 — Landing catégorie éditorialisée

As an **acheteur B2B**,
I want qu ouvrir une famille m amène sur une page structurée, pas une grille brute,
So que je comprenne l offre et trouve vite la bonne sous-catégorie.

**Acceptance Criteria :**

**Given** l acheteur clique une famille depuis le méga-menu ou la home
**When** la landing catégorie rend
**Then** elle affiche un titre + intro courte + sous-catégories en tuiles + best-sellers + la grille produits
**And** les contenus éditoriaux (intro, SEO/GEO) proviennent du PIM ou sont auto-générés (S2.25) — jamais de page vide

**Given** une famille sans contenu éditorial saisi
**When** la landing rend
**Then** le fallback auto-généré (S2.25) est utilisé

**Effort :** M.
**FR couverts :** FR-ECOM-10.
**Dépendances :** contenu auto S2.25 ; champs PIM marketing/SEO/GEO.

### Story S2.21 — Recherche produits + autocomplétion + fallback Magrit

As an **acheteur B2B**,
I want une barre de recherche qui suggère produits et catégories, et bascule sur Magrit si rien ne matche,
So que je ne tombe jamais dans un cul-de-sac.

**Acceptance Criteria :**

**Given** l acheteur saisit une requête dans la barre de recherche
**When** il tape ≥ 2 caractères
**Then** des suggestions instantanées (produits, familles) s affichent
**And** un clic mène au produit/à la catégorie

**Given** aucune correspondance
**When** la recherche ne retourne rien
**Then** un fallback « Demander à Magrit » ouvre le chat pré-rempli avec la requête (réutilise l IA conversationnelle existante)

**Effort :** M.
**FR couverts :** FR-ECOM-11.
**Dépendances :** réutilise Magrit chat + wrapper `anthropicClient` ; index de recherche dérivé PIM.

### Story S2.22 — Navigation par intention/usage pilotée IA

As an **acheteur B2B**,
I want des entrées de navigation par usage (« Pour un salon », « Ouvrir un commerce »...),
So que je trouve des produits par besoin, pas seulement par famille technique.

**Acceptance Criteria :**

**Given** le catalogue et les données PIM
**When** Magrit classe les produits par usage/intention (automatiquement, pas de rangement manuel)
**Then** des regroupements transverses par intention sont proposés dans la navigation
**And** ces regroupements se maintiennent seuls quand le catalogue grandit (re-classement IA)

**Given** un produit multi-usages
**When** le classement s exécute
**Then** il peut apparaître dans plusieurs regroupements d intention

**Effort :** L → **à scinder** (S2.22a classement IA batch + S2.22b UI navigation) si estimé > 3j (DoD principe 7).
**FR couverts :** FR-ECOM-12.
**Dépendances :** IA (Sonnet raisonnement) ; différenciateur vs benchmarks.

### Story S2.23 — Cross-sell home « Magrit vous suggère »

As an **acheteur B2B**,
I want des suggestions produits contextuelles basées sur mon historique,
So que je découvre des compléments pertinents sans chercher.

**Acceptance Criteria :**

**Given** l historique de commandes réel du tenant/acheteur
**When** la home rend pour un acheteur avec historique
**Then** un bloc « Magrit vous suggère » propose du cross-sell contextuel (ex : flyers salon → kakémonos assortis), déduit des séquences de commande réelles
**And** aucune règle de cross-sell n est saisie manuellement (inférence IA/données)

**Given** un acheteur sans historique
**When** la home rend
**Then** le bloc bascule sur une suggestion générique (best-sellers S2.17) ou se masque

**Effort :** M.
**FR couverts :** FR-ECOM-13.
**Dépendances :** historique commandes ; anti-fuite cross-tenant ; phare home (avec S3.3).

### Story S2.24 — Product finder guidé (wizard)

As an **acheteur B2B qui ne sait pas quoi choisir**,
I want répondre à 2-3 questions pour obtenir une recommandation produit,
So que je décide vite sans connaître le vocabulaire imprimeur.

**Acceptance Criteria :**

**Given** l acheteur ouvre « Je ne sais pas quoi choisir »
**When** il répond aux questions (usage / quantité / délai)
**Then** Magrit recommande 1 à 3 produits pertinents avec justification courte
**And** un CTA mène directement à la configuration (overlay S2.4)

**Given** des réponses incompatibles (ex délai express + très grande quantité)
**When** la reco s exécute
**Then** Magrit explique l arbitrage et propose la meilleure option disponible

**Effort :** M.
**FR couverts :** FR-ECOM-14.
**Dépendances :** IA structurée (`anthropicCompleteStructured`) ; Magrit en mode wizard.

### Story S2.25 — Auto-génération descriptions catégorie/SEO par Magrit

As an **imprimeur-opérateur**,
I want que les descriptions de catégorie et champs SEO/GEO manquants soient rédigés automatiquement,
So que mes pages ne soient jamais vides sans que j aie à écrire du contenu.

**Acceptance Criteria :**

**Given** une famille/landing (S2.20) sans intro ni champs SEO/GEO saisis
**When** la page est demandée
**Then** Magrit génère un contenu éditorial + méta SEO/GEO à partir du PIM, mis en cache
**And** l opérateur peut override (le généré est un défaut, pas un verrou)

**Given** un contenu déjà saisi manuellement au PIM
**When** la page rend
**Then** le contenu saisi prime (pas d écrasement)

**Effort :** M.
**FR couverts :** FR-ECOM-15.
**Dépendances :** IA génération (Haiku rapide) ; alimente S2.20.

### Story S2.26 — Fiche produit « rassurance B2B »

As an **acheteur B2B**,
I want voir délais, BAT/échantillon, garanties et contacts sur la fiche,
So que j achète en confiance sur un produit imprimé.

**Acceptance Criteria :**

**Given** une fiche produit
**When** elle rend
**Then** un bloc rassurance affiche délais chiffrés (Clariprint), option BAT/échantillon, garanties, et moyens de contact
**And** les données proviennent du PIM/Clariprint (pas de texte codé en dur)

**Given** une donnée de rassurance indisponible
**When** la fiche rend
**Then** l élément concerné est masqué proprement (pas de « N/A »)

**Effort :** M.
**FR couverts :** FR-ECOM-16.
**Dépendances :** `ClariprintAdapter` pour délais ; champs PIM.

### Story S2.27 — Paliers de prix dégressifs affichés

As an **acheteur B2B**,
I want voir l effet volume sur le prix unitaire sans ouvrir le configurateur,
So que je saisisse la valeur d une commande plus grande d un coup d œil.

**Acceptance Criteria :**

**Given** un produit avec paliers de quantité
**When** la card/fiche rend
**Then** un mini-tableau quantité → prix unitaire est affiché, calculé via `resolvePrice` (hiérarchie clariprint > library_cached > prix_marche > zero)
**And** la source de prix est signalée (badge « Prix marché » le cas échéant, cf. concept prix marché)

**Given** aucun prix disponible (zero)
**When** la card/fiche rend
**Then** le tableau est masqué et un CTA « Demander un devis » est proposé

**Effort :** S.
**FR couverts :** FR-ECOM-17.
**Dépendances :** `priceResolver.ts` existant ; anomalies Clariprint filtrées (`validateClariprintResponse`).

### Story S2.28 — Magrit vendeur sur la fiche produit

As an **acheteur B2B**,
I want poser une question sur un produit directement depuis sa fiche,
So que j obtienne une réponse contextualisée sans quitter la page.

**Acceptance Criteria :**

**Given** une fiche produit
**When** l acheteur clique « Poser une question sur ce produit »
**Then** le chat Magrit s ouvre pré-chargé du contexte produit (délais, options, prix, PIM)
**And** les réponses restent dans le périmètre du produit consulté

**Effort :** S.
**FR couverts :** FR-ECOM-18.
**Dépendances :** réutilise Magrit chat + contexte produit ; fil rouge IA de la boutique.

### Story S2.29 — Favoris / listes d achat récurrentes

As an **acheteur B2B**,
I want créer des listes nommées de produits ré-commandables,
So que je gère mes ré-appros récurrents en lot.

**Acceptance Criteria :**

**Given** un acheteur connecté
**When** il ajoute des produits à une liste nommée (ex « Papeterie agence », « Salon 2026 »)
**Then** la liste est persistée par utilisateur/tenant (RLS)
**And** il peut ré-commander toute la liste en lot (crée un panier/devis multi-produits)

**Given** un produit d une liste retiré du catalogue
**When** l acheteur ouvre la liste
**Then** l item est signalé indisponible sans casser la liste

**Effort :** M.
**FR couverts :** FR-ECOM-19.
**Dépendances :** capitalise sur re-commande S3.3 ; nouvelle table `shop_wishlists` (à valider par Winston).

### Story S2.31 — Consolidation de l écran d admin boutique

As an **imprimeur-opérateur**,
I want un écran d admin boutique clair et fiable pour monter/gérer la boutique d un client,
So que je publie une boutique par simple affectation de produits, sans paramétrage complexe.

**Acceptance Criteria :**

**Given** l écran d admin boutique existant (tableau de bord) — livré partiellement (A4 hero/tagline/palette, tarif per-shop, bibliothèques)
**When** on démarre la story
**Then** un **audit préalable** cartographie l existant (surfaces, dettes, incohérences) AVANT toute refonte (DoD principe 4 étendu)
**And** la consolidation privilégie l affectation de produits PIM→boutique (décision archi 5) et retire/évite tout paramétrage manuel superflu (pas de merchandising manuel, pas de drag & drop, pas de templates par secteur — idées #21/#22/#24 écartées en séance)

**Given** l opérateur monte une boutique client
**When** il affecte des produits depuis le PIM/bibliothèques
**Then** la boutique se peuple et les blocs home (nouveautés/best-sellers) se remplissent automatiquement (dérivés données)

**Effort :** M → **à scinder** après audit (le périmètre exact sort de l audit).
**FR couverts :** FR-ECOM-20.
**Dépendances :** audit d abord ; s appuie sur shop_products + A4 + bibliothèques existants.

> **Note S3.1+ (enrichissement, pas nouvelle story Epic 2) :** enrichir `OrderHistoryTable` (S3.1 livré) avec statuts visuels (En prod / Expédié / Livré) + tracking + bouton recommander déjà présent (S3.3). À traiter comme ajustement contextuel de S3.1 lors du Sprint E2, pas comme story XL.
>
> **Note comparateur :** l idée #18 (comparateur côte-à-côte) = **story S2.9 déjà spécifiée** ci-dessus. À coder au Sprint E5 (activation), pas de nouvelle story.

---

## Epic 3 — Module Commandes (Order entity user-facing)

**Goal :** Exposer côté utilisateur les capacités Order entity persistées en S1.4 : lecture historique, création depuis panier, renouvellement 1-clic, annulation, audit trail. Ne couvre PAS le workflow complet (validation/paiement/expédition reportés Vision V2+).

### Story S3.1 — OrderHistoryTable (lecture + filtres)

As an **acheteur B2B ou admin tenant**,
I want voir l'historique des commandes des boutiques auxquelles j'ai accès, avec filtres par statut/date/montant,
So que je retrouve facilement une commande passée pour la consulter ou la renouveler.

**Acceptance Criteria :**

**Given** un user avec `can_view_orders=true` sur un tenant ayant ≥ 5 commandes
**When** il accède à `/shop/:slug/orders` (ou `/dashboard/orders` pour admin tenant)
**Then** un tableau affiche les commandes triées par date desc avec : ID, date, boutique, créateur, statut (badge coloré), montant HT
**And** des filtres permettent de trier par statut (`draft`/`validated`/...), date, montant
**And** un acheteur shop_only voit UNIQUEMENT les commandes de ses `allowed_shop_ids`
**And** un admin tenant voit toutes les commandes du tenant

**Given** un user sans `can_view_orders`
**When** il tente d'accéder à la page
**Then** un 403 propre est rendu

**Effort :** S.
**FR couverts :** FR19.

### Story S3.2 — Création de commande depuis panier (statut `draft`)

As an **acheteur B2B**,
I want valider mon panier en une commande persistée en base,
So que je passe à l'étape commerciale, et l'imprimeur reçoit une notification.

**Acceptance Criteria :**

**Given** un acheteur avec un panier non-vide (≥ 1 produit avec options Clariprint configurées)
**When** il clique "Valider la commande"
**Then** une nouvelle ligne dans `orders` est créée avec statut `draft`, `tenant_id`, `shop_id`, `created_by`, total_ht
**And** une ligne par produit dans `order_items` avec `clariprint_options` snapshot en JSONB et `product_label` snapshot
**And** une notification email est envoyée à l'admin tenant (réutilise infra Resend)
**And** l'acheteur est redirigé vers la fiche commande qui vient d'être créée

**Given** l'acheteur n'a pas la permission `can_create_order`
**When** il tente de valider le panier
**Then** un message clair explique le manque de permission
**And** la commande n'est pas créée (RLS bloque l'INSERT)

**Effort :** S.
**FR couverts :** FR18.

### Story S3.3 — Bouton Renouveler 1-clic

As an **acheteur B2B**,
I want renouveler une commande passée en un clic avec pré-remplissage des options,
So que je gagne du temps sur les commandes récurrentes (cas Claire Mercier Journey 2).

**Acceptance Criteria :**

**Given** un acheteur sur l'OrderHistoryTable avec une commande passée non-`draft`
**When** il clique "Renouveler" sur une ligne
**Then** un nouveau panier est créé avec les mêmes produits + options Clariprint snapshotées
**And** l'acheteur est redirigé vers le panier pour ajuster la quantité avant validation
**And** les options invalides depuis (gammes désactivées, options Clariprint changées) sont signalées avec un message clair

**Given** l'acheteur ajuste la quantité dans le panier renouvelé
**When** il clique "Valider la commande"
**Then** une nouvelle commande `draft` est créée (S3.2) avec les options renouvelées
**And** la commande originale n'est pas modifiée

**Effort :** S.
**FR couverts :** FR20.

### Story S3.4 — Annulation commande `draft` (acheteur sur sienne, admin sur toutes)

As an **acheteur B2B (sur ses propres commandes) OR admin tenant (sur toutes les commandes du tenant)**,
I want annuler une commande en statut `draft`,
So que j'évite de l'engager si je change d'avis ou si elle est obsolète.

**Acceptance Criteria :**

**Given** un acheteur avec une commande en statut `draft` qu'il a créée
**When** il clique "Annuler"
**Then** le statut passe à `cancelled` via le RPC `update_order_status`
**And** un événement `order_status_events` est inséré (audit trail)
**And** la colonne `cancelled_at` est peuplée
**And** un acheteur qui n'est pas le créateur ne peut pas annuler (RLS bloque)

**Given** un admin tenant
**When** il annule n'importe quelle commande `draft` du tenant
**Then** la transition est autorisée
**And** `actor_id` dans l'événement est l'admin tenant (pas le créateur original)

**Given** une commande en statut `validated` ou supérieur
**When** un user tente l'annulation
**Then** la transition est refusée (matrice transitions)
**And** un message explique que les statuts > `draft` requièrent un workflow de retour V2+

**Effort :** S.
**FR couverts :** FR21, FR22.

### Story S3.5 — Audit trail order_status_events + RPC update_order_status

As a **dev Magrit**,
I want une fonction RPC unique pour toutes les transitions de statut Order, qui valide la matrice + log automatiquement l'événement audit,
So que `orders.status` ne soit jamais updatée directement et l'audit trail soit garanti.

**Acceptance Criteria :**

**Given** la table `order_status_events` (S1.4)
**When** le dev crée le RPC `update_order_status(order_id UUID, new_status order_status, reason TEXT DEFAULT NULL)`
**Then** le RPC vérifie la transition est légale selon la matrice (`draft` → `validated`/`cancelled` ; les transitions au-delà sont rejetées en v1.1)
**And** met à jour `orders.status` + `orders.updated_at`
**And** insère une ligne `order_status_events` avec actor_id = `auth.uid()`, from_status, to_status, reason, metadata={}, created_at
**And** retourne le row updated

**Given** le RPC est exposé
**When** un dev tente un UPDATE direct sur `orders.status` côté front
**Then** la convention impose de passer par `update_order_status` (revue de code, lint custom optionnel)
**And** les RLS policies de `orders.status` restreignent les UPDATE directs aux superadmin Magrit

**Given** une transition illégale (ex: `draft` → `delivered`)
**When** le RPC est appelé
**Then** une erreur explicite est levée
**And** rien n'est inséré ni updaté

**Given** les permissions order ajoutées (cf. extension permissions FR8)
**When** un user sans `can_cancel_order` (ou hors ownership/admin) tente l'annulation
**Then** le RPC vérifie la permission et refuse si manquante

**Effort :** M.
**FR couverts :** FR8 (extension), FR23.

---

## Epic 4 — Mockup Engine paramétrique

**Goal :** Garantir que 100 % des produits Magrit ont un visuel cohérent dès J1, alimenté par les specs Clariprint et le theming par boutique. MVP = 5 templates (couvre ~70 % des cas Clariprint print). Growth = 10 templates supplémentaires.

### Story S4.1a — Bucket Supabase Storage `product_mockups` + RLS + tests

As a **dev Magrit**,
I want le bucket Storage et ses policies RLS prêts pour accueillir les mockups paramétriques,
So que les stories suivantes (S4.1b, S4.1c) aient une infra de stockage validée.

**Acceptance Criteria :**

**Given** une migration Supabase
**When** le dev applique la création du bucket `product_mockups` avec structure `{tenant}/{shop_id}/{product_id}.png`
**Then** le bucket existe avec accès public-read sur les fichiers servis via CDN
**And** l'écriture est restreinte aux service_role (edge functions) via RLS
**And** un test vitest valide qu'un upload puis un GET retournent les bonnes bytes

**Effort :** S.
**FR couverts :** FR26.

### Story S4.1b — Pipeline de rendu SVG → PNG (sharp + svgdom) + 1er template flyer

As a **dev Magrit**,
I want un pipeline de génération PNG paramétrique fonctionnel sur 1 template (flyer),
So que la chaîne technique soit validée avant d'industrialiser sur les 4 autres templates MVP.

**Acceptance Criteria :**

**Given** le module `src/server/mockup/renderer.ts`
**When** le dev implémente la fonction `renderSvgToPng(template, productSpecs, shopTheming)`
**Then** un appel sur le template flyer avec specs Clariprint et couleur primaire boutique retourne un PNG 1024×1024 valide
**And** un test snapshot vitest verrouille le rendu de référence

**Effort :** M.
**FR couverts :** FR25, FR27 (1/5 templates).

### Story S4.1c — Edge Function `mockup-generator` + cache write-through + endpoint d'invalidation

As a **dev Magrit**,
I want l'Edge Function publique qui orchestre cache hit/miss + invalidation admin,
So que tout consommateur (ProductCard, comparateur) ait une URL stable et performante.

**Acceptance Criteria :**

**Given** la création d'une Edge Function `supabase/functions/mockup-generator/index.ts`
**When** le dev déploie via `supabase functions deploy mockup-generator --project-ref ightkxebexuzfjdbpsdg`
**Then** l'endpoint `GET /api/mockup?tenant=X&shop=Y&product=Z` est disponible
**And** cache HIT → 302 redirect CDN (latence ≤ 50 ms NFR2)
**And** cache MISS → orchestre `ClariprintAdapter` (S1.2) + `renderer` (S4.1b) + upload Storage + retour PNG (latence ≤ 300 ms NFR2)

**Given** un endpoint admin `POST /api/mockup/invalidate?shop=Y`
**When** un admin tenant modifie le branding boutique
**Then** tous les mockups de cette boutique sont invalidés (suppression Storage)

**Given** Clariprint indisponible
**When** la fonction tente de générer
**Then** un picto générique fallback est servi avec header `X-Mockup-Fallback: true`
**And** l'événement est logué dans `llm_usage_events` (extension)

**Effort :** M.
**FR couverts :** FR25, FR26.
**Précondition :** S4.1a + S4.1b livrées.
**ADR :** ADR-3.

> _Note R4 (Implementation Readiness 2026-05-09) : S4.1 d'origine scindée en S4.1a/4.1b/4.1c pour améliorer la mergeabilité et la traçabilité dev agent._

### Story S4.2 — 5 templates SVG MVP (flyer, carte de visite, brochure, étiquette, kakémono)

As a **dev Magrit**,
I want 5 templates SVG paramétriques couvrant les types de produits print les plus communs Clariprint,
So que dès la livraison MVP la couverture visuelle des boutiques atteigne ~70 % des cas réels.

**Acceptance Criteria :**

**Given** le dossier `src/server/mockup/templates/`
**When** le dev crée 5 fichiers `*.svg.tsx` (flyer, carteVisite, brochure, etiquette, kakemono)
**Then** chaque template prend en input `(productSpecs, shopTheming)` et retourne une chaîne SVG valide
**And** l'artwork inclut un pattern procédural utilisant la couleur primaire de `shopTheming`
**And** les dimensions du SVG correspondent aux dimensions Clariprint (format, ratio)
**And** un test snapshot vitest valide le rendu pour chaque template avec 2-3 jeux de specs

**Given** la fonction `mockup-generator` (S4.1)
**When** elle reçoit une demande pour un produit du type `flyer`/`carte_visite`/`brochure`/`etiquette`/`kakemono`
**Then** elle utilise le template correspondant
**And** rend un PNG cohérent avec les autres mockups de la boutique (charte couleur, angle, lumière simulée)

**Effort :** M.
**FR couverts :** FR27 (MVP).

### Story S4.3 — Composant React `MockupImage` avec fallback graceful

As a **dev Magrit**,
I want un composant React qui consomme l'API mockup et gère les états (loading, error, fallback),
So que les ProductCard et autres consommateurs n'aient pas à dupliquer la logique d'affichage.

**Acceptance Criteria :**

**Given** le composant `src/components/mockup/MockupImage.tsx`
**When** un parent passe les props `tenantId`, `shopId`, `productId`, `alt`
**Then** le composant fetch l'URL `/api/mockup?tenant=...&shop=...&product=...`
**And** affiche un skeleton / shimmer pendant le chargement
**And** affiche le PNG une fois disponible
**And** gère le fallback (header `X-Mockup-Fallback: true` ou erreur réseau) avec un picto par défaut
**And** ajoute un `alt` significatif (NFR18 accessibilité)

**Given** la ProductCard (S2.3) intègre `MockupImage`
**When** la grille produits rend
**Then** chaque carte montre son mockup avec cohérence graphique (theming boutique respecté)

**Effort :** S.
**FR couverts :** FR25 (consommation côté UI).

### Story S4.4 — 10 templates Growth supplémentaires (couverture 100 % Clariprint print)

As a **product owner Magrit**,
I want 10 templates additionnels pour couvrir 100 % des types de produits Clariprint print,
So que toutes les boutiques aient des mockups cohérents quel que soit leur catalogue.

**Acceptance Criteria :**

**Given** le besoin Growth (post-MVP, même sprint si temps disponible)
**When** le dev crée 10 templates supplémentaires (packaging cube/cylindre, PLV mousse, t-shirt, sticker, stylo, mug, bâche, drapeau, dossard, badge)
**Then** chaque template suit la même convention que S4.2
**And** la couverture des `product.kind` Clariprint atteint 100 %

**Given** un produit dont le `kind` n'a pas de template (cas exotique)
**When** la fonction `mockup-generator` est appelée
**Then** un fallback Imagen 4 / Flux avec style guide strict est utilisé (Vision V2+ — placeholder en v1.1 pour ne pas bloquer)
**OR** un picto générique est servi (selon le choix retenu en début Growth)

**Effort :** L.
**FR couverts :** FR27 (Growth).
**Phase :** Growth.

---

## Epic 5 — Connecteurs design (Canva quick-win + Affinity conditionnel)

**Goal :** Intégrer Canva (quick-win confirmé en PRD) pour permettre aux acheteurs/imprimeurs de designer leurs visuels print sans studio interne. Investiguer Affinity en parallèle pour décision GO/NO-GO.

### Story S5.1 — OAuth 2.0 Canva par tenant + table `tenant_integrations`

As an **admin tenant**,
I want connecter mon compte Canva à Magrit via OAuth depuis l'admin du tenant,
So que mes acheteurs puissent utiliser mes assets et templates Canva pour leurs designs.

**Acceptance Criteria :**

**Given** la migration `supabase/migrations/20260513_canva_integrations.sql` créant `tenant_integrations(tenant_id, provider, oauth_token_encrypted, refresh_token_encrypted, expires_at, ...)` avec RLS
**When** la table est appliquée
**Then** un admin tenant peut visiter `/dashboard/integrations/canva`
**And** clique "Connecter Canva" → redirect OAuth 2.0 vers Canva Connect
**And** au retour, le token est stocké chiffré dans `tenant_integrations`
**And** un superadmin Magrit peut voir le statut (connecté / déconnecté) de tous les tenants

**Given** un tenant déconnecte Canva
**When** l'admin clique "Déconnecter"
**Then** le token est supprimé de `tenant_integrations`
**And** les futurs appels à Canva pour ce tenant échouent gracefully

**Effort :** M.
**FR couverts :** FR28 (partie 1).
**ADR :** ADR-6.

### Story S5.2 — Edge function `canva-webhook` + Storage `tenant_assets/`

As a **dev Magrit**,
I want recevoir les webhooks Canva quand un design est terminé et stocker l'asset dans Magrit,
So que l'asset reste sous contrôle Magrit (RGPD, ownership) et puisse être attaché à une commande.

**Acceptance Criteria :**

**Given** la création de `supabase/functions/canva-webhook/index.ts`
**When** Canva poste un webhook `design_complete`
**Then** la fonction valide la signature HMAC avec le secret stocké en edge function secret
**And** télécharge l'asset depuis l'URL temporaire Canva
**And** uploade dans Supabase Storage `tenant_assets/{tenant}/canva/{order_item_id}.{ext}`
**And** met à jour `order_items.canva_asset_url` (nouvelle colonne nullable à ajouter en migration)
**And** retourne 200 OK à Canva

**Given** la signature HMAC est invalide
**When** la fonction est appelée
**Then** elle retourne 401 et logue l'incident

**Effort :** S.
**FR couverts :** FR28 (partie 2).

### Story S5.3 — UI bouton "Designer dans Canva" sur ProductCard

As an **acheteur B2B (ou imprimeur)**,
I want un bouton "Designer dans Canva" sur la ProductCard qui ouvre Canva avec le gabarit Clariprint pré-chargé,
So que je puisse créer mon visuel directement à partir des bonnes spécifications techniques.

**Acceptance Criteria :**

**Given** un produit dans une boutique dont le tenant a connecté Canva (S5.1)
**When** l'acheteur clique "Designer dans Canva" sur la ProductCard
**Then** Magrit appelle `Canva Connect API : create_design` avec le gabarit Clariprint converti (dimensions, marges, fonds perdus)
**And** redirige l'acheteur vers Canva (nouvel onglet)
**And** au retour de Canva (callback), le design est attaché à l'`order_item` correspondant

**Given** le tenant n'a pas connecté Canva
**When** l'acheteur clique "Designer dans Canva"
**Then** un message explique que la fonction n'est pas activée et invite à contacter l'admin

**Effort :** M.
**FR couverts :** FR28 (partie 3).

### Story S5.4 — Investigation Affinity Claude Cowork (décision GO/NO-GO)

As a **product owner Magrit**,
I want savoir si Claude Cowork peut piloter Affinity Designer/Photo de manière fiable,
So que je décide d'inclure ou de reporter l'intégration Affinity en Vision.

**Acceptance Criteria :**

**Given** une démarche d'investigation Claude Cowork
**When** l'architecte teste 3 scénarios (export gabarit Clariprint vers Affinity, design dans Affinity, retour résultat dans Magrit)
**Then** un rapport `docs/AFFINITY_INVESTIGATION.md` est produit avec : faisabilité, latence, fiabilité, format d'échange (PDF, SVG, AppleScript bridge ?), coût d'implémentation estimé

**Given** le rapport est livré
**When** Arnaud le revoit
**Then** une décision GO/NO-GO est prise
**And** si GO : une story d'implémentation est ajoutée au sprint v1.1 ou Vision selon effort
**And** si NO-GO : Affinity est officiellement reporté en Vision avec message communicable aux clients

**Effort :** S (investigation seule).
**FR couverts :** FR29 (préreq).
**ADR :** ADR-7.
**Phase :** Growth (investigation au plus tôt, implémentation si GO).

---

## Epic 6 — Quotas, feature flags & tier gating

**Goal :** Implémenter les quotas commerciaux (devis mensuels et boutiques par tenant) et l'activation par tier des features v1.1, sans dégrader l'UX (messages clairs au seuil).

### Story S6.1 — Compteur boutiques par tenant + middleware blocage création

As an **admin tenant**,
I want que je sois bloqué de créer une nouvelle boutique au-delà du quota de mon tier (Starter 3 / Pro 10 / Business 30 / Enterprise 50),
So que les engagements commerciaux soient respectés et qu'on me propose un upgrade au lieu d'un crash silencieux.

**Acceptance Criteria :**

**Given** un tenant Starter avec 3 boutiques actives
**When** un admin tenant tente de créer une 4e boutique
**Then** le middleware vérifie le compteur `count(shops where tenant_id = X)` vs quota tier
**And** la création est bloquée
**And** un message clair s'affiche : "Limite Starter atteinte (3 boutiques). Upgradez vers Pro pour 10 boutiques."
**And** un CTA "Upgrade vers Pro" lance le flow billing (V2+ stub)

**Given** un tenant Freemium ou Découverte
**When** un user tente de créer une boutique
**Then** la création est bloquée (quota 0 pour ces tiers)
**And** un message explique que les boutiques sont disponibles dès le tier Starter

**Effort :** S.
**FR couverts :** FR4, FR37.
**NFR couverts :** NFR14.
**ADR :** ADR-8.

### Story S6.2 — Compteur devis mensuel + blocage / soft-warn

As a **user d'un tier avec quota devis**,
I want que mon usage devis soit tracké et que je sois alerté à l'approche du quota,
So que je ne sois pas bloqué brutalement en plein workflow.

**Acceptance Criteria :**

**Given** la table `llm_usage_events` avec `tenant_id` (E7.1)
**When** un user génère un devis (chat ouvert ou strict)
**Then** un middleware compte les devis générés sur la fenêtre mensuelle calendaire
**And** affiche un badge sidebar "X / Quota devis utilisés"
**And** à 80 % du quota : warning visuel
**And** à 100 % : génération bloquée + message explicatif + CTA upgrade

**Given** le calcul est fait via `llm_usage_events` (pas une table compteur séparée)
**When** la fenêtre mensuelle se renouvelle
**Then** le compteur affiché redémarre à 0 automatiquement (basé sur `created_at >= start_of_month`)

**Given** un tenant Enterprise
**When** son usage dépasse 10 000/mois
**Then** un soft-warn admin Magrit s'affiche (négociation contractuelle vs blocage technique)

**Effort :** M.
**FR couverts :** FR36.
**NFR couverts :** NFR13, NFR23.

### Story S6.3 — `featureFlags.ts` étendu + helper `getEnvOrTier()` + tier gating

As a **dev Magrit**,
I want un helper unique qui combine flag global ET tier du tenant pour exposer une feature,
So que les composants v1.1 utilisent un seul `if` clair sans dupliquer la logique.

**Acceptance Criteria :**

**Given** le fichier `src/app/lib/featureFlags.ts`
**When** le dev étend le fichier avec les nouveaux flags v1.1 (`ENABLE_BOUTIQUE_PREMIUM`, `ENABLE_ORDER_ENTITY`, `ENABLE_MOCKUP_ENGINE_V1`, `ENABLE_CANVA_CONNECTOR`, `ENABLE_AFFINITY_CONNECTOR`, `ENABLE_OVERLAY_LIVE_RECALC`, `ENABLE_GROUPED_ACTIONS`, `ENABLE_LEGACY_GPT4O`)
**Then** chaque flag combine env var + minimum tier requis (helper `getEnvOrTier(min)`)
**And** un hook `useFeatureFlag(flagKey)` est disponible côté front

**Given** un user Découverte tente d'accéder à la boutique premium (`/shop/:slug`)
**When** le composant `ShopLayout` rend
**Then** `useFeatureFlag('ENABLE_BOUTIQUE_PREMIUM')` retourne `false`
**And** un message "Fonctionnalité disponible à partir du tier Starter" + CTA upgrade s'affiche

**Effort :** S.
**FR couverts :** FR38.
**ADR :** ADR-8.

---

## Final Validation — Step 4

### FR Coverage validée

✅ **46/46 FR** couverts (cf. FR Coverage Map § Requirements Inventory). Aucun FR orphelin.

### NFR Coverage

✅ **28/28 NFR** adressés via stories ou conventions transversales (DoD globale, RLS systématique, sanitization commune).

### ADR Coverage

✅ **8/8 ADR** (Architecture Decision Records) instanciés dans des stories (ADR-1 → S1.4 et S3.5, ADR-2 → S1.4, ADR-3 → S4.1, ADR-4 → S1.2, ADR-5 → S1.1 et S1.3, ADR-6 → S5.1, ADR-7 → S5.4, ADR-8 → S6.1 et S6.3).

### Story Quality Validation

✅ Chaque story est complétable par un dev agent unique (taille S, M, ou L explicite).
✅ Chaque story a des AC en Given/When/Then testables.
✅ Chaque story référence les FR/NFR/ADR couverts.
✅ Aucune story ne dépend d'une story future au sein du même epic (vérifié par revue séquentielle).
✅ Précondition explicite quand une story dépend d'une autre epic (ex: S2.3 dépend S4.3, S5.3 dépend S5.1).

### DB / Tables Creation Validation

✅ Tables créées **uniquement** par la story qui en a besoin :
- `orders`, `order_items`, `order_status_events` → S1.4 (Epic 1, premier consommateur).
- `tenant_integrations` → S5.1 (premier consommateur Canva).
- Pas de mass-table-creation upfront.

### Couverture phase MVP / Growth / Vision

| Phase | Stories incluses |
|---|---|
| **Pré-v1.1** | S0.1 (hotfix B4), S0.2 (investigation Clariprint) |
| **MVP v1.1** | S1.1, S1.2, S1.3, S1.4, S2.1-2.7, S3.1-3.5, S4.1-4.3, S6.1-6.3 |
| **Growth v1.1** | S2.5 (recalcul live, conditionnel), S2.8-2.10 (multi-actions), S4.4 (10 templates), S5.1-5.3 (Canva), S5.4 (Affinity investigation) |
| **Vision (post-v1.1)** | Workflow B2B complet Order, Stripe E4.3, back-office E4.4, refonte UX parc imprimeur, AO Excel, plateforme annonceur, sync eCommerce, API CMS publication, liens sponsorisés Freemium, recherche sémantique enrichie |

### Flux d'exécution recommandé

```
Pré-sprint   ┌─ S0.1 (beta/v4 hotfix) ──── démo OK 2026-05-23
             └─ S0.2 (beta/v5 investigation) ─── livrable PRICE_SOURCES.md
                       ↓
Epic 1       S1.1 ─→ S1.2 ─→ S1.3 (parallèle E-NEW-LLM-01) ─→ S1.4
             (Foundations stack)
                       ↓
Epics 2/3/4/6 en parallèle (chacun standalone, dépend uniquement Epic 1)
   Epic 2   ─── 7 stories MVP + 3 Growth
   Epic 3   ─── 5 stories MVP
   Epic 4   ─── 3 stories MVP + 1 Growth
   Epic 6   ─── 3 stories MVP
                       ↓
Epic 5 (Growth, dépend Epic 2 pour UI placement et Epic 4 pour mockup integration)
                       ↓
Validation : Implementation Readiness check (skill BMAD)
```

### Effort total estimé

| Catégorie | Stories | Effort cumulé approximatif |
|---|---|---|
| Pré-sprint | 2 | ~3 jours (1j hotfix + 2j investigation) |
| Epic 1 (MVP foundations) | 4 | M+M+M+M ≈ 4-6 jours |
| Epic 2 (boutique premium) | 10 | 7×S + 3×M ≈ 8-10 jours |
| Epic 3 (Order user-facing) | 5 | 4×S + 1×M ≈ 4-5 jours |
| Epic 4 (mockup engine) | 4 | 1×L + 1×M + 1×S + 1×L ≈ 5-7 jours |
| Epic 5 (Canva + Affinity inv.) | 4 | 1×M + 1×S + 1×M + 1×S ≈ 3-4 jours |
| Epic 6 (quotas, flags) | 3 | 2×S + 1×M ≈ 2-3 jours |
| **Total** | **32** | **~3-4 semaines** intensives en parallèle (cf. PRD Step 8 Resources) |

---

🎯 **Epic Breakdown Magrit / e-shop v1.1 — terminé.**

> _Ce document est la sortie de la skill BMAD `bmad-create-epics-and-stories`. Les 32 stories sont sprint-ready : chaque story peut être prise par un dev agent (Claude code, Copilot, dev humain) et complétée indépendamment. La DoD globale (cas TF Notion + testid stables) s'applique à toutes._
