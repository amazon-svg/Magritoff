# Review adversariale refacto Magrit — 2026-05-11

> **Méthode** : Étape C du workflow refacto (option 2 court-circuit du skill `bmad-code-review`). 3 agents Explore en parallèle, chacun jouant un rôle adversarial : **Blind Hunter** (bugs cachés + mauvais raisonnements + dettes ratées), **Edge Case Hunter** (états transitoires + erreurs + boundaries + migration + surface UI), **Acceptance Auditor** (alignement persona/ADR/NFR/V1).
> **Source** : audit refacto [`audit-2026-05-11.md`](audit-2026-05-11.md) §8.1 (5 dettes P0 A-E).
> **Verdict global** : audit solide en cartographie mais **incomplet** sur 3 axes : bugs cachés en hot-path (TVA hardcodée, modal dupliquée, dual-source messages), enrichissement PIM atelier (règle dure Arnaud), et reclasses ADR (ClariprintAdapter).

---

## 1. Findings critiques à intégrer dans le plan refacto

### 1.1 Bugs cachés en hot-path (Blind Hunter)

| # | Bug | Fichier:ligne | Sévérité | Impact |
|---|---|---|---|---|
| B1 | **TVA 20% hardcodée** répliquée 5+ fois | `ProductCard.tsx:786`, `QuoteModal.tsx:173`, `CartButton.tsx:112`, `PublicShop.tsx:257`, `CartContext.tsx:52` | **Critique** | Risque conformité fiscale DGFIP. DOM-TOM (5,5 %), export (0 %), auto-entrepreneur (0 %) impossibles à servir. `tenant.location` stocké (TenantOnboarding) jamais utilisé pour TVA |
| B2 | **LibraryPickerModal dupliquée** dans ProductCard | `ProductCard.tsx:621-639` | **Critique** | 2× rendue en DOM, premier setState seul appliqué, désynchro UI/state à l'ajout library |
| B3 | **`estimatePrice()` ProductCard vs `estimateMarketPriceHT()` utils** divergents | `ProductCard.tsx:206-225` vs `utils/priceResolver.ts:72-118` (rabais `qty >= 1000 → *0.9` absent dans utils) | **Élevée** | Source de vérité split, prix divergents inexpliqués selon le point d'entrée |
| B4 | **Race condition invitations** | `DashboardUsers.tsx:204` (insert tenant_invitations) + `DashboardUsers.tsx:47` (fetch send-invitation-email) | **Élevée** | Invitation en DB sans email envoyé, fallback UI dégradé |
| B5 | **Pas d'AbortController** sur fetches Clariprint + SSE | `ProductCard.tsx:142-152`, `ChatInterface.tsx:213-246` | **Élevée** | Memory leak, `setState` après unmount, warnings React, possible corruption d'état lors de navigation |
| B6 | **Dual source messages ChatInterface** sans synchronisation | `ChatInterface.tsx:74-84` (state local) vs `conversation.messages` (context) | **Élevée** | Data loss/corruption si 2 onglets ouverts |

### 1.2 Dettes manquées dans l'audit (Blind Hunter + Acceptance Auditor)

| # | Dette | Sévérité | Localisation |
|---|---|---|---|
| M1 | **Bundle size jamais auditée** | **Élevée** | 50+ icons lucide inline dans ProductCard, zéro `React.lazy()` sur modales lourdes (QuoteModal, LibraryPickerModal, ProductOverlay), pas de bundle analysis |
| M2 | **Testabilité Supabase nulle** | **Élevée** | 0 mocking/injection sur les 14 callers `from()` + 8 callers `fetch('/functions/v1/...')`. Logique métier business (submitCart, library ops, devis) non testable en isolation |
| M3 | **i18n inexistant** mais `locale='en'` stocké en DB (TF-65) | Moyenne | Pas de lib intl, labels FR en dur, si support EN demandé → chaos |
| M4 | **Debug states `?debug=1`** non scopés sécurité | Faible | Audit mentionne en passant, pas vérifié si CSP/feature flag bien filtré en prod |
| M5 | **PIM marketing enrichissement ProductCard onglet Fiche** | **Critique** (règle dure) | Mémoire `feedback_pim_marketing_card.md` : Arnaud a signalé 2× cette dette. 9 champs PIM (h1, seo_title, seo_description, keywords, schema_org_type, quality_score, validated_by, usage_examples, faq) manquants dans Fiche atelier. Persona primaire imprimeur Pro + persona tertiaire pure player W2P |

### 1.3 Edge cases prioritaires (Edge Case Hunter)

| # | Edge case | Fichier:ligne | Sévérité |
|---|---|---|---|
| E1 | `localProduct = useState(product)` ProductCard sans `useEffect` de sync prop→state | `ProductCard.tsx:101` | Élevée — désynchro silencieuse si parent re-render produit différent |
| E2 | **Tenant_orders dual avec shop_orders legacy** sans migration de données | migration `20260509_01_e1_orders_v1_1.sql` vs `PublicShop.tsx:272` | Élevée — toute connexion future doit gérer 2 sources |
| E3 | **PIM `description_template` XSS** si rendu en `dangerouslySetInnerHTML` non sanitisé | `utils/productEnrichment.ts:242` + `DashboardAdminPIM.tsx:735` textarea HTML brut | Moyenne — XSS croisé entre tenants possible |
| E4 | **Anthropic billing error silencieux** → bascule demo mode sans alert admin | `ChatInterface.tsx:306-342` catch générique | Élevée — perte signal d'erreur critique |
| E5 | **Conversation > 25 messages** sans troncage front (project-context §3.4) | `ChatInterface.tsx` recherche grep négative | Moyenne — risque crash LLM token limit |
| E6 | **Quantity > 100 000** non validé côté `buildClariprintPayload` | `ProductOverlay.helpers.ts:178` | Faible — manipulation DevTools requise mais possible |
| E7 | **ProductOverlay mobile < 1024 px** : Sheet `side=right` 420 px déborde | `ProductOverlay.tsx:28` | Faible (mobile non persona primaire) |

---

## 2. Reclassements de priorité (Acceptance Auditor)

### 2.1 P1 → P0 obligatoire : **ClariprintAdapter pattern enforcement**

L'audit classe les 2 violations (`ProductCard.tsx:143`, `utils/clariprintQuote.ts:32`) en **P1 §I**. Reclassement P0 justifié :
- ADR architecture.md **§4.4 explicite** : *« Toute interaction Clariprint passe par ClariprintAdapter (pas d'appel fetch direct) »*.
- Les 2 callers contournent `validateClariprintResponse()` typé → prix négatifs / undefined / produits manquants peuvent fuiter vers UI (NFR11 sécurité données critique).
- Atelier (ProductCard) et utils/clariprintQuote sont **chemins critiques persona primaire**.

→ **Nouvelle priorité F (P0)** : forcer les 2 callers à passer par `ClariprintAdapter`.

### 2.2 P0 satellite à ajouter : **PIM marketing ProductCard onglet Fiche**

Mémoire `feedback_pim_marketing_card.md` : Arnaud a signalé 2× cette dette. L'audit §8 n'y fait aucune référence. Persona primaire imprimeur + tertiaire pure player W2P.

→ **Nouvelle priorité G (P0 satellite)** : enrichir l'onglet « Fiche » existant (PAS nouveau onglet — règle dure `feedback_no_invent_hors_backlog.md`) avec 9 champs PIM, bouton Copier JSON déjà partiellement fait (S-FIX-1b).

### 2.3 Décision Winston requise : **tenant_orders blocker V1 ou V1.1 ?**

Audit §8.1 **C** classe « tenant_orders mort-né » en P0 mais sans trancher le scope. Architecture.md §6.3 FR18-24 demande **5 composants UI + 1 hook + 1 edge function** pour Order entity complète. Aucun en prod.

Décision binaire à acter via ADR Winston :
- **Option A** — V1 blocker : développer UI Order entity dans la fenêtre refacto post-démo (~M effort par composant × 5 = ~L total).
- **Option B** — V1.1 deferred : conserver `shop_orders` legacy comme source jusqu'à V1, brancher `tenant_orders` post-V1.

Sans cette ADR, le P0 C est non-actionnable.

### 2.4 Nouvelle dette **B1 TVA hardcodée** = P0 conformité

Dette manquée critique. Tier conformité fiscale au-dessus des P0 architecture habituels. À placer comme **priorité H (P0 spike conformité)** avant les autres refactos.

---

## 3. Matrice priorité révisée (post-review adversariale)

| Code | Dette | Priorité audit | Priorité révisée | Justification |
|---|---|---|---|---|
| A | ProductCard atelier 1281 L décomposition | P0 | **P0** ✅ | Inchangé. Pré-requis G (PIM satellite) souhaitable mais pas bloquant |
| B | ChatInterface 1066 L décomposition | P0 | **P0** ✅ | Inchangé. Inclure fix E4 (billing silenced) + B6 (dual source) + E5 (troncage 25 msg) |
| C | tenant_orders mort-né | P0 | **P0 conditionnel** ⚠️ | ADR Winston requis V1 vs V1.1 |
| D | Pas de types DB partagés (zod / database.types.ts) | P0 | **P0** ✅ | Inchangé |
| E | 3 patterns Supabase mélangés | P0 | **P0** ✅ | Inchangé. Cible : `supabase.functions.invoke()` partout pour les edges |
| **F** | **ClariprintAdapter enforcement** (NEW) | (P1 I) | **P0** ⬆️ | Promotion. ADR 4.4 + NFR11 sécurité |
| **G** | **PIM enrichissement Fiche atelier** (NEW) | (absent audit) | **P0 satellite A** ⬆️ | Règle dure Arnaud signalée 2× |
| **H** | **TVA configurable** (NEW) | (absent audit) | **P0 spike conformité** ⬆️ | Risque DGFIP |

**P0 total post-review = 8** (5 initiaux + 3 ajouts/promotions).

## 4. Plan d'action proposé (input pour Winston Étape D)

### 4.1 Spikes pré-refacto (à faire en tout premier)

1. **Spike H** TVA configurable : centraliser dans `src/app/utils/tax.ts` qui lit `tenant.location` ou `tenant.tax_regime` → 5 callers à migrer
2. **Spike sécurité B2** : retirer la 2e instance de LibraryPickerModal dans ProductCard.tsx (l.621-639)
3. **Spike garde-fous tests** avant refacto : ajouter tests unitaires sur `priceResolver.ts`, `ClariprintAdapter.ts`, `CartContext.tsx` (zones froides §6.3 audit) pour empêcher régressions

### 4.2 Décisions Winston (ADR à produire)

| # | ADR | Décision attendue |
|---|---|---|
| ADR-R1 | tenant_orders blocker V1 ou V1.1 | A (UI + DB en V1) ou B (UI déferrée V1.1) |
| ADR-R2 | Stratégie typing cross-couche | Génération `database.types.ts` via Supabase CLI + zod dérivés OU zod backend-only avec types front manuels alignés |
| ADR-R3 | Pattern accès Supabase unique | `supabase.functions.invoke()` pour toutes les edges, `from()` strictement RLS read-only |
| ADR-R4 | Décomposition gros composants — stratégie | Onglet-by-onglet (ProductCard 5 onglets → 5 fichiers + 1 shell) ou pattern Compound Components |
| ADR-R5 | Stratégie tests Supabase | Mock layer abstrait (createSupabaseMock factory) OU MSW HTTP interceptor pour les edges |
| ADR-R6 | TVA tier conformité | Lecture depuis `tenant.tax_regime` (à ajouter en migration) avec défaut 20 % FR métropole |
| ADR-R7 | a11y + i18n roadmap | Engagement WCAG AA + roadmap intl, scopé V2 mais préparé V1.2 |
| ADR-R8 | Bundle size budget | Lighthouse CI + bundle analyzer, seuils en `vite.config` |

### 4.3 Backlog stories refacto (Étape E)

Découpe en stories indépendamment mergeables :
- **R0** Spikes pré-refacto (Spike H + B2 + tests garde-fous) — XS chacun, ~1 j total
- **R1** ProductCard décomposition + PIM satellite (G) — L
- **R2** ChatInterface décomposition + bugs B6+E4+E5 — L
- **R3** ClariprintAdapter enforcement (F) — S
- **R4** Types DB partagés (D) — M (ADR-R2 dépendant)
- **R5** Pattern Supabase unique (E) — M (ADR-R3 dépendant)
- **R6** Order entity V1 ou V1.1 (C) — décision ADR-R1
- **R7** Bundle size baseline + lazy modales (M1) — S
- **R8** Testabilité Supabase mock layer (M2 + ADR-R5) — M

**Effort total estimé** : ~25-35 j Claude code en cumulé, à séquencer en 2-3 sprints post-démo.

---

## 5. Décisions à arbitrer avec Arnaud avant Étape D

1. **tenant_orders V1 vs V1.1** : décision binaire ADR-R1, impacte le scope refacto post-démo.
2. **TVA configurable** : ouvrir un sprint conformité avant ou après refacto ? Recommandation = **avant** (Spike H, 1 j).
3. **i18n V2 confirmé** ou anticiper en V1.2 ? Le code `locale='en'` en DB suggère qu'Arnaud y pense déjà.
4. **PRD update** : 3 ajouts P0 (F, G, H) + 8 nouveaux ADR à produire. Mettre à jour `prd.md` et `architecture.md` en cours de refacto ou en clôture sprint refacto ?

---

*Review adversariale produite par 3 agents Explore en parallèle (Blind Hunter / Edge Case Hunter / Acceptance Auditor), synthèse par Claude Code. Input pour Étape D (Winston Architect → plan + ADR).*
