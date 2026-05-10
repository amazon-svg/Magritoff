# Magrit — Project Context (BMAD persistent facts)

> **À lire en premier.** Ce document est chargé automatiquement par les agents BMAD au démarrage de chaque session (cf. `persistent_facts: ["file:{project-root}/**/project-context.md"]` dans tous les `customize.toml`).
>
> **Source authoritative :** `~/Downloads/CONTEXT_Magrit_IA.md` (maintenu par Arnaud, plus exhaustif). Ce fichier en est la **synthèse opérationnelle pour les agents BMAD** (focus : règles, conventions, états de version, identifiants techniques, **PAS** la stratégie commerciale détaillée).
>
> **Dernière mise à jour :** 2026-05-10 (post Sprint 3 / Epic 1 partiel).
> **Maintenu par :** Arnaud Mazon — PDG AGE Développement — `arnaud@age-services.fr`.
> **Langue de travail :** français (livrables, code commits, variables métier).

---

## 1. Vision projet en 1 paragraphe

**Magrit IA** est une plateforme SaaS B2B web-to-print française, copilote intelligent qui combine **(a) moteur de calcul de prix Clariprint** (déterministe, propriété d'Expert Solutions, sous licence exclusive AGE Dvt. pendant le POC) + **(b) couche IA Anthropic** (Sonnet 4.5 raisonnement / Haiku 4.5 génération rapide). Persona primaire : **l'imprimeur Pro** (producteur, détenteur des paramètres parc machines qui rendent toute la promesse possible). Persona secondaire : **acheteur B2B** (client de l'imprimeur, accède via boutique privée). Persona tertiaire : **W2P pure player** (Marc Tessier — usage long terme via API CMS V2+).

## 2. Structure juridique et gouvernance

- **AGE Développement (AGE Dvt.)** = holding/incubateur. Magrit IA est un projet porté par AGE Dvt., destiné à devenir **Magrit SAS** au déclenchement Phase 2 capitalistique (3 conditions : MRR ≥ 5 000 €/mois sur 3 mois consécutifs + ≥ 2 clients payants + maturité technique).
- **AGE Services** = BU AGE Dvt., **projet frère** de Magrit (P&L distincts). Agence IA intégratrice de technos IA pour entreprises moyennes/grosses, **intégrateur de Magrit** pour les projets clients qui demandent custom au-delà de l'usage standard.
- **Expert Solutions** = éditeur du moteur Clariprint, **co-fondateur de la future Magrit SAS**. Sous licence exclusive AGE Dvt. pour la France pendant le POC. Partenaires opérationnels : Laurent Rebière (100 % dédié), Xavier Péchoultres (disponibilité partielle).
- **Altavia** — **PAS investisseur Magrit** (recalibré 2026-05-08). C'est uniquement un client de Expert Solutions. À voir plus tard si Magrit les intéresse.
- **Sidney Palti** — exclu par défaut de toutes distributions, mailings, contributions opérationnelles Magrit. Ne pas l'inclure sauf mention explicite d'Arnaud.

## 3. Architecture technique

### 3.1 Repos et branches

- **Frontend / app principale** : `amazon-svg/Magritoff` sur GitHub (1 seul repo, multiples branches betas).
- **Branches actives** :
  - `main` (B1, prod, port 5173) — **ne pas toucher**
  - `design/v2` (B2, refonte design)
  - `beta/v3` (B3, multi-tenant initial, Supabase mort)
  - `beta/v4` (**B4, port 5176**, dossier local `/Users/arnaudmazon/Documents/AGE/Projet formateur /Claude code/Magritoff-v4/`) — démo client cible 2026-05-23
  - `beta/v5` (**B5, port 5177**, dossier local `/Users/arnaudmazon/Documents/Claude/BMAD/Magrit/`) — itération **e-shop v1.1**, sprint Epic 1 partiel livré
- **Branche héritée notable** : `design/v2` (pivot `/shop/:slug` vers portail B2B corporate, design tokens dans `.design-handoff/`).

### 3.2 Stack technique verrouillée

| Couche | Choix |
|---|---|
| Frontend bundler | **Vite 6** (ne pas migrer en v1.1) |
| Frontend framework | **React 18** (pas 19, boring technology) |
| Language | **TypeScript** strict |
| CSS | **Tailwind v4** + shadcn/ui (Radix sous-jacent) |
| Backend / DB / Auth / Storage | **Supabase** (project `ightkxebexuzfjdbpsdg` pour B4+B5, partagé avec RLS strict) |
| Edge functions | Supabase Edge Functions (Deno), déploiement via `supabase functions deploy <name> --project-ref ightkxebexuzfjdbpsdg` |
| **LLM raisonnement** | **`claude-sonnet-4-5-20250929`** (upgrade depuis Sonnet 4 le 2026-05-09) |
| **LLM génération rapide** | **`claude-haiku-4-5-20251001`** |
| Wrapper LLM unifié (post S1.1 + S1.5) | `supabase/functions/_shared/anthropicClient.ts` — `anthropicComplete()` + `anthropicCompleteStructured(zodSchema)` + `anthropicStream()` (SSE avec parser tee + tracking auto). Lookup secret multi-casing `ANTHROPIC_API_KEY` / `Magrit3` / `MAGRIT3` / `MAGRIT` |
| Mockup engine SVG→PNG (post S4.1b) | `npm:@resvg/resvg-wasm@2.6.2` (pure WASM, compat Deno Deploy). Fonts Inter/Bitter/JetBrains Mono incluses. Init lazy via fetch unpkg. **Pivot vs Architecture §4.3** qui spec sharp+svgdom (incompat Deno Deploy) |
| Tests unit/integration | Vitest |
| E2E automatisé | **Claude in Chrome** via plugin MCP, sur `data-testid` stables |
| CI/CD | GitHub Actions |
| Tracking LLM | Table `llm_usage_events` (E7.1 livré) |

### 3.3 Multi-tenancy

- Architecture multi-tenants stricte dès le départ (US-NEW-04 P0).
- Chaque tenant = espace isolé. Tables tenant-scoped : `tenants`, `tenant_members`, `tenant_invitations`, `tenant_member_events`, `tenant_slug_history`, `tenant_gamme_subscriptions`, `tenant_orders` (S1.4), `tenant_order_items`, `tenant_order_status_events`, `shops`, `llm_usage_events`.
- Routes tenant : `/t/:slug/dashboard`, `/t/:slug/atelier`, `/t/:slug/dashboard/users`.
- Boutique publique tenant : `/shop/:slug` (a pivoté vers portail B2B corporate).
- Création tenant : `/tenants/new` (wizard avec validation SIREN INSEE + email pro).
- Helpers RLS canoniques (à utiliser dans toute nouvelle policy) : `public.is_super_admin()`, `public.user_role_in_tenant(tenant_id)`, `public.current_user_tenant_ids()`, `public.current_user_can_access_shop(shop_id)`.

### 3.4 IA conversationnelle (renommée Magrit, pas Marguerite)

**Décision Arnaud 2026-05-08 :** l'agent IA conversationnel s'appelle **Magrit** partout (pas Marguerite). Anti-confusion + facilité prononciation anglo-saxonne. Migration progressive du code legacy (testid `marguerite-*` à migrer en `magrit-*` opportunément).

Deux modes :

- **Mode Ouvert (Extrapolation)** — disponible dès Freemium. L'IA génère des propositions même quand la demande est vague, avec bandeau "🌿 Hypothèses".
- **Mode Strict** — disponible Freemium aussi (évolution PRD v1.1 vs Vision Produit initiale). L'IA exécute la commande précise + pose des questions de clarification ciblées ("❓ ...").

Contraintes techniques :

- **Limite 25 paramètres par prompt** (story 2.4 P0, FR43) — appliquée par le wrapper `AnthropicClient`.
- **Validation JSON schéma strict** (story 1.3 P0, FR42) — appliquée par `anthropicCompleteStructured(zodSchema)`.
- Troncature au-delà de 25 messages dans une conversation.
- Affichage progressif (story 3.1 P0, streaming SSE livré E3.1+E3.2, flag `ENABLE_STREAMING_CHAT=true` en B4/B5).

### 3.5 Concept « Prix marché » (décision 2026-05-09, structurant)

Le **Prix marché** est le tier de prix toujours disponible quand Clariprint n'est pas en mesure de fournir un prix réel.

- **v1.0 / v1.1 (aujourd'hui) :** estimation heuristique via `estimateMarketPriceHT()` dans `src/app/utils/priceResolver.ts`.
- **V2+ (panel Magrit) :** prix calculé par agrégat anonymisé des parcs imprimeurs Pro souscrits, alimenté par Clariprint.
- **UI :** badge "⚠️ Prix marché" avec sous-texte "prix réel Clariprint à venir".
- **Hiérarchie canonique** (`resolvePrice`) : `clariprint > library_cached > prix_marche > zero`.
- **Composants concernés (v1.1) :** `PortalProduct`, `PortalCart`, `PricingPanel`, `ProductCard` (ce dernier à DRY-er ultérieurement).

### 3.6 Anomalies Clariprint connues

Constatées en prod, doivent être filtrées défensivement par `validateClariprintResponse()` (S0.2) avant exposition utilisateur :

1. **Prix négatifs** retournés par le moteur (-1,2 € observé) sur certaines configurations.
2. **Valeurs `undefined`** dans les payloads.
3. **Produits légalement requis manquants** dans les réponses catalogue.

Toute interaction avec Clariprint passe par le pattern `ClariprintAdapter` (S1.2) — pas de `fetch` direct depuis les composants ou endpoints.

## 4. Convention `data-testid` (E7.7 livré)

### 4.1 Format

```
data-testid="<scope>-<element>[-<modifier>]"
```

- `scope` ∈ {`tenant`, `user`, `shop`, `magrit`, `auth`, `quote`, `usage`, `nav`, `order` (S1.4), `mockup` (S4.3 livré : `mockup-product-image`, `mockup-product-image-skeleton`, `mockup-product-image-img`, `mockup-product-image-fallback`)}
- `element` ∈ {`btn`, `input`, `select`, `modal`, `banner`, `row`, `card`, `link`, `tab`, `table`, `toggle`, `radio`, `checkbox`}
- `modifier` : nom métier ou état, optionnel

**⚠️ Pas de scope `marguerite`** — renommé `magrit` (cf. §3.4).

### 4.2 Listes et collections

```jsx
<tr data-testid="user-row" data-user-id={user.id}>
  <td><button data-testid="user-remove-btn">Retirer</button></td>
</tr>
```

### 4.3 Source de vérité

Tous les testid centralisés dans `src/app/lib/testIds.ts` (objet `TEST_IDS as const`). **Ne jamais inventer un testid** sans le déclarer dans ce fichier.

### 4.4 Stabilité

Une fois publié, un `data-testid` ne change plus à la légère (contrat avec les cahiers de tests Notion). Renommage = dual-tag pendant 1 sprint, mise à jour Notion, suppression sprint suivant.

### 4.5 Production

Les `data-testid` sont **conservés en production** (overhead négligeable, indispensables pour les E2E IA via Claude in Chrome).

## 5. Cahiers de tests (DoD globale projet)

**Règle projet (validée par Arnaud 2026-05-08) :** toute story livrée Magrit ajoute **au moins 1 cas de test** à la DB Notion 🧪 Cahiers de tests fonctionnels Magrit (https://www.notion.so/7e576e695d504cc9a32ead92f4dde01c), au format TF-XX standard.

Format obligatoire : Titre, Parcours (P00-P11), Persona, Précondition, Étapes numérotées, Résultat attendu, Hints DOM (testid ou structure), URL de départ, Type d'exécution (`Manuel humain` / `IA Chrome` / `SQL DB`), Données de test, Statut.

**Jouabilité dual** : tout cas TF doit être exécutable indifféremment par un humain ou par Claude in Chrome via plugin MCP. Invariant non-négociable.

## 6. Parcours utilisateur P00 → P11

| Code | Parcours | Statut instrumentation |
|---|---|---|
| P00 | Création espace tenant (`/tenants/new`, validation SIREN) | E7.7 livré |
| P01 | Onboarding premier login (`/login`, sidebar dashboard) | E7.7 livré |
| P02 | Gestion utilisateurs (table users, invitations) | E7.7 livré |
| P03 | Droits granulaires (modale permissions, scope `magrit_full` / `shop_only`) | E7.7 livré |
| P04 | Renommer espace (settings tenant) | E7.7 livré |
| P05 | Magrit chat — Mode Ouvert (chat, bandeau hypothèses) | E7.7 livré |
| P06 | Magrit chat — Mode Strict (clarifications ciblées) | E7.7 livré |
| P07 | Quotas freemium (compteur sidebar, ≤ 10 devis/mois) | E7.7 livré |
| P08 | Affichage devis (résultat prix, lignes ajustables) | E7.7 livré |
| P09 | Boutique tenant (`/shop/:slug` portail B2B corporate) | E7.7 livré |
| P10 | Différé — dépend de stories Sprint 2 (E9.5) | Hint à venir |
| P11 | Streaming progressif — différé (E3.1 / E3.2) | Hint à venir |

## 7. Pricing V1 — 6 tiers

| Tier | Prix mensuel HT | Setup HT | Engagement | Cible | Quota devis/mois | Quota boutiques/tenant |
|---|---|---|---|---|---|---|
| **Freemium** | 0 € | 0 € | Aucun | Lead-gen + canal pub | 10 | 0 |
| **Découverte** | 90 € | 0 € | Mensuel | Indépendants, freelances | 50 | 0 |
| **Starter** | 390 € | 1 900 € | 12 mois | Petit imprimeur 2-3 commerciaux | 250 | 3 |
| **Pro ★** | 990 € | 4 900 € | 12 mois | Imprimeur industriel / W2P — **tier d'ancrage** | 1 500 | 10 |
| **Business** | 2 490 € | 9 900 € | 24 mois | Groupe multi-sites, franchise | 4 000 | 30 |
| **Enterprise** | dès 4 900 € + modules | dès 25 000 € | 36 mois | Grand compte (Cimpress-scale) | 10 000 (négociable) | 50 |

Quotas devis = fair-use mensuel (calendaire). Quotas boutiques = plafond strict tier.

## 8. Conventions opérationnelles à respecter

### 8.1 Code et commits

- TypeScript strict, ESLint/Prettier configurés.
- **Format messages commit** : `feat|fix|chore|test|docs(v4|v5): description courte` puis paragraphe optionnel.
- **PAS d'apostrophes** dans les messages de commit (HEREDOC pose problème). Préférer `"d autres"` ou paraphraser.
- Un commit = une story / un fix (atomique).
- **Confirmation avant push systématique** (sauf accord blanket sur le sprint).

### 8.2 Process Arnaud

- Densité d'information appréciée — prose dense argumentée, pas listes à puces excessives.
- Pour livrables diffusables : format Word (page de garde, en-têtes/pieds, code couleur — bleu titres, rouge points critiques, orange évolutions à traiter).
- Vérifier l'état avant de créer (Notion, fichiers, repos) — éviter les doublons.
- Toujours fournir les URLs quand une action externe est attendue.
- **Franchise radicale appréciée** sur les risques et incohérences. Argumenter contre Arnaud plutôt qu'aller dans son sens par défaut.

### 8.3 Workflow BMAD strict

- **Phase Plan (PRD)** : agent **John** (PM) 📋
- **Phase Solutioning (Architecture, Epics)** : agent **Winston** (Architect) 🏗️
- **Phase Implementation (code, tests)** : agent **Dev** 💻 — produire un story document `_bmad-output/implementation-artifacts/story-{X}.md` à chaque story
- **Phase Analysis (project context, briefs)** : agent **Mary** (Analyst) 📊 ou **Paige** (Tech Writer) 📚
- **Support transverse** : skill `bmad-help` invoquable depuis n'importe quel agent

## 9. Fonctions reportées (dépendent de Clariprint)

Décision Arnaud 2026-05-06 : reportées au prochain bloc Clariprint :

- **E3.4** UX simplifiée saisie données imprimeur Freemium (recoupe E6.2 + T-06.1)
- **E6.2** Saisie simplifiée Pro
- **E7.3** Monitoring usage / quotas / coûts (dashboard ops)
- **T-01..T-03** Corporate Portal / Franchise / Sync eCommerce (≥ 1 sprint chacun)

## 10. Identifiants & accès

- **User principal** : `a.mazon@me.com` (Arnaud)
  - Membre direct des tenants : `imprimerie-ipa`, `Boutique 1`
  - **Superadmin Magrit** : oui (membre `magrit-root` via `bootstrap_magrit_admin`)
- **PAT Supabase** : à régénérer à chaque session (l'ancien est révoqué). Procédure : https://supabase.com/dashboard/account/tokens
- **Projet Supabase actif** : `ightkxebexuzfjdbpsdg` (B4 + B5 partagés)
- **Secrets edge functions** : `MAGRIT3` (Anthropic), `RESEND_API_KEY` (E9.5), `CLARIPRINT_HOST/LOGIN/PASSWORD`, `SUPABASE_*` (auto)

## 11. Documents canoniques de référence

| Document | Localisation | Rôle |
|---|---|---|
| **Ce fichier** (`project-context.md`) | `docs/project-context.md` (racine repo) | **Persistent facts BMAD** — chargé automatiquement par les agents |
| `CONTEXT_Magrit_IA.md` | `~/Downloads/CONTEXT_Magrit_IA.md` | Onboarding maître exhaustif (maintenu par Arnaud) |
| `prd.md` | `_bmad-output/planning-artifacts/prd.md` | PRD v1.1 (1079 lignes, 50 FR + 28 NFR) |
| `architecture.md` | `_bmad-output/planning-artifacts/architecture.md` | Architecture v1.1 (15 ADR) |
| `epics.md` | `_bmad-output/planning-artifacts/epics.md` | 7 epics, 32 stories |
| `implementation-readiness-report-2026-05-09.md` | `_bmad-output/planning-artifacts/` | Validation transverse GO + warnings |
| `PRICE_SOURCES.md` | `docs/PRICE_SOURCES.md` | Audit S0.2 sources de prix |
| `SPRINT_HANDOFF.md` | racine repo | État dev, mis à jour à chaque sprint |
| `ARCHITECTURE.md` | racine repo (1206 lignes) | État technique pré-v1.1, référence générale |
| Story documents | `_bmad-output/implementation-artifacts/story-{X}.md` | **Un par story livrée** (créés rétroactivement 2026-05-10) |
| Backlog Notion | https://www.notion.so/4d2e2ea106914ce5a69728fdb67dfddd | Sprint Board officiel |
| Cahiers de tests Notion | https://www.notion.so/7e576e695d504cc9a32ead92f4dde01c | DoD projet, jouable IA + humain |
| Vision Produit | https://drive.google.com/file/d/1UjEd6IrBsxxV1AVKOelAdly6HDFH0tti | Source backlog 31 stories |

## 12. Pour démarrer une nouvelle session BMAD

Premier message à coller à un agent BMAD :

```
Je reprends Magrit v1.1. Lis docs/project-context.md (chargé auto par 
persistent_facts) + SPRINT_HANDOFF.md pour l'état dev courant. Aujourd'hui 
je veux travailler sur : [story / fonctionnalité / question].
```

L'agent doit alors :
1. Charger `docs/project-context.md` (auto via `persistent_facts`).
2. Lire `SPRINT_HANDOFF.md` pour l'état actuel.
3. Lire la (les) mémoire(s) projet pertinente(s) dans `~/.claude/projects/-Users-arnaudmazon/memory/`.
4. Vérifier l'état git du repo (`git status`, `git log --oneline -5`).
5. Demander un nouveau PAT Supabase si déploiement edge function nécessaire.
