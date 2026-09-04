# Backlog Magrit — Export structuré

> Export centralisé du backlog Magrit (toutes stories, tous chantiers) à date du **2026-09-04**.
> Généré à partir des artefacts BMAD du dépôt — pas une nouvelle source de vérité : en cas de divergence, le document source cité dans chaque section prévaut.

## Méthodologie et sources

Cet export agrège :

1. **306 story documents** (`_bmad-output/implementation-artifacts/story-*.md`), chacun portant en principe un frontmatter `epic:`/`status:`.
2. **`_bmad-output/planning-artifacts/epics.md`** — découpage epics/FR/NFR d'origine (v1.1) et epics ajoutés depuis (5 à 8).
3. **`SPRINT_HANDOFF.md`** — journal de sessions, seule source à jour pour le chantier **Sprint 5 — Gestion commerciale (Epic E10)**, qui ne produit pas de story documents (workflow `architecte`/`dev-story`/`qa-review` sur `openapi/magrit-core.v1.yaml` + branches `feat/gescom-*`, cf. `docs/api/CONVENTIONS.md`).
4. **`_bmad-output/implementation-artifacts/deferred-work.md`**, `docs/REFACTO_MULTI_DEVISE.md`, `_bmad-output/planning-artifacts/roadmap-v1.1-qualite-first-2026-05-21.md` pour la dette et le backlog non démarré.

**Limite connue et assumée.** Le champ `status:` en frontmatter n'est pas toujours remis à jour après livraison réelle — plusieurs stories anciennes (Sprint 5/6 initial, mai 2026) affichent encore `spec-ready` ou `in-progress` alors que la fonctionnalité est en production, confirmée par un chantier ultérieur qui la réutilise. Quand une telle divergence a pu être vérifiée directement (commit git, mention explicite dans `SPRINT_HANDOFF.md`), le statut affiché ci-dessous est corrigé et annoté *« statut frontmatter jamais remis à jour post-livraison »*. Les autres statuts sont repris **tels quels** depuis la source — en cas de doute sur une story ancienne marquée non livrée, croiser avec `SPRINT_HANDOFF.md` avant d'en déduire qu'elle reste à faire.

### Légende des statuts

| Icône | Sens |
|---|---|
| ✅ | Livré (production ou code mergé, `done`/`delivered`/`livrée`) |
| 🔵 | Livré, revue ou finition en cours (`review`, `partial-review`, `done-code`) |
| 🟠 | En cours de développement |
| 🟡 | Spec prête / prêt pour dev, développement non démarré |
| ✂️ | Story scindée — voir sous-stories listées dans le doc source |
| ⬜ | Statut non renseigné dans la source |

---

## Vue d'ensemble — 17 chantiers, 306 stories indexées + Sprint 5 en cours

| Chantier | Stories | Livrées | Période |
|---|---|---|---|
| V1.1 · Epic 0 — Pré-sprint Démo Readiness | 6 | 3 | 2026-05 |
| V1.1 · Epic 1 — Stack Foundations | 6 | 6 | 2026-05 |
| V1.1 · Epic 2 — Boutique B2B Premium Experience (socle) | 6 | 0* | 2026-05 → absorbé par Epic 7 |
| V1.1 · Epic 3 — Module Commandes (Order entity) | 9 | 7 | 2026-05 → 06 |
| V1.1 · Epic 4 — Mockup Engine paramétrique | 7 | 1* | 2026-05 |
| A4 — Personnalisation boutiques | 3 | 3 | 2026-06-15 |
| Epic 2 — Extension e-commerce standard (S2.11-S2.33) | 13 | 13 | 2026-06 → 07 |
| S-QUOTES — Bibliothèque de devis éditables | 6 | 5 | 2026-07-02 |
| Sprint 4 — PIM / Boutique / Commandes | 20 | 18 | 2026-05-18 |
| Epic 7 — Gabarit boutique v2 Printoclock | 14 | 14 | 2026-07-26 → 27 (clos) |
| Migration UX modulaire (MUX0-MUX6) | 3 | 3 | 2026-08 |
| Refacto qualité pré-Sprint5 (R0-R9) | 10 | 0* | **non clos** — voir note |
| Refacto API-first & modulaire (Epic 8 / AF0-AF32) | 121 | 113 | 2026 → **clos 2026-08-20** |
| Gestion utilisateurs — identités boutique (UM0-UM10) | 76 | 76 | **clos 2026-08-20** |
| UX — correctifs transverses | 1 | 1 | — |
| UX31 — Consolidation dashboard/invitation | 2 | 2 | 2026-08 |
| Divers / non classé | 3 | 2 | — |
| **Sprint 5 — Gestion commerciale (Epic E10)** | **≥ 15** | *voir section dédiée* | **2026-09 — EN COURS** |

*\* Epic 2 socle et Epic 4 : statuts frontmatter historiques (`review`) jamais remis à jour ; ces chantiers ont été absorbés/reconstruits par Epic 7 et le Mockup Engine réel du 2026-06 — traité comme livré en pratique, non vérifié story par story dans cet export. Refacto R0-R9 : voir note dans sa section, chantier réellement distinct du refacto API-first qui l'a suivi et n'a jamais été refermé formellement.*

---

## Détail par chantier

### V1.1 · Epic 0 — Pré-sprint Démo Readiness  _( 6 stories · source : `_bmad-output/implementation-artifacts/` )_

Hotfix Fiche B4 et audit des sources de prix Clariprint (`docs/PRICE_SOURCES.md`) — préalable obligatoire posé par le PRD avant toute story v1.1, calé sur la démo client du 2026-05-23.

| ID | Titre | Statut |
|---|---|---|
| `story-S-FIX-LARGE-CM-FORMATS` | Story S-FIX-LARGE-CM-FORMATS — Grands formats cm/mm > 3m | 🟡 spec-ready (post Phase 0.10 cadrage qualité, 2026-05-22) |
| `story-S-FIX-LIBRARY-UUID-normalisation` | Story S-FIX-LIBRARY-UUID — Normalisation product_library.id en UUID | 🟡 spec-ready (post Phase 0.10 cadrage qualité, 2026-05-22) |
| `story-S-RECONCILE-SUPABASE-MIGRATIONS` | Story S-RECONCILE-SUPABASE-MIGRATIONS — Mode opératoire de reconcile | 🟡 spec-ready (post Phase 0.8 cadrage qualité, 2026-05-22) |
| `story-S0.1-hotfix-fiche-b4` | Story S0.1 — Hotfix régression Fiche home Magrit | ✅ livrée |
| `story-S0.2-audit-prix-clariprint` | Story S0.2 — Investigation prix + sanitization Clariprint | ✅ livrée |
| `story-prix-marche-debridage-panier` | Story Prix marché — Débridage bouton panier | ✅ livrée (B5 + back-port B4) |

### V1.1 · Epic 1 — Stack Foundations  _( 6 stories · source : `_bmad-output/implementation-artifacts/` )_

Wrapper Anthropic unique, adaptateur `ClariprintAdapter` + `validateClariprintResponse`, migration Order entity tenant. Socle technique dont dépend tout le reste du plan v1.1.

| ID | Titre | Statut |
|---|---|---|
| `story-S-LLM-WRAPPER-ROBUSTNESS` | Story S-LLM-WRAPPER-ROBUSTNESS — Durcissement wrapper Anthropic | ✅ delivered (2026-05-23, beta/v5) |
| `story-S1.1-anthropic-client-wrapper` | Story S1.1 — Wrapper AnthropicClient unifié | ✅ livrée |
| `story-S1.2-clariprint-adapter` | Story S1.2 — ClariprintAdapter pattern | ✅ livrée |
| `story-S1.3-llm-migration-partial` | Story S1.3 — Migration LLM (partiel 2/4 endpoints) | ✅ livrée partiellement |
| `story-S1.4-order-entity-tenant` | Story S1.4 — Order entity Tenant | ✅ livrée |
| `story-S1.5-refactor-llm-finalisation` | Story S1.5 — Refactor LLM finalisation (claude-proxy + claude-proxy-stream) | ✅ done |

### V1.1 · Epic 2 — Boutique B2B Premium Experience (socle S2.1-S2.10)  _( 6 stories · source : `_bmad-output/implementation-artifacts/` )_

Refonte de `/shop/:slug` du proto Beta 3 vers un portail B2B (layout 3 colonnes, sidebar gammes, ProductCard + overlay Clariprint). Socle sur lequel s'est greffée l'extension e-commerce (bucket suivant).

| ID | Titre | Statut |
|---|---|---|
| `story-S-FIX-1-pim-marketing-card-atelier` | Story S-FIX-1 — ProductCard atelier : onglet Marketing PIM | 🟡 ready-for-dev |
| `story-S2.1-shop-layout-3col` | Story S2.1 — ShopLayout 3 colonnes + dark mode + header brandé | 🔵 review |
| `story-S2.2-shop-gammes-sidebar` | Story S2.2 — Catalogue par gammes dépliables et persistantes | 🔵 review |
| `story-S2.3-shop-product-card` | Story S2.3 — ShopProductCard avec MockupImage paramétrique + bouton Configurer & ajouter | 🔵 review |
| `story-S2.4-product-overlay-clariprint` | Story S2.4 — Overlay ProductCard avec options Clariprint en `<select>` | 🔵 review |
| `story-S2.4b-overlay-atelier-deviseur` | Story S2.4b — ProductOverlay côté atelier (remplace onglet Éditer) | 🟡 ready-for-dev |

### V1.1 · Epic 3 — Module Commandes (Order entity)  _( 9 stories · source : `_bmad-output/implementation-artifacts/` )_

Cycle de vie commande (order_status, historique, renouvellement, annulation brouillon) exposé côté acheteur.

| ID | Titre | Statut |
|---|---|---|
| `story-S-ORDER-ROLES-1-schema-db-rls` | Story S-ORDER-ROLES-1 — Schéma DB rôles + enum statuts extensibles + RLS | ✅ delivered (commit 1f85e04, Sprint 6, cf. SPRINT_HANDOFF §14 — statut frontmatter jamais remis à jour post-livraison) |
| `story-S-ORDER-ROLES-2-rpc-transitions-audit` | Story S-ORDER-ROLES-2 — RPC transitions + audit events | ✅ delivered (commit 59308d4, Sprint 6, cf. SPRINT_HANDOFF §14 — statut frontmatter jamais remis à jour post-livraison) |
| `story-S-ORDER-ROLES-3-ui-portal-orders-roles` | Story S-ORDER-ROLES-3 — UI PortalOrders tabs filtrés + admin catalog rôles | ✅ delivered (commit a8114ee puis refonte UI S-ORDER-ROLES-3-UI livrée 2026-06-10 — statut frontmatter jamais remis à jour post-livraison) |
| `story-S-ORDER-ROLES-roles-commande` | Story S-ORDER-ROLES (overview) — Rôles utilisateur sur une commande | ✂️ scindée 2026-05-22 — voir sous-stories -1 / -2 / -3 |
| `story-S-USERS-REFONTE-phase-a` | Story S-USERS-REFONTE Phase A — Livraison 2026-05-25 | ✅ delivered (2026-05-25, beta/v5) |
| `story-S3.1-orderhistorytable` | Story S3.1 — OrderHistoryTable + filtres + tri + badge couleur | ✅ delivered (composant réutilisé par S-QUOTES/S7.9, cf. SPRINT_HANDOFF — statut frontmatter jamais remis à jour post-livraison) |
| `story-S3.2-residual-email-permission` | Story S3.2-residual — Compléments création commande | 🟡 spec-ready (post vérification doublon 2026-05-22) |
| `story-S3.3-renew-order` | Story S3.3 — Renouveler une commande en 1 clic | ✅ delivered (réutilisé explicitement par S7.9 ResumeBanner, cf. SPRINT_HANDOFF §22 — statut frontmatter jamais remis à jour post-livraison) |
| `story-S3.4-cancel-draft-order` | Story S3.4 — Annulation commande draft | ✅ delivered (réutilisé explicitement par S-QUOTES #4, cf. SPRINT_HANDOFF §17 — statut frontmatter jamais remis à jour post-livraison) |

### V1.1 · Epic 4 — Mockup Engine paramétrique  _( 7 stories · source : `_bmad-output/implementation-artifacts/` )_

Génération de visuels produit (Edge Function Deno + Sharp/svgdom, templates SVG, cache Storage write-through).

| ID | Titre | Statut |
|---|---|---|
| `story-S-PIM-VISUELS-gabarits-fond-personnalisable` | Story S-PIM-VISUELS (overview) — Gabarits visuels réalistes + fond personnalisable | ✂️ scindée 2026-05-22 — voir sous-stories -1 à -6 |
| `story-S-RECONCILE-SUPABASE-MIGRATIONS-DONE` | Story S-RECONCILE-SUPABASE-MIGRATIONS — Livraison 2026-05-23 (anticipée) | ✅ delivered (2026-05-23, anticipée Sprint 5 vs prévu Sprint 8) |
| `story-S4.1a-bucket-storage-product-mockups` | Story S4.1a — Bucket Supabase Storage `product_mockups` + RLS + tests | 🔵 review |
| `story-S4.1b-pipeline-svg-png-flyer` | Story S4.1b — Pipeline SVG → PNG (resvg-wasm) + 1er template flyer | 🔵 review |
| `story-S4.1c-edge-function-mockup-generator` | Story S4.1c — Edge Function `mockup-generator` + cache write-through + invalidation | 🔵 review |
| `story-S4.2-templates-svg-mvp` | Story S4.2 — 5 templates SVG MVP | 🔵 review |
| `story-S4.3-mockup-image-component` | Story S4.3 — Composant React `MockupImage` avec fallback graceful | 🔵 review |

### A4 — Mini-sprint personnalisation boutiques (2026-06-15)  _( 3 stories · source : `_bmad-output/implementation-artifacts/` )_

Arbitrage Arnaud du 2026-06-15 : hero+tagline, palette+fonts curated, tarif négocié per-shop (table dédiée `shop_product_pricing`). Reste du menu 8 axes (A4.3/A4.4/A4.6+) toujours backlog.

| ID | Titre | Statut |
|---|---|---|
| `story-A4-1-shop-hero-tagline` | Story A4.1 — Bannière hero + tagline boutique | ✅ delivered (2026-06-15, beta/v5, cf. SPRINT_HANDOFF §16) |
| `story-A4-2-shop-palette-fonts` | Story A4.2 — Palette élargie + fonts par pairings curated | ✅ delivered (2026-06-15, beta/v5, cf. SPRINT_HANDOFF §16) |
| `story-A4-5-shop-product-pricing` | Story A4.5 — Tarif custom par boutique (négociation client) | ✅ delivered (2026-06-15, beta/v5, cf. SPRINT_HANDOFF §16) |

### Epic 2 — Extension boutique e-commerce standard (S2.11-S2.33)  _( 13 stories · source : `_bmad-output/implementation-artifacts/` )_

Standardisation e-commerce en 3 sprints (E1 lisibilité ProductCard · E2 paniers/devis · E3 navigation méga-menu/facettes/recherche), puis S2.32/S2.33 (mode catalogue PIM). **S2.22 à S2.31 restent non démarrées** — voir section Backlog.

| ID | Titre | Statut |
|---|---|---|
| `story-S2.11-category-family-badge` | Story S2.11 — Bandeau catégorie couleur-codé + pictogramme signature | ✅ delivered (E1 clôturé, cf. SPRINT_HANDOFF §18) |
| `story-S2.12-commercial-badges` | Story S2.12 — Badges d'état commercial sur ProductCard | ✅ delivered (E1 clôturé, cf. SPRINT_HANDOFF §18) |
| `story-S2.13-pim-attribute-chips` | Story S2.13 — Puces attributs PIM scan sur ProductCard | ✅ delivered (E1 clôturé, cf. SPRINT_HANDOFF §18) |
| `story-S2.14-mockup-signature` | Story S2.14 — Mockup-signature de famille comme identité catégorie | ✅ delivered (E1 clôturé, cf. SPRINT_HANDOFF §18) |
| `story-S2.15-home-new-products` | Story S2.15 — Bloc « Nouveautés » sur la home boutique | ✅ delivered (E1 clôturé, cf. SPRINT_HANDOFF §18) |
| `story-S2.16` | Story S2.16 — Home : devis en cours + reprise (option C) | ✅ livré (code, cf. doc story — push à reconfirmer) |
| `story-S2.18` | Story S2.18 — Méga-menu 2 niveaux illustré | ✅ delivered (E3 clôturé 2026-07-08, cf. SPRINT_HANDOFF §18) |
| `story-S2.18-megamenu-format-subcats` | Story S2.18-fix — Méga-menu : sous-catégories dérivées par format | ✅ delivered (E3 clôturé 2026-07-08, cf. SPRINT_HANDOFF §18) |
| `story-S2.19` | Story S2.19 — Fil d'Ariane + filtres à facettes légers | ✅ delivered (E3 clôturé 2026-07-08, cf. SPRINT_HANDOFF §18) |
| `story-S2.20` | Story S2.20 — Landing catégorie éditorialisée (contenu auto-généré LLM) | ✅ delivered (E3 clôturé 2026-07-08, cf. SPRINT_HANDOFF §18) |
| `story-S2.21` | Story S2.21 — Recherche produits + autocomplétion + fallback Magrit | ✅ delivered (E3 clôturé 2026-07-08, cf. SPRINT_HANDOFF §18) |
| `story-S2.32-shop-pim-catalog-mode` | Story S2.32 — Mode « Catalogue PIM complet » + sélection par gamme au niveau boutique | ✅ delivered (commits git S2.32, cf. historique) |
| `story-S2.33-generate-sellable-products-from-pim` | Story S2.33 — Générer les produits vendables depuis le PIM (pont PIM → product_library) | ✅ delivered (commits git S2.33, cf. historique) |

### Bibliothèque de devis éditables (S-QUOTES 1-6)  _( 6 stories · source : `_bmad-output/implementation-artifacts/` )_

Devis multi-lignes éditables (prix/marge synchronisés), création depuis le panier, bibliothèque avec statuts et scope mine/all. Remplacée depuis par l'unification des devis du 2026-09-02 (voir Sprint 5).

| ID | Titre | Statut |
|---|---|---|
| `story-S-QUOTES-1-schema-rls` | Story S-QUOTES-1 — Schema & RLS devis éditables | ✅ livrée (code) — migration à appliquer par Arnaud (PAT requis) |
| `story-S-QUOTES-2-data-layer` | Story S-QUOTES-2 — Couche data devis | ✅ livrée (code) |
| `story-S-QUOTES-3-editor` | Story S-QUOTES-3 — Éditeur de devis | ✅ livrée (code) |
| `story-S-QUOTES-4-cart-entry` | Story S-QUOTES-4 — Création depuis le panier | ✅ livrée (code) |
| `story-S-QUOTES-5-library` | Story S-QUOTES-5 — Bibliothèque évoluée | ✅ livrée (code) |
| `story-S-QUOTES-6-e2e-smoke` | Story S-QUOTES-6 — Transitions statut & smoke E2E | 🟡 procédure prête — exécution après application migration |

### Sprint 4 — PIM / Boutique / Commandes  _( 20 stories · source : `_bmad-output/implementation-artifacts/` )_

Extension PIM (gammes, ingestion, conventions cm/mm), wizard onboarding tenant, bascule modèle commandes vers `tenant_orders`. Livré 2026-05-18, rétrospective 2026-05-20.

| ID | Titre | Statut |
|---|---|---|
| `story-P0.1-adr-pim-rls-shared-catalog` | Story P0.1 — ADR PIM RLS shared catalog | 🟡 draft |
| `story-P0.10-pim-trigger-tenant-order-items` | Story P0.10 — Trigger PIM tenant_order_items | ✅ livrée |
| `story-P0.11-tenant-order-items-product-id-nullable` | Story P0.11 — Tenant_order_items product_id nullable | ✅ livrée (DB migrée, attente test E2E Arnaud) |
| `story-P0.2-pim-gammes-extension` | Story P0.2 — Extension catalogue gammes PIM (+5) | ✅ livrée |
| `story-P0.3-tenant-onboarding-wizard-11-parents` | Story P0.3 — Wizard onboarding 8 parents racine | ✅ livrée (validation visuelle seule — aucun changement code) |
| `story-P0.4-pim-ingestion-smoke-test` | Story P0.4 — Smoke test ingestion PIM E2E | ✅ livrée |
| `story-P0.5-adr-orders-model-migration` | Story P0.5 — ADR Orders model bascule | 🟡 draft |
| `story-P0.6-redeploy-pim-ingest` | Story P0.6 — Redéploiement pim-ingest | ✅ livrée |
| `story-P0.7-pim-ingest-cm-mm-fix` | Story P0.7 — Fix conversion cm→mm dans pim-ingest | ✅ livrée partiel (toMm seuil 50 porté, 2/5 mappings OK) |
| `story-P0.8-pim-ingest-parite-resolveGamme` | Story P0.8 — Parité resolveGamme back ↔ front | ✅ livrée partiel (parité front portée, 3/5 mappings OK avec régression critique carte_visite_standard résolue) |
| `story-P0.9-pim-cm-mm-convention` | Story P0.9 — Convention cm/mm robuste partagée | ✅ livrée |
| `story-S-CONSO-1-cleanup-thumbs-placeholder` | Story S-CONSO-1 — Cleanup thumbs placeholder | ✅ livrée |
| `story-S-CONSO-2-a11y-audit-boutique` | Story S-CONSO-2 — Audit a11y boutique B2B | ✅ livrée (0 violation, aucun fix code requis) |
| `story-S-CONSO-3-portal-thank-you` | Story S-CONSO-3 — PortalThankYou | ✅ livrée (test manuel pending Arnaud) |
| `story-S-CONSO-4-recherche-texte-fallback-ia` | Story S-CONSO-4 — Recherche fallback IA → texte | ✅ livrée |
| `story-S-CONSO-5-tri-grille-catalogue` | Story S-CONSO-5 — Tri grille catalogue | ✅ livrée |
| `story-S-CONSO-6-decision-workflow-n1` | Story S-CONSO-6 — Décision workflow N+1 | ✅ livrée |
| `story-S-DASHBOARD-ORDERS-DUAL` | Story S-DASHBOARD-ORDERS-DUAL — Vue owner toutes commandes du tenant | ✅ livrée (attente test manuel Arnaud) |
| `story-S-DUAL-READ-portal-orders` | Story S-DUAL-READ — PortalOrders dual-read | ✅ livrée (test manuel pending sur Arnaud) |
| `story-S-MIGRATION-ORDERS-bascule-tenant-orders` | Story S-MIGRATION-ORDERS — Bascule submitCart vers tenant_orders | ✅ livrée (test manuel pending sur Arnaud) |

### Epic 7 — Gabarit boutique v2 aligné Printoclock (S7.x)  _( 14 stories · source : `_bmad-output/implementation-artifacts/` )_

Refonte complète du portail storefront en 3 sprints (V2-A routage/configurateur/SEO · V2-B vitrine/ShopChrome · V2-C compte/self-signup/checkout). **Clos le 2026-07-27**, 14/14 stories, 3 ADR (§4.18-4.20). 4 anomalies non bloquantes restent à trier — voir section Backlog.

| ID | Titre | Statut |
|---|---|---|
| `story-S7.1-shop-routing-route-driven` | Story S7.1 — Routage boutique route-driven (Epic 7, Sprint V2-A) | ✅ delivered (Epic 7 clos 14/14, cf. SPRINT_HANDOFF §21-24) |
| `story-S7.10-account-hub` | Story S7.10 — AccountHub `/account/*` (Epic 7, Sprint V2-C) | ✅ delivered (Epic 7 clos 14/14, cf. SPRINT_HANDOFF §21-24) |
| `story-S7.11-self-signup-schema-rpc` | Story S7.11 — Schéma + RPC self-signup (Epic 7, Sprint V2-C) | ✅ delivered (Epic 7 clos 14/14, cf. SPRINT_HANDOFF §21-24) |
| `story-S7.12-checkout-2-ecrans` | Story S7.12 — Checkout ≤ 2 écrans (Epic 7, Sprint V2-C) | ✅ delivered (Epic 7 clos 14/14, cf. SPRINT_HANDOFF §21-24) |
| `story-S7.13-shop-sitemap-noindex` | Story S7.13 — Sitemap par boutique + indexabilité (Epic 7, Sprint V2-C) | ✅ delivered (Epic 7 clos 14/14, cf. SPRINT_HANDOFF §21-24) |
| `story-S7.14-cloture-v2c` | Story S7.14 — Clôture gabarit v2 : harmonisation + audits (Epic 7, Sprint V2-C) | ✅ delivered (Epic 7 clos 14/14, cf. SPRINT_HANDOFF §21-24) |
| `story-S7.2-useProductConfigurator` | Story S7.2 — Hook `useProductConfigurator` (Epic 7, Sprint V2-A) | ✅ delivered (Epic 7 clos 14/14, cf. SPRINT_HANDOFF §21-24) |
| `story-S7.3-page-gamme-configurateur` | Story S7.3 — Page gamme `/g/:gamme` : GammeConfigurator + StickyPriceBar (Epic 7, Sprint V2-A) | ✅ delivered (Epic 7 clos 14/14, cf. SPRINT_HANDOFF §21-24) |
| `story-S7.4-pim-editorial` | Story S7.4 — PimEditorial + produits liés + breadcrumb (Epic 7, Sprint V2-A) | ✅ delivered (Epic 7 clos 14/14, cf. SPRINT_HANDOFF §21-24) |
| `story-S7.5-seo-on-page-gamme` | Story S7.5 — SEO on-page des pages gammes (Epic 7, Sprint V2-A) | ✅ delivered (Epic 7 clos 14/14, cf. SPRINT_HANDOFF §21-24) |
| `story-S7.6-gamme-floor-prices-tile` | Story S7.6 — Prix plancher « dès X € » + GammeTile (Epic 7, Sprint V2-B) | ✅ delivered (Epic 7 clos 14/14, cf. SPRINT_HANDOFF §21-24) |
| `story-S7.7-shopchrome` | Story S7.7 — ShopChrome : header e-commerce constant (Epic 7, Sprint V2-B) | ✅ delivered (Epic 7 clos 14/14, cf. SPRINT_HANDOFF §21-24) |
| `story-S7.8-home-vitrine` | Story S7.8 — Home vitrine pour tous (Epic 7, Sprint V2-B) | ✅ delivered (Epic 7 clos 14/14, cf. SPRINT_HANDOFF §21-24) |
| `story-S7.9-resume-banner` | Story S7.9 — ResumeBanner riche + rappel compact (Epic 7, Sprint V2-B) | ✅ delivered (Epic 7 clos 14/14, cf. SPRINT_HANDOFF §21-24) |

### Migration UX modulaire (MUX0-MUX6)  _( 3 stories · source : `_bmad-output/implementation-artifacts/` )_

Découpage des frontières UI en modules par surface, préalable à la refonte API-first ci-dessous.

| ID | Titre | Statut |
|---|---|---|
| `story-MUX0-frontieres-ui-modulaires` | MUX0 — Socle et frontières de l'UX modulaire | ✅ done |
| `story-MUX1-members-ui-modulaire` | MUX1 — Pilote UX modulaire du domaine Members | ✅ done |
| `story-MUX2-MUX6-migration-ux-modulaire` | MUX2 à MUX6 — Migration complète de l’UX modulaire | ✅ done-code |

### Refacto qualité pré-Sprint5 (R0-R9)  _( 10 stories · source : `_bmad-output/implementation-artifacts/` )_

Décomposition ProductCard/ChatInterface, enforcement `ClariprintAdapter`, types DB partagés, testabilité Supabase, a11y CI. **Statuts `review`/`partial-review` — chantier non formellement clos**, contrairement au refacto API-first qui l'a suivi.

| ID | Titre | Statut |
|---|---|---|
| `story-R0-refacto-spikes-garde-fous` | R0 — Spikes garde-fous + TVA configurable + modal dupliquée | 🔵 review |
| `story-R1-refacto-productcard-decomposition` | R1 — ProductCard décomposition 5 onglets + PIM Fiche enrichissement (priorité G satellite) | 🔵 review |
| `story-R2-refacto-chatinterface-decomposition` | R2 — ChatInterface décomposition + bugs B6 / E4 / E5 | 🔵 partial-review |
| `story-R3-refacto-clariprint-adapter-enforcement` | R3 — ClariprintAdapter pattern enforcement | 🔵 review |
| `story-R4-refacto-types-db-partages` | R4 — Types DB partagés (`database.types.ts` + zod sélectif) | 🔵 review |
| `story-R5-bis-invite-member-transactional` | R5-bis — Edge function `invite-member` transactionnelle (fix race B4) | 🔵 review |
| `story-R5-refacto-pattern-supabase-unique` | R5 — Pattern Supabase unique (`functions.invoke()` exclusif edges) + fix race invitations | 🔵 partial-review |
| `story-R7-refacto-bundle-baseline-lazy-modales` | R7 — Bundle baseline (Lighthouse CI + bundle-visualizer + lazy modales) | 🔵 partial-review |
| `story-R8-refacto-testabilite-supabase` | R8 — Testabilité Supabase mock layer étendu + coverage zones froides | 🔵 partial-review |
| `story-R9-refacto-a11y-light-axe-ci` | R9 — a11y light : axe-core CI sur 3 pages critiques | 🔵 review |

### Refacto API-first & modulaire (Epic 8 / AF0-AF32)  _( 121 stories · source : `_bmad-output/implementation-artifacts/` )_

Chantier majeur (AF0→AF32, ~120 stories) : migration de toutes les lectures/écritures navigateur vers `/api/v1`, isolation des domaines dans `src/modules`, confinement Supabase dans `src/adapters/supabase`, 4 sorties explicites (storefront / portail client / workspace / backoffice). **Clôturé le 2026-08-20** (validation de référence AF32.2 : 177 fichiers, 1 260 tests, 0 dépendance Supabase résiduelle dans `src/app`).

| ID | Titre | Statut |
|---|---|---|
| `story-AF0-socle-api-first-garde-fous` | AF0 — Socle API-first et garde-fous | 🔵 review |
| `story-AF1-contrats-http-composition-serveur` | AF1 — Contrats HTTP et composition serveur | 🔵 review |
| `story-AF10-1-lien-invitation-manuel` | AF10.1 — Rendre visible le lien manuel d’invitation | ✅ done |
| `story-AF10-2-invitation-sans-boutique` | AF10.2 — Invitation dans un tenant sans boutique | ✅ done |
| `story-AF10-administration-membres-api` | AF10 — Administration des membres via l’API | ✅ done |
| `story-AF11-1-port-email-resend` | AF11.1 — Isoler l’envoi d’invitation de Supabase | ✅ done |
| `story-AF11-2-creation-invitation-sans-edge` | AF11.2 — Créer une invitation sans Edge Function imbriquée | ✅ done |
| `story-AF12-1-assignations-roles-api` | AF12.1 — Lire et assigner les rôles via l’API Magrit | ✅ done |
| `story-AF12-2-catalogue-roles-api` | AF12.2 — Administrer le catalogue des rôles via l’API Magrit | ✅ done |
| `story-AF13-1-crud-boutiques-api` | AF13.1 — Administrer les boutiques via l’API Magrit | ✅ done |
| `story-AF13-2-lecture-publique-boutique-api` | AF13.2 — Charger une boutique publique via l’API Magrit | ✅ done |
| `story-AF13-3a-prix-negocies-api` | AF13.3a — Isoler les prix négociés de l’éditeur de boutique | ✅ done |
| `story-AF13-3b-assets-boutique-api` | AF13.3b — Isoler les visuels de marque des boutiques | ✅ done |
| `story-AF13-3c-url-storage-locale` | AF13.3c — Corriger les URL Storage du runtime local | ✅ done |
| `story-AF13-4-mockups-boutique-api` | AF13.4 — Isoler les mockups personnalisés des boutiques | ✅ done |
| `story-AF14-1-souscriptions-gammes-api` | AF14.1 — Isoler les souscriptions de gammes du tenant | ✅ done |
| `story-AF14-2a-pim-catalogue-api` | AF14.2a — Isoler les lectures et commandes du PIM global | ✅ done |
| `story-AF14-2b-automatisation-pim-api` | AF14.2b — Isoler l’automatisation du PIM derrière l’API | ✅ done |
| `story-AF15-1-parametres-tenant-api` | AF15.1 — Isoler la modification des paramètres tenant | ✅ done |
| `story-AF15-2-sous-espaces-api` | AF15.2 — Isoler la gestion des sous-espaces | ✅ done |
| `story-AF15-3-capabilities-utilisateur-api` | AF15.3 — Isoler la vérification des capabilities utilisateur | ✅ done |
| `story-AF16-1-redirections-tenant-api` | AF16.1 — Isoler les redirections tenant et boutique | ✅ done |
| `story-AF16-2-acceptation-invitation-api` | AF16.2 — Isoler la destination post-invitation et la déconnexion | ✅ done |
| `story-AF16-3-checkout-identite-api` | AF16.3 — Isoler l’identité checkout et le rattachement self-signup | ✅ done |
| `story-AF17-1-conversations-api` | AF17.1 — Isoler la persistance des conversations | ✅ done |
| `story-AF17-2-session-invitation-auth` | AF17.2 — Centraliser la session fraîche des invitations | ✅ done |
| `story-AF17-3-diagnostic-ia-api` | AF17.3 — Isoler le diagnostic du fournisseur IA | ✅ done |
| `story-AF17-4-diagnostic-clariprint-api` | AF17.4 — Isoler le diagnostic Clariprint | ✅ done |
| `story-AF18-1-brouillon-devis-api` | AF18.1 — Isoler la création rapide des brouillons de devis | ✅ done |
| `story-AF18-2-crud-devis-api` | AF18.2 — Isoler le CRUD des devis éditables | ✅ done |
| `story-AF18-3-gabarits-devis-api` | AF18.3 — Isoler les gabarits de devis | ✅ done |
| `story-AF19-1-bibliotheques-api` | AF19.1 — Isoler le CRUD des bibliothèques | ✅ done |
| `story-AF19-2-produits-bibliotheque-api` | AF19.2 — Isoler les produits de bibliothèque | ✅ done |
| `story-AF2-1-correctif-bootstrap-local` | AF2.1 — Correctif bootstrap local et accès dashboard | 🔵 review |
| `story-AF2-bootstrap-session-tenant-preferences` | AF2 — Bootstrap session, tenant et préférences | 🔵 review |
| `story-AF20-1-lecture-commerciale-api` | AF20.1 — Isoler la lecture de la gestion commerciale | ✅ done |
| `story-AF20-2-mutations-commerciales-api` | AF20.2 — Isoler les mutations commerciales | ✅ done |
| `story-AF21-1-adaptateur-auth` | AF21.1 — Encapsuler le fournisseur d'authentification | ✅ done |
| `story-AF21-2-passerelle-mockups` | AF21.2 — Encapsuler le protocole des mockups | ✅ done |
| `story-AF22-1-passerelle-assistant-legacy` | AF22.1 — Encapsuler le protocole assistant legacy | ✅ done |
| `story-AF22-2-persistance-produits-ia-api` | AF22.2 — Isoler la persistance des produits IA | ✅ done |
| `story-AF23-1-diagnostic-ia-multi-provider` | AF23.1 — Rendre le diagnostic IA multi-provider | ✅ done |
| `story-AF23-2a-editorial-ia-multi-provider` | AF23.2a — Migrer l’éditorial IA vers le fournisseur configuré | ✅ done |
| `story-AF23-2b-facade-chat-sse` | AF23.2b — Placer le chat SSE derrière l’API Magrit | ✅ done |
| `story-AF24-1-clariprint-api-first` | AF24.1 — Sortir les devis Clariprint du navigateur | ✅ done |
| `story-AF24-2-mockups-api-first` | AF24.2 — Masquer Storage et le générateur de mockups | ✅ done |
| `story-AF24-3-tenant-commands-api-first` | AF24.3 — Sortir les commandes tenant du contexte React | ✅ done |
| `story-AF24-4-session-dev-api-first` | AF24.4 — Unifier le bootstrap Session en développement | ✅ done |
| `story-AF24-5-ui-provider-boundary` | AF24.5 — Verrouiller la dernière dérogation fournisseur de l’UI | ✅ done |
| `story-AF25-1-api-runtime-contexts` | AF25.1 — Centraliser le runtime API des contextes React | ✅ done |
| `story-AF25-2-api-runtime-workspace` | AF25.2 — Injecter le runtime API dans workspace et backoffice | ✅ done |
| `story-AF25-3-api-runtime-storefront` | AF25.3 — Injecter le runtime API dans storefront et portail client | ✅ done |
| `story-AF25-4-api-runtime-fresh-token` | AF25.4 — Confinement des transports à jeton fraîchement obtenu | ✅ done |
| `story-AF26-1-orders-surfaces` | AF26.1 — Déclarer les sorties multi-surfaces du module Orders | ✅ done |
| `story-AF26-10-roles-surface` | AF26.10 — Déclarer la sortie workspace de Roles | ✅ done |
| `story-AF26-11-conversations-surface` | AF26.11 — Déclarer la sortie workspace de Conversations | ✅ done |
| `story-AF26-12-machine-parks-surface` | AF26.12 — Déclarer la sortie workspace de MachineParks | ✅ done |
| `story-AF26-13-mockups-surface` | AF26.13 — Déclarer la sortie workspace de Mockups | ✅ done |
| `story-AF26-14-plans-surface` | AF26.14 — Déclarer la sortie workspace de Plans | ✅ done |
| `story-AF26-15-workspace-navigation-composition` | AF26.15 — Composer la navigation workspace depuis le registre | ✅ done |
| `story-AF26-2-shops-surfaces` | AF26.2 — Déclarer les sorties multi-surfaces du module Shops | ✅ done |
| `story-AF26-3-quotes-surfaces` | AF26.3 — Déclarer les sorties multi-surfaces du module Quotes | ✅ done |
| `story-AF26-4-quote-templates-surface` | AF26.4 — Déclarer la sortie workspace de QuoteTemplates | ✅ done |
| `story-AF26-5-libraries-surface` | AF26.5 — Déclarer la sortie workspace de Libraries | ✅ done |
| `story-AF26-6-catalog-surface` | AF26.6 — Déclarer la gestion workspace du Catalog | ✅ done |
| `story-AF26-7-commercial-surface` | AF26.7 — Déclarer la sortie workspace de Commercial | ✅ done |
| `story-AF26-8-members-surface` | AF26.8 — Déclarer la sortie workspace de Members | ✅ done |
| `story-AF26-9-tenants-surface` | AF26.9 — Déclarer la sortie workspace de Tenants | ✅ done |
| `story-AF27-1-portal-host-runtime-paths` | AF27.1 — Exécuter les chemins host du portail | ✅ done |
| `story-AF27-2-auth-runtime-injection` | AF27.2 — Injecter le fournisseur Auth depuis le runtime navigateur | ✅ done |
| `story-AF27-3-route-contribution-availability` | AF27.3 — Distinguer les routes actives des cibles planifiées | ✅ done |
| `story-AF27-4-clariprint-runtime-injection` | AF27.4 — Injecter la passerelle Clariprint depuis le runtime navigateur | ✅ done |
| `story-AF27-5-assistant-runtime-injection` | AF27.5 — Injecter la passerelle de l'assistant | ✅ done |
| `story-AF27-6-mockups-runtime-injection` | AF27.6 — Injecter la passerelle Mockups | ✅ done |
| `story-AF27-7-assistant-sse-gateway` | AF27.7 — Confiner le protocole SSE dans la passerelle assistant | ✅ done |
| `story-AF28-1-catalog-storefront-routes` | AF28.1 — Composer les routes Catalog du storefront | ✅ done |
| `story-AF28-2-order-confirmation-route` | AF28.2 — Composer la confirmation de commande depuis Orders | ✅ done |
| `story-AF29-1-orders-client-composition` | AF29.1 — Composer une façade Orders unique dans le front | ✅ done |
| `story-AF29-2-shops-client-composition` | AF29.2 — Composer les façades Shops dans un root unique | ✅ done |
| `story-AF29-3-quotes-client-composition` | AF29.3 — Composer les façades Quotes dans un root unique | ✅ done |
| `story-AF29-4-catalog-client-composition` | AF29.4 — Composer la façade Catalog dans un root unique | ✅ done |
| `story-AF29-5-libraries-client-composition` | AF29.5 — Composer les façades Libraries dans un root unique | ✅ done |
| `story-AF29-6-non-identity-client-composition` | AF29.6 — Composer les derniers clients hors identité | ✅ done |
| `story-AF29-7-session-client-composition` | AF29.7 — Composer la façade Session Magrit dans un root unique | ✅ done |
| `story-AF29-8-workspace-identity-client-composition` | AF29.8 — Composer les clients d'identité workspace Magrit | ✅ done |
| `story-AF29-9-api-client-composition-guard` | AF29.9 — Verrouiller la composition des clients API React | ✅ done |
| `story-AF3-1-supabase-local-docker` | AF3.1 — Runtime Supabase local Docker | 🔵 review |
| `story-AF3-2-correctif-creation-espace-local` | AF3.2 — Correctif création espace et bootstrap local | 🔵 review |
| `story-AF3-registre-surfaces-contributions-ui` | AF3 — Registre des surfaces et contributions UI | 🔵 review |
| `story-AF30-1-tenant-settings-orchestration` | AF30.1 — Isoler l'orchestration des paramètres tenant | ✅ done |
| `story-AF30-10-tenant-gamme-subscriptions-orchestration` | AF30.10 — Isoler les souscriptions de gammes tenant | ✅ done |
| `story-AF30-11-platform-diagnostics-orchestration` | AF30.11 — Isoler les diagnostics de plateforme | ✅ done |
| `story-AF30-12-local-integration-concurrency` | AF30.12 — Stabiliser la concurrence des intégrations locales | ✅ done |
| `story-AF30-13-dashboard-orders-orchestration` | AF30.13 — Isoler l'orchestration des commandes dashboard | ✅ done |
| `story-AF30-14-printed-quote-persistence` | AF30.14 — Isoler la persistance des devis imprimés | ✅ done |
| `story-AF30-15-shop-customer-invitation-command` | Story AF30.15 — Commande API d’invitation client boutique | ✅ done (statut en corps de doc, non frontmatter) |
| `story-AF30-16-pim-automation-orchestration` | AF30.16 — Isoler l’automatisation du dashboard PIM | ✅ done |
| `story-AF30-2-subtenant-management-orchestration` | AF30.2 — Isoler l'orchestration des sous-espaces | ✅ done |
| `story-AF30-3-local-integration-harness` | AF30.3 — Réactiver le harnais d'intégration Supabase local | ✅ done |
| `story-AF30-4-magrit-invitation-orchestration` | AF30.4 — Isoler l'acceptation des invitations Magrit | ✅ done |
| `story-AF30-5-retire-legacy-shop-only-redirect` | AF30.5 — Retirer la redirection automatique `shop_only` | ✅ done |
| `story-AF30-6-legacy-slug-orchestration` | AF30.6 — Isoler la résolution des anciens slugs tenant | ✅ done |
| `story-AF30-7-legacy-shop-customer-report-orchestration` | AF30.7 — Isoler le rapport de migration des comptes boutique | ✅ done |
| `story-AF30-8-shop-customer-management-orchestration` | AF30.8 — Isoler la gestion des comptes clients boutique | ✅ done |
| `story-AF30-9-shop-custom-mockups-orchestration` | AF30.9 — Isoler la gestion des mockups boutique | ✅ done |
| `story-AF31-1-shop-editor-operations-orchestration` | AF31.1 — Isoler les opérations de l’éditeur boutique | ✅ done |
| `story-AF31-2-commercial-management-orchestration` | AF31.2 — Isoler l’orchestration de la gestion commerciale | ✅ done |
| `story-AF31-3-role-catalog-orchestration` | AF31.3 — Isoler le catalogue des rôles Magrit | ✅ done |
| `story-AF31-4-role-assignment-orchestration` | AF31.4 — Isoler les assignations de rôles Magrit | ✅ done |
| `story-AF31-5-magrit-users-orchestration` | AF31.5 — Isoler la gestion des utilisateurs Magrit | ✅ done |
| `story-AF31-6-magrit-invitation-orchestration` | AF31.6 — Isoler la création d'invitation Magrit | ✅ done |
| `story-AF32-1-shop-customer-surfaces` | AF32.1 — Attribuer les surfaces au module comptes boutique | ✅ done |
| `story-AF32-2-refactoring-completion-audit` | AF32.2 — Audit de clôture du refactoring | ✅ done |
| `story-AF4-api-lecture-orders` | AF4 — API de lecture Orders | 🔵 review |
| `story-AF5-commandes-orders-atomiques` | AF5 — Commandes Orders atomiques | ✅ done |
| `story-AF6-adaptateurs-ui-orders-multi-surfaces` | AF6 — Adaptateurs UI Orders multi-surfaces | ✅ done |
| `story-AF7-1-acces-boutique-et-self-signup` | AF7.1 — Accès boutique et commande self-signup | ✅ done |
| `story-AF7-2-invitation-session-edge` | AF7.2 — Fiabiliser l’invitation avec une session Edge valide | ✅ done |
| `story-AF7-sortie-supabase-orders` | AF7 — Sortie Supabase du périmètre Orders | ✅ done |
| `story-AF8-invitations-api-first` | AF8 — Création des invitations via l’API Magrit | ✅ done |
| `story-AF9-administration-invitations-api` | AF9 — Administration des invitations via l’API | ✅ done |

### Gestion utilisateurs — identités boutique (UM0-UM10)  _( 76 stories · source : `_bmad-output/implementation-artifacts/` )_

Séparation stricte comptes Magrit / comptes clients boutique (identités, sessions, invitations, délégations, transport, runtime) — mené en parallèle du refacto API-first, même clôture 2026-08-20.

| ID | Titre | Statut |
|---|---|---|
| `story-UM0-1-identity-contracts` | UM0.1 — Verrouiller les contrats d’identité boutique | ✅ done |
| `story-UM1-1-shop-customer-schema` | UM1.1 — Créer le schéma des comptes clients boutique | ✅ done |
| `story-UM1-2-shop-customer-domain-access` | UM1.2 — Domaine et accès workspace des comptes boutique | ✅ done |
| `story-UM1-3-shop-customer-api` | UM1.3 — Exposer l’API workspace des comptes boutique | ✅ done |
| `story-UM1-4-shop-customer-workspace-ui` | UM1.4 — Séparer les comptes boutique dans l’interface workspace | ✅ done |
| `story-UM10-1-storefront-assistant-identity` | UM10.1 — Séparer l’identité de l’assistant storefront | ✅ done |
| `story-UM10-10-storefront-clariprint-transport` | UM10.10 — Isoler le transport Clariprint du storefront | ✅ done |
| `story-UM10-11-storefront-shop-view-model` | UM10.11 — Sortir le modèle boutique du contexte workspace | ✅ done |
| `story-UM10-12-storefront-editorial-route` | UM10.12 — Autoriser l’éditorial IA par session boutique | ✅ done |
| `story-UM10-13-order-audit-transport` | UM10.13 — Injecter explicitement le transport d’audit commande | ✅ done |
| `story-UM10-14-configurator-transport` | UM10.14 — Injecter explicitement le transport du configurateur | ✅ done |
| `story-UM10-15-assistant-stream-transport` | UM10.15 — Séparer les transports IA Magrit et storefront | ✅ done |
| `story-UM10-16-workspace-quote-transport` | UM10.16 — Injecter le transport de devis atelier | ✅ done |
| `story-UM10-17-module-client-roots` | UM10.17 — Séparer les composition roots HTTP | ✅ done |
| `story-UM10-18-browser-service-roots` | UM10.18 — Séparer les providers de gateways navigateur | ✅ done |
| `story-UM10-19-storefront-api-runtime` | UM10.19 — Rendre le runtime HTTP storefront autonome | ✅ done |
| `story-UM10-2-storefront-tax-boundary` | UM10.2 — Isoler la politique fiscale du storefront | ✅ done |
| `story-UM10-20-route-runtime-boundaries` | UM10.20 — Monter les identités par frontière de route | ✅ done |
| `story-UM10-21-platform-runtime-roots` | UM10.21 — Séparer les racines de runtime navigateur | ✅ done |
| `story-UM10-22-lazy-surface-boundaries` | UM10.22 — Charger les frontières de surface à la demande | ✅ done |
| `story-UM10-23-storefront-import-graph-guard` | UM10.23 — Verrouiller le graphe d'import storefront | ✅ done |
| `story-UM10-24-lazy-workspace-shells` | UM10.24 — Sortir les shells workspace de l'entrée boutique | ✅ done |
| `story-UM10-25-storefront-account-auth-gate` | UM10.25 — Garder le hub compte par la session boutique | ✅ done |
| `story-UM10-26-local-edge-runtime-recovery` | UM10.26 — Réparer automatiquement l'Edge Runtime local | ✅ done |
| `story-UM10-27-storefront-cart-price-consistency` | UM10.27 — Conserver le prix canonique du panier jusqu'à la commande | ✅ done |
| `story-UM10-28-storefront-load-failure-boundary` | UM10.28 — Distinguer panne storefront, absence de session et boutique inconnue | ✅ done |
| `story-UM10-29-storefront-session-liveness` | UM10.29 — Révoquer visuellement une session boutique expirée | ✅ done |
| `story-UM10-3-remove-mixed-profile-dead-ui` | UM10.3 — Retirer l’ancienne UI de profil mixte | ✅ done |
| `story-UM10-30-storefront-catalog-lifecycle` | UM10.30 — Isoler le cycle de chargement du catalogue storefront | ✅ done |
| `story-UM10-31-storefront-order-lifecycle` | UM10.31 — Isoler le cycle commandes du storefront | ✅ done |
| `story-UM10-32-storefront-order-list` | UM10.32 — Isoler la liste des commandes storefront | ✅ done |
| `story-UM10-33-storefront-order-receipt` | UM10.33 — Isoler le reçu de commande storefront | ✅ done |
| `story-UM10-34-storefront-order-editor` | UM10.34 — Isoler l'éditeur de commande storefront | ✅ done |
| `story-UM10-35-storefront-category-editorial` | UM10.35 — Isoler l'éditorial de catégorie storefront | ✅ done |
| `story-UM10-36-storefront-identity-form` | UM10.36 — Isoler le formulaire d'identité storefront | ✅ done |
| `story-UM10-37-storefront-credential-setup` | UM10.37 — Isoler les parcours de mot de passe storefront | ✅ done |
| `story-UM10-38-storefront-view-boundary` | UM10.38 — Verrouiller la frontière des vues storefront | ✅ done |
| `story-UM10-4-storefront-shop-state-isolation` | UM10.4 — Isoler l’état transactionnel par boutique | ✅ done |
| `story-UM10-5-storefront-customer-orders-ui` | UM10.5 — Séparer l’interface des commandes client | ✅ done |
| `story-UM10-6-storefront-orders-transport` | UM10.6 — Isoler le transport Orders du storefront | ✅ done |
| `story-UM10-7-storefront-shops-transport` | UM10.7 — Isoler le transport catalogue boutique | ✅ done |
| `story-UM10-8-storefront-editorial-identity` | UM10.8 — Neutraliser l’identité Magrit de l’éditorial storefront | ✅ done |
| `story-UM10-9-storefront-configurator-tax` | UM10.9 — Injecter la fiscalité dans le configurateur storefront | ✅ done |
| `story-UM2-1-storefront-session-boundary` | UM2.1 — Poser la frontière de session storefront | ✅ done |
| `story-UM2-10-storefront-activation-screen` | UM2.10 — Permettre au client d’activer son compte | ✅ done |
| `story-UM2-11-activation-opens-session` | UM2.11 — Ouvrir la session boutique pendant l’activation | ✅ done |
| `story-UM2-2-private-storefront-auth-storage` | UM2.2 — Isoler le stockage d’authentification storefront | ✅ done |
| `story-UM2-3-storefront-auth-orchestration` | UM2.3 — Orchestrer l’authentification storefront | ✅ done |
| `story-UM2-4-storefront-auth-sql-primitive` | UM2.4 — Rendre l’authentification SQL atomique | ✅ done |
| `story-UM2-5-storefront-session-route` | UM2.5 — Exposer la connexion storefront par le BFF | ✅ done |
| `story-UM2-6-storefront-session-lifecycle-sql` | UM2.6 — Résoudre et révoquer une session storefront | ✅ done |
| `story-UM2-7-storefront-session-routes` | UM2.7 — Lire et fermer la session storefront | ✅ done |
| `story-UM2-8-storefront-credential-activation` | UM2.8 — Activer un credential boutique par jeton | ✅ done |
| `story-UM2-9-storefront-activation-api` | UM2.9 — Exposer l’activation d’un credential boutique | ✅ done |
| `story-UM3-1-storefront-activation-invitation` | UM3.1 — Inviter un compte boutique à s’activer | ✅ done |
| `story-UM4-1-ensure-self-shop-customer` | UM4.1 — Garantir un compte boutique pour l’utilisateur Magrit | ✅ done |
| `story-UM5-1-shop-customer-delegation-session` | UM5.1 — Émettre une session storefront déléguée | ✅ done |
| `story-UM5-2-connect-to-storefront-ui` | UM5.2 — Se connecter à la boutique depuis Magrit | ✅ done |
| `story-UM5-3-storefront-catalog-session-access` | UM5.3 — Autoriser le catalogue privé avec la session boutique | ✅ done |
| `story-UM6-1-storefront-order-identity` | UM6.1 — Rattacher la création de commande au compte boutique | ✅ done |
| `story-UM6-2-storefront-portal-orders` | UM6.2 — Consulter ses commandes depuis le portail boutique | ✅ done |
| `story-UM6-3-storefront-order-drafts` | UM6.3 — Lire et modifier ses brouillons boutique | ✅ done |
| `story-UM6-4-storefront-order-cancellation` | UM6.4 — Annuler une commande depuis le compte boutique | ✅ done |
| `story-UM6-5-storefront-order-audit` | UM6.5 — Consulter l'historique de sa commande boutique | ✅ done |
| `story-UM6-6-storefront-checkout-identity` | UM6.6 — Connecter le checkout avec le compte boutique | ✅ done |
| `story-UM6-7-resilient-session-bootstrap` | UM6.7 — Ne pas confondre panne API et absence d'espace | ✅ done |
| `story-UM6-8-delegated-checkout-runtime` | UM6.8 — Stabiliser le checkout en mode délégué | ✅ done |
| `story-UM7-1-legacy-shop-only-customer-migration` | UM7.1 — Migrer les anciens utilisateurs `shop_only` | ✅ done |
| `story-UM7-2-legacy-migration-report-api` | UM7.2 — Exposer le rapport de migration via l’API Magrit | ✅ done |
| `story-UM7-3-legacy-migration-control-surface` | UM7.3 — Surface de contrôle de la migration legacy | ✅ done |
| `story-UM8-1-freeze-legacy-shop-only-writes` | UM8.1 — Geler les écritures `shop_only` | ✅ done-code |
| `story-UM8-2-identity-documentation` | UM8.2 — Aligner la documentation sur les identités séparées | ✅ done |
| `story-UM8-3-separate-magrit-role-catalog` | UM8.3 — Séparer le catalogue de rôles Magrit | ✅ done-code |
| `story-UM8-4-strict-private-storefront-boundary` | UM8.4 — Supprimer l’accès storefront implicite des utilisateurs Magrit | ✅ done |
| `story-UM9-1-storefront-self-registration` | UM9.1 — Auto-inscription sur une boutique publique | ✅ done-code |
| `story-UM9-2-storefront-password-recovery` | UM9.2 — Récupération de mot de passe boutique | ✅ done-code |

### UX — Correctifs transverses  _( 1 stories · source : `_bmad-output/implementation-artifacts/` )_

Correctif ref forwarding Radix, hors périmètre d'un epic dédié.

| ID | Titre | Statut |
|---|---|---|
| `story-UX-radix-ref-forwarding` | UX — Supprimer les warnings de ref des modales Radix | ✅ done |

### UX31 — Consolidation dashboard/invitation directe  _( 2 stories · source : `_bmad-output/implementation-artifacts/` )_

Surface dashboard orders + invitation directe client boutique, en clôture du chantier UM.

| ID | Titre | Statut |
|---|---|---|
| `story-UX31-1-dashboard-orders-surface` | Story UX31.1 — Harmoniser la liste des commandes du dashboard | ✅ done (statut en corps de doc, non frontmatter) |
| `story-UX31-2-direct-shop-customer-invitation` | Story UX31.2 — Invitation directe d’un client boutique | ✅ done (statut en corps de doc, non frontmatter) |

### Divers / non classé  _( 3 stories · source : `_bmad-output/implementation-artifacts/` )_

Stories ne portant pas de champ `epic` structuré et non rattachables aux buckets ci-dessus par convention de nommage — à reclasser si un futur epic les couvre.

| ID | Titre | Statut |
|---|---|---|
| `story-S-PIM-EXAPRINT` | Story S-PIM-EXAPRINT — PIM complet aligné catalogue Exaprint | ✅ delivered (2026-07-10, prod vérifiée, cf. SPRINT_HANDOFF §20) |
| `story-S-SUBTENANT-SCOPE-sous-espace` | Story S-SUBTENANT-SCOPE — Filiales d'un imprimeur multi-sites | 🟡 spec-ready (post Phase 0.6 cadrage qualité, 2026-05-22) |
| `story-refonte-ux-dashboard-2026-08-08` | Story — Refonte UX du tableau de bord (8 points Arnaud) | ✅ delivered (2026-08-08, build+750 tests verts, cf. SPRINT_HANDOFF §25 — recette visuelle Arnaud tracée séparément) |

## Sprint 5 — Gestion commerciale (Epic E10) — 🟠 EN COURS

**Chantier actif à la date de cet export** (branche courante `feat/gescom-e10-4-entite-client`). Cadre API-first strict posé au WM du 2026-09-01 par Xavier Péchoultres : `openapi/magrit-core.v1.yaml` fait foi, seul l'agent `architecte` le modifie ; une story = une branche `feat/gescom-<id>-<slug>` + PR + revue `qa-review` distincte de l'auteur. **Ce chantier ne produit pas de story documents** dans `_bmad-output/implementation-artifacts/` — la source de vérité est le contrat OpenAPI (commentaires `# story E10.x`), `docs/api/CONVENTIONS.md` §8 (dette tracée par story) et l'historique git. Reconstitué ici depuis ces deux sources ; à faire auditer par l'agent `scribe` pour un suivi Notion si un tracking plus fin est nécessaire.

| ID | Objet | Statut |
|---|---|---|
| `E10.0` | Socle API-first — outillage `gen:api`, façades HTTP, table `api_idempotency_keys`, scopes de clé de service | ✅ Livré |
| `E10.1` | Espace Projets — conteneur de travail commercial, point d'entrée de la création de devis | ✅ Livré |
| `E10.2` | Tags libres colorés sur les projets (filtre simple + multi-tags ET) | ✅ Livré |
| `E10.3` | Création d'un devis depuis un projet (sélection multi-produits) | ✅ Livré |
| `E10.4` | Entité Client (personne morale ou physique) et interlocuteurs | ✅ Livré |
| `E10.5` | Dissociation comptes Magrit / comptes clients boutique | ✅ Livré |
| `E10.6` | Référentiel des règles de prix — marge publique standard par gamme | ✅ Livré |
| `E10.7` | Arbitrage des règles de prix concurrentes (spécificité puis récence) | ✅ Livré |
| `E10.8` | Décomposition Clariprint réelle du prix (`breakdown[]` détaillé par poste) | 🟡 **Gelée** (spécification seule, décision Arnaud/WM du 2026-09-01 — aucun code) |
| `E10.9` | Édition des lignes d'un devis : prix de vente OU taux de marge, remises granulaires par ligne + audit | ✅ Livré (+ correctifs qa-review B1/C1/C2, 2026-09-04) |
| `E10.10` | Remises (au-delà de la ligne) — première story à faire porter un statut de devis autre que `draft` | 🟡 Backlog (mentionnée, non spécifiée en détail) |
| `E10.11` | Droit dédié `can_manage_pricing` (remplace le contournement temporaire sur un droit existant, E10.6 CA7) | 🟡 Backlog |
| `E10.12` | Conversion d'un devis en commande (`quote.converted`) | 🟡 Backlog (mentionnée, non spécifiée en détail) |
| `E10.16` / `E10.18` / `E10.19` | Stories futures qui câbleront réellement `PricingEngine.price()` sur `commercial_quote_lines` (aujourd'hui seule `production_price` est renseignée, cf. CONVENTIONS.md §8.6/§8.9) | 🟡 Backlog (mentionnées, non spécifiées) |
| `E10.21` | Interface `PricingEngine` — implémentation provisoire mono-poste (`SingleCostPricingEngine`) | ✅ Livré (provisoire — la décomposition par poste attend E10.8 dégelée) |
| *(hors numérotation)* | **Unification des devis** (2026-09-02) — retrait pur et simple de l'ancien module `quotes` legacy au profit de `commercial_quotes` unique | ✅ Livré (chantier `dev-story` post-Lot 0, accepté §8.10) |

**Dette R5 tracée et acceptée** (dérogations documentées, non des bugs) : voir `docs/api/CONVENTIONS.md` §8.1 à §8.10 pour le détail par story (ex. `updateQuote` sans garde de statut tant qu'aucun statut ≠ `draft` n'existe réellement — à corriger avec E10.10 ou E10.12).

---

## Backlog non démarré / à cadrer

Éléments **explicitement identifiés comme non livrés** dans les documents sources, à traiter dans un futur sprint.

### Epic 2 — Extension e-commerce, sprints E4/E5 jamais lancés

Prévus dans `epics.md` (L629+), jamais entamés (aucun commit, aucun story document) :

| ID | Objet | FR |
|---|---|---|
| `S2.22` | Navigation par intention/usage pilotée IA — *à scinder si > 3j (S2.22a classement batch / S2.22b UI)* | FR-ECOM-12 |
| `S2.23` | Cross-sell home « Magrit vous suggère » | FR-ECOM-13 |
| `S2.24` | Product finder guidé (wizard) | FR-ECOM-14 |
| `S2.25` | Auto-génération descriptions catégorie/SEO par Magrit | FR-ECOM-15 |
| `S2.26` | Fiche produit « rassurance B2B » | FR-ECOM-16 |
| `S2.27` | Paliers de prix dégressifs affichés | FR-ECOM-17 |
| `S2.28` | Magrit vendeur sur la fiche produit | FR-ECOM-18 |
| `S2.29` | Favoris / listes d'achat récurrentes (+ ADR §4.13) | FR-ECOM-19 |
| `S2.31` | Consolidation de l'écran d'admin boutique (transverse, à démarrer par un audit) | FR-ECOM-20 |

### Epic 5 — Connecteurs design (jamais démarré)

`epics.md` L1332+ — OAuth Canva par tenant (`S5.1`), webhook `canva-webhook` + Storage (`S5.2`), bouton « Designer dans Canva » sur ProductCard (`S5.3`), investigation Affinity via Claude Cowork GO/NO-GO (`S5.4`, ADR-7 — préalable obligatoire avant toute implémentation). **Aucun story document, aucune trace de démarrage.**

### Epic 6 — Quotas, feature flags & tier gating (jamais démarré)

`epics.md` L1429+ — quotas commerciaux (devis mensuels, boutiques par tenant) et activation par tier des features v1.1. **Aucun story document, aucune trace de démarrage.**

### Sprint 5 (Epic E10) — stories futures identifiées mais non spécifiées

`E10.8` (décomposition Clariprint réelle, gelée), `E10.10` (remises), `E10.11` (droit `can_manage_pricing`), `E10.12` (conversion devis→commande), `E10.16`/`E10.18`/`E10.19` (câblage réel du PricingEngine) — cf. tableau Sprint 5 ci-dessus.

### Refacto qualité pré-Sprint5 (R0-R9) — chantier jamais formellement clos

Contrairement au refacto API-first (Epic 8) qui l'a suivi et a été clôturé le 2026-08-20 avec preuves explicites, **le chantier R0-R9 n'a pas d'équivalent** : 6 des 10 stories restent au statut `partial-review` ou `review` dans leur frontmatter (`R2` ChatInterface, `R5`/`R5-bis` pattern Supabase, `R7` bundle/lazy modales, `R8` testabilité Supabase). À rouvrir ou à considérer explicitement absorbé par le refacto API-first avant de le déclarer clos.

### Multi-devise — tranche 1 seule livrée

`docs/REFACTO_MULTI_DEVISE.md` — décision Arnaud du 2026-08-10, plan en 4 tranches verticales. Tranche 1 (« la devise existe et s'affiche ») en cours de reprise (colonne `tenants.currency`, helper unique `formatMoney`, purge des littéraux `€`/`'EUR'`, sélecteur devise dans Paramètres). **Tranches 2 à 4 non démarrées** :
- Tranche 2 — les coûts de production passent en type `Money`
- Tranche 3 — le chemin de prix de vente (dépend de la règle d'arrondi, décision à obtenir côté Expert Solutions)
- Tranche 4 — documents et export

### Anomalies Epic 7 — non bloquantes, à trier

Détectées lors de la campagne TF-S7.x du 2026-07-27 (`SPRINT_HANDOFF.md` §24), jamais corrigées depuis :

1. `no papers for "leaflet"` — l'edge `clariprint-quote` reçoit un grammage brut non mappé, prix flyer tombe systématiquement en repli marché avec un message d'erreur trompeur (« Erreur réseau » au lieu d'erreur de calcul).
2. Budget mock (« Centre de coût · Communication Groupe ») visible dans le header/drawer panier pour un visiteur anonyme — contredit l'anti-mock S7.8, oubli du header lors du masquage S7.10.
3. « Demander un accès » — lien mort (`<a>` sans `href`) sur toute boutique hors ERAM, dont `contact_email` est vide.
4. Ligne panier affiche le format du produit de base plutôt que le format réellement configuré.
5. Mineures : cartes produits liés « 0 € / 1000 ex. » sur page gamme · vocabulaire brut PIM FR (`PELLIC_ACETATE_BRILLANT`) · commande post-checkout reste en BROUILLON éditable (à confirmer produit) · `/checkout` panier vide sans redirect auto.

### Dette différée (`deferred-work.md`)

Issue de la revue de `story-S1.5-refactor-llm-finalisation` (2026-05-10), jamais reprise dans une story dédiée :

- `isBillingError`/`isClaudeBillingError` — regex de détection trop permissive (`/credit|billing|authentication/`), risque de fallback démo silencieux sur un message d'erreur Anthropic légitime.
- Drift de cette même regex entre `claude-proxy/index.ts` et `make-server-e3db71a4/index.ts`.
- `claude-proxy` standalone ne propage pas `userId`/`tenantId` → `llm_usage_events` perd l'attribution — à traiter avec l'instrumentation NFR23.
- Aucun `AbortSignal`/timeout sur les appels `fetch` Anthropic (`anthropicClient.ts:184,380`) — un hang bloque l'edge function jusqu'au kill plateforme Supabase (~150s).

*(Note : `story-S-LLM-WRAPPER-ROBUSTNESS` a depuis livré un durcissement partiel du wrapper le 2026-05-23 — vérifier avant de rouvrir ces points s'ils sont déjà couverts.)*

### Autre backlog spec-ready non absorbé

- `story-S-SUBTENANT-SCOPE-sous-espace` — filiales d'un imprimeur multi-sites, statut `spec-ready` (2026-05-22). Possiblement recouvert par `story-AF30-2-subtenant-management-orchestration` (livré, Epic 8) — **à vérifier avant de considérer cette story comme un vrai backlog**, car son périmètre a pu être absorbé par le refacto API-first sans renommage de la story d'origine.
- `story-S-RECONCILE-SUPABASE-MIGRATIONS` (spec-ready, 2026-05-22) — superseded par `story-S-RECONCILE-SUPABASE-MIGRATIONS-DONE` (livré, anticipé Sprint 5 vs Sprint 8 prévu). La version `-DONE` fait foi.
- `story-S-FIX-LARGE-CM-FORMATS`, `story-S-FIX-LIBRARY-UUID-normalisation` — `spec-ready` (2026-05-22), non retrouvées comme livrées dans `SPRINT_HANDOFF.md` — à vérifier en priorité, ce sont des correctifs de fond (formats CM/MM, normalisation UUID bibliothèque) potentiellement encore ouverts.
- `story-S-ORDER-ROLES-3-ui-portal-orders-roles` — remplacée en pratique par `story-S-ORDER-ROLES-3-UI` (livrée 2026-06-10, cf. `TF-NOTION-S-ORDER-ROLES-3-UI.md`) ; la story d'origine reste au statut `ux-ready` en frontmatter mais son contenu a été livré sous cet autre identifiant.

---

## Prochaine mise à jour

Ce document est un **export figé au 2026-09-04**, pas un flux synchronisé. Sources à re-consulter avant toute décision de sprint :
- `SPRINT_HANDOFF.md` pour l'état courant Sprint 5 / Gestion commerciale ;
- `docs/api/CONVENTIONS.md` §8 pour la dette R5 vivante du chantier E10 ;
- `git log --all --oneline --grep="E10"` pour l'avancement story-par-story du Sprint 5, faute de story documents dédiés.
