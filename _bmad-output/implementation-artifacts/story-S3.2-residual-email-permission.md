---
story_id: S3.2-residual
epic: 3 — Module Commandes (Order entity user-facing)
title: S3.2 résiduel — Email admin tenant + status draft + permission can_create_order
status: spec-ready (post vérification doublon 2026-05-22)
created_at: 2026-05-22
target_branch: beta/v5
agent: TBD (Dev hat)
size: S (1-1.5j)
prd_ref: _bmad-output/planning-artifacts/prd.md (FR18)
predecessors: [S-MIGRATION-ORDERS livré, S-CONSO-3 PortalThankYou livré]
successors: []
sprint_cible: Sprint 5 (roadmap qualité-first)
---

# Story S3.2-residual — Compléments création commande

## Contexte vérification doublon (Phase 0.9, 2026-05-22)

La story originale [S3.2](../planning-artifacts/epics.md) (epics.md L614) prévoyait : insertion `orders` draft + items + email admin tenant Resend + redirection fiche commande + RLS permission `can_create_order`.

**Vérification terrain Phase 0.9** (roadmap qualité-first) :

| AC originale S3.2 | Couvert par | Statut |
|---|---|---|
| Insert `tenant_orders` (draft) + `tenant_order_items` | S-MIGRATION-ORDERS ([PublicShop.tsx:262](../../src/app/components/shop/PublicShop.tsx)) | ✅ Couvert |
| Redirection vers fiche commande créée | S-CONSO-3 ([PortalThankYou.tsx](../../src/app/components/shop/portal/PortalThankYou.tsx) + setView('thankYou')) | ✅ Couvert |
| Notification email admin tenant Resend | — | ❌ Manquant (PortalThankYou affiche juste "email sera envoyé prochainement" purement déclaratif) |
| Statut `draft` (vs `pending` default) | — | ⚠️ À vérifier dans `20260509_01_e1_orders_v1_1.sql` + cohérence Sprint 6 S-ORDER-ROLES-1 (statuts extensibles) |
| Permission RLS `can_create_order` + message d'erreur clair | — | ❌ Manquant (la permission n'existe pas explicitement dans `tenant_members.permissions`, seules `can_quote` / `can_order` / `can_invite` existent) |

**Verdict** : S3.2 n'est PAS un pur doublon. Elle se réduit à 3 sous-tâches résiduelles formant cette story `S3.2-residual`.

## Story (user story)

**As an** acheteur B2B,
**I want** que la création de ma commande déclenche une notification email à l'admin du tenant + soit gouvernée par une permission explicite + soit créée au statut `draft` (modifiable / annulable),
**So that** (a) l'imprimeur Pro est notifié en temps réel, (b) seuls les users autorisés créent des commandes, (c) la commande reste éditable avant validation N+1 (cohérence Sprint 6 S-ORDER-ROLES).

## Acceptance Criteria (3 sous-AC)

### AC1 — Notification email admin tenant à la création

**Given** un acheteur authentifié soumet un panier valide
**When** `submitCart()` insère avec succès dans `tenant_orders` + `tenant_order_items`
**Then** la edge function `send-order-notification` (nouvelle, basée sur infra Resend E9.5) envoie un email à l'admin du tenant (membre `tenant_members` avec `access_scope='magrit_full'` et `permissions.can_invite=true` — heuristique "admin du tenant")
**And** le contenu email contient : référence courte commande (`formatShortOrderId`), nom acheteur, shop concernée, total HT, lien profond vers la commande dans le dashboard owner
**And** si la edge function Resend échoue (RESEND_API_KEY manquant ou rate limit), l'erreur est loggée dans `llm_usage_events` (endpoint=send-order-notification-fallback) sans bloquer le submitCart côté front (notification = best effort, pas blocker)
**And** un TF Notion couvre le scénario nominal + fallback Resend down

### AC2 — Status default `draft` (vs `pending`)

**Given** la table `tenant_orders` (créée S1.4, migration `20260509_01_e1_orders_v1_1.sql`)
**When** on inspecte le default de la colonne `status`
**Then** soit le default est déjà `draft` (vérification simple, AC = écrire le test vitest qui le confirme)
**Or** le default est `pending` et il faut une migration `20260522_*_tenant_orders_status_default_draft.sql` qui bascule vers `draft` (avec migration rétroactive des `pending` existants → `draft` si pertinent, à arbitrer Arnaud)
**And** le code submitCart explicite le `.insert({ status: 'draft', ... })` (defensive, ne dépend pas du default)
**And** cohérence cross-sprint vérifiée : Sprint 6 S-ORDER-ROLES-1 (enum statuts extensibles) doit conserver `draft` comme état initial

### AC3 — Permission explicite `can_create_order` + UX message

**Given** la table `tenant_members.permissions` jsonb existe (E9.3 livré)
**When** on crée la permission `can_create_order` (jsonb key, default `true` pour back-compat)
**Then** une migration `20260522_*_tenant_members_can_create_order.sql` ajoute la default value pour les rows existants
**And** la RLS INSERT de `tenant_orders` vérifie `(public.user_can_create_order(tenant_id) = true)` via helper SQL nouveau ou existant
**And** côté front, si `can_create_order = false`, le bouton "Valider la commande" dans PortalCart est désactivé avec tooltip "Votre administrateur tenant n'a pas activé la création de commandes pour votre compte"
**And** si la RLS bloque (cas race condition flag désactivé pendant la session), un message Sally-validé s'affiche côté PortalCart : "Permission insuffisante pour créer une commande. Contactez votre administrateur."
**And** un TF Notion couvre les 3 scénarios : permission OK, permission désactivée (bouton disabled), permission révoquée en cours de session (message erreur post-submit)

## Out of scope explicite

- Logique de transition `draft → validated` (Sprint 6 S-ORDER-ROLES-2 RPC transitions)
- UI dashboard admin pour gérer `can_create_order` par membre (Sprint 6 S-ORDER-ROLES-3, à confirmer)
- Notifications email aux validateurs N+1 (Sprint 6 S-N1-APPROVAL)
- Audit trail UI (Sprint 6 S3.5)

## Tasks

- [ ] Task 1 — Vérification statut default `tenant_orders.status` (5min SQL audit, écrire test vitest si OK ou migration si KO)
- [ ] Task 2 — Edge function `send-order-notification` (Resend, basée sur infra E9.5), avec fallback log
- [ ] Task 3 — Migration `tenant_members.permissions.can_create_order = true` par défaut + back-fill rows
- [ ] Task 4 — Helper SQL `public.user_can_create_order(tenant_id)` + extension RLS INSERT `tenant_orders`
- [ ] Task 5 — UX PortalCart : bouton conditionnellement disabled + tooltip + message d'erreur post-submit (Sally validation)
- [ ] Task 6 — 3 TF Notion (email envoyé OK, fallback Resend down, permission désactivée)
- [ ] Task 7 — Tests vitest : send-order-notification (mock Resend) + RLS INSERT bloquée + status default

## References

- [Source: _bmad-output/planning-artifacts/epics.md L614] — S3.2 originale
- [Source: src/app/components/shop/PublicShop.tsx:262] — submitCart() actuel
- [Source: src/app/components/shop/portal/PortalThankYou.tsx] — page confirmation (S-CONSO-3)
- [Source: supabase/migrations/20260509_01_e1_orders_v1_1.sql] — schéma `tenant_orders`
- [Source: supabase/migrations/20260505_02_e9_user_permissions.sql] — `tenant_members.permissions`
- [Source: supabase/functions/send-invitation-email/] — pattern Resend E9.5 réutilisable

## Cohérence cross-roadmap

Cette story doit être livrée **Sprint 5** (roadmap qualité-first) en complément de S3.1 + S3.3 + S3.4. Pas avant Sprint 6 S-ORDER-ROLES (qui apportera les statuts extensibles + RPC transitions + RLS jointure rôles), pour ne pas tasser.

Effort cumulé Sprint 5 avec cette story : S3.1 (1.5j) + S3.3 (0.5j) + S3.4 (0.5j) + S3.2-residual (1-1.5j) + S-LLM-WRAPPER-ROBUSTNESS (2-3j) + R5-bis (1j) = ~7-8j sur 5-6 stories. Dans la cible roadmap ("Sprint 5 ~6-7j, 5 stories").

**Action roadmap** : mettre à jour `roadmap-v1.1-qualite-first-2026-05-21.md` annexe maturité S3.2 → "S3.2-residual prête, Sprint 5, 1-1.5j" au lieu de "à supprimer Phase 0.9".
