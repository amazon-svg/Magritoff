# 📋 Rapport audit + plan refacto Magrit (à destination des devs)

> **Date** : 2026-05-11  •  **Branche** : `beta/v5` HEAD `f23628d` v0.5.3-beta.5  •  **Démo client** : 2026-05-23 (12 j)  •  **Fenêtre exécution refacto** : post-démo (≥ 2026-05-23)
>
> Ce document est une **synthèse exécutive** des 3 artefacts produits le 2026-05-11 (audit + review adversariale + plan Winston Architect). Pour le détail méthodologique et les findings exhaustifs, voir les 3 documents sources cités en fin de rapport.

---

## 1. TL;DR (à lire absolument)

1. **Démarrage refacto : post-démo client (≥ 2026-05-23). Aucune action refacto avant.** Sprint Epic 2 restant (S2.5+) reste prioritaire pour la démo.
2. **8 priorités P0** confirmées en review adversariale (5 audit initiaux + 3 reclassées/ajoutées : ClariprintAdapter enforcement, PIM enrichissement Fiche, TVA configurable conformité DGFIP).
3. **9 stories R0→R8** séquencées en **3 sprints post-démo** (≈ 21-22 jours-Claude au total).
4. **R0 (garde-fous tests) obligatoire AVANT toute décomposition de gros composant** — sinon risque régression silencieuse maximal sur ProductCard (1 281 L) et ChatInterface (1 066 L).
5. **Décision Arnaud actée : `tenant_orders` V1.1 deferred**. S1.4 reste valide (RLS + tests + RPC OK), front branché plus tard. Pas de R6 dans ce sprint refacto.
6. **Décision Arnaud actée : a11y light V1.2 + i18n V2** (R9 axe-core CI sur 3 pages, pas de WCAG AA formel, pas de lib i18n V1.x).
7. **Règle dure rappelée** : zéro création d'onglet/composant hors backlog. Tout refacto **enrichit l'existant**. PIM Fiche atelier = enrichir l'onglet `Fiche` existant, pas créer un onglet "Marketing".
8. **Pas de cycle d'imports détecté + duplication code prod 2,52 %** — la dette n'est PAS le copier-coller. La vraie dette = monolithique des gros composants + dette structurelle (types DB partagés, pattern Supabase unifié).

---

## 2. État du code (chiffres clés audit)

| Périmètre | Fichiers | Lignes | Top fichier |
|---|---:|---:|---|
| `src/` (front) | 151 | **27 418** | `ProductCard.tsx` (**1 281**) |
| `supabase/functions/` (edge) | 21 | 5 699 | `make-server-e3db71a4/index.ts` (1 515) |
| `tests/` (vitest + RLS + storage) | 13 | 2 097 | `orders_isolation.test.ts` (309) |

**Tests** : vitest **162/162** verts. **Coverage NON mesurée** (pas de `c8`/`istanbul`).

**Top 5 composants à décomposer en priorité** :
1. `ProductCard.tsx` — 1 281 L, 9+ concerns, 13 useState, 321 conditionnels (densité 25 %)
2. `DashboardUsers.tsx` — 1 230 L, 21 useState (record du repo)
3. `ChatInterface.tsx` — 1 066 L, dual source messages, SSE inline
4. `DashboardAdminPIM.tsx` — 918 L, body duplication pim-generate
5. `make-server-e3db71a4/index.ts` — 1 515 L (edge, multi-routes Hono)

**Métriques outillées** :
- ✅ **Pas de cycles d'imports** (madge clean sur 156 fichiers) — graphe DAG sain
- ✅ **Duplication code prod 2,52 %** (jscpd) — basse, pas un sujet
- ⚠️ Clusters de duplication structurelle : `DashboardLibrary*` (≈245 L), `Dashboard{Libraries,Shops,TenantGammes,TenantSpaces}` (≈130 L)

---

## 3. Les 8 priorités P0 (matrice impact / effort)

> Échelles : Impact 1-5 (5 = critique métier), Effort XS/S/M/L/XL, Risque régression 1-5, ROI = Impact / Effort.

| Code | Dette | Impact | Effort | Risque régr. | ROI | Story |
|------|-------|:------:|:------:|:------------:|:---:|:-----:|
| **H** | TVA configurable (conformité DGFIP) | **5** | S | 2 | 2,50 | **R0** spike |
| **F** | ClariprintAdapter enforcement (2 callers) | 4 | S | 1 | 2,00 | **R3** |
| **G** | PIM enrichissement Fiche atelier (9 champs) | 4 | S | 2 | 2,00 | **R1 satellite** |
| **A** | ProductCard atelier décomp (1 281 L → 5 onglets + shell) | **5** | L | **5** | 0,63 | **R1** |
| **B** | ChatInterface décomp + B6/E4/E5 bugs | **5** | L | 4 | 0,63 | **R2** |
| **D** | Types DB partagés (`database.types.ts` + zod sélectif) | 4 | M | 2 | 1,00 | **R4** |
| **E** | Pattern Supabase unique (`functions.invoke()` + race fix) | 4 | M | 3 | 1,00 | **R5** |
| **C** | `tenant_orders` mort-né | 3-5 | 0 V1.1 | 4 | N/A | **R6** ❌ OUT |

**Top ROI** : H (TVA), F (Clariprint), G (PIM Fiche). À faire en premier (R0+R1+R3).
**ROI moyens mais critiques** : A et B (gros composants, risque régression maximal). Doivent venir **après** R0 garde-fous tests.
**Fondations** : D et E (ROI 1,00). Valeur réelle = débloquer R8 (testabilité) et toute story future.

---

## 4. Bugs cachés en hot-path (review adversariale Blind Hunter)

À intégrer dans les stories R0/R1/R2 selon localisation. **Ne pas livrer un refacto sans les corriger** :

| # | Bug | Fichier:ligne | Sévérité | Story |
|---|---|---|:---:|:---:|
| B1 | **TVA 20% hardcodée** 5+ fois | ProductCard:786, QuoteModal:173, CartButton:112, PublicShop:257, CartContext:52 | Critique | R0 |
| B2 | **LibraryPickerModal dupliquée** dans ProductCard | ProductCard.tsx:621-639 | Critique | R0 spike |
| B3 | `estimatePrice()` ProductCard ≠ `estimateMarketPriceHT()` utils (rabais qty≥1000 absent dans utils) | ProductCard:206-225 vs priceResolver:72-118 | Élevée | R1 |
| B4 | **Race condition invitations** (insert DB sans email envoyé) | DashboardUsers.tsx:204 + send-invitation-email | Élevée | R5 |
| B5 | **Pas d'AbortController** sur fetches Clariprint + SSE → memory leak | ProductCard:142-152, ChatInterface:213-246 | Élevée | R1, R2 |
| B6 | **Dual source messages ChatInterface** sans sync (data loss possible si 2 onglets) | ChatInterface.tsx:74-84 vs `conversation.messages` | Élevée | R2 |

**Edge cases prioritaires** (Edge Case Hunter) intégrés dans R1/R2 :
- E1 : `localProduct = useState(product)` sans `useEffect` sync (ProductCard:101) → désynchro silencieuse
- E4 : Anthropic billing error silencieux → catch générique sans banner UI explicite
- E5 : Conversation > 25 messages sans troncage front → risque crash LLM token limit
- E3 : XSS PIM `description_template` rendu en `dangerouslySetInnerHTML` non sanitisé (V1.2+)

---

## 5. Plan d'exécution (3 sprints post-démo)

> Hypothèse : ADR-R1 V1.1 deferred actée → R6 OUT. Durées en jours-Claude (1 j ≈ 4-6 h pair-programming dirigé).

### Sprint refacto 1 (≈ 7 j) — Fondations + garde-fous

| Story | Effort | Description |
|---|:---:|---|
| **R0** | M (2 j) | **OBLIGATOIRE EN PREMIER** : Spike H TVA configurable (`src/app/utils/tax.ts`) + Spike B2 fix modal dupliquée + 3 tests garde-fous vitest (priceResolver, ClariprintAdapter, CartContext) + mock layer Supabase minimal (factory `createSupabaseMock`) |
| **R3** | S (1 j) | **ClariprintAdapter enforcement** : migrer `ProductCard:143` + `utils/clariprintQuote:32` vers `httpAdapter.computePrice()`. 0 fetch direct Clariprint restant. |
| **R1** | L (4 j) | **ProductCard décomposition 5 onglets** + extraction `useClariprintProduct(productId)` hook + **PIM enrichissement Fiche** (9 champs SEO/GEO `dans l'onglet Fiche existant`) |

### Sprint refacto 2 (≈ 9 j) — Décomposition Chat + types + Supabase

| Story | Effort | Description |
|---|:---:|---|
| **R2** | L (4 j) | **ChatInterface décomposition** + résolution dual source messages (B6) + billing banner explicite (E4) + troncage 25 msg (E5) + extraction `readClaudeSseStream` partagé |
| **R4** | M (2 j) | **Types DB partagés** : `pnpm db:types` génère `database.types.ts` via Supabase CLI + zod schemas sélectifs (Cart, Order, Clariprint payloads, PIM definitions). Migration des 14 callers `from()` critiques. |
| **R5** | M (3 j) | **Pattern Supabase unifié** : 8 fetch URL hardcodée → `supabase.functions.invoke()`. Edge function transactionnelle `invite-member` (fix race B4). |

### Sprint refacto 3 (≈ 5 j) — Perf + testabilité + a11y

| Story | Effort | Description |
|---|:---:|---|
| **R7** | S (1 j) | **Bundle baseline** : Lighthouse CI (GitHub Action, 3 URLs, seuils perf ≥80 / a11y ≥90) + vite-bundle-visualizer (`pnpm analyze`) + 3-4 `React.lazy()` modales (QuoteModal, LibraryPickerModal, ProductOverlay) + audit tree-shake lucide-react. Budget : main < 300 KB gzipped. |
| **R8** | M (2-3 j) | **Testabilité Supabase étendue** : factory `createSupabaseMock()` complète + tests cibles couverts 70 % (priceResolver, ClariprintAdapter, CartContext, useClariprintProduct, useChatConversation) |
| **R9** | XS (0,5 j) | **a11y light** : `pnpm audit:a11y` (axe-core via vitest-axe) en CI sur 3 pages critiques (atelier, boutique, login). Seuil : 0 critical. |

### Stratégie de merge

- **1 story = 1 PR atomique** (convention existante).
- **Garde-fou non négociable** : vitest doit être vert avant merge. Régression bloque PR.
- **R0 = test seeds** : écrits **avant** R1/R2, ne doivent pas régresser pendant la décomposition. C'est le contrat d'invariance qui sécurise.
- **Séquencement série dans `beta/v5`** : pas de parallélisation R1+R2 (conflits sur `testIds.ts` et contexts).

---

## 6. ADR formalisés (8 décisions architecturales)

| ADR | Sujet | Décision | Statut |
|---|---|---|---|
| **ADR-R1** | `tenant_orders` V1 vs V1.1 | **V1.1 deferred** : conserver `shop_orders` legacy, brancher tenant_orders post-refacto | ✅ Arnaud |
| **ADR-R2** | Typing cross-couche | `database.types.ts` généré + zod sélectif Cart/Order/Clariprint | ✅ Winston |
| **ADR-R3** | Pattern Supabase | Reads = `from()` direct typé, writes/edges = `functions.invoke()` exclusivement | ✅ Winston |
| **ADR-R4** | Décomp gros composants | Onglet-by-onglet (ProductCard = 5 onglets + shell), hooks extracts (ChatInterface) | ✅ Winston |
| **ADR-R5** | Tests Supabase | Factory `createSupabaseMock()` (pas MSW) | ✅ Winston |
| **ADR-R6** | TVA configurable | `tenant.tax_regime` enum (`fr_metropole / fr_dom_tom / fr_autoentrepreneur / eu_export / world_export`) + `src/app/utils/tax.ts` | ✅ Winston |
| **ADR-R7** | a11y + i18n roadmap | **a11y light V1.2** (axe-core CI 3 pages) + **i18n V2** (pas de lib runtime V1.x) | ✅ Arnaud |
| **ADR-R8** | Bundle size budget | Lighthouse CI + vite-bundle-visualizer + lazy modales | ✅ Winston |

**Toutes les décisions sont prises**. Le plan est exécutable tel quel par les devs.

---

## 7. Risques + atténuations

| # | Risque | Probabilité | Sévérité | Atténuation |
|---|---|:---:|:---:|---|
| R-1 | **Régression silencieuse** lors décomp ProductCard / ChatInterface | Élevée | **Critique** | **R0 obligatoire avant R1/R2**. 3 tests garde-fous + smoke E2E Claude in Chrome avant/après chaque PR. Cahier de tests Notion TF-XX. |
| R-2 | **Scope creep** pendant R1 (tentation onglet hors backlog) | Moyenne (récidive 2026-05-10) | Élevée | Story spec R1 liste explicitement les 5 onglets ProductCard `out of scope renaming` (Fiche/Prix/3D/Éditer/Debug). Validation Arnaud avant merge. **PIM enrichissement dans Fiche existant uniquement.** |
| R-3 | **Migration types DB R4** casse silencieusement callers RLS | Moyenne | Moyenne | Migration en 2 temps : (a) génération + `tsc --noEmit` passant avec `as unknown as Tables<>` transitoires marqués `// TODO R4-cleanup`, (b) cleanup PR suivante. |
| R-4 | **Décision ADR-R1 retardée** → bloque équipe | (déjà tranchée) | — | N/A : ADR-R1 = V1.1 deferred confirmée. R0+R1+R3 lançables immédiatement. |
| R-5 | **Lighthouse CI** fait échouer des PRs critiques v1.1 sur B4 démo | Faible | Moyenne | Activer Lighthouse CI **uniquement sur `beta/v5`** au début, pas sur `beta/v4`. Seuils permissifs en R7 (perf ≥70) puis relevés. |
| R-6 | **Spike H TVA** révèle un bug en prod déjà vendu (DOM-TOM facturé 20 %) | Faible | Élevée si confirmé | R0 audit : grep `* 1.20` + `tva`/`tax` dans tout le code + SQL anciennes factures. Si trouvé : hotfix prio B4 avant démo. |

---

## 8. Hors scope explicite (anti-scope creep)

Pour éviter la dérive (mémoire `feedback_no_invent_hors_backlog`) :

- ❌ Pas de migration React 19 / Tailwind v5 / Vite 7 (boring technology, architecture.md §2.3)
- ❌ Pas de React Query / SWR (ADR-R4 alternative refusée)
- ❌ Pas de barrel exports (`index.ts` regroupants) — pas justifié par le coût/valeur
- ❌ Pas de réorganisation `pages/` vs `components/` (cosmétique vs structurel)
- ❌ Pas de remplacement `formatEuro` 3× dupliqué — ramassé naturellement R4/R5
- ❌ Pas de refacto cluster `DashboardLibrary*` — hors P0, à reconsidérer V2
- ❌ Pas de migration testid `marguerite-*` → `magrit-*` — opportuniste R1/R2
- ❌ Pas d'`i18n` infra (ADR-R7 = V2)
- ❌ Pas de WCAG AA formel (ADR-R7 = a11y light only)
- ❌ Aucun nouvel onglet/composant non-spec'd dans une story (règle dure Arnaud)

---

## 9. Documents sources (sur la branche `beta/v5`)

| Document | Path | Auteur | Méthode |
|---|---|---|---|
| **Audit refacto** | [_bmad-output/refacto-artifacts/audit-2026-05-11.md](_bmad-output/refacto-artifacts/audit-2026-05-11.md) | Claude code | 1 cartographie exhaustive + 4 sondes qualitatives + 1 sonde cross-couches + métriques objectives (cloc/wc-l, jscpd, madge) |
| **Review adversariale** | [_bmad-output/refacto-artifacts/review-adversarial-2026-05-11.md](_bmad-output/refacto-artifacts/review-adversarial-2026-05-11.md) | 3 agents Explore | Blind Hunter / Edge Case Hunter / Acceptance Auditor en parallèle |
| **Plan refacto Winston** | [_bmad-output/refacto-artifacts/refacto-plan-2026-05.md](_bmad-output/refacto-artifacts/refacto-plan-2026-05.md) | Winston Architect (BMAD persona) | Synthèse audit + review en 8 ADR + 9 stories + matrice ROI |

**Mémoires BMAD pertinentes** :
- `~/.claude/projects/.../memory/feedback_persona_primaire_imprimeur.md` (atelier > boutique)
- `~/.claude/projects/.../memory/feedback_pim_marketing_card.md` (9 champs PIM dans Fiche existante)
- `~/.claude/projects/.../memory/feedback_no_invent_hors_backlog.md` (règle absolue)
- `~/.claude/projects/.../memory/feedback_code_commits.md` (`feat(v5):`, pas d'apostrophes, commit atomique, confirmation push)

---

## 10. Prochaines étapes côté projet

| Quand | Quoi | Qui |
|---|---|---|
| **Maintenant → 2026-05-23** | Préparer la démo client sur `beta/v5`. **Aucune action refacto**. | Tous |
| **Post-démo 2026-05-23** | Lancer `bmad-create-epics-and-stories` pour produire le backlog R0-R8 dans `_bmad-output/implementation-artifacts/` | PM John (BMAD) |
| **Sprint refacto 1** | R0 + R3 + R1 (≈ 7 j) | Devs |
| **Sprint refacto 2** | R2 + R4 + R5 (≈ 9 j) | Devs |
| **Sprint refacto 3** | R7 + R8 + R9 (≈ 5 j) | Devs |
| **Post-refacto** | Sprint V1.1 deferred dédié à `tenant_orders` UI + brancher front sur le schéma S1.4 (≈ 8-12 j) | Devs |
| **À chaque PR R0-R8** | Update `architecture.md §X` correspondante dans le DoD | Dev story |
| **Clôture sprint refacto** | Passe d'update `prd.md` | Tech writer Paige |

---

*Rapport généré le 2026-05-11 par Claude code à partir des 3 artefacts BMAD signés Winston Architect. À partager avec l'équipe dev pour discussion + cadrage du sprint refacto post-démo.*
