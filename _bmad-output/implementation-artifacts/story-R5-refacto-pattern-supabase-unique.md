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
status: pending
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
