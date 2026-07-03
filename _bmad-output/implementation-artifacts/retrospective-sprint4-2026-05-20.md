---
sprint: Sprint 4 — PIM-Boutique-Commandes (BMAD)
retrospective_date: 2026-05-20
type: rétrospective de fin de sprint
agent: Claude Code (Dev, hat retrospective)
participants: [Arnaud (PO/PM), Claude Code (Dev/Architect/PM hats)]
head_at_start: c95b547
head_at_end: becf6cd (+ fe59be2 fixes post-sprint)
period: 2026-05-17 → 2026-05-18 (1 session unique très dense) + fixes 2026-05-19/20
stories_planned: 16
stories_delivered: 20 (élargi en cours via pre-flight checks)
demo_target: 2026-05-23 (Groupe ICI bêta — démo principale déjà eue le 18/05 succès)
---

# Rétrospective Sprint 4 — PIM-Boutique-Commandes

> Format synthèse directe (pas de party-mode). Périmètre : 20 stories livrées entre `c95b547` et `becf6cd` + 3 fixes post-sprint (`9ecd956`, `c95a7a9`, `fe59be2`). Démo Groupe ICI eue le **18/05 (succès, accord principe bêta 2 dirigeants)** — la "démo cible 23/05" du sprint plan est devenue un débrief de consolidation.

---

## 🎯 Sprint en chiffres

| Indicateur | Valeur | Commentaire |
|---|---|---|
| Stories livrées | **20 / 16 planifiées** | +25 % scope (élargissement via pre-flight checks détectant bugs prod) |
| Phases livrées | **3 sur 4** (Phase 0+1+2 complet) | Phase 3 commandes lifecycle (S3.1→S3.5) reportée post-démo |
| Tests vitest | **353 verts** (+63 vs baseline 290) | 0 régression |
| Commits poussés | **15** sur `beta/v5` | Atomicité respectée |
| Migrations SQL prod | **3** | +5 gammes, trigger PIM tenant_order_items, product_id nullable |
| Edge functions redéployées | **4** | pim-ingest v6→v10 (4 itérations) |
| ADR formalisées | **2** | §4.9 ADR-PIM-RLS-1 + §4.10 ADR-ORDERS-1 |
| TF Notion créés | **15** | 1 par story applicable (DoD respectée) |
| Bugs prod silencieux détectés | **6** | Tous fixés en cours de sprint |
| Sally UX consultations | **2** | S-DUAL-READ icône legacy + S-CONSO-3/4/5/6 groupé |
| Durée réelle | **~1 session unique** (18/05) | ⚠️ Très dense — voir §"Ce qui doit s'améliorer" |

---

## 🟢 Ce qui a bien fonctionné

### 1. Discipline BMAD intégrale appliquée — la promesse de la rétro Sprint 3 tenue

La rétro intermédiaire du 10/05 avait engagé : *"Discipline BMAD à partir de Epic 4 : story-doc dès démarrage + TF Notion en parallèle + bascule Dev hat formelle"*. **Engagement tenu intégralement** : 20 story docs produits formellement, 15 TF Notion créés en parallèle (1 par story applicable), changement de hat respecté. C'est la première fois depuis le démarrage v1.1 qu'on a une trace BMAD complète d'un sprint de bout en bout.

### 2. Les smoke tests formels ont payé en cash : 6 bugs prod détectés

Le pattern *"créer un smoke test E2E formel avant de tirer parti d'une dépendance"* (P0.4 sur ingestion PIM, pre-flight checks S-MIGRATION-ORDERS) a permis de **détecter 6 anomalies prod silencieuses** qui auraient explosé en démo client :

| Bug | Détecté par | Sans la discipline BMAD on aurait découvert ça… |
|---|---|---|
| pim-ingest v6 PRE-fix Magrit3 case-sensitive | Smoke P0.4 (enrichissement Claude échoue) | en démo, fiches PIM vides |
| toMm seuil < 50 insuffisant grands formats cm | P0.4 v2 kakemono → flyer | en démo, kakemono mal mappé |
| Parité `resolveGamme` front/back manquante | P0.4 v3 (3/5 OK) | en démo, gamme erratique |
| Convention cm/mm fragile (seuil numérique) | P0.8 v3 (kakemono 80cm faux) | en démo, mêmes erreurs |
| Trigger PIM absent sur `tenant_order_items` | Pre-flight S-MIGRATION-ORDERS | en prod, pipeline rompu post-bascule |
| `tenant_order_items.product_id NOT NULL` | Test E2E S-MIGRATION-ORDERS Arnaud | en prod, panier items library bloqué |

Ce sont 6 incidents critiques évités. La méthode BMAD n'est plus "du process pour faire bien", c'est **un filet de sécurité prod opérationnel**.

### 3. ADR formalisées AVANT implémentation — économie d'alignement

`ADR-PIM-RLS-1` (§4.9) et `ADR-ORDERS-1` (§4.10) ont été écrites en Phase 0 (P0.1 + P0.5), AVANT les stories qui en dépendent. Conséquence : zéro débat en cours d'implémentation sur "dual-read ou pas", "shared catalog ou tenant-scoped". Les décisions étaient documentées, sourcées, défendues. Stories S-MIGRATION-ORDERS, S-DUAL-READ, S-DASHBOARD-ORDERS-DUAL ont juste eu à *exécuter* l'ADR. C'est l'inverse exact du chaos S1.4 du Sprint 3 (3 itérations sur la même migration faute d'ADR amont).

### 4. Convention `string=cm, number=mm` (P0.9) — simple, déterministe, audit-safe

Après 2 tentatives sur heuristique de seuil numérique (P0.7 seuil <50, P0.8 affinage), bascule sur convention typage. **Audit SQL prod confirme 0 régression** (aucun produit historique en string ≥ 50). Solution : ① déterministe ② documentable ③ identique front/back ④ side-by-side testable. Type d'amélioration qu'on n'aurait pas trouvée sans avoir d'abord constaté l'échec des heuristiques.

### 5. Pattern dual-read résilient (S-DUAL-READ)

`Promise.all` 2 queries (legacy `shop_orders` + v1.1 `tenant_orders`) avec recovery par query indépendante (si l'une fail, l'autre continue + log). Sally H1-bis : marker visuel discret (point gris + tooltip "Commande antérieure 17/05") au lieu d'une colonne dédiée laide. C'est un pattern réutilisable pour toute bifurcation de modèle data temporaire.

### 6. Succès démo Groupe ICI 18/05 (objet de la mémoire `project_demo_groupe_ici_2026-05-18`)

La démo qui était la **raison d'être** de ce sprint a eu lieu le 18/05 — le jour même où le sprint s'est terminé. Verdict client : *« nœud du problème »* (Richard), accord principe bêta 2 dirigeants, ouverture 2e axe dirigeant augmenté. **L'objectif business du sprint est atteint** indépendamment de la "deadline 23/05" technique restante.

---

## 🔴 Ce qui n'a pas bien fonctionné (franchise radicale)

### 1. 🚨 20 stories en 1 session unique — violation directe de la lesson 17/05

Le **lessons.md** d'Arnaud capte explicitement le 17/05 :

> *"Ne JAMAIS enchaîner plus de 2-3 stories dans une même session sans pause récapitulative obligatoire. Après chaque story poussée, faire un mini-récap visuel/factuel synthétique."*

Sprint 4 a livré **20 stories en 1 session** sans pause récap intermédiaire systématique. Pourquoi ça n'a pas explosé : la pression démo 23/05 + une discipline BMAD individuelle par story qui a tenu. Mais la lesson reste **violée frontalement**, et la chance d'avoir un PO (Arnaud) capable de suivre 20 stories d'affilée n'est pas une stratégie reproductible.

**Cause racine** : pression de la deadline démo + élargissement scope en cours (pre-flight checks ajoutaient des stories à la volée P0.6→P0.11) → emballement.

**Action corrective immédiate** : pour tout sprint futur > 5 stories, **pause récap obligatoire toutes les 3 stories** avec sortie format `lessons.md` (1 ligne par story : ce qui a changé concrètement + ce que tu peux tester en 30s). Story future `S-PROCESS-CHECKPOINT-EVERY-3` à intégrer aux skills BMAD si possible (hook ?).

### 2. ⚠️ La chaîne P0.7 → P0.8 → P0.9 — 3 itérations sur le même problème cm/mm

Symétrique au problème S1.4 du Sprint 3 (3 itérations migration). Cette fois : 3 stories pour résoudre la même question cm vs mm. **Cause racine** : on a tenté de patcher l'heuristique (seuil <50, puis affinage) au lieu de questionner d'emblée si l'heuristique elle-même était le bon outil. P0.9 a finalement audit prod et choisi une convention typage — qui aurait pu être proposée dès P0.7 si on avait commencé par l'audit.

**Action corrective** : ajouter au flow BMAD `bmad-create-story` un *"check préalable des hypothèses heuristiques"* — si une story propose un seuil numérique magique, l'AC inclut une vérification empirique sur données prod AVANT implémentation.

### 3. ⚠️ pim-ingest oublié dans le redeploy post-S1.5 (bug latent 9 jours)

Le 09/05, S1.5 a corrigé `Magrit3` case-sensitive dans le wrapper Anthropic. Le 17/05 (8 jours plus tard), le smoke test P0.4 révèle que **pim-ingest** n'avait pas été redéployé et tournait toujours sur l'ancien wrapper → 5/5 candidats rejetés en silence avec `"API key ?"`. Bug latent invisible parce que personne ne consultait les `pim_candidates` rejetés.

**Cause racine** : pas de checklist *"après chaque modification d'un module `_shared/`, redéployer TOUS les edge functions qui l'importent"*. Le SPRINT_HANDOFF mentionnait *"redeploy claude-proxy v8 + make-server-e3db71a4 v12"* mais oubliait `pim-ingest` et `pim-generate`.

**Action corrective** : ajouter un script `scripts/list-edge-functions-importing.sh _shared/<file>` qui sort la liste des edge functions à redéployer après modif d'un module `_shared/`. Doc dans `SPRINT_HANDOFF.md` section dédiée.

### 4. ⚠️ Fixes post-sprint immédiats — la stabilité n'est pas acquise

Entre `becf6cd` (fin sprint) et aujourd'hui (`fe59be2`), 3 fixes ont été nécessaires en 2 jours :
- `9ecd956` — docs (acceptable, c'est de la consolidation)
- `c95a7a9` — **fix CORS** claude-proxy (`x-client-info` + `apikey` headers) → impact askMagrit boutique
- `fe59be2` — **timeout askMagrit boutique 3s → 15s** (cas nominal LLM 5-15s mal calibré)

Les deux fix techniques (CORS + timeout) sont des **régressions de configuration** post-Sprint 4 qui suggèrent qu'on n'a pas testé `askMagrit` côté boutique de bout en bout avant de clore. Le sprint a couvert l'orderbook (tenant_orders, dual-read) mais a sous-testé le parcours acheteur AI.

**Cause racine** : la définition de "done" Sprint 4 n'a pas explicité un smoke test "parcours acheteur AI complet" sur la boutique. Phase 2 (S-CONSO-*) couvrait UI et recherche mais pas l'invocation Magrit en contexte boutique.

**Action corrective** : avant clôture sprint, **smoke test E2E parcours acheteur** obligatoire (login boutique → askMagrit → ajout panier → commande). Doit faire partie de la DoD globale projet (mise à jour `docs/project-context.md` §5).

### 5. ⚠️ Dette tracée mais non priorisée (4 stories futures sans owner)

Le SPRINT_HANDOFF liste 4 stories futures `S-N1-APPROVAL`, `S-PRODUCT-VIEWS-MULTI`, `S-FIX-LIBRARY-UUID`, `S-FIX-LARGE-CM-FORMATS` + 3 stories du sprint refacto (R2-bis, R5-bis, R8-bis) du Sprint 3. Soit **7 stories en backlog non planifiées**, sans Sprint cible, sans criticality assignée.

**Cause racine** : pas de session de grooming backlog à la fin du Sprint 4. La rétro Sprint 3 le 10/05 prévoyait déjà 2 stories en cleanup ("Reconcile Supabase migrations history" + "Refactor ProductCard DRY") — **toujours pas adressées**.

**Action corrective** : prévoir une session de grooming backlog **avant Sprint 5** pour trier les 9 stories en attente (4 nouvelles + 3 refacto + 2 cleanup Sprint 3) et décider go/no-go par story.

---

## 🔄 Follow-through de la rétro Sprint 3 (10/05)

| Action engagée le 10/05 | Statut au 20/05 | Évidence |
|---|---|---|
| Rétrofit story documents Sprint 3 | ✅ Fait | 8 story-docs dans `implementation-artifacts/` |
| `docs/project-context.md` officiel BMAD | ✅ Fait + maintenu | Mis à jour 10/05, structure stable |
| 9 cas TF Notion Sprint 3 | ✅ Fait | Référencé Notion ID 7e576e695d504cc9a32ead92f4dde01c |
| Sprint status formel | ✅ Fait | `sprint-status-2026-05-10.md` puis `2026-05-17.md` |
| Discipline BMAD intégrale à partir Epic 4 | ✅ **Tenu** | 20 story-docs Sprint 4, 15 TF, hat formel |
| Story technique "Reconcile Supabase migrations history" | ❌ Non fait | Toujours en attente, pas urgent mais reste dette |
| Refactor cleanup `ProductCard.tsx` DRY → `priceResolver` | ❌ Non fait | Hotfix 17/05 a touché `ProductOverlay` mais pas DRY |

**Score : 5/7 actions tenues**. Les 2 actions techniques de cleanup ont glissé. Pas critique mais à priorifier en grooming pré-Sprint 5.

---

## 🚨 Discoveries significatives — Impact sur la suite

### Discovery 1 : Le pipeline PIM était fragile sur 4 axes simultanés

Avant Sprint 4 on pensait que le pipeline PIM était stable. Sprint 4 a révélé qu'il était fragile sur **4 axes simultanés** : wrapper API key, conversion cm/mm, parité front/back resolveGamme, trigger DB post-bascule. Le pipeline était une bombe à retardement. **Conséquence pour Phase 3 et Sprint 5** : continuer la discipline smoke E2E sur tout flow touchant Clariprint / PIM / orders. Ne pas présumer la stabilité.

### Discovery 2 : Bifurcation orders (legacy + v1.1) — bien gérée mais à monitorer

ADR-ORDERS-1 + dual-read pattern OK techniquement. **Risque suivant** : si Phase 3 (S3.1 OrderHistoryTable avec filtres) est faite naïvement, elle pourrait casser la dual-read en filtrant par colonne uniquement présente sur `tenant_orders` (ex: `tax_regime`). À prévenir dans la conception S3.1.

### Discovery 3 : La démo a déjà eu lieu — recalibrer la cible "23/05"

La démo Groupe ICI du 18/05 ayant été un succès avec accord bêta, **la "deadline démo 23/05" du sprint plan n'a plus la même nature**. Plus de pression date — devient une fenêtre de consolidation. À utiliser pour :
- (a) débrief 26/05 prévu (cf. mémoire `project_demo_groupe_ici_2026-05-18`)
- (b) finaliser les fixes post-sprint identifiés
- (c) commencer Phase 3 (S3.1 OrderHistoryTable) sereinement

**Pas besoin de mettre à jour les epics ou le PRD** — les ADR formalisées en Phase 0 couvrent les évolutions.

---

## 📋 Actions concrètes — Pré-démo 23/05 (J-3) et préparation Sprint 5

### Critical path avant 23/05 (3 jours)

| # | Action | Owner | Critère "done" |
|---|---|---|---|
| 1 | Smoke test E2E parcours acheteur AI sur `/shop/boutique-1` (login → askMagrit → panier → commande tenant_orders) | Claude Code + Arnaud test visuel | URL ouverte, étapes décrites, captures pertinentes |
| 2 | Vérifier zéro erreur console + Supabase log sur 1h d'usage simulée | Claude Code (lance dev:b5 + monitore) | 0 erreur 4xx/5xx non gérée |
| 3 | Confirmer que `askMagrit` timeout 15s convient en cas nominal (LLM 5-15s) | Claude Code (5 prompts test sur boutique) | 0 timeout sur prompts réalistes |
| 4 | Préparer un script démo 23/05 si Arnaud veut faire une 2e démo | Arnaud décide | Décision go/no-go démo additionnelle |

### Préparation Sprint 5 (post-26/05 débrief Groupe ICI)

| # | Action | Owner | Quand |
|---|---|---|---|
| 5 | Session grooming backlog : trier 9 stories en attente (4 Sprint 4 futures + 3 R-bis + 2 cleanup Sprint 3) | Arnaud + Claude Code (hat John PM) | Pré-Sprint 5 |
| 6 | Décider go/no-go Phase 3 (S3.1→S3.5) vs autres priorités issues du débrief Groupe ICI | Arnaud | Post-26/05 |
| 7 | Adopter règle "pause récap toutes les 3 stories" (lesson 17/05) — explorer hook BMAD Claude Code | Claude Code | Sprint 5 démarrage |
| 8 | Script `list-edge-functions-importing.sh` pour ne plus oublier un redeploy | Claude Code | Sprint 5 démarrage |
| 9 | Ajouter "smoke E2E parcours acheteur AI" à la DoD globale (`docs/project-context.md` §5) | Claude Code | Sprint 5 démarrage |

### Dette technique à arbitrer en grooming

- 🟡 Reconcile Supabase migrations history (Sprint 3 retro)
- 🟡 Refactor `ProductCard.tsx` DRY → `priceResolver` (Sprint 3 retro)
- 🟡 `S-REFACTO-SHARED-RESOLVER` (extraire toMm + resolveGamme en module commun)
- 🟡 `S-CLEANUP-CM-MM-HEURISTIC` (unifier les 2 seuils helpers)
- 🟡 `S-RPC-CREATE-ORDER-TRANSACTIONAL` (rollback atomique)
- 🟡 R2-bis (ChatInterface sous-composants), R5-bis (invite-member transactional), R8-bis (tests Auth/Shops/hooks)
- 🟢 `S-N1-APPROVAL`, `S-PRODUCT-VIEWS-MULTI`, `S-FIX-LIBRARY-UUID`, `S-FIX-LARGE-CM-FORMATS` (features mineures)

---

## 💡 Top 3 enseignements

1. **La discipline BMAD est un filet prod, pas du process pour faire bien.** Les smoke tests formels + ADR amont + pre-flight checks ont détecté 6 bugs prod silencieux. Sans BMAD strict, démo Groupe ICI 18/05 = catastrophe. À répéter sur chaque sprint sans exception.

2. **Heuristiques magiques = signal d'auditer la prod d'abord.** Quand une story propose un seuil numérique (cm/mm <50, <100), l'AC doit inclure une vérification empirique sur données prod AVANT implémentation. P0.9 a démontré qu'un audit SQL de 5 min remplace 2 itérations d'heuristique.

3. **20 stories en 1 session = chance, pas méthode.** La lesson 17/05 (max 2-3 stories sans pause récap) est non-négociable. Sprint 5 doit explicitement définir une cadence avec checkpoints, même sous pression démo. La prochaine fois, on aura moins de chance.

---

## 📌 Mise à jour mémoire post-rétro

À sauvegarder dans `~/.claude/projects/-Users-arnaudmazon-Documents-Claude-BMAD-Magrit/memory/` :

- **Nouvelle entrée feedback** : *"Smoke E2E parcours acheteur AI obligatoire dans la DoD avant clôture sprint"* → fichier `feedback_dod_smoke_e2e_acheteur.md`
- **Nouvelle entrée feedback** : *"Heuristiques numériques magiques (seuils cm/mm, etc.) — auditer prod AVANT implémentation"* → fichier `feedback_audit_prod_avant_heuristique.md`
- **Mise à jour entrée projet** : Sprint 4 fini, 20 stories, démo 18/05 OK → mettre à jour `project_sprint3_status.md` ou créer `project_sprint4_status.md`

---

## Liens

- Rétro précédente : [retrospective-sprint3-partial.md](retrospective-sprint3-partial.md)
- Sprint status : [sprint-status-2026-05-17.md](sprint-status-2026-05-17.md)
- Handoff complet Sprint 4 : [../../SPRINT_HANDOFF.md](../../SPRINT_HANDOFF.md) §12
- ADR §4.9 PIM RLS : [../planning-artifacts/architecture.md](../planning-artifacts/architecture.md)
- ADR §4.10 Orders model : idem
- Mémoire démo Groupe ICI : `~/.claude/projects/.../memory/project_demo_groupe_ici_2026-05-18.md`
- Backlog Notion : https://www.notion.so/4d2e2ea106914ce5a69728fdb67dfddd
- TF Notion : https://www.notion.so/7e576e695d504cc9a32ead92f4dde01c
