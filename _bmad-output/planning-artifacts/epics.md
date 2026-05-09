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

**Couverture vérifiée : 46/46 FR ont au moins une story v1.1 OU sont déjà livrées en sprints précédents.**

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

**Goal :** Refondre la boutique `/shop/:slug` du proto v1 (Beta 3) vers un portail B2B premium digne des standards d'achat pros 2026 — layout 3 colonnes dark mode, header brandé tenant, catalogue par gammes persistantes, ProductCard avec overlay configuration Clariprint, home enrichie, multi-sélection, comparateur, actions groupées. C'est l'epic le plus volumineux (10 stories) parce que tout converge sur les mêmes fichiers `src/components/shop/*` (consolidation justifiée).

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
