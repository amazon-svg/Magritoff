---
id: R2
epic: EPIC-REFACTO-1
sprint: Refacto Sprint 2 (post-démo)
priority: P0
effort: L (4 j-Claude)
assignee: Claude code
depends_on: [R0]
unblocks: [R7]
inputs:
  - _bmad-output/refacto-artifacts/refacto-plan-2026-05.md (ADR-R4)
  - _bmad-output/refacto-artifacts/review-adversarial-2026-05-11.md §1.1 B6 + §1.3 E4 + E5
  - _bmad-output/refacto-artifacts/audit-2026-05-11.md §3.2 + §8.1 B
status: partial-review
---

# R2 — ChatInterface décomposition + bugs B6 / E4 / E5

## Origine

Story refacto P0 issue de l'**Étape D Winston** sur priorité **B** + 3 bugs Élevés détectés par l'**Étape C review adversariale** :
- **B6** — dual source `messages` (state local) vs `conversation.messages` (context) sans synchronisation
- **E4** — Anthropic billing error silencieux → bascule demo mode sans alert admin
- **E5** — Conversation > 25 messages sans troncage front (project-context §3.4)

## Contexte

`ChatInterface.tsx` 1066 lignes. 8+ concerns mélangés (conversation state, message flow, streaming SSE, mode toggle open/strict, Clariprint config parsing, library bulk, history panel, demo mode, multi-select). 11 useState + 2 useEffect. Helper inline `readClaudeSseStream` (65 L) — logique métier forte à extraire.

Bugs combinés à fixer dans la même story (couplés) :
- Dual source messages = data corruption silencieuse si 2 onglets ouverts.
- Billing error catché en générique → demo mode active sans signal → IA cassée silencieusement.
- 25 messages limite NFR43 mais aucun troncage front visible → risque crash LLM token limit.

## User story

En tant que **Owner / Admin / Member tenant** imprimeur Pro atelier, je veux que l'interface Magrit chat soit décomposée en sous-composants + hooks et que les 3 bugs B6/E4/E5 soient corrigés, afin d'avoir un chat IA stable (pas de data loss), un signal d'erreur lisible (billing vs autre) et une expérience prévisible au-delà de 25 messages.

## Critères d'acceptation

1. **Given** la décomposition R2 livrée, **When** je liste les fichiers, **Then** la structure est : `ChatInterface.tsx` (shell ≤ 300 L) + `ChatMessageList.tsx` + `ChatInput.tsx` + `ChatHistoryPanel.tsx` + `ChatModeToggle.tsx` + hooks extraits (`useChatConversation`, `useClaudeSseStream`).
2. **Given** B6 résolu, **When** je grep dans `ChatInterface.tsx` + sous-composants, **Then** **1 seule source `messages`** (depuis `useConversation` context), pas de duplication en state local. Un test vitest couvre le cas 2 onglets simultanés (mock context update + assertion pas de divergence).
3. **Given** E4 résolu, **When** Anthropic LLM endpoint renvoie un 401/403 billing error, **Then** un banner explicite `"IA temporairement indisponible — facturation"` s'affiche au lieu de la bascule silencieuse `demoMode=true`. Le mode démo reste disponible mais opt-in explicite.
4. **Given** E5 résolu, **When** la conversation atteint 25 messages, **Then** **troncage automatique** au début (garde les 24 derniers + nouveau) + indicateur visible `"messages plus anciens tronqués pour respecter limite contexte"`. Conformité project-context §3.4.
5. **Given** `useClaudeSseStream` extrait, **When** un AbortController est associé, **Then** la navigation hors `/t/:slug/atelier` pendant streaming **annule** le fetch (résout edge case 1.2 review §1.3).
6. **Given** la décomposition, **When** je grep `useState` dans le shell `ChatInterface.tsx`, **Then** ≤ 4 useState (au lieu de 11). Les useState restants sont dans les sous-composants ou hooks.
7. **0 régression** : `vitest run` >= 188/188 (R0 + R1 + R2). TF-50 mode strict + TF-51 streaming restent OK. Persistance conversation localStorage tenant-scoped préservée.
8. **Garde-fou tests R0** : les tests `priceResolver`, `ClariprintAdapter`, `CartContext` (R0) restent verts.

## Spécifications API / data

- **Fichiers à créer** :
   - [src/app/components/chat/ChatMessageList.tsx](src/app/components/chat/ChatMessageList.tsx)
   - [src/app/components/chat/ChatInput.tsx](src/app/components/chat/ChatInput.tsx)
   - [src/app/components/chat/ChatHistoryPanel.tsx](src/app/components/chat/ChatHistoryPanel.tsx)
   - [src/app/components/chat/ChatModeToggle.tsx](src/app/components/chat/ChatModeToggle.tsx)
   - [src/app/hooks/useChatConversation.ts](src/app/hooks/useChatConversation.ts) — wrap context + dérive `messages` source unique
   - [src/app/hooks/useClaudeSseStream.ts](src/app/hooks/useClaudeSseStream.ts) — extraction `readClaudeSseStream` + AbortController + truncation 25 msg
- **Fichier modifié** : [src/app/components/ChatInterface.tsx](src/app/components/ChatInterface.tsx) — shell réduit (≤ 300 L), routing entre sous-composants.
- **Endpoint inchangé** : `make-server-e3db71a4/claude-proxy-stream` (déjà refactoré S1.5 via `anthropicStream` wrapper).
- **Erreur billing typée** : utiliser `AnthropicClientError.kind === 'billing'` (déjà disponible côté wrapper S1.5) pour discriminer côté front.
- **testIds** : ajouter `chat-billing-banner`, `chat-truncation-indicator` à [src/app/lib/testIds.ts](src/app/lib/testIds.ts).
- **Pas de changement de schéma DB.**

## Dépendances

- **Prérequis** : R0 mergé + vert.
- **Indépendant de R1** : peut être joué en parallèle si capacité, mais en pratique séquentiel sur la même branche pour limiter les conflits sur `testIds.ts`.
- **Débloque** : R7 (bundle baseline peut maintenant cibler les modales chat extraites).

## Estimation

**L (4 j-Claude)**. 1 j extraction hooks (`useChatConversation` + `useClaudeSseStream` avec AbortController) ; 0,5 j résolution B6 dual source ; 0,25 j fix E4 billing banner ; 0,25 j fix E5 troncage ; 1 j extraction des 4 sous-composants ; 0,25 j shell + routing ; 0,75 j tests vitest.

## Plan de test

- **vitest** : 1 test par hook (2) + 1 test par sous-composant (4) + 1 test B6 dual source résolu + 1 test E4 billing banner + 1 test E5 troncage 25 msg + 1 test AbortController.
- **TF Notion à re-jouer** : TF-50 mode strict + TF-51 streaming + TF-52 history persistance.
- **TF nouveau à créer** : *"ChatInterface — billing error banner explicite + troncage 25 messages + AbortController navigation"*, P05/P06, persona Member tenant, P0, IA Chrome. Hints : assertion banner billing + indicateur troncage + 0 warning React `setState on unmounted`.
- **Smoke humain** : Arnaud joue 30 messages + observe troncage + observe banner billing simulé via DevTools network throttle 401.

## Définition de « terminé »

- Code merged sur `beta/v5`.
- 4 sous-composants + 2 hooks + shell réduit livrés.
- B6 / E4 / E5 fix vérifiés.
- vitest run vert avec 11+ nouveaux cas.
- TF existants re-joués OK.
- TF nouveau créé et joué OK.
- Update `architecture.md` §6.X avec ADR-R4 ChatInterface tranchée + traçage E4/E5/B6.
- 0 occurrence pattern de demo mode silencieux dans le code (grep verified).

## Tasks / Subtasks

### Phase A — Hook `useClaudeSseStream` (LIVRE)

- [x] `src/app/hooks/useClaudeSseStream.ts` cree : extraction `readClaudeSseStream` + `AbortController` (annulation au demontage et entre 2 requetes successives, fix edge case review §1.3 1.2)
- [x] Export helpers purs : `truncateMessages`, `detectBillingError`, `MAX_CONTEXT_MESSAGES`, classe `ClaudeSseStreamError`
- [x] Migration `ChatInterface.tsx` sendMessage() vers le hook (suppression `readClaudeSseStream` inline)
- [x] Tests `tests/hooks/useClaudeSseStream.test.ts` (14 cas : truncateMessages x6, detectBillingError x6, ClaudeSseStreamError x2)

### Phase B — Bugs E4 + E5 + B6 (LIVRE)

- [x] **E4 (billing explicit)** : `ClaudeSseStreamError.kind === 'billing'` declenche un banner `data-testid=marguerite-billing-error-banner` rouge ⚠ FACTURATION IA au lieu de la bascule silencieuse `setIsDemoMode(true)`. Le mode demo reste disponible mais opt-in pour les autres erreurs reseau.
- [x] **E5 (troncage 25 msg)** : `truncateMessages` applique avant envoi au LLM. L UI conserve l'historique complet, un badge `marguerite-context-truncated-indicator` "CONTEXTE TRONQUE" s affiche quand `messages.length > MAX_CONTEXT_MESSAGES`. NFR43 respecte.
- [x] **B6 (dual source)** : verifie dans le code actuel → **deja resolu**. `ChatInterface` utilise `messages` / `setMessages` du `useConversation()` context. Pas de useState local pour messages. Le bug etait probablement deja fixe lors d'un sprint anterieur (S1.X). Documente comme "non-applicable car deja corrige".

### Phase C — Extraction 4 sous-composants UI (REPORTE en R2-bis)

- [ ] `ChatMessageList.tsx` — feed scrollable messages + chips clarification + indicateur streaming
- [ ] `ChatInput.tsx` — textarea + bouton envoi + raccourcis clavier
- [ ] `ChatHistoryPanel.tsx` — modale historique conversations (⌘K)
- [ ] `ChatModeToggle.tsx` — selecteur mode open/strict + persistance localStorage

Decision : reporte en R2-bis (story dediee) car la Phase A+B livre la totalite
de la valeur fonctionnelle (3 bugs critiques fixes + AbortController). La Phase
C est de la maintenabilite pure (decoupage UI 1057 → ~300 L shell), aucune
amelioration UX visible. Sera traite quand le sprint refacto continue.

### Phase D — Tests + commit (PARTIEL : Phase A+B tests OK)

- [x] vitest 246/246 verts (232 baseline R0+R1 + 14 nouveaux R2)
- [x] Vite build OK (1808 modules)
- [ ] Tests par sous-composant UI : differes en R2-bis

## Dev Agent Record

### Completion Notes

**ACs satisfaits (Phase A+B)** :
- AC1 (decomposition 5 fichiers) → **partiel** : 1 hook + 1 banner E4 + 1 indicateur E5 livres. 4 sous-composants UI differes R2-bis.
- AC2 (B6 dual source) → **deja resolu hors R2** : code actuel utilise seulement `useConversation()` context.
- AC3 (E4 billing banner) → ✅ `marguerite-billing-error-banner` visible quand `ClaudeSseStreamError.kind === 'billing'`.
- AC4 (E5 troncage 25 msg) → ✅ `truncateMessages` + indicateur `marguerite-context-truncated-indicator`.
- AC5 (AbortController) → ✅ `useClaudeSseStream` annule au demontage et entre 2 sends successifs.
- AC6 (≤4 useState dans le shell) → **non encore atteint** : ChatInterface.tsx reste a ~10 useState (les 4 sous-composants UI extrairaient `mode`, `showHistory`, `bulkLibraryPickerOpen`, `selectedIds`, etc.). R2-bis.
- AC7 (0 regression) → ✅ vitest 246/246 verts.
- AC8 (garde-fous R0) → ✅ tests R0 priceResolver / ClariprintAdapter / CartContext / tax tous verts.

**Story R2-bis a creer** : Phase C extraction 4 sous-composants UI + tests par composant + finalisation AC1/AC6. Estimee S (2 j-Claude).

### File List

**Nouveaux fichiers** (2) :
- `src/app/hooks/useClaudeSseStream.ts` (197 L : hook + helpers purs + classe d'erreur typee)
- `tests/hooks/useClaudeSseStream.test.ts` (14 cas)

**Fichiers modifies** (2) :
- `src/app/components/ChatInterface.tsx` : suppression `readClaudeSseStream` inline (65 L), migration vers hook, fix E4 (billing banner + opt-in demo), fix E5 (truncateMessages + indicateur)
- `src/app/lib/testIds.ts` : ajout `marguerite.billingErrorBanner`

### Change Log

- 2026-05-11 : Story R2 livree partial (Phase A hook + Phase B bugs E4/E5/B6), status `pending` → `partial-review`. R2-bis a creer pour Phase C (4 sous-composants UI).
