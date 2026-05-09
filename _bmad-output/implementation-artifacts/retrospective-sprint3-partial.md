---
sprint: Sprint 3 — e-shop v1.1 (BMAD)
retrospective_date: 2026-05-10
type: rétrospective intermédiaire (sprint en cours)
agent: Dev (BMAD)
participants: [Arnaud (PO/PM), Claude code (Dev/Architect/PM hats)]
---

# Rétrospective intermédiaire Sprint 3 — 2026-05-10

> _Rétrospective produite à mi-sprint (post-livraison Pré-sprint Epic 0 + Epic 1 partiel + Prix marché). Une rétrospective de fin de sprint sera produite après livraison complète de l'itération v1.1 (cible ~fin mai / début juin)._

## 🎯 Objectifs sprint vs. réalité

### Objectifs initiaux (PRD v1.1)

- 7 epics + 32 stories sprint-ready
- Démo client opérationnelle pour 2026-05-23
- Premier client Pro signé suite à démo (Vincent Gillier — Imprimerie du Roi)

### Réalité à date (mi-sprint)

✅ **Pré-sprint Epic 0 livré complet** (S0.1 + S0.2 + extension Prix marché).
🟡 **Epic 1 livré partiellement** : 3.5 stories sur 4 (S1.1, S1.2, S1.4 OK ; S1.3 à 50%).
⏳ **Epics 2-7 non démarrés** (selon plan : Epic 4 Mockup Engine prioritaire suivant).

## 🟢 Ce qui a bien fonctionné

### 1. Discipline BMAD-méthode sur le planning

Les 4 documents BMAD canoniques (PRD + Architecture + Epics & Stories + Implementation Readiness Report) ont été produits en suivant les skills officielles, avec respect des step-files. Ils ont servi de **contrat de capacités** pendant l'implémentation et ont permis de tracer chaque ligne de code à un FR/NFR/ADR.

### 2. Investigation pré-implémentation (S0.2)

Le subagent Explore a mené l'audit prix en autonomie (~5 min) et a permis de **découvrir 2 issues majeures** :
- `PricingPanel` outlier qui causait le « 2e prix mystère »
- Aucune validation Clariprint côté endpoint

Sans cette investigation, l'Order entity Epic 1 aurait été bâtie sur fondations opaques.

### 3. Anticipation des collisions de naming

La collision avec `public.orders` legacy (table user_id-based de 2026-04-18) a été détectée APRÈS échec de la migration mais résolue rapidement par rename `tenant_*`. Le naming final est **architecturalement plus propre** que le naming initial PRD. Pas de rework du front (le naming logique « Order » reste).

### 4. Découverte « pas d'OpenAI à migrer » (audit S1.3)

L'audit pré-implémentation S1.3 a confirmé qu'**aucun endpoint n'utilise OpenAI** — la story se simplifie en refactor wrapper sur Anthropic existant. Économie de ~1-2 jours d'effort.

### 5. Ré-élévation du concept « Prix marché » en concept structurant

Régression bloquante détectée par Arnaud en testant en local → fix livré en quelques heures + **concept élevé au niveau Vision Produit** (panel Magrit V2+ alimenté par parcs imprimeurs Pro anonymisés). Le PRD a été étendu avec FR47-50 et la mémoire projet enrichie.

### 6. Back-port systématique B5 → B4

Le fix Prix marché et l'investigation Clariprint ont été back-portés sur `beta/v4` pour la démo, sans dette technique additionnelle (4 fichiers identiques sur les 2 branches).

## 🔴 Ce qui n'a pas bien fonctionné (franchise radicale)

### 1. Discipline BMAD incomplète sur la phase Implémentation

**Constat majeur, soulevé par Arnaud le 2026-05-10 :** je n'ai PAS suivi rigoureusement la phase 4-implementation BMAD pendant les livraisons :
- ❌ Pas de `bmad-create-story` document par story livrée
- ❌ Pas de `bmad-dev-story` exécuté formellement
- ❌ Pas de `bmad-qa-generate-e2e-tests` (les cas TF Notion ont été créés à la fin, pas avant chaque story)
- ❌ Pas de changement de chapeau formel (resté John PM au lieu de basculer sur Dev)
- ❌ Pas de `bmad-sprint-status` ni de retrospective avant aujourd'hui

**Action corrective lancée 2026-05-10 :** rétrofit de toutes les stories en story documents formels + project-context + sprint-status + cette retrospective + cas TF Notion. **À faire systématiquement à partir de la prochaine story.**

### 2. Itérations multiples sur la migration SQL Order entity

3 commits successifs pour livrer S1.4 :
1. Initial (1a29481) — policies avec `orders.tenant_id` qualifié
2. Fix policies (4b2091c) — bascule sur helper `user_role_in_tenant`
3. Fix collision (9d70e58) — rename `tenant_*` après detection table legacy

**Cause racine :** absence de revue préalable de l'existant `supabase/migrations/` avant proposition du schéma. Si j'avais grep'é `create table.*orders` avant, j'aurais détecté la collision. **Action corrective :** ajouter au flow `bmad-create-architecture` Step 4 (DB schema) une check préalable des migrations existantes.

### 3. Bouton panier resté désactivé après S0.2

Le concept Prix marché aurait DÛ être identifié pendant la planification PRD/Architecture, pas en phase test. Le PRD initial mentionnait « Order entity persistée + Renouveler » mais ne mentionnait pas que le **bouton panier était bloqué** par l'attente Clariprint dans le code existant.

**Cause racine :** le PRD n'a pas inspecté l'état réel du code shop B2B (PortalProduct/PortalCart). C'est un manque de l'analyse Step 1 (project doc discovery) — j'ai chargé le PRD existant et l'Architecture mais pas exploré le code en profondeur.

**Action corrective :** dans la prochaine planification BMAD, le Step 2 (Project Context Analysis) doit inclure une revue ciblée du code des composants concernés par le scope, pas juste la doc.

### 4. Migration historique Supabase désynchronisée

`supabase db push --linked` a échoué parce que les anciennes migrations (`20260418_*.sql`, etc.) n'étaient pas enregistrées dans `supabase_migrations.schema_migrations`. Workaround : application manuelle via SQL Editor.

**Cause racine :** historique de migrations appliquées manuellement avant l'usage du CLI. Pas notre faute structurelle, mais à corriger pour rendre les futures migrations automatisables.

**Action corrective différée :** story technique future « Reconcile Supabase migrations history » — utiliser `supabase migration repair --status applied <version>` pour chaque migration legacy.

## 🟡 Ce qui doit s'améliorer

### 1. Halt aux menus BMAD = friction inutile pendant l'implémentation

À plusieurs reprises, je suis resté bloqué à un menu BMAD `[A]/[P]/[C]` alors qu'Arnaud souhaitait avancer vite. La règle BMAD « halt at menu » est utile en phase planning (où chaque décision compte), mais en phase implémentation elle ralentit inutilement quand le PO veut juste « go ». Arnaud a dû me dire 2 fois « tu bloques ou tu avances ? ».

**Amélioration :** lors d'invocations en cascade de skills, faire ressortir clairement quand un menu attend une input vs quand l'agent peut continuer sur défaut raisonnable. Pour la phase Implementation, les menus sont moins critiques.

### 2. Documentation après-coup vs documentation continue

Les story documents ont été produits le 2026-05-10 EN BLOC pour 8 stories livrées entre le 8 et le 9. Le rationale précis de certaines décisions techniques pourrait s'être atténué. Par exemple, je n'ai plus le souvenir précis des alternatives qu'on a écartées sur la Story Prix marché (1 ou 2 options non retenues sont mentionnées en commentaire de code mais pas formalisées).

**Amélioration :** prochaine fois, créer le story document AU MOMENT du démarrage de la story (pattern `bmad-create-story`), pas à la fin du sprint.

### 3. Tests TF Notion à créer AVANT la livraison, pas après

Idem — les 9 cas TF ont été créés a posteriori dans un batch. Idéalement chaque story livrée crée son cas TF en parallèle (skill `bmad-qa-generate-e2e-tests` OU création MCP Notion à la fin de chaque story).

**Amélioration :** intégrer la création TF dans la définition de "done" de chaque story (DoD globale projet le prévoit déjà — il faut le respecter strictement).

## 🚀 Actions correctives engagées

| Action | Quand | Owner | Statut |
|---|---|---|---|
| Rétrofit story documents Sprint 3 | 2026-05-10 | Dev | ✅ fait (8 documents) |
| Création `docs/project-context.md` officiel BMAD | 2026-05-10 | John PM | ✅ fait |
| Création 9 cas TF Notion sur livraisons Sprint 3 | 2026-05-10 | Dev | ✅ fait |
| Sprint status formel | 2026-05-10 | Dev | ✅ fait |
| Rétrospective intermédiaire | 2026-05-10 | Dev | ✅ ce document |
| **Discipline BMAD à partir de Epic 4** : story-doc dès démarrage + TF Notion en parallèle + bascule Dev hat formelle | À partir prochain sprint | Dev | ⏳ à intégrer |
| Story technique « Reconcile Supabase migrations history » | Sprint cleanup | Dev | ⏳ backlog |
| Refactor cleanup `ProductCard.tsx` pour DRY-er `estimatePrice` vers `priceResolver` | Sprint cleanup | Dev | ⏳ backlog |

## 📊 Métriques d'apprentissage

- **3 itérations** sur la migration S1.4 → cause racine identifiée et corrigée
- **2 réveils** d'Arnaud (« tu bloques ou tu avances ? ») → plus efficace désormais
- **1 régression bloquante** détectée en test (Prix marché) → fix livré, concept élevé au niveau Vision

## 💡 Top 3 enseignements

1. **BMAD-Methode = méthode documentaire intégralement.** La phase 4-implementation est aussi structurée que les phases 1-3. Story documents, sprint status, retrospective sont des artefacts obligatoires, pas des nice-to-have.
2. **L'investigation préalable PAYE.** Subagent Explore avant d'écrire du code = découvertes architecturales majeures (S0.2 audit prix, S1.3 OpenAI absent, S1.4 collision legacy détectée tardivement faute d'investigation).
3. **Le PO doit pouvoir tester en continu.** Le concept Prix marché n'aurait jamais été élevé au niveau structurant si Arnaud n'avait pas testé en local et signalé le bouton panier bloqué. → garder un environnement local fonctionnel à tout moment du sprint.
