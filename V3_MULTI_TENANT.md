# Magrit Beta 3 — Architecture multi-tenant

> Document vivant. Decrit ce qui est en place a la sortie de la **phase 1**
> (baseline v3), les decisions prises, et ce qui reste pour les phases 2+.
> Branche : `beta/v3`. Dossier : `Magritoff-v3/`. Port dev : **5175**.

---

## 1. Decisions structurantes (validees avec Arnaud)

| Point | Decision |
|---|---|
| **Strategie** | Hybride : multi-tenant **logique** (shared DB + RLS) par defaut. Possibilite future de silo (projet Supabase dedie) en offre Enterprise. |
| **Niveaux** | Exactement **2** : tenant racine (imprimeur) + sous-tenant (filiale interne OU client B2B externe). Enforce par trigger DB. |
| **Roles** | `owner` / `admin` / `member` / `partner`. Les `partner` n'heritent pas des sous-tenants du parent (isolation externe). |
| **PIM** | Global unique, patrimoine Magrit. Chaque tenant **souscrit a N gammes** (packaging, grand format…). Ingestion pipeline alimente par les commandes validees. |
| **Projet Supabase** | **Nouveau projet dedie** (pas `jynxrpzwgzrrfuooputw`). A creer par Arnaud. |
| **Super-admin Magrit** | Tenant systeme `magrit-root` (flag `is_system_tenant=true`). Ses membres voient tout. |
| **Routage** | `/t/:tenantSlug/*` partout. Sous-domaine custom en option premium future. |

---

## 2. Schema DB (migrations v3)

5 fichiers numerotes dans `supabase/migrations/`, appliques **apres** les migrations v2 heritees.

| Fichier | Contenu |
|---|---|
| `20260424_01_tenants_core.sql` | Tables `tenants`, `tenant_members`, `tenant_invitations`. Fonctions helpers RLS : `current_user_tenant_ids()`, `is_super_admin()`, `user_role_in_tenant()`. Trigger `enforce_tenant_depth` (max 2 niveaux). |
| `20260424_02_tenant_id_on_data.sql` | Ajoute `tenant_id` sur `conversations`, `clients`, `libraries`, `product_library`, `shops`, `shop_products`, `quotes`, `quote_templates`. Ajoute `last_tenant_id` sur `user_preferences`. |
| `20260424_03_pim_subscriptions_and_ingestion.sql` | Table `tenant_gamme_subscriptions`. Table `pim_candidates` (pipeline ingestion). Colonnes enrichissement sur `product_definitions` : SEO (`seo_title`, `seo_description`, `schema_org`, `seo_keywords`), commercial (`commercial_pitch`, `benefits`, `use_cases`), technique Clariprint (`clariprint_ref`, `technical_spec`, `mockup_3d_url`, `gabarit_pdf_url`), qualite (`quality_score`, `order_count`, `last_ordered_at`). Trigger `enqueue_pim_candidate_on_order`. |
| `20260424_04_rls_tenant_scoped.sql` | Refonte complete des RLS : toutes les tables data passent de "auth.uid() = user_id" a "tenant_id IN current_user_tenant_ids()". Lecture publique maintenue pour les shops publies. `product_gammes` / `product_definitions` restent en lecture auth globale (patrimoine Magrit), ecriture superadmin. |
| `20260424_05_bootstrap_magrit_root.sql` | Seed du tenant `magrit-root`. RPC : `bootstrap_magrit_admin(user_id)`, `create_tenant_with_owner(slug, name, parent)`, `accept_tenant_invitation(token)`. |

### Cas limite : eviter la recursion RLS

Les helpers `current_user_tenant_ids()`, `is_super_admin()`, `user_role_in_tenant()` sont tous declares `security definer` + `stable` pour pouvoir etre appeles depuis les policies sans provoquer de recursion RLS sur `tenant_members`.

### Pipeline d'ingestion PIM

```
Commande validee (quotes.status = 'won')
        │
        ▼
  Trigger enqueue_pim_candidate_on_order
        │
        ▼
  pim_candidates (status = 'pending')
        │
        ▼  (edge function `pim-ingest` a ecrire)
  Normalisation Clariprint (specs techniques, gabarits, 3D)
  Enrichissement LLM (pitch commercial, SEO, benefits, schema.org)
        │
        ▼
  pim_candidates (status = 'normalized')
        │
        ▼  (Admin PIM Magrit : valide / rejete / fusionne)
  product_definitions (colonnes normalized_*) ← merged
```

L'edge function `pim-ingest` est a ecrire en phase 2. Elle devra :
1. Poller les `pim_candidates` `status='pending'` (ou subscribe via Realtime).
2. Appeler Clariprint avec `raw_config` → recuperer le normalized JSON → remplir `clariprint_normalized`.
3. Appeler Claude avec le normalized + contexte gamme → recuperer SEO + commercial → remplir `llm_enrichment`.
4. Verifier les doublons (hash sur kind + format + paper + finish). Si match → `status = 'superseded'`, `merged_into = <id>`. Si pas de match → `status = 'normalized'`, en attente d'admin.
5. L'admin Magrit (role superadmin) valide depuis `Dashboard > Admin PIM` → merge dans `product_definitions`, increment `order_count`.

---

## 3. Frontend (phase 1)

### Hierarchie des providers

```
App.tsx
 └─ AuthProvider
     └─ PreferencesProvider
         └─ PIMProvider
             └─ RouterProvider
                 └─ AppShell (premier enfant du router)
                     └─ TenantProvider              ← router-aware (useParams)
                         └─ ConversationProvider
                             └─ ClientsProvider
                                 └─ LibraryProvider
                                     └─ ShopsProvider
                                         └─ QuoteTemplatesProvider
                                             └─ CartProvider
                                                 └─ <Outlet />
```

### Nouveaux fichiers

| Fichier | Role |
|---|---|
| `src/app/AppShell.tsx` | Racine du router, monte TenantProvider + tous les providers tenant-scoped. |
| `src/app/contexts/TenantContext.tsx` | Context tenant : liste des tenants accessibles, tenant courant (resolu depuis l'URL), role, helpers (`createTenant`, `createSubTenant`, `acceptInvitation`, `withTenant`), flag `isSuperAdmin`. |
| `src/app/components/tenant/TenantAwareLayout.tsx` | Layout des routes `/t/:tenantSlug/*`. Verifie auth + membership. |
| `src/app/components/tenant/TenantPicker.tsx` | Page `/tenants` : liste des tenants directs + sous-tenants herites. |
| `src/app/components/tenant/TenantOnboarding.tsx` | Page `/tenants/new` : wizard de creation de tenant racine. |
| `src/app/components/tenant/AcceptInvitation.tsx` | Page `/invitations/:token` : accept invitation flow. |
| `src/app/components/dashboard/DashboardTenantMembers.tsx` | Dashboard > Membres (liste + invitations). |
| `src/app/components/dashboard/DashboardTenantSpaces.tsx` | Dashboard > Sous-espaces (CRUD sous-tenants). |

### Routes

```
/shop/:slug                          → boutique publique anonyme
/                                    → redirection /tenants
/reset-password                      → auth reset
/tenants                             → picker
/tenants/new                         → onboarding
/invitations/:token                  → accept invitation
/t/:tenantSlug/                      → chat home
/t/:tenantSlug/product/:id           → fiche produit
/t/:tenantSlug/personalization/:id   → personnalisation
/t/:tenantSlug/dashboard/            → profil
/t/:tenantSlug/dashboard/quotes      → devis (et toutes les autres vues dashboard)
/t/:tenantSlug/dashboard/members     → gestion membres      (v3)
/t/:tenantSlug/dashboard/spaces      → gestion sous-tenants  (v3)
/t/:tenantSlug/dashboard/admin/pim   → admin PIM (superadmin)
```

### Helper `withTenant(payload)`

Utilise dans TOUS les `supabase.from(...).insert(withTenant({...}))` des contextes data (ClientsContext, LibraryContext, ShopsContext, QuoteTemplatesContext, etc.). **A propager en phase 2** (les contextes n'ont pas encore ete migres vers tenant-scoped dans la phase 1).

---

## 4. Ce qui reste (phase 2+)

### Phase 2 — Propagation tenant_id dans les contextes data
- [ ] `ClientsContext` : filtrer par `currentTenant.id`, utiliser `withTenant()` a l'insert
- [ ] `LibraryContext` : idem
- [ ] `ShopsContext` : idem
- [ ] `ConversationContext` : idem (+ denormaliser `tenant_id` a l'insert sinon conversations hors tenant = invisibles)
- [ ] `QuoteTemplatesContext` : idem
- [ ] `CartContext` : pas de DB → rien a changer
- [ ] `PublicShop` : la route `/shop/:slug` reste anonyme, mais les queries doivent respecter la RLS publique (shops status='published'). A valider.

### Phase 3 — PIM pipeline effectif
- [ ] Edge function `pim-ingest` (Deno) : Clariprint + Claude enrichment
- [ ] UI superadmin : liste `pim_candidates` avec apercu, boutons valider/rejeter/fusionner
- [ ] Auto-subscription par defaut : a la creation d'un tenant, souscrire aux gammes "de base" (cartes visite, flyers) pour que l'espace soit utilisable immediatement
- [ ] UI tenant : page "Gammes actives" dans Dashboard > Preferences pour choisir les gammes exposees

### Phase 4 — Onboarding polish
- [ ] Edge function d'envoi d'email pour les invitations (Resend, SendGrid ou Supabase built-in)
- [ ] SSO SAML/OIDC pour les tenants Enterprise (Supabase Auth Pro)
- [ ] Custom domain par tenant (table `tenant_domains` + resolution par hostname)
- [ ] Billing Stripe par tenant (un plan = un customer Stripe)

### Phase 5 — Tests d'etancheite RLS
- [ ] Script SQL de test : creer 3 tenants, des users dans chaque, verifier qu'aucun cross-access n'est possible via direct query ou via Realtime subscription
- [ ] CI : run les migrations + tests RLS sur un projet Supabase "staging"

---

## 5. Ce qu'Arnaud doit faire avant que je continue

1. **Creer le nouveau projet Supabase** pour Beta 3 (plan gratuit OK pour demarrer). Noter :
   - `projectId` (ex: `abcdefg123456789`)
   - `anon key`
2. **Appliquer les 5 migrations v3** dans l'ordre (via SQL Editor du nouveau projet).
3. **Me fournir le projectId + anon key** pour que je les mette dans `utils/supabase/info.tsx`.
4. **Generer un Personal Access Token** Supabase (temporaire, tu le revoques apres) pour que je deploie les edge functions sur le nouveau projet.
5. Eventuellement : **promouvoir ton user en superadmin** apres avoir signe-up sur v3, via :
   ```sql
   select public.bootstrap_magrit_admin('<ton-user-uuid>');
   ```

---

## 6. Ce qui ne bouge pas

- Beta 1 (`Magritoff/`, branche `main`, port **5173**) — production actuelle, intouchable
- Beta 2 (`Magritoff-v2/`, branche `design/v2`, port **5174**) — demo en cours, intouchable
- Projet Supabase `jynxrpzwgzrrfuooputw` — intouche par v3
