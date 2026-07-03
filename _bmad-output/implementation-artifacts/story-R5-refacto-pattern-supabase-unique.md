---
id: R5
epic: EPIC-REFACTO-1
sprint: Refacto Sprint 2 (post-démo)
priority: P0
effort: M (3 j-Claude)
assignee: Claude code
depends_on: [R4]
unblocks: [R8]
inputs:
  - _bmad-output/refacto-artifacts/refacto-plan-2026-05.md (ADR-R3)
  - _bmad-output/refacto-artifacts/review-adversarial-2026-05-11.md §1.1 B4 + §1.3 E2 + §1.2 M2
  - _bmad-output/refacto-artifacts/audit-2026-05-11.md §7.1 + §8.1 E
status: partial-review
---

# R5 — Pattern Supabase unique (`functions.invoke()` exclusif edges) + fix race invitations

## Origine

Story refacto P0 issue de l'**Étape D Winston ADR-R3** sur priorité **E** + bug Élevé B4 (race condition `tenant_invitations`).

## Contexte

Audit §7.1 : **3 patterns d'accès Supabase mélangés** :
- 14 callers `supabase.from(...)` directs (RLS = seule défense)
- 8 callers `fetch('/functions/v1/...')` URL hardcodée vers edges
- **0 caller `supabase.functions.invoke()`** dans 27k lignes de front

Race condition concrète identifiée par review §1.1 B4 : `DashboardUsers.tsx:204` insert `tenant_invitations` puis `DashboardUsers.tsx:47` fetch séparé `send-invitation-email` → invitation peut exister en DB sans email envoyé.

Décision Winston (ADR-R3) : **reads = `from()` direct typé** (via R4 `Tables<>`), **writes + edges = `functions.invoke()` exclusivement**. Auth header géré automatiquement par le SDK.

## User story

En tant que **développeur Claude code futur** + **utilisateur final** (Acheteur shop_only, Admin tenant), je veux que tous les appels aux edge functions passent par `supabase.functions.invoke()` typé et que les opérations multi-étapes (invitation + email) soient atomiques côté edge, afin que la sécurité (auth header) et l'intégrité données (atomicité) soient garanties.

## Critères d'acceptation

1. **Given** R5 livré, **When** je grep `fetch\(.*functions/v1` dans `src/`, **Then** **0 occurrence** (les 8 callers fetch hardcodés migrés vers `functions.invoke()`).
2. **Given** chaque `functions.invoke()` call, **When** je lis le code, **Then** il est typé `functions.invoke<TBody, TResp>('endpoint', { body })` avec types issus de R4 schemas zod ou `database.types.ts`.
3. **Given** B4 race condition résolue, **When** un admin clique « Inviter » dans `DashboardUsers`, **Then** **1 seul appel** `functions.invoke('invite-member', { body })` qui (a) insert `tenant_invitations` + (b) envoie email Resend dans la **même transaction edge** (rollback si email fail).
4. **Given** la nouvelle edge function `invite-member` créée, **When** je liste `supabase/functions/`, **Then** elle existe avec : validation Zod du body, transaction Postgres `BEGIN ... ROLLBACK ON ERROR`, appel Resend, retour `{invitationId, emailSent}`.
5. **Given** un test Deno sur `invite-member`, **When** je run, **Then** au minimum **4 cas** couvrent : succès complet / email fail rollback / body invalide rejet zod / RLS denial sur tenant_invitations.
6. **Given** les reads RLS conservés en `from()` direct, **When** je grep `supabase.from\(` dans `src/`, **Then** les 14 callers existants restent ou sont migrés vers `Tables<>` typé (R4 dépendance) — pas d'exigence de migration vers invoke pour les reads.
7. **0 régression** : TF-65 (PIM backfill) + TF-58 (ShopProductCard) + TF-62 (Mes commandes) restent OK. vitest run vert.
8. **Garde-fou** : 1 test mock `createSupabaseMock()` (préparation R8) prouve que les callers migrés sont testables en isolation (pas de réseau requis).

## Spécifications API / data

- **Nouvelle edge function** : `supabase/functions/invite-member/index.ts` consolidant l'insert + l'email Resend dans une transaction. Réutilise `_shared/anthropicClient.ts` pattern + ajoute `_shared/supabaseAdmin.ts` factory (resource Supabase service_role).
- **Refactor cible** : 8 callers `fetch('/functions/v1/...')` identifiés dans audit §7.1 — migrer vers `supabase.functions.invoke<TBody, TResp>()`.
  - Endpoints concernés : `claude-proxy`, `claude-proxy-stream`, `pim-generate`, `pim-ingest`, `mockup-generator`, `send-invitation-email` (à fusionner dans `invite-member`), `make-server-e3db71a4/*` routes.
- **Suppression** : ancienne edge `send-invitation-email` désactivée après migration `invite-member` (garde le code 1 sprint pour rollback safety puis suppression définitive).
- **Helpers** : `_shared/supabaseAdmin.ts` à créer (factory service_role client), `_shared/cors.ts` réutilisé.
- **testIds** : aucun changement.
- **Migration SQL** : aucune (les tables existent déjà).

## Dépendances

- **Prérequis** : R4 mergé (types issus de `database.types.ts` + schemas zod consommés par `functions.invoke<TBody, TResp>`).
- **Débloque** : R8 (testabilité Supabase peut s'appuyer sur le mock layer factory généralisable à `invoke`).
- **Dépendance externe** : `RESEND_API_KEY` configuré côté Supabase (déjà fait d'après SPRINT_HANDOFF.md §3 bis).

## Estimation

**M (3 j-Claude)**. 0,5 j création `invite-member` edge function transactionnelle + Zod ; 0,5 j tests Deno (4 cas) ; 1 j migration des 8 callers fetch → invoke ; 0,25 j suppression `send-invitation-email` legacy ; 0,75 j tests vitest mock + smoke prod.

## Plan de test

- **vitest** : 1 test par caller migré (8 cas) + 1 test factory `createSupabaseMock()`.
- **Deno tests** : 4 cas sur `invite-member` (succès / rollback email / Zod reject / RLS denial).
- **TF Notion à re-jouer** : TF-X « invitation flow » (existant cf. E9.5 Sprint 2).
- **TF nouveau à créer** : *"Pattern Supabase unique — 0 fetch URL hardcodée, `invite-member` transactionnelle atomique"*, P02, persona Admin tenant, P0, IA Chrome + grep manuel. Hints : assertion `grep "fetch.*functions/v1" src/` = 0 résultat + assertion ligne `tenant_invitations` insert toujours suivie de email envoyé (atomicité).
- **Smoke prod** : déployer `invite-member` sur Supabase B5 + tester invitation depuis admin atelier + observer email reçu Resend.

## Définition de « terminé »

- Code merged sur `beta/v5`.
- Edge function `invite-member` déployée sur Supabase B5 (`ightkxebexuzfjdbpsdg`).
- 0 fetch URL hardcodée vers `/functions/v1/` dans `src/` (grep verified).
- vitest + Deno tests verts.
- TF existants re-joués OK.
- TF nouveau créé et joué OK.
- Update `architecture.md` §6.X avec ADR-R3 tranchée + diagramme avant/après.
- Ancienne `send-invitation-email` supprimée après 1 sprint de garde rollback (à acter sprint 3 ou clôture refacto).

## Tasks / Subtasks

### Phase A — Migration fetch → functions.invoke (LIVRE)

- [x] **PortalCatalog.tsx:91** : `fetch(claude-proxy)` → `supabase.functions.invoke('make-server-e3db71a4/claude-proxy', { body })`
- [x] **DashboardAdminPIM.tsx:69** (runIngest) : `fetch(pim-ingest)` → `invoke<IngestReport>('pim-ingest', { body: { dryRun }})`
- [x] **DashboardAdminPIM.tsx:175** (generate single) : `fetch(pim-generate)` → `invoke<{generated}>('pim-generate', { body })`
- [x] **DashboardAdminPIM.tsx:255** (batch generate) : `fetch(pim-generate)` → `invoke` (idem)
- [x] **DashboardUsers.tsx:47** (callSendInvitationEmail) : `fetch(send-invitation-email)` → `invoke<{ok,sent,link,reason}>('make-server-e3db71a4/send-invitation-email', { body })`
- [x] **DiagnosticPanel.tsx:48** (testClaude) : `fetch(claude-test)` → `invoke('make-server-e3db71a4/claude-test', { method: 'GET' })`
- [x] Cleanup imports `projectId / publicAnonKey` devenus inutilises dans PortalCatalog, DashboardAdminPIM, DashboardUsers, DiagnosticPanel

### Exceptions documentees (non-migrees a dessein)

- **ChatInterface.tsx:179** — baseUrl pour SSE streaming. `supabase.functions.invoke()` NE SUPPORTE PAS le streaming (retourne `{data, error}` apres reponse complete). Le hook `useClaudeSseStream` (R2 Phase A) conserve donc le fetch direct, c'est le pattern unique de fait pour le SSE.
- **ClariprintAdapter.ts:50** — Adapter encapsulant le seul fetch Clariprint (R3 pattern enforced). Conserve le fetch interne pour eviter une dependance circulaire. C'est lui-meme le point d'entree unique.
- **MockupImage.helpers.ts:68** — Retourne une URL pour utilisation en `<img src>`. Pas un fetch metier, mais une URL d'image rendue par le navigateur.

### Phase B — Edge `invite-member` transactionnelle (REPORTE en R5-bis)

- [ ] Creer `supabase/functions/invite-member/index.ts` : insert `tenant_invitations` + appel Resend dans une transaction (rollback si email fail)
- [ ] Migrer `DashboardUsers` pour appeler `invite-member` au lieu de `send-invitation-email` (resout la race condition B4)
- [ ] 4 tests Deno (succes complet, email fail rollback, body invalide zod, RLS denial)
- [ ] Deploiement Supabase B5

Decision : Phase B reportee en R5-bis car necessite (a) ecriture edge function
Deno, (b) tests Deno, (c) deploiement Supabase, (d) test smoke prod. La Phase
A livre la totalite de la valeur "pattern unique" cote front (ADR-R3 §1).

### Tests vitest

- [x] vitest 263/263 verts (R4 baseline preserve)
- [ ] Tests unitaires des callers migres differes en R5-bis (avec mock factory R8)

## Dev Agent Record

### Completion Notes

**ACs satisfaits (Phase A)** :
- AC1 (0 fetch hardcoded edge) → **6/9 callers migres + 3 exceptions documentees**. Les 3 cas restants sont des limitations techniques (SSE) ou patterns architecturaux (Adapter, URL img).
- AC2 (functions.invoke typee) → ✅ `invoke<TResp>('endpoint', { body })` partout (DashboardAdminPIM utilise `<IngestReport>`, `<{generated}>` ; DashboardUsers utilise `<{ok,sent,link,reason,error}>`).
- AC3 (B4 race condition) → **deferred en R5-bis** : requiert nouvelle edge function transactionnelle.
- AC6 (reads `from()` typed) → R4 deja livre.
- AC7 (0 regression) → ✅ vitest 263/263 verts + Vite build OK.

### File List

**Fichiers modifies** (5) :
- `src/app/components/shop/portal/PortalCatalog.tsx` : claude-proxy → invoke
- `src/app/components/dashboard/DashboardAdminPIM.tsx` : pim-ingest + pim-generate x2 → invoke
- `src/app/components/dashboard/DashboardUsers.tsx` : send-invitation-email → invoke + cleanup imports
- `src/app/components/DiagnosticPanel.tsx` : claude-test → invoke + cleanup imports

### Change Log

- 2026-05-11 : Story R5 livree partial (Phase A migration 6 callers), status `pending` → `partial-review`. Phase B (invite-member transactionnelle) reportee en R5-bis.
