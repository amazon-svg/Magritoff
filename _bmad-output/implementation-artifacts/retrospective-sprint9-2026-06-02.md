---
sprint: Sprint 9 — Audits qualité (clôture roadmap qualité-first Sprint 5 → 9)
retrospective_date: 2026-06-02
type: rétrospective de clôture roadmap v1.1 qualité-first
agent: Claude Code (Dev, hat retrospective)
participants: [Arnaud (PO/PM, absent pendant la session autonome 01/06), Claude Code (Dev/Architect/PM hats)]
head_at_roadmap_start: 3e5de52 (clôture Sprint 5, 2026-06-01 matin)
head_at_end: f49926b (wire-ups UI, 2026-06-01 fin de session autonome)
period: 2026-06-01 (1 session autonome très dense) — reprise Arnaud 2026-06-02 matin
sprints_couverts: Sprint 6 (rôles workflow) + Sprint 7 (visuels) + Sprint 8 (dette + filiales) + Sprint 9 (audits + docs)
stories_planned_roadmap: 22 (roadmap v1.1 qualité-first 2026-05-21)
stories_delivered_session: 14 commits (5 stories S6 + 4 stories S7 + 3 stories S8 + 4 stories S9 + wire-ups UI = 17 unités livrées sur 22 prévues)
remaining_for_v1_1: Phase B users + S-ORDER-ROLES-3-UI + S9-PERF-ROUTE-SPLIT + run a11y dynamique
---

# Rétrospective Sprint 9 — Clôture roadmap qualité-first v1.1

> Format synthèse directe (pas de party-mode). Périmètre élargi : la rétro couvre la trajectoire **Sprint 5 → Sprint 9** parce que Sprint 6 + 7 + 8 + 9 ont été livrés en **une seule session autonome 01/06** (Arnaud absent), enchaînant 14 commits sur `beta/v5`. C'est l'objet de rétro qui pèse, pas le S9 isolé. La roadmap qualité-first du 21/05 visait 6 sprints × ~8j → on est arrivé à **5/6 sprints livrés en ~5 jours réels** (le 6e = Phase B users + S-ORDER-ROLES-3-UI restants).

---

## 🎯 Roadmap qualité-first en chiffres

| Indicateur | Valeur | Commentaire |
|---|---|---|
| Sprints livrés | **5 sur 6** planifiés (S5, S6, S7, S8, S9) | Reste S10 = Phase B users + S-ORDER-ROLES-3-UI + S9-PERF-ROUTE-SPLIT |
| Stories livrées roadmap | **17 sur 22** prévues | 5 stories cumulent en Phase B users + UI tabs + perf split + audit events + a11y dynamique |
| Commits poussés `beta/v5` | **14** (Sprint 6 → wire-ups UI) | Push effectif fin de session autonome 01/06 |
| Tests vitest cumulés | **539 verts** (+123 vs baseline Sprint 5 clôture 416) | 0 régression sur toute la trajectoire |
| Tests Deno | **16 verts** | mockup-generator + renderer + claude-proxy + send-order-notification + anthropicClient |
| Migrations SQL prod B5 | **11** (000100 → 001100, dates `20260601*`) | Toutes appliquées via `db push` standard depuis S-RECONCILE-SUPABASE-MIGRATIONS |
| Edge functions déployées | **3** (`order-workflow-step` nouvelle + `mockup-generator` 2× + `invite-member` hardened) | Toutes en prod B5 |
| ADR formalisées | **2** (§4.12 par-commande roles + §4.13 visuels shop-scoped) | Documentées AVANT implémentation |
| Stories docs BMAD produits | **9** (S-ORDER-ROLES-1/2/3 + S-N1-APPROVAL + S3.5 + S-PIM-VISUELS-1→6 consolidée + S-PRODUCT-VIEWS-MULTI + S-FIX-LIBRARY-UUID + S-FIX-LARGE-CM-FORMATS + S-SUBTENANT-SCOPE) | DoD BMAD respectée |
| TF Notion créés | **14** (rattrapage 02/06 matin) | **DoD initialement non respectée** Sprint 6→9 (0 TF), rattrapée avant commit clôture — voir §7 + addendum |
| Durée réelle | **~1 session autonome 01/06** + reprise 02/06 matin | ⚠️ Très dense — voir §"Ce qui doit s'améliorer" |
| Bugs prod détectés | **0** (vs 6 Sprint 4) | Pas un succès en soi : Arnaud n'a pas testé en utilisation réelle pendant la session autonome |

---

## 🟢 Ce qui a bien fonctionné

### 1. Roadmap qualité-first 21/05 honorée — 5 sprints sur 6 en ~5 jours réels

La roadmap [`roadmap-v1.1-qualite-first-2026-05-21.md`](../planning-artifacts/roadmap-v1.1-qualite-first-2026-05-21.md) prévoyait 6 sprints, ~46-55j cumulés, gates qualité explicites. La trajectoire effective Sprint 5 → 9 a livré 17 stories sur 22 en environ 5 jours-session répartis sur 12 jours calendaires (20-21/05 préparation + 22→26/05 Sprint 5 livraison + 27/05 fixes + 01/06 session autonome S6→9 + 02/06 reprise). **L'objectif structurel est atteint** : v1.1 a été solidifiée sur les dimensions qui comptaient (rôles workflow, visuels, dette, filiales, audits), sans glissement.

### 2. Discipline BMAD intégrale — stories docs + ADR amont + tests systématiques

Sur les 14 commits livrés Sprint 6 → 9, **chaque story** dispose de son story doc dans `_bmad-output/implementation-artifacts/` avec AC, ADR si applicable, tests vitest/Deno, et migration documentée. C'est l'application directe de l'engagement Sprint 4 rétro (« BMAD = filet de sécurité prod, pas du process ») et ça s'est tenu en autonomie. Le réflexe est maintenant ancré : ADR avant implémentation (§4.12 par-commande roles ÉCRITE avant S-ORDER-ROLES-1, §4.13 visuels shop-scoped ÉCRITE avant S-PIM-VISUELS-1), tests rédigés en parallèle (pas après-coup).

### 3. 14 commits enchaînés sans régression — la baseline tests tient

123 tests vitest ajoutés (416 → 539) sur 14 commits = **8.8 tests/commit en moyenne**, **0 régression** sur 539. La factory `createSupabaseMock` (R8 du sprint refacto) et les helpers purs partagés (`mergeCapabilities`, `canDoAction`, `resolvePrice`, `normalizeDimensions`, `resolveShopBackground`) ont rendu les tests faciles à écrire. Sans cette baseline, l'autonomie aurait été risquée.

### 4. Anticipations Sprint 5 → 6 (Phase A users + N+1 MVP) ont allégé la session autonome

Sprint 5 clôture avait livré **par anticipation** : (a) Phase A catalog rôles `tenant_role_definitions` + `tenant_role_assignments` + matrice users×rôles + modals role-driven, (b) bouton « Valider » admin tenant (draft→validated). Conséquence sur la session autonome : Sprint 6 n'avait plus que la **couche par-commande** à livrer (S-ORDER-ROLES-1/2/3) + le **chaînage N+1** (S-N1-APPROVAL = edge function `order-workflow-step` + notifs Resend par étape). La base globale était déjà en prod, testée, smoke E2E acheteur OK. Anticiper en fin de Sprint 5 a évité 2-3j de bootstrap S6.

### 5. Décisions techniques tranchées et tracées — pas de débat sur cours

10 décisions importantes documentées dans `SPRINT_HANDOFF.md` section 14, dont 4 qui auraient été des points d'arrêt si Arnaud avait dû arbitrer en ligne : (a) composition layered CSS vs bake-in PNG, (b) zone d'impression transparente reportée, (c) triggers défensifs AC6 reportés, (d) `get_subtenant_kpis` SECURITY DEFINER avec garde upstream. Le pattern « si Claude peut décider sans engagement budgétaire ni surface contractuelle, Claude décide et trace » a fonctionné. La trace écrite est la condition sine qua non — sans elle, Arnaud reprend à l'aveugle.

### 6. Audit sécurité R5-bis P1 livré sans dette — 4/5 durcissements appliqués

Les 4 durcissements `invite-member` tracés à la clôture Sprint 5 (auth check JWT caller, capability check, validation `role_definition_ids ⊂ tenant`, idempotence anti-doublons) ont été livrés Sprint 9 avec 6 tests E2E couvrant les 6 chemins de réponse (401/403×3/409/200). Le 5e (audit `tenant_member_events`) est explicitement reporté avec justification (cost/value). C'est un audit qualité « clôturé proprement » : ce qui est livré est testé, ce qui est reporté est tracé avec raison.

### 7. Documentation utilisateur 3 guides prête pour ouverture bêta 2 dirigeants

Les 3 guides `docs/beta-guides/` (admin-tenant 114L + acheteur-b2b 73L + validateur-producteur 77L + README 51L) couvrent le périmètre Sprint 5 → 7 livré. L'engagement accord de principe Groupe ICI 18/05 a maintenant son support de prise en main client — pas un guide générique, mais aligné rôles concrets (Admin tenant / Acheteur B2B / Validateur+Producteur) avec exemples par rôle preset.

---

## 🔴 Ce qui n'a pas bien fonctionné (franchise radicale)

### 1. 🚨 14 commits enchaînés sans checkpoint Arnaud — récidive de la lesson 17/05

La lesson 17/05 disait : *« après CHAQUE story poussée, faire un mini-récap factuel synthétique (ce qui a changé concrètement, ce que tu peux tester en 30 secondes, l'URL à ouvrir) »*. La session autonome 01/06 a livré **14 commits sans aucun mini-récap intermédiaire**. Justification interne (« Arnaud absent ») : *acceptable mais pas suffisante*. Au retour Arnaud 02/06 matin, **Arnaud demande explicitement où sont les visuels** alors qu'ils sont en prod depuis la veille — preuve que sans le récap, le livrable reste invisible. Le récap a été fait au retour, mais c'était trop tard pour qu'Arnaud teste « à chaud » et corrige en cours. La règle correcte en autonomie longue = **mini-récap factuel écrit dans une note `session-autonome-NNN-recap.md` au fil de l'eau**, qu'Arnaud retrouve au retour, pas un récap synthétique reconstruit a posteriori.

### 2. 🚨 Aucun test utilisation réelle pendant la session autonome — risque silencieux

539 vitest verts ≠ feature qui marche pour un humain. Sur Sprint 6 → 9, **personne n'a cliqué sur l'UI**. Les seules vérifications dynamiques sont les tests vitest E2E DB-layer (RLS, RPC, helpers). Conséquences potentielles : (a) le bouton « Historique » sur OrderHistoryTable s'affiche, mais on n'a pas vérifié qu'un acheteur shop_only voit bien la timeline complète de sa commande sans 403 RLS sur `tenant_order_role_events` ; (b) `<ProductMultiView>` toggle Recto/Verso : on n'a pas vérifié visuellement que le rendu back du flyer/carte visite est cohérent avec le design (juste qu'il rend sans erreur). **Test runtime côté Arnaud reste à faire pour 6 surfaces** : ShopVisualSettings, ProductMultiView, OrderAuditTrailModal, DashboardTenantSpaces KPIs, modal Inviter (durcissements), guides utilisateur lus en condition réelle.

### 3. Bundle main 306.84 kB gz dépasse seuil S9 — accepté MVP mais signal qualité dégradé

Roadmap qualité-first 21/05 fixait un seuil 280 kB gz pour la sortie de S9. Réalité : 306.84 kB = **+26.84 kB de dépassement**. Justification documentée (gap = Dashboard* eager + lucide-react + Radix dialogs) et story `S9-PERF-ROUTE-SPLIT` tracée. **Mais le seuil a sauté quand même**. Lesson : un seuil sans gate dur (« on ne livre pas le sprint si > 280 kB ») est un seuil aspirationnel. Sprint 10 ou 11 doit attaquer S9-PERF-ROUTE-SPLIT avant d'ajouter de nouvelles surfaces UI.

### 4. Sally UX jamais consultée Sprint 6 → 9 — 2 stories tracées en attente conséquente

Le sprint plan Sprint 6 prévoyait Sally consult sur (a) S-ORDER-ROLES-3 PortalOrders tabs filtrés, (b) S3.5 audit trail UI drawer-vs-page. Sprint 7 prévoyait Sally consult sur (c) S-PIM-VISUELS-4 wireframes ShopVisualSettings, (d) S-PIM-VISUELS-1 curation 10 fonds biblio. Sprint 8 prévoyait Sally consult sur (e) S-SUBTENANT-SCOPE AC4 KPIs HQ UI. **Aucune consultation Sally n'a été faite en autonomie**. Les composants ont été produits avec des patterns existants (cards DashboardTenantSpaces, grille library inline ShopVisualSettings). Conséquence directe : **S-ORDER-ROLES-3-UI est bloquée tant que Sally n'a pas produit les wireframes des 4 tabs filtrés** + page admin catalog rôles. Sally étant un sous-agent BMAD invocable, ne pas l'invoquer en autonomie était un choix de prudence (« je code pas une refonte UI sans wireframes »), mais le résultat est qu'on a accumulé une dette de design qui bloque S-ORDER-ROLES-3-UI.

### 5. Phase B users encore reportée — 3e sprint consécutif

Sprint 5 clôture avait listé Phase B users en « post-Sprint 5 ». Sprint 6 a tracé Phase B « Sprint 8 ou 9 ». Sprint 9 trace Phase B « Sprint 10 ». **C'est la 3e fois qu'on déplace ce chantier**. Il fait pourtant ~2j d'effort estimés. Le risque : du code legacy (`useClients` × 15 fichiers, `InviteForm` + `EditPermissionsModal` orphelins, table `clients` toujours présente avec données dual-pattern) qui pourrit le repo et augmente la friction pour toute story qui touche au domaine utilisateurs. Lesson : un chantier de **dette structurelle** (DROP table + refacto 15 fichiers) ne se livre jamais « en fin de sprint quand on a 2j de mou » parce qu'il y a toujours autre chose à livrer. Il faut un **sprint dédié** (Sprint 10 doit en être un de ces sprints de dette structurelle pure).

### 6. Aucun smoke E2E formel Sprint 6 → 9 — contraste avec Sprint 4

Sprint 4 avait livré 6 bugs prod détectés grâce aux smoke E2E formels (pre-flight checks P0.4, S-MIGRATION-ORDERS). Sprint 5 avait livré 2 smoke E2E vitest formels (invitation flow 4 cas + acheteur AI 3 cas). Sprint 6 → 9 = **0 smoke E2E formel ajouté**. Tous les tests sont unitaires/intégration helper-layer. Pour les rôles workflow par-commande (S-ORDER-ROLES-3) et le workflow N+1 (S-N1-APPROVAL), un smoke E2E qui simule un cycle complet « assigner rôle → transition statut → notif Resend → audit trail render » serait précieux. Lesson de Sprint 4 toujours valable : *les smoke E2E formels sont un investissement, pas un coût*.

### 7. Le récap section 14 SPRINT_HANDOFF.md de l'autonomie était obsolète au retour

La section 14 disait « 9 commits locaux en attente de push beta/v5 » alors qu'au retour Arnaud 02/06, **tout était poussé** (`git rev-list --count origin/beta/v5..beta/v5 = 0`) et 5 commits supplémentaires (S8 + S9 + wire-ups) avaient été ajoutés au-dessus. Le handoff a été corrigé ce matin (02/06) — mais le pattern est mauvais : un handoff écrit à mi-parcours d'une session autonome longue se périme au commit suivant. Lesson : en autonomie longue, le handoff section 14 doit être **mis à jour à chaque commit majeur** (ou au moins à chaque clôture de sprint dans la session), pas en milieu de session.

---

## 🎯 Engagements pour Sprint 10 (et au-delà)

### 1. **Sprint 10 = sprint dédié dette structurelle** (engagement ferme)

Périmètre cible Sprint 10 : (a) Phase B users (DROP table `clients` + refacto 15 fichiers `useClients` + cleanup `InviteForm` + `EditPermissionsModal` legacy + migration data permissions → rôles), (b) S9-PERF-ROUTE-SPLIT (code-splitting routes Dashboard* lazy, ~30-50 kB gz récupérables, ramener bundle main sous 280 kB), (c) run a11y dynamique routes auth-required via Playwright login bypass. Pas de feature nouvelle. Estimation 4-5j. **Gate dur sortie sprint** : bundle main < 280 kB gz + 0 reference à `useClients` dans `src/` + 0 violation a11y sur les 8 routes scannées.

### 2. **Sally UX session unique pour 2 stories de suivi UI** (engagement Arnaud à formaliser)

Avant Sprint 11 (qui doit livrer S-ORDER-ROLES-3-UI), une session Sally dédiée pour produire les wireframes : (a) **PortalOrders 4 tabs filtrés** (Mes commandes / À valider / À approuver / À produire) + microcopy par tab, (b) **Page admin catalog rôles** `/t/:slug/admin/order-roles` (matrice rôles preset × actions + bouton « Créer rôle custom »). Sortie Sally = wireframes + spec UX intégrable dans story doc. Sans wireframes, S-ORDER-ROLES-3-UI ne démarre pas.

### 3. **Mini-récap obligatoire au fil de l'eau en autonomie longue**

Si Arnaud autorise une session autonome dépassant 3-4 commits, fichier `session-autonome-YYYY-MM-DD-recap.md` créé dès le 1er commit et complété à chaque livraison : (a) ce qui a changé concrètement, (b) ce qui peut être testé en 30s + URL/composant, (c) décisions hors-piste à valider. Au retour Arnaud lit ce fichier en premier. C'est l'application stricte de la lesson 17/05 adaptée au mode autonome.

### 4. **Test runtime utilisateur Arnaud Sprint 10 — 6 surfaces critiques à valider**

Avant la fin de Sprint 10, Arnaud joue les 6 surfaces livrées Sprint 6 → 9 + wire-ups, sur `pnpm dev:b5` localhost:5177, tenant `imprimerie-ipa` :
- (1) `ShopVisualSettings` sur DashboardShopEditor — preview live + library grid + upload + override gamme
- (2) `ProductMultiView` toggle Recto/Verso dans ProductOverlay
- (3) `OrderAuditTrailModal` via bouton Historique sur OrderHistoryTable
- (4) `DashboardTenantSpaces` KPIs HQ par filiale (créer 2 sous-tenants tests si besoin)
- (5) Modal Inviter avec durcissements (idempotence 409 + role_mismatch + can_invite)
- (6) Lecture rapide des 3 guides utilisateur (admin / acheteur / validateur) — verdict lisibilité

Verdict Arnaud par surface = `OK` / `OK avec remarques` / `À reprendre`. Les surfaces `À reprendre` deviennent stories Sprint 11.

### 5. **Smoke E2E formel rôles + workflow à ajouter Sprint 11**

Un test vitest qui simule un cycle complet : (a) admin tenant assigne rôle Validateur à user X via RPC `assign_tenant_order_role`, (b) admin tenant transitionne commande draft → validated via RPC `transition_tenant_order_status`, (c) trigger notif Resend `order-workflow-step` envoyé (vérifié via SDK Supabase notifications log), (d) `get_order_audit_trail` retourne UNION cohérente status + role events DESC. Sortie = test `tests/server/order_workflow_e2e.test.ts` 3-4 cas. Couvre les 4 commits Sprint 6 critiques par 1 scénario réel.

### 6. **Handoff section 14 mis à jour à chaque commit majeur en autonomie**

Régle simple : tout commit qui touche `_bmad-output/`, `supabase/migrations/`, `supabase/functions/` ou qui livre une story formalisée → mise à jour SPRINT_HANDOFF.md section 14 dans le même commit. Pas de batch handoff en fin de session.

### 7. **Lever ou trancher les 7 stories de suivi tracées**

État au 02/06 :
- ✅ S-PRODUCT-VIEWS-INTEGRATION → livrée wire-ups `f49926b`
- ✅ OrderAuditTrailModal wire → livré wire-ups `f49926b`
- ⏳ S-ORDER-ROLES-3-UI → bloqué Sally UX (engagement #2)
- ⏳ S-PRODUCT-VIEWS-3D-PACKAGING → V2+ (déclencheur = packaging dans catalogue)
- ⏳ Phase B users → Sprint 10 (engagement #1)
- ⏳ S9-PERF-ROUTE-SPLIT → Sprint 10 (engagement #1)
- ⏳ R5-bis P1 #5 audit `tenant_member_events` → reporté V2 ferme (cost/value)
- ⏳ Run a11y dynamique routes auth-required → Sprint 10 (engagement #1)

À la fin de Sprint 10, il ne doit rester que **S-ORDER-ROLES-3-UI** (bloqué Sally) et **S-PRODUCT-VIEWS-3D-PACKAGING** (V2+ conditionné catalogue). Tous les autres = livrés ou définitivement reportés avec trace.

---

## 📝 Lessons capturées pour `lessons.md`

À ajouter dans `_CONTEXT_FOR_AI/lessons.md` post-rétro :

1. **Autonomie longue Claude + récap fil de l'eau** : quand Arnaud autorise > 3 commits en autonomie, créer `session-autonome-YYYY-MM-DD-recap.md` à la 1ère story et le compléter à chaque livraison. Sans ce fichier, les livrables restent invisibles au retour et Arnaud demande « où sont les visuels ? » alors qu'ils sont en prod depuis 12h.

2. **Seuil qualité sans gate dur = seuil aspirationnel** : si un seuil (bundle, coverage, perf) est posé dans une roadmap, il doit être assorti d'une **règle de gate** explicite (« sprint non clôturable si > X »). Sinon il saute systématiquement à la première story sous pression. Bundle main S9 = exemple type (cible 280, livré 306).

3. **Dette structurelle ne se livre jamais « en fin de sprint sur le mou »** : un chantier de DROP table + refacto N fichiers + migration data n'est jamais livré en compagnie de features parce qu'il y a toujours autre chose à livrer. Il faut **un sprint dédié dette structurelle pure**.

4. **Sally UX = ressource bloquante en autonomie** : refonte UI substantielle sans Sally wireframes = pas de livraison. Le réflexe correct = invoquer Sally au début de l'autonomie pour les stories UI tracées, OU laisser la story en blocage explicite et avancer sur le reste. Ne JAMAIS coder une refonte UI sans wireframes en autonomie pour « faire avancer », même avec un pattern existant — c'est de la dette UX silencieuse.

5. **Smoke E2E formel = filet de sécurité prod, pas un coût** : Sprint 4 = 6 bugs prod détectés via smoke E2E. Sprint 6 → 9 = 0 smoke E2E ajouté = 0 bug prod détecté **mais aussi 0 garantie**. Pour chaque epic qui touche un cycle métier complet (rôles workflow, validation N+1), ajouter 1 smoke E2E formel en clôture epic.

---

## 🎬 Cap reprise Arnaud 02/06

1. **Aujourd'hui** : 2 todos qui clôturent la roadmap qualité-first :
   - ✅ Mise à jour `SPRINT_HANDOFF.md` section 14 (faite)
   - ✅ Rétrospective Sprint 9 (ce fichier)
2. **Test runtime des 6 surfaces** (engagement #4) — Arnaud joue sur `pnpm dev:b5` localhost:5177, verdict par surface.
3. **Décision Sprint 10** : confirmer périmètre dette structurelle (Phase B users + S9-PERF-ROUTE-SPLIT + run a11y dynamique) et estimer 4-5j.
4. **Décision Sally UX session** : programmer 1 session Sally avant Sprint 11 pour S-ORDER-ROLES-3-UI wireframes.

---

*→ Roadmap référence : [`roadmap-v1.1-qualite-first-2026-05-21.md`](../planning-artifacts/roadmap-v1.1-qualite-first-2026-05-21.md) | Rétro précédente : [`retrospective-sprint4-2026-05-20.md`](retrospective-sprint4-2026-05-20.md)*

---

## 📎 Addendum 2026-06-02 — Rattrapage DoD TF Notion (suite à interpellation Arnaud)

À la reprise 02/06 matin, Arnaud a interpellé sur l'absence de TF Notion pour les stories Sprint 6 → 9 livrées en autonomie. Vérification via MCP Notion search sur la DB 🧪 Cahiers de tests fonctionnels Magrit (`collection://9e8f5f5f-...`) : **0 TF créé entre le 25/05 et le 02/06 matin** — confirmation de la violation DoD identifiée au §7 ci-dessus.

**Rattrapage effectué avant commit clôture** : 14 TF créés en batch dans la DB Notion, 1 par story livrée Sprint 6 → 9 + wire-ups (cible Beta B5, statut « À jouer », testeur « Claude (IA Chrome) ») :

| # | Titre du cas | Story | Parcours | Priorité |
|---|---|---|---|---|
| 1 | RLS tenant_order_roles isolation cross-tenant | S-ORDER-ROLES-1 | P03 | P0 |
| 2 | Transition draft→validated RPC + matrice illegal | S-ORDER-ROLES-2 | P03 | P0 |
| 3 | Hook useOrderRoles capabilities + canDoAction | S-ORDER-ROLES-3 | P03 | P1 |
| 4 | Notif Resend par notify_policy | S-N1-APPROVAL | P10 | P1 |
| 5 | Modale historique UNION events DESC | S3.5 | P09 | P0 |
| 6 | Biblio 10 fonds + upload + cascade | S-PIM-VISUELS-1+2+3+5 | P09 | P0 |
| 7 | ShopVisualSettings preview + override gamme | S-PIM-VISUELS-4 | P09 | P0 |
| 8 | 5 templates SVG photo-réalistes | S-PIM-VISUELS-6 | P08 | P1 |
| 9 | Toggle Recto/Verso ProductMultiView | S-PRODUCT-VIEWS-MULTI | P09 | P1 |
| 10 | normalizeDimensions string=cm/number=mm | S-FIX-LARGE-CM-FORMATS | P08 | P0 |
| 11 | KPIs HQ par filiale + move atomique | S-SUBTENANT-SCOPE | P00 | P1 |
| 12 | invite-member 4 durcissements R5-bis P1 | S9 sécurité | P10 | P0 |
| 13 | Bouton Historique acheteur + admin | Wire-up `f49926b` | P09 | P0 |
| 14 | ProductMultiView dans ProductOverlay | Wire-up `f49926b` | P09 | P1 |

**Engagement supplémentaire Sprint 10** :
- (#8) **Gate dur DoD BMAD TF Notion** : à partir de Sprint 10, aucun commit story n'est mergeable sans son TF Notion référencé dans le commit message (`feat(v5): S-X — description (TF: <notion-url>)`). Vérification scriptable : grep des commits du sprint, croiser avec API Notion sur created_date_range.

Lesson candidate (à valider) : **DoD partielle non détectée en autonomie longue = dette invisible qui pourrit au sprint suivant**. La règle "TF Notion par story applicable" était présente dans `feedback_workflow_bmad.md` et `reference_notion_tests.md` mais n'a pas été appliquée en mode autonome. Pas parce qu'elle a été oubliée — parce que personne ne la rappelait. La discipline DoD doit être autochtone, pas dépendre du checkpoint Arnaud. Concrètement : à chaque story livrée en autonomie, créer le TF Notion **dans le même commit** que la story (commit propose code + story doc + TF reference URL).
