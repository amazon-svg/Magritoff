# Magrit Beta 4 / Beta 5 — Handoff entre sessions Claude code

> Document de reprise pour démarrer une nouvelle session de Claude code sur le projet sans recharger tout l'historique. À tenir à jour à chaque fin de sprint.
>
> **Dernière mise à jour : 2026-07-08 — Sprint E3 Navigation (Epic 2 e-commerce) CLÔTURÉ + correctif méga-menu (sous-catégories par format S2.18-fix, vérifié live). Voir section 18. Tout poussé `origin/beta/v5` (HEAD `5e7260a`), edge `category-editorial` déployée. 714 tests verts.**

## 18. Sprints E1 → E3 — Extension boutique e-commerce standard (Epic 2) — E3 CLÔTURÉ 2026-07-08

Extension de la boutique B2B vers un standard e-commerce (Epic 2, `_bmad-output/planning-artifacts/epics.md` L629+, FR-ECOM). Mémoire projet : `project_ecom_boutique_extension.md`. Découpage en sprints E1 (ProductCard lisibilité) · E2 (paniers/devis) · **E3 (navigation)**.

### Correctifs post-clôture E3 (2026-07-08, suite feedback Arnaud sur boutique manitou)

⚠️ **3 commits en attente de push** au moment de la rédaction (coupure réseau GitHub/egress ; la boucle de retry pousse dès réouverture). Vérifier `git rev-list --left-right --count origin/beta/v5...beta/v5` en début de session.

| Commit | Sujet | Détail |
|---|---|---|
| `e6439c1` | fix timeout claude-proxy 15s→45s | Correctif intermédiaire, **superseded** par le streaming ci-dessous. |
| `922dc6f` | **feat streaming boutique (S-SHOP-STREAM)** | Le `askMagrit` du catalogue (`PortalCatalog`) passe sur `claude-proxy-stream` via le hook partagé `useClaudeSseStream` (même que la home). Motif : requêtes larges/multi-produits (ex. « produits pour événement sportif 15 équipes rugby ») prennent **30s+** (mesuré 30,9s → 5 configs) ; l'ancien invoke non-streamé coupait à 15/45s → filtre texte local muet sur une phrase = **écran sans réponse**. Le `done` SSE porte les mêmes `configs`. Indicateur « Magrit rédige sa réponse… ». Erreurs typées `ClaudeSseStreamError` (aborted/billing/réseau). |
| `8191a9c` | **fix méga-menu responsive** | `ShopMegaMenu` n'est plus `hidden md:flex` (invisible < 768px). Barre de familles visible sur toutes largeurs, scrollable horizontalement, familles tappables → navigation. Panneau sous-catégories reste un enrichissement desktop (survol), non-débordant en étroit. Répond au « je ne vois plus de bigmenu » d'Arnaud (fenêtre < 768px). |
| `5e7260a` | **feat méga-menu sous-catégories par format (S2.18-fix)** | **Poussé.** Le panneau déroulant ne se déployait jamais sur un catalogue à produits : conditionné à `subcategories.length > 0`, or le seed S-CAT-3 rattache les produits à la gamme RACINE → aucune gamme enfant peuplée. Correctif conforme ADR-4.17 (décision Arnaud « peupler sans re-seeder ») : `buildShopTaxonomy` dérive les sous-catégories depuis les **formats** des produits (`resolveFormatLabel`, source facette S2.19) quand aucun enfant PIM n'est peuplé. `formatKey` threadé ShopMegaMenu→ShopLayout→PublicShop→PortalCatalog : clic sous-cat = filtre **famille** + présélection **facette Format**. Libellés/slugs alignés PIM (« A3 »→« Affiche A3 »), bucket « Autre » jamais exposé. **Vérifié live** (ERAM, 30 produits : Affiches → A2·4/A1·1/A3·1, clic A2 → 4 résultats filtrés). Story `story-S2.18-megamenu-format-subcats.md`. |

**Tests** : 714 vitest verts (build vert) après le correctif `5e7260a` (+5 cas taxonomy). Réseau rétabli : les 4 commits E3 en attente + le correctif méga-menu sont poussés sur `origin/beta/v5` (HEAD `5e7260a`).

**Diagnostic #2 méga-menu** : ce n'était pas un bug applicatif — le `hidden md:flex` datait de S2.18 (desktop-only par design). Le correctif le rend accessible en étroit/mobile.

**Non fait (bloqué réseau)** : vérif Chrome live du streaming + méga-menu (le fetch données boutique passe par le sous-domaine projet Supabase, injoignable pendant la coupure).

### E1 — Lisibilité ProductCard boutique (livré + poussé, HEAD `c0ec853`)
- S2.11-S2.14 lisibilité ProductCard + S2.15 bloc « Nouveautés » sur la home boutique. 650 tests. Audit prod : **S2.17 abandonnée** (POC, bloc vide).

### E2 — Paniers / devis (livré + poussé)
- **S2.16 (option C, décision Arnaud 2026-07-07)** : panier/reprise sur la home boutique + « Devis en attente » en **sous-menu du menu Devis** au tableau de bord (page `dashboard/quotes/pending`, comme « Gabarits de devis »). Helpers `resolvePendingQuotes` / `summarizeCartResume`.

### E3 — Navigation (CLÔTURÉ 2026-07-08, 4 stories + 1 chantier cohérence)

| Story | Commit | Livré |
|---|---|---|
| **S2.18** méga-menu | (E3) | `ShopMegaMenu` : familles (repère couleur + picto + compteur) → panel sous-catégories + vignette featured. Taxonomie `buildShopTaxonomy` sur l'arbre gammes PIM. A11y aria-haspopup/expanded/controls + Escape. |
| **Cohérence catégorie (ADR-4.17)** | (E3) | Chantier hors-plan : la **gamme = catégorie explicite** (FK `gamme_slug` sur `product_library` + `shop_products`), prime sur la résolution par format. Le format ne détermine JAMAIS la famille. Migrations `20260707000100/150/200` appliquées prod (packaging ajouté, 31/31 produits seedés racine). Le LLM produit renvoie désormais `gamme`. Badge carte = méga-menu = pilule = `resolveProductGamme`. |
| **S2.19** fil d'Ariane + facettes | `9a42c4e` | `catalogFacets.ts` : fil d'Ariane « Accueil › Catalogue › Famille » + facettes **Format** (filtre, pas catégorie) + **Prix** (tranches <100/100-500/>500). État vide → réinitialiser + « Demander à Magrit ». |
| **S2.21** recherche + autocomplétion | `8398003` | `catalogSearch.ts` : autocomplétion dès 2 car. (familles puis produits), clic produit → fiche / clic famille → filtre (`selectGammes`). Aucun match → « Demander à Magrit » pré-rempli (ADR §4.15). Index = catalogue complet. Accent-insensible. |
| **S2.20** landing éditorialisée LLM | `d731243` | `catalogLanding.ts` + `PortalCategoryLanding` : landing famille (titre + intro + sous-catégories + best-sellers + grille). **Socle déterministe** (jamais vide) + **enrichissement LLM** endpoint edge `category-editorial` (Haiku, cache session, timeout 12s → repli socle). |

### Endpoint edge déployé prod B5
- **`make-server-e3db71a4/category-editorial`** (S2.20) : génère `{title, intro, seo}` d'une famille via Haiku. Fallback gracieux (clé absente / billing / erreur → editorial vide, le client garde le socle). **Déployé + vérifié live 2026-07-08** (réponse réelle sur « Affiches »).

### Tests
- **709 vitest verts** (baseline E3 début 650 → 709). Nouveaux fichiers : `catalogFacets.test.ts`, `shopTaxonomy.test.ts`, `shopFamilyIdentity.test.ts`, `resolveProductGamme.test.ts`, `catalogSearch.test.ts` (11), `catalogLanding.test.ts` (9). 0 régression.

### ADR
- **§4.17** (architecture.md) : `gamme_slug` = catégorie explicite autoritaire. Le format est un attribut/filtre, jamais un déterminant de famille. Réf. gammes Exaprint/Vistaprint. Packaging = tout carton/emballage.

### Reste / suivi
- **Révoquer le PAT Supabase** utilisé pour le déploiement (hygiène).
- **Epic 2 restant** : S2.22 (navigation par intention/usage IA) → S2.31. Sprint E4+ à cadrer.
- **S-CAT-EDIT** (suivi) : éditer la catégorie d'un produit dans l'UI PIM (aujourd'hui seed + LLM).
- Sous-catégories méga-menu/landing masquées tant que le catalogue est seedé au niveau racine (attendu, dégradé gracieux).

## 17. Session 2026-07-02 — S-QUOTES : bibliothèque de devis éditables

Demande Arnaud : éditer les devis après génération (quantités, prix, marges), modifier le nom du client, réordonner les lignes, bibliothèque avec statuts (en cours/validé/rejeté) au tableau de bord, devis associés à l'utilisateur (admin voit tout). Plan validé (ExitPlanMode) puis exécution 6 stories.

### Décisions produit
- **Devis multi-lignes** : nouvelle table `quote_lines` (le modèle `quotes` était à plat, 1 produit).
- **Prix ET marge % synchronisés** par ligne (markup sur coût par défaut — **à confirmer** vs taux de marque).
- **Création depuis le panier** (bouton « Créer un devis ») puis éditeur dédié.
- Statuts : `text` + CHECK rétro-compatible, mapping 3 groupes UI (en cours = draft/sent/pending · validé = validated/won · rejeté = rejected/lost).
- RLS override admin calqué sur `tenant_orders` (auteur édite ses devis quel que soit le statut ; admin/owner tenant voit et édite tout).

### 6 stories livrées (code, non commité — confirmation push requise)
| Story | Contenu |
|---|---|
| S-QUOTES-1 | Migration `20260702000100` (ALTER quotes + `quote_lines` + RLS + trigger + compat data) + tests RLS `quotes_lines_isolation.test.ts` (6 cas) + types |
| S-QUOTES-2 | `quoteMath.ts` (synchro prix/marge, 13 tests) + `QuotesContext` (scope mine/all) + montage AppShell |
| S-QUOTES-3 | `DashboardQuoteEditor` (page `dashboard/quotes/:id/edit`) + `openQuotePrint`/`buildQuoteDocumentHtml` (quote.ts) + `quoteStatus.ts` + testIds `quoteLib` |
| S-QUOTES-4 | Bouton « Créer un devis » dans `CartButton` (+ « Imprimer directement » secondaire) |
| S-QUOTES-5 | Refonte `DashboardQuotes` : 3 statuts, bascule scope Mes/Tous (owner/admin), colonne Émetteur, actions ligne (éditer/dupliquer/supprimer) |
| S-QUOTES-6 | Statut = simple UPDATE (pas de RPC audit) + procédure smoke E2E acheteur |

Build Vite vert · 47 tests unitaires/smoke verts (RLS skip sans creds).

### ⚠️ Reste à faire avant clôture
1. **Appliquer la migration** `20260702000100_s_quotes_editable_library.sql` en prod B5 (PAT Supabase → Arnaud) puis `npm run db:types` (régénérer proprement `database.types.ts`, actuellement patché à la main).
2. **Confirmer la sémantique de marge** (markup sur coût vs taux de marque sur prix de vente).
3. Lancer les tests RLS avec `.env.test` + smoke E2E Chrome MCP (section testIds `quoteLib`).
4. Résolution email/nom émetteur (colonne Émetteur montre id court pour l'instant).
5. Commit + push (convention `feat(v5):`, confirmation).

## 16. Session 2026-06-15 — A4 mini-sprint personnalisation boutiques (CR WM#090626 action A4)

Workflow BMAD : cartographie 2 volets (perso boutique + bibliothèques) → menu 8 axes proposés à Arnaud → arbitrage périmètre A4.1+A4.2+A4.5 → Amelia Dev exécution. Commits locaux `beta/v5` (pas encore poussés origin au moment de cette mise à jour).

### Décisions Arnaud (2026-06-15)

- **Périmètre A4** : A4.1 (hero+tagline) + A4.2 (palette élargie+fonts curated) + A4.5 (tarif négocié per-shop). Autres axes du menu (A4.3/A4.4/A4.6+) restent backlog 🟡.
- **A4.5 architecture** : table dédiée `shop_product_pricing` (pas colonne sur `shop_products` legacy) — extensible pour validity temporelle V2.
- **Mode build, pas démo client immédiate** : on enrichit le backlog, pas de démo Groupe ICI sur A4.

### 3 commits livrés

| Commit | Sujet | Tests |
|---|---|---|
| `7a39ddc` | A4.1 bannière hero + tagline (migration + UI editor + render ShopLayout + helpers) | 572 verts |
| `00b133d` | A4.2 palette élargie + fonts curated par pairing (5 pairings Google Fonts) | 588 verts |
| `bb6f2f1` | A4.5 tarif négocié per-shop (table + helper + branchement PublicShop + UI inline editor) | 597 verts |

### Migrations Supabase appliquées prod B5

| Migration | Contenu |
|---|---|
| `20260615000100` | `shops.hero_image_url` + `shops.tagline` (idempotent ALTER ADD COLUMN) |
| `20260615000200` | `shop_product_pricing` table + RLS 3 policies (tenant select/write + public read shops actifs) + unique index couple (shop_id, library_product_id) + index secondaires |

Aucune migration SQL pour A4.2 : extension du JSONB `shops.theme` pure code (back-compat boutiques existantes via fallback dans les helpers).

### Surface fonctionnelle livrée

**A4.1 — Bannière hero + tagline**
- Section « Bannière hero » dans `DashboardShopEditor` : URL image + textarea tagline 120 char + aperçu live
- Rendu conditionnel dans `ShopLayout` (avant header sticky) : 200px desktop / 140px mobile, gradient overlay tagline
- Helpers `shouldRenderHeroBanner` + `resolveHeroTagline` (testables purs)
- TestIds `shop.heroBanner` + `shop.heroTagline`

**A4.2 — Palette + fonts**
- `ShopTheme` étendu (optionnel back-compat) : secondaryColor / textColor / bgColor / fontPairing
- Module `fontPairings.ts` : 5 pairings curated (system / modern Inter / editorial Lora+Inter / luxury Playfair+Lato / technical Roboto Slab+Roboto)
- `index.html` prefetch Google Fonts (Inter, Lora, Playfair Display, Lato, Roboto, Roboto Slab) `display=swap`
- `resolveShopBrandStyle` expose 5 nouvelles CSS vars : `--shop-secondary`, `--shop-text`, `--shop-bg`, `--shop-font-heading`, `--shop-font-body`
- `DashboardShopEditor` section Apparence étendue : 3 inputs color + 1 select pairing
- ShopLayout : `fontFamily` wrapper utilise `var(--shop-font-body, var(--font-ui))` ; hero tagline utilise `var(--shop-font-heading)`

**A4.5 — Tarif négocié per-shop**
- Table `shop_product_pricing` : id / shop_id (FK cascade) / library_product_id (FK cascade) / price_ht_override / tenant_id / timestamps
- RLS : tenant_select + tenant_write (membres) + public_read (anonyme via shops.active=true)
- Helper `applyPricingOverrides(products, overrides)` pur : remplace `price_ht` + ajoute `price_ht_override`
- `PublicShop.refetchProducts` : fetch overrides + application avant `setProducts`
- `DashboardShopEditor` : input number inline « Prix négocié » par produit library, upsert/delete sur blur, badge « négocié » + label adaptive desktop
- Hiérarchie de prix portail acheteur étendue : `shop_pricing > library_cached > zero`

### Tests cumul

- **597 vitest verts** (+25 vs baseline post-S-ORDER-ROLES-3-UI 572), 0 régression
- **+6 cas ShopLayout.helpers** : `shouldRenderHeroBanner` + `resolveHeroTagline` (null / undefined / empty / whitespace / trim cap)
- **+11 cas fontPairings** : catalog complet (5 pairings, clés uniques, labels FR, fallback system)
- **+8 cas ShopLayout.helpers** : `resolveShopBrandStyle` étendu (5 CSS vars + back-compat JSONB + pairing fallback)
- **+9 cas applyPricingOverrides** : match, no-match, multi, immutabilité, défensif overrides malformés

### Lessons appliquées sur la session

- **2026-05-25 §refonte non-cassante** : aucune régression sur les boutiques existantes (champs optionnels JSONB + fallback dans les helpers).
- **2026-05-22 microcopy FR** : « Bannière hero », « Aperçu », « Pairing de fonts », « Prix négocié » — aucun anglicisme dans l'UI.
- **2026-06-09 régression seed** : aucune fonction SQL `CREATE OR REPLACE` partagée dans ces migrations → 0 risque.
- **2026-05-17 mini-récap factuel** + résumé exécutif → produit en fin de session.

### Brief A3 démo Magrit Core (Mary BMAD, livré en parallèle)

3 livrables dans `_bmad-output/planning-artifacts/` :
- `brief-A3-demo-magrit-core-2026-06-15.md` — séquence démo 4 étapes ~6 min, audit maturité stories (3🟢/3🟡/6🔴), 8 questions Xavier, 3 actions Arnaud
- `demo-fichier-brut-magrit-core.csv` — 12 lignes brutes représentatives (mélange unités, doublons silencieux, 5 OUT_OF_SCOPE)
- `demo-prompt-claude-cleaning.md` v2 — calibré sur la doc API Clariprint réelle (CSV `;`, vocabulaire FR `type;ref;qt;hauteur;largeur;Qualité;grammage;recto;verso;binding;pages`)

Prompt **testé en conditions réelles 2026-06-15** via sous-agent Claude : 12/12 items extraits, 7 chiffrables / 5 OOS attendus, doublon COM-001/COM-007 détecté, mapping types/encres/reliures correct, CSV final propre. **Validé pour la démo mer/jeu 15/06.**



Workflow BMAD complet : Sally UX (3 wireframes lo-fi 2026-06-08) → arbitrage Q1/Q2/Q3 Arnaud → Amelia Dev (T2-ter à T9). Tous les commits poussés sur `origin/beta/v5` 2026-06-10 (`bc28a31`).

### Décisions Arnaud (post-wireframes Sally)

- **Q1** : permission accès page admin catalog rôles = `can_manage_roles` (NOUVELLE permission, par défaut Owner + Admin via migration 2026-06-09)
- **Q2** : ordre 4 tabs PortalOrders = `Mes commandes → À valider → À approuver → À produire` (chronologique workflow)
- **Q3** : 1 définition de rôle = 1 scope unique (tenant OU une seule boutique), pas d'array `scope_shop_ids[]`. Bouton "Dupliquer" pour répliquer entre boutiques.

### 9 commits livrés (chronologique, `da2575a..bc28a31`)

| Commit | Sujet |
|---|---|
| `b245e99` | docs Sally wireframes (3 fichiers `.design-handoff/wireframes/`) + story doc ux-ready |
| `e7cab2a` | T2-ter migration `can_manage_roles` Admin preset + RPC `get_portal_orders_counters` |
| `92fd406` | fix régression seed_tenant_catalogs (perform seed_status_transitions restauré) |
| `9c1c460` | T3 PortalOrders refondu 4 tabs role-driven + RPC `get_portal_orders_workflow` + `RejectOrderConfirmDialog` |
| `db51177` | T3-bis DashboardOrders harmonisé (Démarrer prod + Marquer expédiée) |
| `5a32f18` | BUG routing acheteur — RPC `auto_accept_pending_invitations` + branchement TenantContext + one-shot DB `emgaar@me.com` |
| `706cf34` | T4+T5 page admin `/dashboard/order-roles` + composant `RoleEditorDialog` + route + lien sidebar (icône Workflow) |
| `c4fb997` | T6+T7 21 tests vitest + a11y-scan étendu |
| `bc28a31` | T9 5 TF Notion copy-paste + smoke E2E live chrome + fix loading infini PortalOrders anonyme |

### Migrations Supabase appliquées prod B5

| Migration | Contenu |
|---|---|
| `20260609000100` | UPDATE rétroactif preset Admin can_manage_roles=true + back-fill tenant orphelin smoke + refonte seed_tenant_catalogs |
| `20260609000200` | RPC `get_portal_orders_counters(p_shop_id, p_user_id)` returns 4 compteurs (mine/to_validate/to_approve/to_produce) |
| `20260609000300` | Fix régression seed_tenant_catalogs (perform seed_tenant_status_transitions restauré) |
| `20260609000400` | RPC `get_portal_orders_workflow(p_shop_id, p_tab, p_user_id)` returns table(order_id uuid) — IDs par tab workflow |
| `20260610000100` | RPC `auto_accept_pending_invitations()` SECURITY DEFINER — corrige users qui signup direct sans cliquer lien invitation |

### Tests cumul

- **560 vitest verts** (+21 vs baseline 539), 0 régression
- **+21 cas** : computeTabVisibility, TAB_LABELS, TAB_QUERY_PARAM/TAB_FROM_QUERY round-trip, TAB_EMPTY_STATES (helpers PortalOrders)
- **Smoke E2E live** chrome devtools MCP : `/shop/<slug>` charge sans erreur, click "Mes commandes" mount PortalOrders refondu, empty state Sally-validated visible, 0 console error
- **Build Vite OK** 4.04s

### Bug bonus traité hors story (BUG-INVITATION-AUTO-ACCEPT)

**Cause racine** : `emgaar@me.com` signup direct au lieu de cliquer le lien `/invitations/<token>` → RPC `accept_tenant_invitation` jamais déclenchée → invitation `accepted_at=null` indéfiniment → 0 `tenant_member` créé → user bloqué sur home Magrit "créer un tenant".

**Fix systémique** : nouvelle RPC `auto_accept_pending_invitations()` SECURITY DEFINER qui boucle les invitations pending matchant `auth.email()` et appelle `accept_tenant_invitation(token)` (EMAIL_MISMATCH guard inclus). Branchée dans `TenantContext.reload()` avant la query memberships. Logs info console si >0 invitations acceptées.

**One-shot DB** : invitation `emgaar` acceptée manuellement en SQL admin pour qu'Arnaud teste immédiatement sans attendre refresh côté emgaar.

### Stories de suivi tracées (hors MVP S-ORDER-ROLES-3-UI)

- **Roadmap qualité-first COMPLÈTE** — toutes les stories livrées, plus rien à faire selon le plan 2026-05-21.
- **TF Notion à coller dans la DB** : 5 cas dans `_bmad-output/implementation-artifacts/TF-NOTION-S-ORDER-ROLES-3-UI.md` (action manuelle Arnaud).
- **Test E2E `/shop/<slug>` avec login validateur réel** : prérequis = créer fixtures `tenant_order_roles` Validateur sur commandes draft, puis valider visuellement les 4 tabs avec compteurs > 0.
- **Refonte URL `/shop/<slug>/orders` en route distincte** (au lieu de state interne PublicShop) : permettrait deep-linking depuis emails de notification Resend. V2+.

---

## 14. Sessions autonomes 2026-06-01 → 02 — Sprint 6 + 7 + 8 + 9 livrés et poussés

Arnaud absent. Auto-validation totale. **Tous les commits sont sur `origin/beta/v5`** (push effectué en fin de session autonome). État au reprise du 02/06 matin : `git rev-list --count origin/beta/v5..beta/v5 = 0`.

### Tests globaux (cumul Sprint 6 + 7 + 8 + 9 + wire-ups)

- **539 vitest verts** (+123 vs baseline Sprint 5 clôture 416)
  - +95 Sprint 6+7 (13 RLS order_roles + 14 RPC + 25 hook + 13 audit trail + 6 workflow + 9 visuals + 4 upload + 4 resolver + 7 V7 helpers)
  - +10 Sprint 8 (S-FIX-LARGE-CM-FORMATS `normalizeDimensions`)
  - +12 Sprint 8 (S-SUBTENANT-SCOPE helpers + RPC + KPIs)
  - +6 Sprint 9 (invite-member hardened E2E)
- **16 Deno verts** (mockup-generator + renderer + claude-proxy + send-order-notification + anthropicClient)
- **0 régression** sur toute la trajectoire Sprint 5 → 9

### Sprint 6 — Rôles workflow + validation (5 stories livrées)

| Commit | Story | Livré |
|---|---|---|
| `1f85e04` | **S-ORDER-ROLES-1** schéma DB | 3 tables par-commande (`tenant_order_roles`, `tenant_order_role_events`, `tenant_order_status_definitions`) + ALTER `tenant_role_definitions` (notify_policy/scope/scope_shop_id) + helpers SQL `user_has_order_role` / `user_can_validate_order` + trigger `tenants_seed_catalogs` AFTER INSERT + ADR §4.12 |
| `59308d4` | **S-ORDER-ROLES-2** RPC + audit auto | Table `tenant_order_status_transitions` (matrice extensible) + 4 RPC SECURITY DEFINER : `assign_tenant_order_role`, `revoke_tenant_order_role`, `update_tenant_order_role_capabilities` (audit rétroactif), `transition_tenant_order_status` (matrice). Triggers défensifs AC6 reportés Sprint 9. |
| `a8114ee` | **S-ORDER-ROLES-3** hook front | `useOrderRoles(orderId, userId)` + helpers purs `mergeCapabilities`, `canDoAction`, `isTerminalStatus`. **Refonte UI PortalOrders tabs filtrés + page admin catalog tracée comme story de suivi S-ORDER-ROLES-3-UI** (nécessite Sally UX wireframes DoD #5). |
| `0dc910b` | **S-N1-APPROVAL** workflow N+1 | Edge function `order-workflow-step` (déployée prod B5) qui notifie Resend selon `notify_policy` (chain_next / all_roles / none). Helper fire-and-forget wire dans PortalOrders cancel + DashboardOrders cancel/validate. |
| `6b886ad` | **S3.5 audit trail UI** | RPC `get_order_audit_trail` (UNION status_events + role_events DESC) + helpers React `formatAuditEventTitle/Description/Timestamp` + composant `<OrderAuditTrailModal>` Dialog Radix prêt à wirer. |

### Sprint 7 — Visuels boutique (7 stories livrées, ordre 22/05)

| Commit | Story | Livré |
|---|---|---|
| `5e13440` | **V1 + V2 + V3 + V5** foundation + composition layered | Catalog `magrit_background_library` (10 fonds Unsplash B2B print curatés) + tables `shop_visual_preferences` + `shop_gamme_visual_preferences` + helper SQL `resolve_shop_background` (cascade gamme→shop→default) + bucket Storage `shop_backgrounds` (5MB, MIME image/jpeg|png|webp) + helper `user_can_manage_shop_assets` pour storage policy + helper React `resolveShopBackground` + MockupImage extension `backgroundUrl` (composition LAYERED CSS, **PAS de bake-in PNG** — décision MVP plus performante et plus simple). |
| `9976b6c` | **V4** UI admin ShopVisualSettings | Composant React standalone : fond global (preview + library grid + upload custom + color picker) + overrides par gamme (collapsible, par row). Wire dans `DashboardShopEditor` juste avant Export catalogue. testIds : `shop-visual-settings`, `shop-bg-preview`, `shop-bg-library-{id}`, `gamme-bg-select-{slug}`. |
| `d20e6f5` | **V6** upgrade 5 templates photo-réalistes | Helpers SVG partagés `photoRealisticDefs` (double shadow + highlight gradient + paper texture pattern) + `photoRealisticProductRect`. Application uniforme sur flyer, carteVisite, brochure, etiquette, kakemono. Décision Q5 upgrade in-place (pas de S4.2bis). Snapshots SVG régénérés. Edge mockup-generator redéployé prod. |
| `ac5f210` | **V7** S-PRODUCT-VIEWS-MULTI 2D recto/verso | `ShopTheming.view?: 'front' \| 'back'` + edge param `view` (default front retro-compat) + cache key suffixe `__back` cohabitation + templates flyer + carteVisite avec layout back différencié (les 3 autres rendent identique, cas dégradé acceptable MVP) + composant `<ProductMultiView>` toggle Recto/Verso. Story future `S-PRODUCT-VIEWS-3D-PACKAGING` tracée V2+. |

### Sprint 8 — Dette technique + filiales (3 stories livrées)

| Commit | Story | Livré |
|---|---|---|
| `29e771f` | **S-FIX-LIBRARY-UUID + S-FIX-LARGE-CM-FORMATS** dette technique batch | Audit prod : `product_library` 100% UUID v4 (déjà strict). Story réduite à FK manquante `tenant_order_items.product_id → product_library(id) ON DELETE SET NULL`. Refonte `isLikelyCm` fragile → `normalizeDimensions` convention canonique P0.9 strict (`string=cm` ↔ `number=mm`, mixte = throw). Fix kakémono 400×100cm (était mal converti). +10 vitest. |
| `73a64e4` | **Refacto DRY ProductCard priceResolver** | Suppression duplication 21 lignes : `ProductCard.estimatePrice()` réimplémentait la logique `priceResolver` avec seuils divergents (manquait kakemono, etiquette, packaging). Bascule sur cascade canonique `clariprint > library_cached > prix_marche > zero`. 521 vitest verts. |
| `ce27ffa` | **S-SUBTENANT-SCOPE Usage A filiale** | Helpers SQL `is_subtenant_member_direct`, `is_subtenant_member_inherited`, `get_user_subtenants`, RPC `move_user_between_subtenants` (SECURITY DEFINER atomique), `get_subtenant_kpis` (nb commandes mois + CA HT mois par filiale). UI `DashboardTenantSpaces` étendu avec KPIs cards. +12 vitest E2E (member_direct + inherited + move + KPIs aggregations). |

### Sprint 9 — Audits qualité + docs utilisateur (4 stories livrées)

| Commit | Story | Livré |
|---|---|---|
| `8bdad11` | **Audit perf bundle** | Lazy-load `ShopVisualSettings` (8.21 kB raw / 2.80 kB gz, chunk séparé). Verdict : main 306.84 kB gz **dépasse seuil 280 kB roadmap S9 de +26.84 kB**. Gap principal = `Dashboard*` eager + lucide-react + Radix dialogs + Storage SDK. Story future `S9-PERF-ROUTE-SPLIT` tracée (~30-50 kB récupérables, lazy par route). |
| `e3d1f91` | **Audit sécurité RLS — durcissements R5-bis P1 invite-member** | Edge function `invite-member` étendue : (1) auth check JWT caller (Bearer required + `callerId === invited_by`), (2) capability check `user_has_capability(can_invite)`, (3) validation `role_definition_ids ⊂ tenant_role_definitions(tenant_id)`, (4) idempotence (409 sur doublon pending). Redéployée prod B5. +6 vitest E2E (401/403 × 3 / 409 / happy path). #5 audit `tenant_member_events` reporté V2 (cost/value). |
| `f3917e6` | **Audit a11y — extension routes scan** | `scripts/a11y-scan.sh` étendu 3 → 8 routes (DashboardOrders + DashboardUsers + DashboardTenantSpaces + PortalOrders + Portal shop). Audit statique composants S6/7 confirme patterns Radix (Dialog, AlertDialog, toggle aria-pressed). Run dynamique route auth-required tracé pour suivi (login bypass Playwright). |
| `37c3e9d` | **Documentation utilisateur bêta v1.1** | 3 guides + README dans `docs/beta-guides/` : `admin-tenant.md` (114 lignes : onboarding, invitations, rôles, sous-tenants, visuels, workflow validation), `acheteur-b2b.md` (73 lignes : shop_only redirect, askMagrit, panier, historique), `validateur-producteur.md` (77 lignes : capabilities, audit trail, transitions matrice). Cible ouverture bêta 2 dirigeants (accord principe Groupe ICI 18/05). |

### Wire-ups UI post-S9 (clôture limites tracées)

| Commit | Livré |
|---|---|
| `f49926b` | **`<ProductMultiView>` branché dans `ProductOverlay`** (toggle Recto/Verso visible avec `aria-pressed`, MockupImage gardé sur ShopProductCard pour perf grille) + **bouton « Historique »** sur `OrderHistoryTable` qui ouvre `<OrderAuditTrailModal>` (icône `History` lucide, testId `order-history-btn`, dispo acheteur via RLS ET admin tenant). `showActionsColumn` déclenché si au moins 1 commande v1.1 dans la liste. Résout les 2 stories de suivi tracées Sprint 6/7 : **S-PRODUCT-VIEWS-INTEGRATION** + **OrderAuditTrailModal wire**. |

### Migrations Supabase appliquées prod B5

| Migration | Contenu |
|---|---|
| `20260601000100` | S-ORDER-ROLES-1 schéma (3 tables + helpers + RLS) |
| `20260601000200` | Trigger `tenants_seed_catalogs` (5 rôles presets + 7 statuts canoniques auto pour new tenants) |
| `20260601000300` | S-ORDER-ROLES-2 RPC + matrice transitions (8 transitions canoniques v1.1) |
| `20260601000400` | S3.5 RPC `get_order_audit_trail` (initial) |
| `20260601000500` | S3.5 fix cast `varchar → text` (erreur 42804) |
| `20260601000600` | S7 V1 + V3 foundation visuels (library 10 fonds + shop/gamme prefs + resolver) |
| `20260601000700` | S7 V2 bucket `shop_backgrounds` + policies storage |
| `20260601000800` | S7 V2 helper `user_can_manage_shop_assets` SECURITY DEFINER (fix policy storage) |
| `20260601000900` | S8 S-FIX-LIBRARY-UUID — FK `tenant_order_items.product_id → product_library(id) ON DELETE SET NULL` |
| `20260601001000` | S8 S-SUBTENANT-SCOPE — helpers `is_subtenant_member_*` + `get_user_subtenants` + RPC `move_user_between_subtenants` |
| `20260601001100` | S8 S-SUBTENANT-SCOPE — `get_subtenant_kpis` bascule SECURITY DEFINER (garde upstream `get_user_subtenants` INVOKER) |

### Edge functions déployées prod B5

- `order-workflow-step` (nouvelle, S-N1-APPROVAL)
- `mockup-generator` redéployé 2x (templates V6 + param view V7)
- `invite-member` redéployé Sprint 9 (4 durcissements R5-bis P1)

### Décisions importantes prises pendant l'autonomie (Sprint 6 → 9)

1. **Triggers défensifs AC6** (S-ORDER-ROLES-2) → reportés Sprint 9 audit sécurité (RLS write_admin super_admin only déjà bloque l'écriture directe, double couche = belt-and-suspenders, hors MVP).
2. **Refonte UI PortalOrders tabs filtrés** (AC3-AC5 spec S-ORDER-ROLES-3) → tracée comme story de suivi `S-ORDER-ROLES-3-UI` séparable. Couche métier + hook front complets. Refonte UI nécessite Sally UX wireframes (DoD #5) → décision Arnaud à formaliser.
3. **Composition layered CSS vs bake-in PNG** (S-PIM-VISUELS-5) → décision MVP layered. PNG produit reste transparent shape, le background est appliqué via `backgroundImage` CSS dans le wrapper React. Avantages : PNG plus petit (~30 KB vs 200 KB), pas de fetch+base64 dans l'edge, changement fond instantané, cache PNG inchangé.
4. **Décision Q6 zone d'impression transparente** (S-PIM-VISUELS-6) → **NON appliquée MVP**. Maintien `fill="url(#paperTexture)"` (~ blanc avec grain subtil) pour usage standalone PNG (sans bg shop) dans certains contextes (DashboardOrders, exports CSV). Cohabitation layered V5 reste valide.
5. **Snapshot test pattern** (Deno mockup) → suppression manuelle des `.snapshot.svg` puis re-run test qui re-crée. Pattern documenté pour futurs upgrades templates.
6. **Anti-pattern Supabase JS batch insert** (lesson tirée Sprint 6) → ne JAMAIS mélanger rows avec/sans une colonne dans le même batch insert si la colonne a un DEFAULT SQL ; le SDK aligne et passe null explicite qui viole NOT NULL. Documenté en commentaire test `order_roles_rpc.test.ts`.
7. **Audit perf bundle dépasse seuil S9** (+26.84 kB gz vs cible 280 kB) → MVP acceptable, gap principal = `Dashboard*` eager. Story `S9-PERF-ROUTE-SPLIT` tracée (~30-50 kB récupérables, lazy par route). Pas de hot-fix bloquant : le seuil est interne qualité, pas user-impact démo bêta.
8. **Audit a11y dynamique route auth-required** → run Playwright avec login bypass tracé pour suivi. Pour MVP, audit statique (composants nouveaux Radix conformes) suffit. À reprendre quand workflow E2E Playwright sera en place (Phase B users dépend du même outillage).
9. **`get_subtenant_kpis` bascule SECURITY INVOKER → DEFINER** : la version INVOKER était bloquée par RLS `tenant_orders_select` (admin racine pas membre direct des sous-tenants). Le garde upstream `get_user_subtenants` (INVOKER) filtre via member check, donc pas de fuite cross-tenant possible. Migration `20260601001100` séparée pour traçabilité ADR.
10. **R5-bis P1 #5 audit `tenant_member_events`** → reporté V2 (event toutes 2 transitions × N invitations = volume notable). Coût dev vs valeur audit relative jugée insuffisante MVP. À reprendre si audit utilisateur final demande l'historique des invitations.

### Stories de suivi tracées (post-push, hors MVP)

- **S-ORDER-ROLES-3-UI** : refonte PortalOrders 4 tabs filtrés (Mes commandes / À valider / À approuver / À produire) + page admin catalog rôles `/t/:slug/admin/order-roles`. **Sally UX wireframes préalable obligatoire**.
- ~~**S-PRODUCT-VIEWS-INTEGRATION**~~ → **LIVRÉE** dans wire-ups `f49926b` (ProductMultiView dans ProductOverlay).
- ~~**OrderAuditTrailModal wire**~~ → **LIVRÉE** dans wire-ups `f49926b` (bouton Historique sur OrderHistoryTable).
- **S-PRODUCT-VIEWS-3D-PACKAGING** (V2+) : tracée pour quand le premier produit packaging entrera dans le catalogue.
- **Phase B users** : refacto 15 fichiers `useClients` + cleanup legacy InviteForm/EditPermissionsModal + migration data permissions→rôles + DROP table `clients`. ~2j.
- **S9-PERF-ROUTE-SPLIT** : code-splitting routes (lazy par `Dashboard*`), ~30-50 kB gz récupérables. Nécessite revision du routeur principal + acceptable dégradation initial nav.
- **R5-bis P1 #5 audit `tenant_member_events`** : event invitation/acceptation dans audit trail si demande utilisateur final.
- **Run a11y dynamique routes auth-required** : Playwright avec login bypass.

### Statut push

**Tout est sur `origin/beta/v5`** (push effectué en fin de session autonome 01/06). `git rev-list --count origin/beta/v5..beta/v5 = 0`.

14 commits Sprint 6 → 9 + wire-ups (chronologique) :
```
f49926b feat(v5): wire-ups UI - ProductMultiView dans ProductOverlay + bouton Historique audit trail
37c3e9d docs(v5): S9 documentation utilisateur beta v1.1 (3 guides)
f3917e6 chore(v5): S9 audit a11y - extension routes a11y-scan.sh post S6/7/8
e3d1f91 feat(v5): S9 audit securite RLS - durcissements R5-bis P1 invite-member
8bdad11 perf(v5): S9 audit perf bundle - lazy-load ShopVisualSettings + finding
ce27ffa feat(v5): S8 S-SUBTENANT-SCOPE Usage A filiale (helpers + RPC + KPIs HQ)
73a64e4 refactor(v5): S8 ProductCard DRY priceResolver (suppression duplication 21 lignes)
29e771f fix(v5): S8 S-FIX-LIBRARY-UUID + S-FIX-LARGE-CM-FORMATS (dette technique batch)
ac5f210 feat(v5): S7 V7 S-PRODUCT-VIEWS-MULTI 2D recto/verso
d20e6f5 feat(v5): S7 V6 upgrade 5 templates SVG photo-realistes
9976b6c feat(v5): S7 V4 UI admin ShopVisualSettings
5e13440 feat(v5): S7 V1 + V2 + V3 + V5 visuels boutique - foundation layered composition
6b886ad feat(v5): S3.5 audit trail UI
0dc910b feat(v5): S-N1-APPROVAL edge order-workflow-step
a8114ee feat(v5): S-ORDER-ROLES-3 hook useOrderRoles
59308d4 feat(v5): S-ORDER-ROLES-2 RPC transitions + matrice extensible
1f85e04 feat(v5): S-ORDER-ROLES-1 schema DB par-commande + helpers + ADR 4.12
```

Migrations DB (11), edge functions (3), tests (539 vitest + 16 Deno) tout est en prod B5 + repo distant. La rétrospective Sprint 9 (clôture roadmap qualité-first) est dans [`_bmad-output/implementation-artifacts/retrospective-sprint9-2026-06-02.md`](_bmad-output/implementation-artifacts/retrospective-sprint9-2026-06-02.md).

---

## 13. Sprint 5 "Orderbook & filet LLM" — CLÔTURÉ 2026-06-01

**Tests : 416 vitest verts** (+7 vs baseline 409 : 4 invitation_flow + 3 smoke_acheteur_ai) + 13 Deno verts. 0 régression.

### Stories LIVRÉES (commitées + poussées)

| Story | Commit | Résumé |
|---|---|---|
| **S-LLM-WRAPPER-ROBUSTNESS** | `5255b78` | Helper billing canonique + AbortSignal.timeout(60s) + propagation JWT user/tenant + harmonisation 2 endpoints. ADR §4.11. 4 edge functions redéployées. |
| **S3.1 OrderHistoryTable** (+ext) | `c6d93b7` `6e20aaf` `12d02c3` | Filtres (statut/période/montant) + tri colonnes 2-états + nom boutique + filtre Boutique dropdown Combobox |
| **S3.2-residual** | `5a0c7f7` | Email notif admin tenant (edge `send-order-notification`) + status draft + permission can_order RLS |
| **S-RECONCILE-SUPABASE-MIGRATIONS** (anticipé Sprint 8) | `b330df9` | 29 migrations renommées format Supabase standard + tracking réconcilié. `db push` natif restauré. Doc `docs/SUPABASE_MIGRATIONS_WORKFLOW.md`. |
| **S3.3 Renouveler 1-clic** | `2752e7a` | Bouton Renouveler (orders v1.1 non-draft) → rebuild cart + warnings produits indispo |
| **S3.4 Annulation draft** | `03b94d7` | Bouton Annuler + AlertDialog + RPC update_tenant_order_status |
| **Validation MVP** (anticipe S-N1-APPROVAL) | `0ddd4e6` | Bouton Valider admin tenant (draft→validated) role-driven |
| **S-USERS-REFONTE Phase A** (anticipe S-ORDER-ROLES Sprint 6) | `01939ba` + 7 fixes | Catalog rôles configurables (`tenant_role_definitions` + `tenant_role_assignments`) + 5 presets B2B + matrice users×rôles + modals Inviter/Éditer role-driven. **8 bugs flux invitation corrigés** (voir story-S-USERS-REFONTE-phase-a.md §Fixes post-livraison). Parcours acheteur shop_only → boutique validé E2E. |
| **R5-bis invite-member** (consolidation 2026-06-01) | livré R5 + fixes 27/05 (`e91df1f` `d9c5671` `f658b29` `4f0cb8f`) | Edge function transactionnelle (insert + Resend + rollback). Distinction config Resend (4xx/key absent → garde invitation + lien manuel) vs panne (5xx → rollback DELETE). Stabilisé via fixes session 27/05. Audit OK 2026-06-01 ; 5 durcissements P1 (auth check serveur, validation `role_definition_ids ⊂ tenant`, idempotence, audit `tenant_member_events`, tests Deno) tracés → Sprint 9 audit sécurité RLS. |
| **Smoke E2E acheteur AI** (DoD #3 obligatoire) | `tests/server/smoke_acheteur_ai.test.ts` | Test vitest 3 cas : login boutique (RLS shops_select_tenant) + askMagrit ACTIVE (CORS preflight `make-server-e3db71a4/claude-proxy-stream`) + panier→commande draft (tenant_orders + items via SDK acheteur shop_only). |
| **Re-test flux invitation E2E** | `tests/server/invitation_flow.test.ts` | Test vitest 4 cas DB layer : insert tenant_invitations avec `pending_role_ids` + EMAIL_MISMATCH (faille 27/05 colmatée) + accept→tenant_members + tenant_role_assignments + idempotence replay. |
| **Bug ERAM "disparue" UI** | résolu effet de bord `8173b4e` | Fix race condition TenantContext (loading reste true tant que tenants pas chargés) → ShopsContext attend le bon `currentTenant.id` avant query. ERAM réapparaît. |
| **Nettoyage MdP temp** | rotated 2026-06-01 | Mot de passe `amazon@ageservices.fr` rotated MagritTest2026! → admin123 via service_role (compte test cobaye uniquement). |

### Points d'attention sécurité/dette

- **Faille colmatée** (commit `7a04046`) : un acheteur shop_only héritait d'accès magrit_full fantômes sur les sous-tenants du parent. Audit Sprint 9 : vérifier qu'aucun compte prod n'a de tels accès résiduels.
- **Faille colmatée** (commit `f658b29` + migration `20260527000100`) : RPC accept_tenant_invitation acceptait sans vérifier que `auth.email() = invitation.email`. EMAIL_MISMATCH guard en place + test régression 2026-06-01.
- **Clé Resend régénérée** 27/05 (ancienne compromise). Sender `MAGRIT_FROM_EMAIL` = `Magrit <support@ageservices.fr>`.
- **Phase B users** (post-Sprint 5) : refacto 15 fichiers `useClients` + cleanup code mort (InviteForm/EditPermissionsModal legacy) + migration data permissions→rôles + DROP table clients.
- **PAT Supabase** : Keychain macOS (`security find-generic-password -a "$USER" -s "supabase-pat-magrit" -w`).
- **Compte test acheteur** `amazon@ageservices.fr` / `admin123` (cobaye uniquement, à renforcer si usage au-delà smoke).
- **Durcissements R5-bis P1 → Sprint 9** : (1) auth check serveur côté edge invite-member (vérif JWT caller = invited_by + capability can_invite), (2) validation `role_definition_ids ⊂ tenant_role_definitions(tenant_id)`, (3) idempotence (réjet doublons invitation pending même email/tenant), (4) audit dans `tenant_member_events`, (5) tests Deno edge function.

### Cap Sprint 6 (allégé par anticipations Sprint 5)

Restent pour Sprint 6 selon roadmap qualité-first :
- **S-ORDER-ROLES-1** schéma DB couche par-commande (`tenant_order_roles` + `tenant_order_role_events`) — la couche globale (`tenant_role_definitions` + `tenant_role_assignments`) est déjà livrée Phase A.
- **S-ORDER-ROLES-2** RPC transitions + audit events couche par-commande.
- **S-ORDER-ROLES-3** UI PortalOrders tabs filtrés (`useOrderRoles`).
- **S-N1-APPROVAL** workflow backend N+1 + notifications Resend par étape (Validation MVP livrée Sprint 5 = base, manque chaînage multi-étapes).
- **S3.5 Audit trail UI** modale historique statuts.
- **Phase B users** : refacto 15 fichiers `useClients` + DROP `clients`.

---

## 12. Sprint 4 "PIM-Boutique-Commandes" — Bilan 2026-05-18 (session unique) — HEAD `becf6cd`

## 12. Sprint 4 "PIM-Boutique-Commandes" — Bilan 2026-05-18 (session unique)

**Contexte** : sprint planifié post-hotfix 17/05 (HEAD `c95b547`). Démo client cible 2026-05-23 (5 jours). Méthode BMAD stricte respectée à la lettre (story doc → AC → ADR → conception UX Sally si applicable → dev → tests vitest → TF Notion). Sprint élargi à 20 stories effectives (vs 12 planifiées initialement) suite à découverte de 6 bugs prod silencieux par les pre-flight checks et smoke tests formels.

### Stories livrées (20 sur 1 session)

| Phase | Stories | HEAD commit | Stories docs |
|---|---|---|---|
| **0** Préalables PIM/Gammes | P0.1 → P0.11 (11 stories) | `5fb9e55` → `45ad435` | story-P0.1 à P0.11 |
| **1** Bascule orders model | S-MIGRATION-ORDERS, S-DUAL-READ, S-DASHBOARD-ORDERS-DUAL | `931f7e9` → `31a021c` | story-S-MIGRATION + story-S-DUAL-READ + story-S-DASHBOARD-ORDERS-DUAL |
| **2** Boutique consolidation | S-CONSO-1 à 6 (6 stories) | `6926b40` → `becf6cd` | story-S-CONSO-1 à 6 |

### ADR formalisées dans architecture.md

- **§4.9 ADR-PIM-RLS-1** : `product_definitions` lecture publique intentionnelle (shared catalog SEO vitrine). Aucune donnée tenant sensible. Filtrage par boutique via `tenant_gamme_subscriptions`.
- **§4.10 ADR-ORDERS-1** : Bascule `submitCart` shop_orders → tenant_orders + dual-read PortalOrders (Option B Winston). Alignement v1.1, NFR6 cross-tenant strict, hooks NFR16 e-invoicing/E4.3 Stripe/S5.2 Canva pré-câblés.

### 6 bugs prod silencieux détectés et fixés (méthode BMAD stricte)

| # | Bug | Découverte | Fix |
|---|---|---|---|
| 1 | `pim-ingest` v6 du 09/05 PRE-fix S1.5 Magrit3 case-sensitive | Smoke test P0.4 (enrichissement Claude échoue) | P0.6 redeploy v7 |
| 2 | `pim-ingest` toMm seuil `<50` insuffisant pour grands formats cm | P0.4 v2 (kakemono → flyer) | P0.7 port toMm |
| 3 | Parité `resolveGamme` front/back manquante (ruleSpecificity + filterMatchesByProductName) | P0.4 v3 (3/5 OK) | P0.8 port complet |
| 4 | Convention cm/mm fragile (seuil numérique) — kakemono 80cm faux | P0.8 v3 (kakemono/banderole faux) | P0.9 convention typage `string=cm, number=mm` |
| 5 | Trigger PIM absent sur tenant_order_items (rupture pipeline après bascule) | Pre-flight check 2 S-MIGRATION-ORDERS | P0.10 trigger SQL |
| 6 | `tenant_order_items.product_id NOT NULL` bloque items library legacy | Test E2E S-MIGRATION-ORDERS Arnaud | P0.11 ALTER COLUMN DROP NOT NULL |

### Métriques quantitatives

- **20 stories livrées** (11 Phase 0 + 3 Phase 1 + 6 Phase 2)
- **353 tests vitest verts** (+63 vs baseline 290, 0 régression)
- **15 commits push** sur `beta/v5` (`c95b547` → `becf6cd`)
- **3 migrations SQL prod** appliquées (gammes +5, trigger PIM tenant_order_items, product_id nullable)
- **4 redeploys** pim-ingest (v6 → v10)
- **15 TF Notion** créés dans la DB Cahiers de tests (1 par story livrée applicable)
- **Sally UX consult** invoquée 2x (S-DUAL-READ icône legacy + S-CONSO-3/4/5/6 groupé)

### Décisions Arnaud clés

- **B2** Authentification requise pour valider panier (pré-flight S-MIGRATION-ORDERS) — cohérent persona B2B acheteur compte tenant
- **Option A Sally** sur workflow N+1 (S-CONSO-6) — retrait propre + microcopy transparente, pas de mock front
- **H1-bis Sally** sur dual-read marker (S-DUAL-READ) — point gris discret + sr-only + title fallback

### Cible démo 23/05 — état COVERAGE

- ✅ Pipeline ingestion PIM E2E validé (5/5 mappings corrects après P0.9)
- ✅ Bascule orders v1.1 (auth required) + dual-read PortalOrders + DashboardOrders
- ✅ PortalThankYou page de confirmation (parcours acheteur complet visible)
- ✅ Microcopy transparence workflow N+1
- ✅ Cleanup thumbs placeholder
- ✅ 0 violation a11y axe-core (3 routes critiques)
- ✅ Recherche IA résiliente (fallback timeout 3s) + tri grille catalogue (Select shadcn + persist localStorage)

### Hors scope Sprint 4 (post-démo, Phase 3 à venir)

- **Epic 3 Commandes lifecycle** (S3.1-S3.5) : OrderHistoryTable avec filtres avancés, Renouveler 1-clic, Annulation draft, Audit trail UI (RPC `update_tenant_order_status` déjà livré S1.4)
- **Stories futures tracées** : S-N1-APPROVAL (workflow validation hiérarchique backend), S-PRODUCT-VIEWS-MULTI (vraies vues recto/verso/3D), S-FIX-LIBRARY-UUID (normalisation product_library UUID), S-FIX-LARGE-CM-FORMATS (heuristique cm/mm grands formats > 3m)

### Tooling actualisé

- `pnpm a11y:scan` : 3 routes critiques (login + atelier + boutique-1), reports JSON commités
- 4 helpers purs partagés : `productEnrichment.resolveGamme` (front+back parité), `PortalOrders.helpers`, `PortalCatalog.helpers`, `tenantOrder.schema` Zod

---

## 11. Hotfix B5 — 2026-05-17 (session unique, 2 bugs critiques home Magrit)

**Contexte** : Arnaud signale 2 régressions en utilisation réelle sur `/t/imprimerie-ipa` :
1. Recherche home Magrit perdue au tab focus (déjà fixé en B4 commit `acb7352` — apparemment regressé sur B5)
2. Volet d'édition ProductCard affiche les valeurs par défaut au lieu des valeurs du produit

### Diagnostic & fix bug 1 — Persistance conv home au tab focus

**Racine** : bug pré-existant **`ReferenceError: Can't find variable: newMessages`** dans [ChatInterface.tsx:319](src/app/components/ChatInterface.tsx#L319). Le refacto **R2 Phase B** (11/05) avait renommé `newMessages → fullMessages` ligne 165 mais oublié le `finally` ligne 319. Crash à chaque envoi → `saveCurrentConversation` jamais appelé → `currentConversationId` reste null → clé `magrit_current_conversation__<tenantId>` jamais écrite → la home n'avait rien à restaurer au tab focus.

**Fix** (commit `86e2220`) :
- `newMessages` → `fullMessages` ligne 319
- `ConversationContext` : restauration synchrone depuis le cache localStorage AVANT le reset state (évite le flash visuel entre reset et fetchRemote async)
- `ConversationContext` : nouveau `hydratedRef` qui bloque l'effet sync `history → localStorage` tant que l'hydratation initiale n'est pas finie. Sans ça, le `useState([])` initial écrasait le cache avec `"[]"` AVANT que la restauration n'ait pu lire l'ancien contenu

### Diagnostic & fix bug 2 — Volet édition ProductCard atelier

**Racine** : depuis le refacto **R1** (11/05), le bouton "Éditer" ouvre `ProductOverlay` (S2.4b), mais `localProduct` côté atelier a un format **UI/LLM** (`material`, `finishRecto/Verso` camelCase, `dimensions.{w,h}` nested, `printing` objet, `format` verbose "A2 (420 × 594 mm)") incompatible avec le contrat **Clariprint** qu'attend `extractInitialOptions` (`papers[]`, `finishing_front` snake_case, `width/height` top-level mm, `printing` string, `back_colors` number). Conséquence : 5 selects sur 7 retombaient sur `DEFAULT_OPTIONS` (A5/135g/recto/aucun).

Découvertes additionnelles via logs DevTools :
- LLM Clariprint renvoie `clariprintData.width/height` en **string CM** (ex: "42" / "59.4" pour A2 = 420 × 594 mm)
- LLM renvoie codes finition Clariprint (`PELLIC_BRILL`, `PELLIC_ACETATE_MAT`)
- A2/A1/A0 manquaient dans `FORMATS` (limité à A6 → A3)

**Fix** (commit `5325c6c`) — nouveau helper pur `extractClariprintConfigFromAtelierProduct(localProduct)` dans [ProductOverlay.helpers.ts](src/app/components/shop/ProductOverlay.helpers.ts) :
- `extractStandardFormatLabel` : reconnaît `"A2 (420 × 594 mm)"` verbose, `"A4 paysage"`, `"85x55"` → label propre matchant FORMATS du select
- `matchStandardFormat` : retro-recherche format ISO depuis width/height (tolérance ±2mm + orientation portrait/paysage)
- `isLikelyCm` : conversion cm → mm sur les strings raw uniquement (heuristique < 100), pas sur les number ou dimensions UI (déjà mm)
- `normalizeFinishingLabel` : reconnaît codes LLM `PELLIC_BRILL` / `PELLIC_ACETATE_MAT` / `SOFT_TOUCH` en plus des libellés humains
- Ajout `A2`/`A1`/`A0` à `FORMATS` + `FORMAT_DIMENSIONS`

### Tests vitest

- Baseline avant session : 278 verts
- Après session : **290 verts** (+12 cas nouveaux dont scénario réel user 2026-05-17 reproduit exactement depuis logs DevTools)

### Cahiers de tests Notion (DoD)

2 TF ajoutés dans la DB Notion 🧪 Cahiers de tests fonctionnels Magrit (à jouer en local sur B5) :
- TF "Persistance conversation home Magrit au tab focus" — P05, P0 critique
- TF "Volet édition ProductCard atelier affiche les valeurs du produit (cas A2)" — P08, P1 importante

### À surveiller pour les sprints futurs

- **Audit refacto R1/R2** : les 2 bugs viennent de migrations textuelles incomplètes lors de R1 (ProductCard) et R2 (ChatInterface). Penser à un grep exhaustif sur les renommages variables/imports au prochain refacto important.
- **Logs sentinelles temporaires** retirés avant commit (`[Conversation FIX-v2]`, `[Overlay FIX-v2]`).

---

## 10. Sprint Refacto EPIC-REFACTO-1 — Bilan 2026-05-11 (session unique)

**Contexte** : Arnaud demande un sprint refacto suite à l'audit ✦ Étape A/B/C (audit + review adversariale + plan Winston) du 11/05 matin. 9 stories spec rédigées par Winston (R0→R9). Validation Arnaud "oublie la démo, enchaîne tout" → exécution séquentielle complète en 1 session.

### Stories livrées

| Story | Spec | Statut | HEAD | Tests Δ |
|---|---|---|---|---|
| **R0** TVA centralisée + 3 garde-fous vitest | M 2j | ✅ review | `0f8d2d4` | +65 |
| **R3** ClariprintAdapter enforcement (0 fetch direct) | S 1j | ✅ review | `d8157b0` | +3 |
| **R1** ProductCard décomposition (5/5 onglets extraits) | L 4j | ✅ review | `52f35ce` | +2 |
| **S-FIX-PANIER** 5 bugs critiques boutique (LEAFLET, prix×qty, UUID, catégories, boutons) | — | ✅ | `b2fbbc5` | — |
| **R2** ChatInterface hook useClaudeSseStream + fixes E4 (billing) + E5 (troncage) | L 4j | ⚠️ partial-review | `43c324e` | +14 |
| **R4** Types DB (`database.types.ts` 1604L) + zod sélectif (4 schemas) | M 2j | ✅ review | `b1b666e` | +17 |
| **R5** Pattern Supabase unique (6 callers fetch → `functions.invoke()`) | M 3j | ⚠️ partial-review | `270ba52` | — |
| **R7** Lazy modales + bundle visualizer + Lighthouse config | S 1j | ⚠️ partial-review | `e5016a2` | — |
| **R8** Factory `createSupabaseMock` + coverage v8 + seuils baseline | M 3j | ⚠️ partial-review | `3c26864` | +15 |
| **R9** axe-core CLI + scan local + workflow CI a11y | XS 0.5j | ✅ review | `ee82fa7` | — |

### Migrations SQL prod appliquées (Supabase B5)

- `20260511_02_R0_tenant_tax_regime.sql` — Enum `tax_regime_enum` + colonne `tenants.tax_regime` default `'metropole_fr'`. 9 tenants existants migrés.
- `20260511_03_shop_order_trigger_uuid_defensive.sql` — Trigger `enqueue_pim_candidates_on_shop_order` re-écrit avec regex UUID v4 défensive. Fix bug #4d S-FIX-PANIER.

### Tooling nouveau

| Commande | Description |
|---|---|
| `pnpm test:coverage` | vitest + rapport coverage v8 HTML dans `coverage/` |
| `pnpm build:analyze` | Vite build avec rollup-plugin-visualizer → `dist/stats.html` |
| `pnpm db:types` | Régénère `src/types/database.types.ts` via Supabase Management API |
| `pnpm a11y:scan` | Scan axe-core local des 3 routes critiques |
| `pnpm dev:b5` / `:bg` / `:stop` / `:status` | Lancement Vite port 5177 (déjà existant pré-refacto) |

### Fichiers de config livrés

- `.lighthouserc.json` (config Lighthouse CI, workflow yml à créer par Arnaud)
- `.github/workflows/a11y.yml` (CI axe-core, s'active au prochain push)
- `.axe-config.json` (rules WCAG 2.1 A + AA)
- `vitest.config.ts` (section `coverage` v8 + seuils baseline 7-3%)
- `vite.config.ts` (plugin visualizer conditionnel `ANALYZE=1`, `chunkSizeWarningLimit: 600`)

### Métriques

- **Bundle main** : 250 kB gz → **245 kB gz** + 3 chunks lazy (8.15 kB gz cumulés)
- **vitest** : 162 baseline → **278 cas verts** (+116 cas R0+R2+R4+R8)
- **0 occurrence `fetch.*clariprint`** dans `src/` (R3)
- **0 occurrence `import \* as` lucide-react** (R7 AC5)

### À faire opérationnel par Arnaud (cf. agenda 2026-05-12)

1. **CI GitHub** (1h matin) : ajouter secrets repo (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_PAT`), créer `.github/workflows/lighthouse.yml`, observer 1er run a11y.yml
2. **Smoke tests visuels** (1h) : valider les 5 fixes S-FIX-PANIER (LEAFLET, prix×qty, UUID, catégories, boutons persistants) + R0/R1/R2/R3/R7 sur localhost:5177
3. **Arbitrages produit** (30min) : trancher S-ORDER-ROLES, S-PIM-VISUELS, S-SUBTENANT-SCOPE + prioriser R5-bis vs R2-bis

### Stories follow-up tracées (post-refacto)

- **R2-bis** (S 2j) — Extraction 4 sous-composants UI ChatInterface (ChatMessageList / ChatInput / ChatHistoryPanel / ChatModeToggle). Découpage UI pur, 0 fix fonctionnel.
- **R5-bis** (S 1j) — Edge function `invite-member` transactionnelle qui résout la race condition B4 (insert `tenant_invitations` + email Resend dans la même transaction edge avec rollback).
- **R8-bis** (M 2j) — Tests AuthContext / ShopsContext / hooks React via la factory `createSupabaseMock`. Cible coverage 50% globale.

---



---

## 1. Contexte projet en 30 secondes

Magrit = copilote IA web-to-print B2B français. Stack Vite 6 + React 18 + TS + Tailwind v4 + Supabase. Modèles Claude : `claude-sonnet-4-5-20250929` pour le raisonnement (upgrade depuis Sonnet 4 le 2026-05-09) / `claude-haiku-4-5-20251001` pour génération rapide (PIM, descriptifs). Moteur de devis externe : Clariprint (Expert Solutions, partenariat AGE).

**5 Betas en parallèle** :
- B1 (`Magritoff/`, port 5173, branche `main`) — prod, ne pas toucher
- B2 (`Magritoff-v2/`, port 5174, branche `design/v2`) — refonte design
- B3 (`Magritoff-v3/`, port 5175, branche `beta/v3`) — multi-tenant, **projet Supabase mort** (`azbpnhnfnkdemfmwvyqc` n'existe plus)
- **B4 (`Magritoff-v4/`, port 5176, branche `beta/v4`)** — Sprint 1 + Sprint 2 livrés + hotfix S0.1 Fiche regression (2026-05-09). Cible démo client 2026-05-23.
- **B5 (`/Users/arnaudmazon/Documents/Claude/BMAD/Magrit`, port 5177, branche `beta/v5`)** — itération **e-shop v1.1**, sprint Epic 1 partiel livré 2026-05-09

## 2. Infrastructure B4

| Item | Valeur |
|---|---|
| Repo Git | https://github.com/amazon-svg/Magritoff |
| Branche active | `beta/v4` |
| Dossier local | `/Users/arnaudmazon/Documents/AGE/Projet formateur /Claude code/Magritoff-v4/` |
| Port dev | `5176` (lancement : `pnpm dev`) |
| Projet Supabase | `ightkxebexuzfjdbpsdg` (Magrit 4) |
| Dashboard Supabase | https://supabase.com/dashboard/project/ightkxebexuzfjdbpsdg |
| Secrets configurés | `Magrit3` (Anthropic), `CLARIPRINT_HOST/LOGIN/PASSWORD`, `SUPABASE_*` (auto) |
| Edge functions déployées | `make-server-e3db71a4`, `claude-proxy`, `pim-generate`, `pim-ingest` |
| Backlog Notion | https://www.notion.so/4d2e2ea106914ce5a69728fdb67dfddd |

## 3. Stories livrées Sprint 1 (Claude code)

Toutes pushées sur `beta/v4`, edge function déployée, SQL appliqué.

| ID | Story | État |
|---|---|---|
| E9.1 | Renommer onglet Clients → Utilisateurs | ✅ |
| E9.2 | CRUD utilisateurs par admin d'espace + audit trail | ✅ |
| E9.3 | Droits granulaires (scope `magrit_full` / `shop_only` + permissions fines) | ✅ |
| E9.4 | Renommer un espace actif (admin + superadmin) + redirect 90j ancien slug | ✅ |
| E6.1 | Validation SIREN bouchonnée + email pro check (débrayés en beta) | ✅ |
| E7.1 | Tracking consommation tokens LLM (table `llm_usage_events` + RPC) | ✅ |
| E2.1 + E2.2 + E2.4 | Modes Marguerite (ouvert / strict avec chips cliquables / limite 25 contexte) | ✅ |

## 3 bis. Stories livrées Sprint 2 (Claude code, 2026-05-06)

| ID | Story | État | Notes |
|---|---|---|---|
| E9.5 | Email invitations via Resend + bouton « Renvoyer » | ✅ | Route edge `send-invitation-email`. `RESEND_API_KEY` configuré côté Supabase B4. **Mode test** : envoi limité à `amazon@ageservices.fr` tant qu'un domaine n'est pas vérifié sur Resend. Domaine prod à choisir + DNS Gandi à venir |
| E9.11 | Bouton « Réintégrer » sur exclusions boutique (one-way → two-way) | ✅ | Liste des exclusions cliquable dans l'éditeur boutique, `includeProduct()` déjà côté ShopsContext |
| E9.12 | Migration `claude-3-haiku` → `claude-haiku-4-5` sur B1/B2 | ✅ | Déployé sur projet partagé `jynxrpzwgzrrfuooputw` |
| E9.10 | Tests RLS automatisés vitest (6 cas) | ✅ | Harness `tests/rls/setup.ts` + `tenant_isolation.test.ts`. Skip auto si `.env.test` absent. Voir `tests/README.md` |
| E3.1 + E3.2 | Streaming Claude SSE | ✅ | Route séparée `claude-proxy-stream`. Flag `ENABLE_STREAMING_CHAT` **passé à `true`** (commit `fa44682`) après QA réussi |
| E7.7 | Instrumentation `data-testid` P00→P09 | ✅ | Mergé via PR #1 (commit `c344ce0`). `src/app/lib/testIds.ts` central + smoke test `tests/data-testid.smoke.spec.ts` (21 tests). Référence Notion : [🧬 Hints DOM par parcours](https://www.notion.so/358d0131973c810e93c2c5285099b8a4) |
| E9.6 | Wizard souscription gammes à création tenant | ✅ | TenantOnboarding refondu en 2 étapes (Identité + Gammes). createTenant accepte `gammeSlugs[]` qui déclenche un upsert bulk dans `tenant_gamme_subscriptions`. Bouton « Configurer plus tard » pour skip |

### Fixes post-Sprint 2 (sur `beta/v4` direct)

| Commit | Story | Notes |
|---|---|---|
| `7881bcb` | Superadmin Magrit bypasse les guards `canWrite`/`canManage` | Régression de E9.3 généralisée à 4 composants (DashboardUsers, DashboardLayout, DashboardTenantGammes, DashboardTenantSpaces). Détectée en testant E9.5 sur `a.mazon@me.com` membre simple sur `imprimerie-ipa` mais superadmin Magrit |
| `acb7352` | Persistance conversation Marguerite à travers tab focus | `onAuthStateChange` Supabase fire à chaque tab focus → ref `user` change → reset `messages/products`. Fix : nouvelle clé localStorage `magrit_current_conversation__<tenant_id>` + capture avant reset + restauration depuis l'historique. Survit aussi au F5 et close/reopen tab |

## 3 ter. Sprint 3 — Itération e-shop v1.1 (BMAD workflow, 2026-05-09)

**Workflow BMAD complet (3 500+ lignes) sur `beta/v5`** — PRD + Architecture + Epics & Stories + Implementation Readiness produits via les agents BMAD (John PM, Winston Architect). Voir [`_bmad-output/planning-artifacts/`](_bmad-output/planning-artifacts/).

### Infrastructure B5

| Item | Valeur |
|---|---|
| Repo Git | https://github.com/amazon-svg/Magritoff (même repo que B4) |
| Branche active | `beta/v5` (forkée de `a32ac65` sur `beta/v4`) |
| Dossier local | `/Users/arnaudmazon/Documents/Claude/BMAD/Magrit/` |
| Port dev | `5177` (lancement : `pnpm exec vite --port 5177 --strictPort`) |
| Projet Supabase | `ightkxebexuzfjdbpsdg` (Magrit 4) — partagé avec B4, RLS isole |
| Edge functions déployées | 2026-05-09 : `make-server-e3db71a4` v?, `pim-generate`, `pim-ingest` (S1.3 partial). 2026-05-10 : redeploy `claude-proxy` v8 + `make-server-e3db71a4` v12 (S1.5 + fix `Magrit3` case-sensitive) |
| Modèle LLM | `claude-sonnet-4-5-20250929` (raisonnement) + `claude-haiku-4-5-20251001` (génération rapide) |

### Stories pré-sprint Epic 0 livrées

| Story | Commit | Description |
|---|---|---|
| **S0.1** Hotfix régression Fiche home Magrit | `f925eba` (sur `beta/v4`) | Fallback UI explicite + logging PIM context. Cible démo client 2026-05-23 |
| **S0.2** Investigation provenance des prix (E-NEW-CLARIPRINT-01) | `c929371` (sur `beta/v5`) | Audit complet → `docs/PRICE_SOURCES.md`. Identifié `PricingPanel.tsx:26` comme outlier "2e prix mystère". Pas d'hallucination LLM. Fixes appliqués |
| Fixes S0.2 (C1+C2+C3+E1) | `c929371` | (a) `validateClariprintResponse()` filtre prix négatifs/NaN/undefined. (b) endpoint `clariprint-quote` valide avant retour (-1,2 € bloqué côté serveur). (c) `PricingPanel` utilise `resolvePrice()` + badge « Estimation » sur fallback. (d) Helper unique `priceResolver.ts` |

### Stories Epic 1 — Stack Foundations (partiel, 2026-05-09)

| Story | Commit | Description |
|---|---|---|
| **S1.1** Wrapper `AnthropicClient` | `6f1aa84` | `supabase/functions/_shared/anthropicClient.ts` — `complete()` + `completeStructured(zodSchema)` + tracking auto `llm_usage_events` + limite 25 paramètres anti-hallucination + erreurs typées `AnthropicClientError` |
| **S1.2** `ClariprintAdapter` pattern | `632db88` | `src/server/clariprint/ClariprintAdapter.ts` — interface + `ClariprintHttpAdapter` (prod) + `ClariprintMockAdapter` (tests) + `ClariprintError` discriminée par `kind` |
| **S1.4** Order entity DB schema + RLS + tests vitest | `1a29481` + `9d70e58` (rename) | Migration `20260509_01_e1_orders_v1_1.sql` — 3 tables `tenant_orders` / `tenant_order_items` / `tenant_order_status_events` (préfixe `tenant_*` pour éviter collision avec legacy `public.orders`). RPC `update_tenant_order_status()` + trigger updated_at. RLS strict via helpers `current_user_can_access_shop` + `user_role_in_tenant`. 6 tests vitest dans `tests/rls/orders_isolation.test.ts` |
| **S1.3** partiel — refactor endpoints | `555574a` (pim-generate) + `df47dc3` (pim-ingest + Sonnet 4 → 4.5) | 2/4 endpoints utilisent maintenant le wrapper. `claude-proxy/index.ts` + `make-server-e3db71a4/claude-proxy*` finalisés en S1.5 |
| **S1.5** suite S1.3 — finalisation refactor LLM (2026-05-10, déployé) | (à committer) | (a) Schema Zod `_shared/productsSchema.ts`. (b) `claude-proxy/index.ts` standalone refactoré sur `anthropicCompleteStructured`. (c) Wrapper étendu : `anthropicStream()` avec parser SSE + tracking auto. (d) `make-server-e3db71a4/claude-proxy` + `claude-proxy-stream` refactorés sur wrapper, `logLlmUsage` manuel supprimé. (e) Tests Deno `_shared/anthropicClient.test.ts` (7 cas). (f) **Bug pré-existant S1.1 corrigé** : `Magrit3` case-sensitive (était `MAGRIT3` upper, secret réel mixed case → wrapper tombait silencieusement en `missing_api_key`). Bénéficie aussi à pim-generate/pim-ingest. (g) **Déviation spec assumée** : `anthropicStream` retourne `{textChunks: AsyncIterable<string>, finalPromise}` au lieu de `{stream: ReadableStream}` brut pour préserver contrat client SSE Hono. Déploiement validé : claude-proxy v8 + make-server-e3db71a4 v12 ACTIVE, smoke cURL OK, tracking `llm_usage_events` confirmé via SQL |

### Migration appliquée 2026-05-09

✅ `supabase/migrations/20260509_01_e1_orders_v1_1.sql` appliquée via Dashboard SQL Editor (Supabase CLI `db push` échouait sur historique migrations désynchronisé). Tables `tenant_orders`, `tenant_order_items`, `tenant_order_status_events` créées en prod avec RLS actif.

### Edge functions redéployées 2026-05-09

✅ `pim-generate`, `pim-ingest`, `make-server-e3db71a4` sur `ightkxebexuzfjdbpsdg`. Sonnet 4.5 actif, wrapper `_shared/anthropicClient.ts` actif sur les 2 endpoints PIM.

### Reste à faire pour Epic 1 complet

- [x] **S1.3 / S1.5** — Refactor `claude-proxy/index.ts` + `make-server-e3db71a4/claude-proxy` + `claude-proxy-stream` sur wrapper (S1.5 livré + déployé 2026-05-10).
- [ ] **R1** (Implementation Readiness) — Ajouter event analytics `first_action_after_landing` à S2.1 (instrument NFR1+NFR3).
- [ ] **R2** — Wireframes lo-fi des composants Epic 2.
- [ ] **S1.5 T9.1 (Notion TF)** — Ajouter cas TF "Refactor wrapper LLM — non-régression chat strict streaming" dans la DB Notion 🧪 Cahiers de tests (draft fourni dans story-S1.5 Completion Notes).

### Stories Epic 4 — Mockup Engine (chemin critique R3, démarré 2026-05-10)

| Story | Commit | Description |
|---|---|---|
| **S4.1a** Bucket Storage `product_mockups` + RLS + tests | `e9d4124` | Migration `20260510_01_e4_storage_product_mockups.sql` — bucket public-read avec MIME `image/png` strict + 5 MB max + policy RLS `product_mockups_public_read`. Tests vitest `tests/storage/product_mockups_isolation.test.ts` (4 cas : upload service_role, GET public round-trip, upload anon BLOCKED, cleanup). Migration appliquée via `supabase db query --linked --file` (fallback du `db push` à cause de l'historique désynchronisé, même problème S1.4). 37/37 vitest passed. **Bonus** : fix bug pré-existant S1.4 `owner_user_id` manquant dans `tests/rls/orders_isolation.test.ts` (les 6 cas RLS Order entity tournent désormais réellement avec `.env.test`). |
| **S4.1b** Pipeline rendu SVG → PNG + 1er template flyer | `1bc3071` | Module `supabase/functions/_shared/mockup/` (types + renderer + 1 template + 5 tests Deno). **Pivot technique majeur vs Architecture §4.3** : `sharp + svgdom` (Node native) abandonnés (incompat Deno Deploy). Pivot `npm:@resvg/resvg-wasm@2.6.2` (pure WASM, fonts Inter/Bitter/JetBrains incluses). Init WASM lazy via fetch unpkg. Snapshot SVG versionné. Tests Deno 5/5 (975ms). Perf render warm 183ms. |
| **S4.1c** Edge Function `mockup-generator` + cache write-through + invalidation | (à committer) | Edge function déployée sur `ightkxebexuzfjdbpsdg`. 2 endpoints : `GET ?tenant=X&shop=Y&product=Z&width=...&height=...&productName=...&primaryColor=...` (cache HEAD HIT 302 / MISS render+upload), `POST /invalidate?shop=Y` (admin tenant only via JWT + tenant_members role check). **Trade-off MVP** : specs en query params (pas de port ClariprintAdapter Deno, story future). Fallback `render_failed` → re-render gris minimal + log `llm_usage_events` endpoint=mockup-generator-fallback. 8 tests Deno passants. Smoke prod : MISS cold 2.5s, HIT warm 343-426ms (≤NFR2 50ms atteinte browser via CDN cache 24h). Vitest 37/37 (0 régression). |
| **S4.2** 5 templates SVG MVP (flyer, carte de visite, brochure, étiquette, kakémono) | (à venir) | Peut être fait en parallèle de S2.3, étend `mockup/templates/` |
| **S4.3** Composant React `MockupImage` avec fallback graceful | (à committer) | `src/app/components/mockup/MockupImage.tsx` (composant) + `MockupImage.helpers.ts` (helpers d'URL pure pour testabilité) + 7 tests vitest. Pattern : URL publique CDN direct sur `<img>` (cache HIT < 50ms NFR2), `onError` → fetch edge function S4.1c avec auth + cache buster pour retry, fallback ultime `<ProductMockup>` SVG schematic. Anti-loop via `useRef`. Skeleton `bg-line animate-pulse` Tailwind. testIds.ts étendu avec scope `mockup` (4 ids). Vite build OK 1.53s, vitest 44/44 (0 régression). |

**🎯 Epic 4 chemin critique R3 : 4/4 livrées (S4.1a + S4.1b + S4.1c + S4.3)** — S2.3 ProductCard variante boutique **DÉBLOQUÉ** pour démarrage Epic 2 (Boutique Premium B2B).

### Documents BMAD livrés (3 500+ lignes)

| Document | Lignes | Rôle |
|---|---|---|
| [`_bmad-output/planning-artifacts/prd.md`](_bmad-output/planning-artifacts/prd.md) | 1 079 | PRD v1.1, 46 FR + 28 NFR |
| [`_bmad-output/planning-artifacts/architecture.md`](_bmad-output/planning-artifacts/architecture.md) | ~835 | Architecture v1.1, 15 ADR (note rename `tenant_*` §4.1) |
| [`_bmad-output/planning-artifacts/epics.md`](_bmad-output/planning-artifacts/epics.md) | ~1 075 | 7 epics, 32 stories sprint-ready |
| [`_bmad-output/planning-artifacts/implementation-readiness-report-2026-05-09.md`](_bmad-output/planning-artifacts/implementation-readiness-report-2026-05-09.md) | 294 | Rapport readiness GO + 7 warnings |
| [`docs/PRICE_SOURCES.md`](docs/PRICE_SOURCES.md) | ~200 | Livrable S0.2 audit prix |

### Prochaines étapes recommandées

1. **Tester en local** sur ports 5176 (B4 hotfix Fiche) et 5177 (B5 sanitization Clariprint + PricingPanel).
2. **Démarrer Epic 4 — Mockup Engine** en priorité (R3 Implementation Readiness : S4.1a/b/c → S4.2 → S4.3 doivent précéder S2.3 ProductCard).
3. **En parallèle Epic 4** : Epic 3 (Order entity user-facing) et Epic 6 (quotas/feature flags).
4. **Epic 2 (Boutique B2B premium)** une fois Epic 4 ≥ S4.3 livré.

## 4. Stories reportées (dépendent de Clariprint)

Décision Arnaud 2026-05-06 : ces stories nécessitent d'abord du travail Clariprint (paramétrage parc imprimeur, prix marché, observabilité Clariprint). On y revient après le bloc Clariprint.

| ID | Story | Pourquoi |
|---|---|---|
| E3.4 | UX simplifiée saisie données imprimeur Freemium | Recoupe E6.2 et T-06.1, à faire en bloc |
| E6.2 | Saisie simplifiée Pro | Couplée avec T-06.1 paramétrage parc |
| E7.3 | Monitoring usage / quotas / coûts (dashboard ops) | Sprint dédié observabilité |
| T-01..T-03 | Corporate Portal / Franchise / Sync eCommerce | Chantiers ≥ 1 sprint chacun |

## 5. Feature flags actifs en beta

Fichier : `src/app/lib/featureFlags.ts`

| Flag | Beta | Prod | Notes |
|---|---|---|---|
| `REQUIRE_PRO_EMAIL` | `false` | `true` | E6.1 |
| `REQUIRE_VERIFIED_SIREN` | `false` | `true` | E6.1 |
| `ENABLE_STREAMING_CHAT` | **`true`** | `true` | E3.1+E3.2 — passé à `true` 2026-05-06 après QA |

Le mock SIREN INSEE est dans `src/app/lib/sirenValidator.ts`. Le bloc `mockInseeLookup` à remplacer par un vrai `fetch` quand le compte INSEE Sirene V3 sera créé (commentaire en place dans le fichier).

## 6. Modèle de données B4 (multi-tenant)

Tables clés ajoutées en Sprint 1 (Sprint 2 = aucune migration DB) :
- `tenant_member_events` — audit trail des actions sur memberships
- `tenant_slug_history` — archivage des renames de slug (E9.4)
- `llm_usage_events` — tracking des appels Claude (E7.1)
- Colonnes ajoutées sur `tenant_members` : `access_scope`, `allowed_shop_ids`, `permissions` (E9.3)
- Colonnes ajoutées sur `tenant_invitations` : idem (E9.3)
- Colonnes ajoutées sur `tenants` : `siren`, `siren_data`, `verified`, `verified_at` (E6.1)

RPC publics ajoutés :
- `get_tenant_members_with_email(tenant_id)` — joint auth.users
- `current_user_can_access_shop(shop_id)` — helper RLS
- `get_user_llm_usage(user_id, period_start?, period_end?)`
- `get_tenant_llm_usage(tenant_id, period_start?, period_end?)`
- `resolve_tenant_slug(old_slug)` — pour redirect 90j

Bootstrap complet d'un nouveau projet : exécuter `Magritoff-v4/supabase/_bootstrap_b4.sql` (regroupe toutes les migrations).

## 7. Sprint 3 — Plan proposé

Périmètre Sprint 2 livré (E9.5, E9.10, E9.11, E9.12, E3.1+E3.2). À arbitrer début Sprint 3 :

### Multi-tenant & gouvernance (résiduel E9)
- **E9.6** Wizard souscription gammes à la création tenant

### Foundations Pro
- **E3.4** UX saisie imprimeur Freemium (recoupe E6.2 + T-06.1)
- **E6.2** Saisie simplifiée Pro
- **E7.3** Monitoring usage / quotas / coûts (dashboard ops)

### eCommerce + Corporate (gros chantiers, ≥ 1 sprint chacun)
- **T-01** Corporate Portal
- **T-02** Franchise Module
- **T-03** Sync eCommerce Shopify/Woo
- **T-06.1, T-06.2** Paramétrage parc machines + Prix marché Magrit

→ Sprint 3 recommandé : E9.6 + E6.2 + E7.3 (cohérent Foundations Pro), reporter T-01..T-03 à des sprints dédiés.

## 8. Workflow git Magrit

D'après les préférences du user :
- Commits atomiques (un commit = une story / un fix)
- **Confirmation avant push** systématique (sauf accord blanket sur le sprint)
- Heredoc git commit OK, mais éviter les apostrophes dans les messages (préférer `"d'autres"` → `"d autres"` ou paraphraser)
- Format messages : `feat|fix|chore(v4): description courte` puis paragraphe optionnel

## 9. Bugs / fragilités connus à surveiller

- **Onglet Boutiques masqué** pour le plan `freemium` — c'est le comportement legacy B3, à reconsidérer avec E9.8 (Billing Stripe). Workaround : `update user_preferences set plan='pro' where user_id=...`
- **Edge function** : nécessite redéploiement après chaque modif côté `supabase/functions/*`. Commande : `supabase functions deploy make-server-e3db71a4 --project-ref ightkxebexuzfjdbpsdg` (avec PAT temporaire)
- **Pas d'override superadmin** sur certains guards futurs — penser à toujours ajouter le check `isSuperAdmin` quand on bloque un user sur un scope (cf. E9.3 où le bug a été corrigé après coup)
- **E9.5 Resend** : pour activer l'envoi email, configurer `RESEND_API_KEY` (et optionnellement `MAGRIT_FROM_EMAIL`, ex `Magrit <noreply@magrit.fr>`) dans les secrets Supabase B4. Sans clé, le flux retombe automatiquement sur l'ancien `prompt()` avec lien manuel (no-op fonctionnel). Domaine `from` doit être vérifié sur Resend, sinon utiliser le `onboarding@resend.dev` par défaut (limite : envoi uniquement vers le compte Resend).
- **E9.12 / B1+B2 partagés** : Magritoff/ et Magritoff-v2/ partagent le projet Supabase `jynxrpzwgzrrfuooputw` — il suffit de déployer la fonction depuis l'un des deux pour mettre à jour les deux betas (la dernière `supabase functions deploy` gagne).
- **E3.1 Streaming** : la route `/claude-proxy-stream` parse le JSON Claude APRÈS le stream complet (pas de progressive parsing JSON pour l'instant). L'indicateur live se contente d'un compteur de chunks. Pour du progressive content rendering true (cards qui se construisent), il faudra un Sprint 3 dédié avec parsing JSON incrémental.

## 10. Identifiants & accès

- **User principal** : `a.mazon@me.com` (Arnaud)
  - Membre direct des tenants : `imprimerie-ipa`, `Boutique 1`
  - Superadmin Magrit : oui (membre `magrit-root` via `bootstrap_magrit_admin`)
- **PAT Supabase** : à régénérer à chaque session (l'ancien est révoqué). Procédure : https://supabase.com/dashboard/account/tokens

## 11. Pour démarrer la prochaine session

Première message à coller à Claude pour le briefer :

```
Je reprends le projet Magrit B4. Lis le handoff dans 
Magritoff-v4/SPRINT_HANDOFF.md pour avoir le contexte.

Aujourd'hui je veux travailler sur : [story / fonctionnalité]
```

Claude doit alors :
1. Lire ce fichier (`Read` tool)
2. Lire ses mémoires `project_magrit.md` et `reference_magrit_infra.md` (qui peuvent être à mettre à jour)
3. Vérifier l'état git du repo (`git status`, `git log --oneline -5`)
4. Demander un nouveau PAT Supabase si déploiement edge function nécessaire
