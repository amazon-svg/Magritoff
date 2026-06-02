---
title: Magrit v1.1+ — Roadmap qualité-first (post Sprint 4)
date: 2026-05-21
author: Arnaud Mazon (PO/PM) + Claude Code (Architect hat)
context: Post démo Groupe ICI 18/05 réussie + accord principe bêta 2 dirigeants
trade_off: Qualité > vitesse, on a le temps de tout faire, aucune story backlog glissée hors scope
horizon: 6 sprints (Phase 0 cadrage + Sprints 5-9), ~46-55j dev, ~6-8 semaines au rythme Magrit normal
predecessor: retrospective-sprint4-2026-05-20.md
successor: à définir post Sprint 9 (audit qualité v1.1)
---

# Magrit v1.1+ — Roadmap qualité-first

## Synthèse

Après livraison réussie du Sprint 4 PIM-Boutique-Commandes (20 stories, 18/05) et démo Groupe ICI réussie le même jour (accord principe bêta 2 dirigeants), la pression deadline tombe. Arnaud confirme 2026-05-21 : **qualité > vitesse, on a le temps de tout faire**. Cette roadmap réorganise les 19 stories en attente (rétrospective Sprint 4) en **6 sprints courts qualité-first** sans aucun glissement hors scope. S-ORDER-ROLES est scindée en 3 sous-stories → 22 stories totales + 5 chantiers d'audit Sprint 9. Les 2 questions expertes Arnaud sur S-ORDER-ROLES (Q4 lien avec `tenant_members.permissions`, Q6 modèle DB rôles) sont tranchées dans cette roadmap (couche séparée + table dédiée `tenant_order_roles`). 10 principes qualité non-négociables sont posés comme DoD étendue à intégrer dans `docs/project-context.md` §5.

## Principes qualité — DoD étendue (10 règles non-négociables)

Applicables dès Sprint 5. À intégrer dans `docs/project-context.md` §5 (action Phase 0.1) :

1. **Plafond 3-5 stories par sprint**, jamais plus (lesson 17/05 — vault).
2. **Checkpoint récap toutes les 3 stories** avec mini-doc visuel "ce qui a changé concrètement + ce que tu peux tester en 30s" (lesson 17/05).
3. **Smoke E2E parcours acheteur AI** obligatoire avant clôture sprint qui touche shop/orders/Magrit (lesson 20/05).
4. **Audit prod systématique avant toute heuristique numérique** (lesson 20/05).
5. **Sally UX consult systématique** sur tout composant user-facing nouveau ou modifié.
6. **ADR formalisée pour toute décision architecturale** (pattern Sprint 4).
7. **Story scindée si effort > 3 jours** (granularité atomique, pas de "story XL").
8. **TF Notion créé en parallèle de chaque story, pas en fin de sprint** (lesson Sprint 3).
9. **Story doc BMAD au démarrage de la story, pas rétrofit** (lesson Sprint 3).
10. **Audit a11y axe-core sur toute nouvelle route exposée acheteur** (pas seulement les 3 routes critiques actuelles).

## Vue d'ensemble 6 sprints

| Sprint | Bannière | Stories/Chantiers | Effort dev | Cumul stories |
|---|---|---|---|---|
| **Phase 0** | Cadrage qualité (10 artefacts non-dev) | 10 | 3-4j | — |
| **Sprint 5** | Orderbook & filet LLM | 5 | 6-7j | 5 |
| **Sprint 6** | Rôles, validation, audit complet | 5 | 10-12j | 10 |
| **Sprint 7** | Visuels boutique complets | 6-7 | 10-12j | 17 |
| **Sprint 8** | Filiales & hygiène | 5 | 7-8j | 22 |
| **Sprint 9** | Bilan Qualité v1.1 | 5 chantiers audit | 7-8j | 22 + 5 |
| **TOTAL** | | **22 stories + 5 chantiers audit** | **~46-55j (~6-8 semaines)** | 27 livraisons |

---

## Phase 0 — Cadrage qualité (~3-4 jours, non-dev)

**Bannière** : *"On installe les conditions de la qualité avant de coder."*

| # | Artefact | Owner | Pourquoi |
|---|---|---|---|
| 0.1 | ✅ **Livré 2026-05-22** — DoD étendue intégrée dans `docs/project-context.md` §5.2 (les 10 principes), §5 restructurée en §5.1 Cahiers de tests + §5.2 DoD étendue qualité-first | Claude (Tech Writer hat) | Source unique de vérité chargée par tous les agents BMAD |
| 0.2 | ✅ **Livré 2026-05-22** — Script `scripts/list-edge-functions-importing.sh` opérationnel, testé sur `anthropicClient.ts` → identifie 4 edge functions consommatrices (claude-proxy, make-server-e3db71a4, pim-generate, pim-ingest). Sort une checklist redeploy directement copiable | Claude (Dev) | Prévient l'oubli pim-ingest 9j de Sprint 4 |
| 0.3 | ✅ **Livré 2026-05-22** — Spec [story-S-LLM-WRAPPER-ROBUSTNESS.md](../implementation-artifacts/story-S-LLM-WRAPPER-ROBUSTNESS.md) finalisée : matrice billing double couche (status HTTP + regex stricte tokens identifiés), 8 ACs, ADR §4.11 préparée, plan tests régression 7 endpoints staging, 12 Tasks | Claude (Architect) | Story 🟡 → 🟢 |
| 0.4 | ✅ **Livré 2026-05-22** — Spec S-ORDER-ROLES refondue en overview/index avec Q1-Q10 tranchées + ADR §4.12 préparée + scindée en 3 sous-stories : [-1 schéma DB + RLS](../implementation-artifacts/story-S-ORDER-ROLES-1-schema-db-rls.md), [-2 RPC + audit](../implementation-artifacts/story-S-ORDER-ROLES-2-rpc-transitions-audit.md), [-3 UI tabs + admin catalog](../implementation-artifacts/story-S-ORDER-ROLES-3-ui-portal-orders-roles.md) | Claude (Architect) | Story L → 3 stories M-S |
| 0.5 | ✅ **Livré 2026-05-22** — Spec [story-S-PIM-VISUELS](../implementation-artifacts/story-S-PIM-VISUELS-gabarits-fond-personnalisable.md) refondue en overview/index : pivot shop-scoped formalisé (table `shop_visual_preferences` + override `shop_gamme_*`, plus tenant), Q1-Q8 tranchées (10 fonds biblio, JPG/PNG/WebP 5MB, modération a posteriori, override gamme MVP, upgrade in-place, cache key étendue, Imprint V2+), ordre 6 sous-stories formalisé (3 + 1 // → 2 → 5 → 4 → 6), ADR §4.13 préparée | Claude (Architect) | Permet sprint visuels structuré |
| 0.6 | ✅ **Livré 2026-05-22** — Spec [story-S-SUBTENANT-SCOPE-sous-espace.md](../implementation-artifacts/story-S-SUBTENANT-SCOPE-sous-espace.md) finalisée Usage A seul + 4 arbitrages Arnaud (héritage total / pas d'enum / un seul sous-tenant à la fois / dashboard MVP minimal) + 6 ACs + audit infra existante révèle effort **L → S (2j)** grâce à `parent_tenant_id` + trigger 2 niveaux + `createSubTenant` + héritage `TenantContext` déjà tous présents | Claude (Architect) + Arnaud arbitrages | Story 🟡 → 🟢 |
| 0.7 | ✅ **Livré + DÉCISION ACTÉE 2026-05-22** — Pitch Mary Analyst [pitch-court-S-PRODUCT-VIEWS-MULTI-2026-05-22.md](pitch-court-S-PRODUCT-VIEWS-MULTI-2026-05-22.md) + arbitrages Arnaud : **Option A 2D multi-vues confirmée pour Sprint 7** (Q-ROADMAP packaging Oui mais V2+, Q-SIGNAL-CLIENT Non, Q-SCOPE-PLV 2D suffit). Story future `S-PRODUCT-VIEWS-3D-PACKAGING` tracée pour V2+ quand le premier produit packaging entrera dans le catalogue. | Arnaud (décision) + Mary (pitch) | Débloque cadrage |
| 0.8 | ✅ **Livré 2026-05-22** — Story [S-RECONCILE-SUPABASE-MIGRATIONS](../implementation-artifacts/story-S-RECONCILE-SUPABASE-MIGRATIONS.md) (1.5j, Sprint 8) : 7 ACs avec audit prod read-only + provisionnement staging (branches Supabase ou projet éphémère) + dry-run avec script `supabase migration repair --status applied` pour les 28 migrations historiques + plan rollback testé + application prod en heures creuses + documentation `docs/SUPABASE_MIGRATIONS_WORKFLOW.md`. À faire EN PREMIER au Sprint 8 pour débloquer dry-runs des autres stories Sprint 8 (S-FIX-LIBRARY-UUID notamment) | Claude (Architect) | Dérisque story |
| 0.9 | ✅ **Livré 2026-05-22** — Vérification S3.2 : pas doublon, scope réduit à 3 ACs résiduelles (email Resend + status `draft` + permission `can_create_order`). Story [story-S3.2-residual-email-permission.md](../implementation-artifacts/story-S3.2-residual-email-permission.md) créée, Sprint 5, 1-1.5j | Claude (Dev) | Vérification terrain effectuée |
| 0.10 | ✅ **Livré 2026-05-22** — Specs [story-S-FIX-LIBRARY-UUID-normalisation.md](../implementation-artifacts/story-S-FIX-LIBRARY-UUID-normalisation.md) (6 ACs, normalisation UUID strict + rollback workaround P0.11) + [story-S-FIX-LARGE-CM-FORMATS.md](../implementation-artifacts/story-S-FIX-LARGE-CM-FORMATS.md) (5 ACs, refonte `isLikelyCm` → `normalizeDimensions` cohérent convention P0.9) | Claude (Dev) | 🟡 → 🟢 |
| 0.11 | Synchronisation backlog Notion (https://www.notion.so/4d2e2ea106914ce5a69728fdb67dfddd) avec les 22 stories de cette roadmap | Arnaud + Claude | Source unique de vérité |

**Sortie attendue** : 10 specs mûres + 1 script + DoD étendue + Notion synchronisé. 0 ligne de code produit, 0 surprise au démarrage Sprint 5.

---

## Sprint 5 — Orderbook & filet LLM (5 stories, ~6-7j)

**Bannière** : *"On clôt la promesse commandes simples + on durcit le LLM avant ouverture bêta."*

| Story | Effort | DoD spécifique |
|---|---|---|
| S3.1 OrderHistoryTable + filtres + badge couleur | 1.5j | Sally UX consult mockup avant dev. Status mapping `label→enum` dans `src/app/lib/orderStatus.ts` (anticipation extension S-ORDER-ROLES). TF Notion. Audit a11y route `/shop/<slug>/orders`. |
| S3.3 Renouveler 1-clic | 0.5j | TF Notion. |
| S3.4 Annulation commande draft | 0.5j | Modal confirm Sally. TF Notion. |
| S-LLM-WRAPPER-ROBUSTNESS | 2-3j | Tests régression staging avant prod. ADR §4.11 si pattern significatif. TF Notion non-régression chat strict streaming. |
| R5-bis invite-member transactional | 1j | Tests rollback Resend down. TF Notion E9.5 résilient. |

**Checkpoint impératif** après S3.4 (3 stories cumulées) : mini-récap visuel obligatoire, puis enchaîne S-LLM-WRAPPER + R5-bis.

**Sortie** : 5 commits + 5 TF + DoD respectée. Bêta technique solide.

---

## Sprint 6 — Rôles, validation, audit complet (5 stories, ~10-12j)

**Bannière** : *"On donne aux clients B2B la chaîne de validation et la traçabilité d'un acheteur public."*

| Story | Effort | DoD spécifique |
|---|---|---|
| S-ORDER-ROLES-1 Schéma DB + enum statuts extensibles + RLS | 2j | 3 nouvelles tables (`tenant_role_definitions`, `tenant_role_assignments`, `tenant_order_roles`). Tests RLS vitest 6+ cas. ADR §4.12. |
| S-ORDER-ROLES-2 RPC transitions + audit events | 2-3j | RPC `assign_tenant_order_role` + `revoke_tenant_order_role` + `update_tenant_order_role_capabilities`. Trigger audit dans `tenant_order_role_events`. Tests vitest. |
| S-ORDER-ROLES-3 UI PortalOrders tabs filtrés + composants `useOrderRoles` | 2-3j | Sally UX wireframes préalables. Tabs "À valider / Mes commandes / À approuver / À produire". TF Notion 1 par tab. Audit a11y. |
| S-N1-APPROVAL Workflow backend N+1 + notifications Resend par étape | 2j | Edge function `order-workflow-step` qui mappe transition → notify_policy. Tests vitest matrice transitions. TF Notion email reçu par bon destinataire. |
| S3.5 Audit trail UI (modale historique statuts) | 1.5j | Lit `tenant_order_status_events` + `tenant_order_role_events`. Sally UX mockup drawer vs page dédiée. TF Notion. |

**Checkpoint impératif** après S-ORDER-ROLES-3 (3 stories cumulées) puis surveillance fine sur S-N1-APPROVAL et S3.5.

**Risque** : Sprint le plus chargé. Si débrief Groupe ICI 26/05 fait émerger une priorité nouvelle, on redéfinit Sprint 6 plutôt que de tasser.

---

## Sprint 7 — Visuels boutique complets (6-7 stories, ~10-12j)

**Bannière** : *"On donne aux boutiques leur identité visuelle propre et photo-réaliste."*

S-PIM-VISUELS découpé en 6 sous-stories selon la spec (ordre formalisé Phase 0.5), traitées toutes (qualité-first) :

| Story | Effort | Dépendance |
|---|---|---|
| S-PIM-VISUELS-1 Bibliothèque Magrit 10 fonds pré-conçus (kraft, marbre, desk wood, mains, etc.) | 1.5j | Sally curation visuels |
| S-PIM-VISUELS-2 Upload utilisateur (Supabase Storage `shop_backgrounds` + validation MIME/poids strict) | 2j | Sécurité MIME/poids |
| S-PIM-VISUELS-3 Table `shop_visual_preferences` (granularité boutique + par-gamme override) + RLS | 1j | RLS tests vitest |
| S-PIM-VISUELS-4 UI admin boutique `<ShopVisualSettings>` (collapsible par gamme + preview live) | 2j | Sally wireframes |
| S-PIM-VISUELS-5 Refonte `mockup-generator` (composition background layer + product layer) | 2j | ADR layers |
| S-PIM-VISUELS-6 Gabarits 5 templates plus photo-réalistes (carte 3D, kakémono pied, brochure ombre, étiquette perspective, flyer texture) | 2.5j | Snapshot SVG versionné |
| S-PRODUCT-VIEWS-MULTI (post Pitch court Phase 0.7) | 2-3j si 2D / 5-7j si 3D | Hypothèse 2D = recto/verso via 2 SVG composés. Si 3D : story éclatée en Sprint 7-bis dédié. |

**Checkpoint impératif** après VISUELS-3 (mi-sprint).

**Risque** : si Pitch court Phase 0.7 retient 3D, S-PRODUCT-VIEWS-MULTI sort de Sprint 7 et devient Sprint 7-bis dédié (5-7j supplémentaires).

---

## Sprint 8 — Filiales & hygiène (5 stories, ~7-8j)

**Bannière** : *"On structure les imprimeurs multi-sites et on solde la dette technique."*

| Story | Effort | DoD |
|---|---|---|
| S-SUBTENANT-SCOPE (Usage A filiale, post-nettoyage Phase 0.6) | 2-3j | Helper RLS `is_subtenant_member_direct`. Tests vitest. Sally UX dashboard consolidé parent. |
| Reconcile Supabase migrations history (post mode opératoire Phase 0.8) | 1.5j | Dry-run staging obligatoire avant prod. `supabase db push` doit fonctionner après. |
| ProductCard DRY priceResolver | 0.5j | Vérifié encore pertinent ([ProductCard.tsx:202-223](../../src/app/components/ProductCard.tsx) garde `estimatePrice()` local). |
| R2-bis ChatInterface sous-composants (UI pur) | 1.5j | 4 sous-composants extraits : `ChatMessageList` / `ChatInput` / `ChatHistoryPanel` / `ChatModeToggle`. Tests vitest. |
| S-FIX-LIBRARY-UUID + S-FIX-LARGE-CM-FORMATS (regroupés en mini-batch) | 1j | Tests vitest sur cas limite (kakémono 4m). |

**Sortie** : codebase Magrit techniquement propre. Dette technique soldée.

---

## Sprint 9 — Bilan Qualité v1.1 (5 chantiers audit, ~7-8j)

**Bannière** : *"On audite, on mesure, on corrige avant déclaration v1.1 stable et ouverture bêta dirigeants."*

⚠️ **Ce sprint n'est pas un sprint feature.** C'est un sprint d'audit qualité. Chantiers à formaliser en Phase 0 du sprint (cadrage léger).

| Chantier | Effort | Objectif |
|---|---|---|
| R8-bis tests Auth/Shops/hooks via `createSupabaseMock` | 2j | Coverage globale 60%. |
| Audit a11y axe-core étendu — toutes les routes acheteur (`/shop/:slug/*` complet) | 1.5j | 0 violation WCAG A + AA. Si violations → mini-fix dans le sprint. |
| Audit perf bundle — vérifier no-regression vs 245kB gz baseline, identifier gros chunks récents | 0.5j | Bundle ≤ 280kB gz toléré, sinon refacto lazy. |
| Audit sécurité RLS — toutes les nouvelles policies post Sprint 5-8 (tenant_role_*, shop_visual_preferences, tenant_orders étendu) | 1.5j | Tests RLS isolation cross-tenant exhaustifs. |
| Documentation utilisateur figée (pour bêta dirigeants) — guide bêta acheteur + guide bêta admin tenant | 2j | Paige (Tech Writer) hat. Markdown dans `docs/bêta-guides/`. |

**Sortie** : v1.1 déclarée stable. Bêta peut s'ouvrir sereinement.

---

## Réponses techniques aux questions expertes Arnaud (S-ORDER-ROLES)

### Q4 — Lien avec `tenant_members.access_scope` + `permissions` existants : **couche séparée**

**Justification** :
- `tenant_members.permissions` modélise des droits structurels d'appartenance (`magrit_full`/`shop_only`, `can_quote`/`can_order`/`can_invite`) = autorisation statique liée à la place dans l'organisation.
- Le système Acheteur/Producteur + validateurs N modulaires + droits paramétrables (`valider/annuler/modifier/exporter`) + notifications configurables par étape = autorisation contextuelle liée à un workflow paramétrable par tenant. Radicalement différent.
- 4 raisons de ne PAS mélanger : (1) évolution séparée, (2) cardinalité (1 ligne user vs N rôles catalog par tenant), (3) audit (transitions à tracer dans `tenant_order_role_events`), (4) RLS lisibilité (policy `tenant_orders_select` déjà longue, parsing JSONB serait imbuvable).

**Conception cible** :
```
tenant_members  (existant, ne pas modifier)
tenant_role_definitions  (NOUVEAU — catalog rôles paramétrés par tenant)
   id, tenant_id, name, capabilities {can_validate, can_cancel, can_modify, can_export} jsonb,
   notify_policy ('chain_next' | 'all_roles' | 'none'),
   ordering_index int, scope ('tenant' | 'shop'), scope_shop_id uuid nullable
tenant_role_assignments  (NOUVEAU — qui occupe quel rôle, indépendant commande)
tenant_order_roles  (NOUVEAU — qui occupe quel rôle SUR UNE COMMANDE)
```

**Bénéfice secondaire** : cette couche métier devient réutilisable pour d'autres workflows futurs (validation devis, validation chargement Canva...) sans toucher au cœur authz.

### Q6 — JSONB sur `tenant_orders` vs table dédiée : **table dédiée `tenant_order_roles`**

**4 raisons décisives** :
1. **Audit et traçabilité** — soft delete via `revoked_at`, audit natif. JSONB perd la temporalité.
2. **Scalabilité requêtes** — "toutes les commandes que je dois valider" = SELECT simple avec index. JSONB = GIN possible mais fragile au refactoring.
3. **RLS** — extension policy SELECT triviale en table dédiée (`OR exists (...)`). JSONB = parsing JSON dans la policy = SQL imbuvable + perf dégradée.
4. **Cumul de rôles (Q2 = oui)** — JSONB type `{ "passer": "uid_a", "validator_1": "uid_a" }` est limite (même UID, 2 rôles). Table dédiée = 2 rows naturels.

**Schéma cible** :
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

**Anti-pattern formellement à éviter** : *"on commence en JSONB pour aller vite, on migrera plus tard"* — la dette est garantie.

---

## Risques résiduels et mitigations

| Risque | Probabilité | Mitigation |
|---|---|---|
| Débrief Groupe ICI 26/05 fait émerger priorité produit nouvelle | Élevée | Sprint 5 court (5 stories) absorbe le choc. Si priorité lourde, redéfinir Sprint 6 sans tasser Sprint 5. |
| S-ORDER-ROLES dérape en Sprint 6 (3 sous-stories, RLS + RPC + UI) | Moyenne | Checkpoint impératif après chaque sous-story. Découpage Phase 0.4 par Architect. |
| S-PRODUCT-VIEWS-MULTI Pitch court retient 3D → story éclate sprint visuels | Moyenne | Pitch court fait dès Phase 0.7. Si 3D, story sortie de Sprint 7 et placée en Sprint 7-bis dédié. Pas de surprise en cours de sprint. |
| Reconcile migrations casse staging | Faible (avec dry-run) | Mode opératoire formalisé Phase 0.8. Dry-run staging obligatoire avant prod. Plan rollback documenté. |
| Sprint 9 audit révèle violations a11y massives nécessitant re-dev | Moyenne | DoD étendue principe #10 dès Sprint 5 prévient. Audit a11y par route exposée acheteur dans chaque sprint, pas au global Sprint 9. |
| Backlog Notion non synchronisé avec la roadmap | Élevée | Phase 0.11 = synchroniser le backlog avec les 22 stories de cette roadmap. |

---

## Annexe — Maturité des 19 stories d'origine

| Story | Cat. | Maturité | Effort | Sprint cible |
|---|---|---|---|---|
| S3.1 OrderHistoryTable | 1 | 🟢 | 1.5j | Sprint 5 |
| S3.2 Création draft + ACK | 1 | 🟢 (post Phase 0.9 — pas doublon, scope réduit à 3 ACs résiduelles : email Resend admin tenant + status `draft` default + permission `can_create_order`) | 1-1.5j | Sprint 5 (→ [story-S3.2-residual-email-permission.md](../implementation-artifacts/story-S3.2-residual-email-permission.md)) |
| S3.3 Renouveler 1-clic | 1 | 🟢 | 0.5j | Sprint 5 |
| S3.4 Annulation draft | 1 | 🟢 | 0.5j | Sprint 5 |
| S3.5 Audit trail UI | 1 | 🟡 | 1.5j | Sprint 6 |
| S-N1-APPROVAL | 2 | 🔴 → 🟢 post Phase 0.4 | 2j | Sprint 6 |
| S-PRODUCT-VIEWS-MULTI | 2 | 🟢 (post décision Arnaud 22/05 : Option A 2D multi-vues confirmée) | 2-3j | Sprint 7 (option A → pas de Sprint 7-bis nécessaire) |
| S-PRODUCT-VIEWS-3D-PACKAGING (nouveau, V2+) | tracé suite à Q-ROADMAP Oui | 🔴 (à cadrer quand catalogue packaging élargi) | TBD (5-7j base + 5-15j modélisation 3D externe) | V2+ post-Sprint 9 (déclenchement = arrivée premier produit packaging dans catalogue) |
| S-FIX-LIBRARY-UUID | 2 | 🟡 → 🟢 post Phase 0.10 | 0.5j | Sprint 8 |
| S-FIX-LARGE-CM-FORMATS | 2 | 🟡 → 🟢 post Phase 0.10 | 0.5j | Sprint 8 |
| R2-bis ChatInterface | 3 | 🟡 | 1.5j | Sprint 8 |
| R5-bis invite-member transactional | 3 | 🟢 | 1j | Sprint 5 |
| R8-bis tests Auth/Shops/hooks | 3 | 🟢 | 2j | Sprint 9 |
| Reconcile Supabase migrations | 4 | 🟡 → 🟢 post Phase 0.8 | 1.5j | Sprint 8 |
| ProductCard DRY priceResolver | 4 | 🟢 (vérifié pertinent) | 0.5j | Sprint 8 |
| S-LLM-WRAPPER-ROBUSTNESS | 5 | 🟡 → 🟢 post Phase 0.3 | 2-3j | Sprint 5 |
| S-ORDER-ROLES | 6 | 🟡 → 🟢 post Phase 0.4 (scindée 3) | 5-7j | Sprint 6 |
| S-PIM-VISUELS | 6 | 🟡 → 🟢 post Phase 0.5 (6 sous-stories) | 10-12j | Sprint 7 |
| S-SUBTENANT-SCOPE | 6 | 🟡 → 🟢 post Phase 0.6 | 2-3j | Sprint 8 |

---

## Liens

- Rétrospective Sprint 4 : [retrospective-sprint4-2026-05-20.md](../implementation-artifacts/retrospective-sprint4-2026-05-20.md)
- PRD v1.1 : [prd.md](prd.md)
- Architecture v1.1 : [architecture.md](architecture.md)
- Epics & Stories : [epics.md](epics.md)
- Sprint status courant : [sprint-status-2026-05-17.md](../implementation-artifacts/sprint-status-2026-05-17.md)
- Deferred work (source S-LLM-WRAPPER) : [deferred-work.md](../implementation-artifacts/deferred-work.md)
- Specs retravaillées 21/05 : [story-S-ORDER-ROLES](../implementation-artifacts/story-S-ORDER-ROLES-roles-commande.md), [story-S-PIM-VISUELS](../implementation-artifacts/story-S-PIM-VISUELS-gabarits-fond-personnalisable.md), [story-S-SUBTENANT-SCOPE](../implementation-artifacts/story-S-SUBTENANT-SCOPE-sous-espace.md)
- Backlog Notion : https://www.notion.so/4d2e2ea106914ce5a69728fdb67dfddd
- TF Notion : https://www.notion.so/7e576e695d504cc9a32ead92f4dde01c
