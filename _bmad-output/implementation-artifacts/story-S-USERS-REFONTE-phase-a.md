---
story_id: S-USERS-REFONTE-A
epic: 3 — Gestion utilisateurs (refonte unifiée)
title: Refonte gestion users Phase A — catalog rôles configurable + capabilities modulaires + UI assignation
status: delivered (2026-05-25, beta/v5)
created_at: 2026-05-25
delivered_at: 2026-05-25
target_branch: beta/v5
agent: Claude Code (Dev hat) + Arnaud (PO)
size: M-L (~2j effectifs, anticipation partielle Sprint 6 S-ORDER-ROLES-1)
sprint_cible: Sprint 5 (anticipation Sprint 6 sur demande Arnaud post-tests)
predecessors: [S3.4 Annulation, Validation MVP S3.4-bis, E9.3 user_permissions]
successors: [S-USERS-REFONTE-B (migration data + refacto 15 fichiers useClients), S-ORDER-ROLES Sprint 6]
---

# Story S-USERS-REFONTE Phase A — Livraison 2026-05-25

## Contexte d'origine

Feedback Arnaud post-test 2026-05-25 sur 5 points dont :
- #3 « je ne vois pas comment on peut assigner le rôle d'acheteur à un utilisateur puisque dans le menu des droits de l'utilisateur on a : "créer des devis", "Passer des commandes" et "inviter d'autres utilisateurs" Il faut donc ajouter le rôle d'acheteur »
- #5 « il faut refondre notre gestion des utilisateurs, le concept de client CRM n'a aucun intérêt, il faut consolider notre gestion des utilisateurs, avec une notion unique et des droits qui sont octroyés par l'admin du tenant ou de la plateforme. On fait ça avant le S5 »

Diagnostic 2026-05-25 : 3 notions séparées dans la DB (`clients` legacy CRM v3 + `tenant_members` B2B v1.1 + `tenant_invitations`) avec confusion UX dans DashboardUsers qui mélange Magrit Users + Contacts CRM. Le rôle "Acheteur" est implicite (scope shop_only + can_order=true), pas explicitement nommé.

## Périmètre Phase A (livré)

**DANS** :
- Nouvelles tables `tenant_role_definitions` + `tenant_role_assignments`
- Seed des 5 presets Standard B2B par tenant : Owner / Admin / Acheteur / Validateur / Producteur (45 rôles = 5×9 tenants)
- Helper SQL `user_has_capability(p_tenant_id, p_capability)` réutilisable RLS
- Migration data MINIMALE : Arnaud (user `8e29a136-95df-4ee2-84dd-2ea00a2e1f7c`) assigné Owner sur ses 5 tenants membres
- Cleanup UI : section "Contacts CRM" retirée de DashboardUsers (code helper conservé, juste plus rendu)
- Nouvelle section `DashboardRolesSection` : catalog rôles (capabilities en chips) + matrice users × rôles avec toggle d'assignation
- Hook React `useUserCapability` (wrap RPC)
- Bouton "Valider" sur DashboardOrders devient role-driven via `useUserCapability('can_validate')`

**HORS** (Phase B / Sprint 6) :
- Migration data automatique des autres tenant_members vers nouveaux rôles (Arnaud créera des comptes clean via UI)
- Refacto des 15 fichiers qui import `useClients` (Quote, ProductCard, etc.)
- DROP TABLE clients (V2+)
- UI création/édition/archivage rôles custom (Phase A = read-only catalog des 5 presets)
- Tables `tenant_order_roles` + `tenant_order_role_events` + `tenant_order_status_definitions` (vraie story S-ORDER-ROLES Sprint 6 pour workflow N+1 par-commande)
- RPC `update_tenant_order_status` étendue pour accepter `user_has_capability` (reste check legacy `role in ('owner','admin')` — Arnaud Owner passe partout, suffisant Phase A)

## Décisions Arnaud 2026-05-25

| # | Question | Décision |
|---|---|---|
| 1 | 5 presets : capabilities exactes | Standard B2B recommandé. Owner=toutes / Admin=toutes sauf can_manage_roles / Acheteur=can_quote+can_order / Validateur=can_validate+can_cancel+can_modify+can_export / Producteur=can_export+can_modify |
| 2 | Migration data tenant_members.permissions → tenant_role_assignments | Migrer UNIQUEMENT son user (admin plateforme). Les autres comptes existants ne sont pas migrés — Arnaud créera des comptes clean via la nouvelle UI |
| 3 | Retirer section Contacts CRM dès Phase A | Oui retirer maintenant (UI seule, table DB clients conservée pour back-compat des 15 fichiers Quote/ProductCard) |

## Architecture livrée

### DB

| Table | But | RLS |
|---|---|---|
| `tenant_role_definitions` | Catalog rôles par tenant (id, name, description, capabilities jsonb, ordering_index, scope, archived_at) | SELECT membres du tenant ; WRITE super_admin OU can_manage_roles |
| `tenant_role_assignments` | Qui occupe quel rôle (id, role_definition_id, user_id, assigned_at, assigned_by, revoked_at, revoked_by) | SELECT user_id=auth.uid() OU admins tenant ; WRITE can_manage_roles |
| `user_has_capability(tenant_id, capability)` (fn) | Helper RLS réutilisable | super_admin bypass ; sinon EXISTS assignment actif avec capability=true |

**Index** : unique partiel sur `(role_definition_id, user_id) WHERE revoked_at IS NULL` (cumul de rôles ok mais pas de doublon actif).

### Front

| Fichier | Rôle |
|---|---|
| `src/app/hooks/useUserCapability.ts` (nouveau) | Hook React wrap RPC `user_has_capability` |
| `src/app/components/dashboard/DashboardRolesSection.tsx` (nouveau) | Section catalog rôles + matrice users × rôles toggle |
| `src/app/components/dashboard/DashboardUsers.tsx` (M) | Retiré `<CrmContactsSection />`, ajouté `<DashboardRolesSection />`, titre devient "Utilisateurs et rôles" |
| `src/app/components/dashboard/DashboardOrders.tsx` (M) | Import `useUserCapability` + conditionne `onValidateOrder` sur `canValidate` |
| `src/app/lib/testIds.ts` (M) | +4 testIds : `sectionRoles`, `roleRow`, `assignmentRow`, `assignmentToggle` |

## Tests

- `409/409 vitest verts` (0 régression vs sprint précédent)
- `13 Deno verts` (wrapper LLM + extractAuthContext + email helper)
- DB : 45 rôles seedés vérifiés via PostgREST + 5 assignments Owner Arnaud vérifiés

## Tu peux tester en 30s

1. http://localhost:5177/dashboard → onglet **Utilisateurs et rôles**
2. Section "Rôles et droits" → table des 5 presets avec capabilities en chips
3. Matrice users × rôles : ton compte affiche "Owner" coché ✅
4. Clic sur n'importe quelle case → toggle assignation en live (loading puis check/croix)
5. Onglet Commandes : ton bouton "Valider" reste visible (tu as can_validate via Owner)
6. Crée un compte test "Acheteur" via Invite → assigne-lui seulement le rôle "Acheteur" → vérifie que sur son dashboard le bouton Valider est MASQUÉ

## Lessons appliquées (déjà notées vault)

- Notion unique d'utilisateur > 2 entités séparées (clients CRM vs tenant_members)
- Cardinalité design > 12 valeurs → dropdown, pas chips (filtre boutique fix #1)
- Tri colonne 2 états vs 3-cycle bugué

## Phase B à scheduler (estimation ~1j)

- Migration auto des `tenant_members.permissions` legacy vers `tenant_role_assignments`
- Refacto des 15 fichiers qui import `useClients` pour décorréler (QuoteModal, ProductCard, etc.)
- (V2+) DROP TABLE clients

## Phase C / Sprint 6 (S-ORDER-ROLES déjà spec)

- `tenant_order_roles` (qui occupe quel rôle SUR une commande)
- `tenant_order_role_events` (audit transitions rôles par commande)
- `tenant_order_status_definitions` (statuts custom par tenant)
- Workflow N+1 complet (notifications par étape via `notify_policy`)

---

## Fixes post-livraison flux invitation (2026-05-27)

Après la livraison Phase A (catalog rôles + matrice), les tests d'invitation d'un acheteur réel ont révélé **6 bugs en chaîne** sur le flux invitation → connexion → routing boutique. Tous corrigés et poussés sur beta/v5 :

| # | Commit | Bug | Fix |
|---|---|---|---|
| 1 | (redeploy) | `invite-member` HTTP 503 BOOT_ERROR | Redéploiement edge fn = fresh cold start (deps CDN périmées) |
| 2 | `e91df1f` | Modals Inviter/Permissions encore en legacy role+permissions jsonb | Nouveaux composants InviteUserModalV2 + EditUserRolesModal role-driven |
| 3 | `d9c5671` | Resend 403 domaine → rollback bloquant | Graceful degradation : Resend 4xx = garde invitation + lien manuel (rollback réservé 5xx/réseau) |
| 4 | `4f0cb8f` | Modals ne définissaient pas scope+boutiques → acheteur magrit_full sans boutique | Ajout sélecteur Type d'accès (shop_only/magrit_full) + multi-select boutiques dans les 2 modals |
| 5 | `f658b29` | accept_tenant_invitation acceptait pour le user connecté (pas l'email cible) | Migration 20260527000100 : guard `auth.email() == invitation.email` + UX message + redirect boutique |
| 6 | `60bb45c` | TenantPicker ne routait pas un shop_only vers sa boutique | Redirect auto `/t/<slug>` si tous accès shop_only |
| 7 | `8173b4e` | Race condition : `loading` false transitoire → redirect /tenants/new prématuré | `effectiveLoading` qui track `loadedUserId` |
| 8 | `7a04046` | **CAUSE RACINE** : acheteur shop_only héritait des sous-tenants en magrit_full | Héritage descendant réservé owner/admin magrit_full (allow-list, pas exclusion) |

**Config Resend résolue** : sender `MAGRIT_FROM_EMAIL` = `Magrit <support@ageservices.fr>` (domaine vérifié) au lieu de `onboarding@resend.dev` (mode test limité). Clé Resend régénérée (ancienne compromise dans le chat).

**Parcours acheteur validé end-to-end 2026-05-27** : login `amazon@ageservices.fr` (shop_only Imprimerie IPA) → redirect auto → boutique Manitou. ✅

### Reste à faire (prochaine session)

- **Valider le flux invitation complet bout-en-bout** : le compte acheteur de test a été créé manuellement en DB (membership shop_only + rôle Acheteur). Le flux invitation lui-même (email → lien → acceptation → membership auto) doit être re-validé proprement maintenant que l'email guard + scope sont en place.
- **Mot de passe temporaire** `MagritTest2026!` posé sur amazon@ageservices.fr pour les tests → à changer/nettoyer.
- **Faille colmatée** : avant le fix #8, un acheteur shop_only avait des accès magrit_full fantômes sur les sous-tenants du parent. À vérifier qu'aucun autre compte en prod n'a hérité de tels accès (audit RLS Sprint 9).
- **Phase B** : refactor des 15 fichiers `useClients` + cleanup code mort (InviteForm, EditPermissionsModal legacy) + migration data tenant_members.permissions → tenant_role_assignments.
