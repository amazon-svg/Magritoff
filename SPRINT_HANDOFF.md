# Magrit Beta 4 — Handoff entre sessions Claude code

> Document de reprise pour démarrer une nouvelle session de Claude code sur le projet sans recharger tout l'historique. À tenir à jour à chaque fin de sprint.
>
> **Dernière mise à jour : fin session post-Sprint 2 + E7.7 + E9.6 (2026-05-06)**

---

## 1. Contexte projet en 30 secondes

Magrit = copilote IA web-to-print B2B français. Stack Vite 6 + React 18 + TS + Tailwind v4 + Supabase. Modèle Claude `claude-sonnet-4-20250514` pour le chat / `claude-haiku-4-5-20251001` pour le PIM. Moteur de devis externe : Clariprint (Expert Solutions, partenariat AGE).

**4 Betas en parallèle** :
- B1 (`Magritoff/`, port 5173, branche `main`) — prod, ne pas toucher
- B2 (`Magritoff-v2/`, port 5174, branche `design/v2`) — refonte design
- B3 (`Magritoff-v3/`, port 5175, branche `beta/v3`) — multi-tenant, **projet Supabase mort** (`azbpnhnfnkdemfmwvyqc` n'existe plus)
- **B4 (`Magritoff-v4/`, port 5176, branche `beta/v4`)** — incréments Sprint 1 + Sprint 2 livrés, **environnement de dev actif**

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
