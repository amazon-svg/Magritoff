---
stepsCompleted:
  - step-01-init
  - step-02-discovery
  - step-02b-vision
  - step-02c-executive-summary
  - step-03-success
  - step-04-journeys
  - step-05-domain
  - step-06-innovation
  - step-07-project-type
  - step-08-scoping
  - step-09-functional
  - step-10-nonfunctional
  - step-11-polish
  - step-12-complete
releaseMode: phased
status: complete
completedAt: 2026-05-09
classification:
  projectType: saas_b2b
  formFactor: web_app
  domain: general
  domainAdjacency: [fintech]
  complexity: medium
  projectContext: brownfield
  iterationScope: e-shop-v1.1
  itemsInScope:
    - E9.13   # Refonte PortalShop B2B premium
    - E4.1    # Panier depuis devis
    - E4.2-lite  # Order entity (sans workflow/paiement)
    - E8.3    # Visualisation 2D / mockup engine
    - new:GroupedActions
    - new:PIM-Canva-Affinity
    - hotfix:FicheRegression-B4
  itemsExplicitlyOutOfScope:
    - E4.3   # Stripe payment terminal (V2+)
    - E4.4   # Back-office validation (V2+)
    - T-03   # Sync eCommerce Shopify/Woo
    - E5.1   # API CMS publication
inputDocuments:
  # Code repo (committed, beta/v5)
  - path: ARCHITECTURE.md
    source: git
    type: project_doc
  - path: SPRINT_HANDOFF.md
    source: git
    type: project_doc
  - path: V3_MULTI_TENANT.md
    source: git
    type: project_doc
  - path: guidelines/Guidelines.md
    source: git
    type: project_doc
  # Notion — backlog & vision
  - id: 4d2e2ea1-0691-4ce5-a697-28fdb67dfddd
    title: "📋 Backlog Magrit — Sprint Board"
    source: notion
    type: backlog_db
  - id: 349d0131-973c-819f-b4dd-f53b8db248dd
    title: "📋 Backlog Technique Magrit"
    source: notion
    type: backlog_overview
  - id: 348d0131-973c-80fe-9ba7-f602ec181c3f
    title: "Magrit IA"
    source: notion
    type: project_root
  - id: 357d0131-973c-8140-ac58-d78f4618c927
    title: "E9.13 — Refonte PortalShop B2B premium"
    source: notion
    type: story
  - id: 357d0131-973c-81b9-84fb-f01c4baf137c
    title: "E4.2 — Transformation devis → commande"
    source: notion
    type: story
  - id: 349d0131-973c-8114-84d7-fde23e56db5c
    title: "E4 — Mini-shop et transactions (Epic)"
    source: notion
    type: epic
  - id: 358d0131-973c-8122-ba0d-f43d9b0cff6e
    title: "TF-39 — Demande de devis depuis ProductCard"
    source: notion
    type: test_case
  # Notion — tests & DoD
  - id: 7e576e69-5d50-4cc9-a32e-ad92f4dde01c
    title: "🧪 Cahiers de tests fonctionnels Magrit"
    source: notion
    type: test_db
    role: definition_of_done
  - id: 358d0131-973c-810e-93c2-c5285099b8a4
    title: "🧬 Hints DOM par parcours — testid Magrit B4"
    source: notion
    type: test_reference
  - id: 358d0131-973c-8173-99cc-cff5d7acb844
    title: "E7.8 — Seed SQL pour les cahiers de tests fonctionnels"
    source: notion
    type: story
  # Drive — vision produit & protocoles
  - id: 1UjEd6IrBsxxV1AVKOelAdly6HDFH0tti
    title: "Vision_Produit_Backlog_Magrit_15avril2026.docx"
    source: drive
    type: vision
    role: master_backlog_source
  - id: 1lfCKS5y4a6Ine-0LV_XrNLboUUzAvJFa
    title: "CR_Reunion_Magrit_15avril2026.docx"
    source: drive
    type: meeting_minutes
  - id: 1Z_5vTbG7Gh2rOllo3KvzQbRLyh8pCsZO
    title: "PROTOCOLE PROJET MAGRIT.docx"
    source: drive
    type: project_protocol
  - id: 1ceyMmHGLCT-C5TxEwQS2Fr27jYPyI3-i
    title: "Magrit_IA_Pitch_Exaprint.pptx"
    source: drive
    type: pitch_deck
  - id: 1jmNTiLg1U4M2cXAtTXM-fi92o6xLlHGG
    title: "Dossier_DIHNAMIC_Magrit_v2.docx"
    source: drive
    type: funding_dossier
  # Conversation Copilot restaurée — input brut du user pour v1.1
  - path: ../../COPILOT_CHAT_HISTORY.md
    source: restored_chat
    type: user_brief
    role: v1_1_user_requirements
documentCounts:
  briefs: 1  # COPILOT_CHAT_HISTORY (input utilisateur restauré, fait office de brief Mary)
  research: 0
  brainstorming: 0
  projectDocs: 4  # ARCHITECTURE, SPRINT_HANDOFF, V3_MULTI_TENANT, Guidelines
  notionPages: 9
  driveDocs: 5
  testReferences: 3
workflowType: 'prd'
projectType: 'brownfield'
targetBranch: 'beta/v5'
hotfixBranch: 'beta/v4'
sprintCodeName: 'e-shop v1.1'
language:
  communication: French
  document: French
---

# Product Requirements Document — Magrit / e-shop v1.1

**Author:** Arnaud Mazon
**PM Facilitator:** John (BMAD Product Manager)
**Date:** 2026-05-08
**Target Beta:** Beta 5 (`beta/v5`)
**Hotfix scope (Story 0):** Beta 4 (`beta/v4`) — régression Fiche home Magrit
**Source backlog :** [Vision Produit Magrit IA — 15 avril 2026](https://drive.google.com/file/d/1UjEd6IrBsxxV1AVKOelAdly6HDFH0tti/view) + [Backlog Sprint Board Notion](https://www.notion.so/4d2e2ea106914ce5a69728fdb67dfddd)

---

## Mapping initial des chantiers v1.1 → backlog Vision Produit

| Chantier user (Copilot tour 23) | Stories Vision Produit alignées | Statut backlog |
|---|---|---|
| **1. Interface enrichie (home, catalogue, commandes, overlay PIM, images produits)** | E9.13 (Refonte PortalShop B2B premium) + E8.2 (Catalogue élargi) + E8.3 (Visualisation 2D/gabarits) | P1 v1.1 — Sprint 3 |
| **2. Actions groupées (multi-sélection, comparateur)** | _Nouveau_ — à ajouter au backlog | À créer |
| **3. PIM enrichi (specs Clariprint, Canva/Affinity, fix Fiche)** | Partiellement E1 (Clariprint) — fix Fiche = hotfix B4 | À créer + hotfix |
| **4. Édition devis interactive** | E4.1 (Panier depuis devis) | P1 v1.1 |
| **+ Module Commandes (objet, infos, accès, renouvellement)** | E4.2 (simplifié, sans workflow/paiement) | P1 v1.1 |

## Décisions PM verrouillées

1. **Scope Order v1.1 = "Order entity"** — matérialiser la commande comme objet persisté + accès lecture/renouvellement. Workflow / paiement / logistique = hors scope (E4.3, E4.4 reportés en V2+ tel que prévu Vision Produit).
2. **Stratégie images produits = Mockup engine paramétrique** alimenté par specs Clariprint, ~15 templates SVG/Canvas, artwork procédural cohérent par boutique, cache Supabase Storage. Aligné avec E8.3.
3. **Régression "Fiche" home Magrit = HOTFIX prioritaire sur `beta/v4`**, sort du scope v1.1 mais reste en haut de pile sprint (Story 0).
4. **Definition of Done v1.1 = cahiers de tests Notion** ([🧪 DB](https://www.notion.so/7e576e695d504cc9a32ead92f4dde01c)) avec exécution Claude Code + plugin Chrome via testids stables (E7.7 livré).

---

_Document **finalisé** via la skill `bmad-create-prd` (steps 1 → 12 ✅). Statut : prêt pour les workflows aval (architecture, UX, breakdown epics & stories)._

## Table des matières

1. **Executive Summary** — vision, personas, périmètre v1.1, hors scope
2. **What Makes This Special** — 5 différenciateurs + core insight
3. **Project Classification** — `saas_b2b`, brownfield, complexity medium, branch `beta/v5`
4. **Success Criteria** — User / Business / Technical + Definition of Done + Critère 4 conditions cumulatives
5. **Product Scope** — MVP / Growth / Vision
6. **User Journeys** — 6 journeys (Bruno imprimeur, Claire acheteuse, hotfix démo, Yasmine admin, Claude in Chrome QA, Marc Tessier W2P)
7. **Domain-Specific Requirements** — Compliance, Technical Constraints, Integrations, Risk Mitigations + **E-NEW-CLARIPRINT-01 P0 pré-v1.1**
8. **Innovation & Novel Patterns** — 4 areas + Market Context recalibré (Cimpress = client cible) + WebSearch sources
9. **SaaS B2B Specific Requirements** — Tenant Model, RBAC, Subscription Tiers + quotas, Integrations, Compliance
10. **Project Scoping & Phased Development** — MVP philosophy, Resources, Risk Mitigation
11. **Functional Requirements** — 50 FR + 20 FR-ECOM sur 11 domaines (capability contract ; Domaine 11 = extension boutique e-commerce 2026-07-06)
12. **Non-Functional Requirements** — 28 NFR (Performance, Security, Scalability, Accessibility, Integration, Reliability)
13. **Document Status & Next Steps** (en bas)

---

---

## Executive Summary

**Magrit / e-shop v1.1** est l'itération qui transforme le proto boutique B2B (livré en Beta 3) en **portail B2B premium intégré à l'assistant business de l'imprimeur**. Elle clôt la chaîne « devis → commande » en matérialisant la commande comme objet persisté côté plateforme et en offrant à l'acheteur de l'imprimeur un environnement digne des standards d'achat pro modernes — là où la concurrence (web-to-print historique, ERP/MIS legacy) propose encore des grilles figées et des UX datées.

**Persona primaire : l'imprimeur.** Il est le producteur, donc le détenteur des paramètres (parc machines via Clariprint) qui rendent toute la promesse Magrit possible. Le PRD v1.1 sert d'abord son chemin critique « générer un devis complexe sans difficulté à la vitesse Magrit » — d'où l'inclusion du hotfix régression « Fiche » sur Beta 4 en Story 0, hors scope itération mais prioritaire pour la démo client imminente.

**Personas secondaires :**

- **Acheteur de l'imprimeur** (sur la boutique B2B) — moment de magie quand il retrouve en un instant ses commandes passées et obtient un chiffrage à la volée pour ce qui n'est pas encore au catalogue.
- **W2P e-commerçant** — cible long terme via API CMS (E5.1, hors v1.1), mentionnée pour ne pas fermer architecturalement cette voie d'expansion.

**Problème résolu en v1.1 :** la boutique tenant `/shop/:slug` est restée en layout v1 simple (ProductCard basique, panier minimal, pas de module commandes, pas d'images cohérentes, régression Fiche home Magrit chat). L'imprimeur n'a aujourd'hui rien à montrer à un acheteur pro qui équivaille à ce que ce dernier expérimente sur un site B2B moderne. v1.1 corrige ce gap.

**Nouvelle convention produit (intégrée à v1.1) :** **fusion des concepts Storefront et E-shop** en un objet unique « boutique » (`/shop/:slug`). Les distinctions historiques entre vitrine catalogue (Starter) et vitrine transactionnelle (Pro+) deviennent des **capacités activées par feature flag selon le tier** — notamment les workflows B2B propres au Pro+ qui n'ont pas de pendant en e-commerce simple. Cette fusion supprime un vecteur de confusion côté code, pricing et glossaire.

**Périmètre fonctionnel v1.1 (verrouillé) :**

- Refonte boutique B2B premium (E9.13) : layout 3 colonnes, dark mode, header brandé tenant, navigation gammes / grille / panier sticky.
- Home boutique enrichie : dernières commandes, paniers en attente, fichiers produit ou en attente de production.
- Catalogue par gammes dépliables et persistantes (l'ajout n'écrase pas la sélection précédente).
- Overlay ProductCard de configuration produit (style « édition en panneau ») avec options Clariprint en `<select>` (jamais de saisie libre).
- **Module Commandes simplifié — Order entity** : matérialisation persistée de la commande + accès lecture + bouton « Renouveler ». Pas de workflow validation / paiement / expédition (reportés V2+).
- Mockup engine paramétrique (E8.3) : ~15 templates SVG/Canvas alimentés par les specs Clariprint, artwork procédural cohérent par boutique, cache Supabase Storage.
- Multi-sélection, comparateur produits côte-à-côte, actions groupées (téléchargement fiches, devis groupé).
- **Quick-win Canva** : ajout connecteur Canva (envoi gabarits Clariprint → Canva, récupération design) — opportunité signalée par Arnaud, pas dans le backlog Notion initial mais alignée avec la stratégie « pas de design studio natif, intégration Canva dès le Pro » (CONTEXT §6.3).
- **Connecteur Affinity — conditionnel** : à inclure si l'investigation Claude Cowork démontre une capacité de pilotage Affinity utilisable. Sinon reporté.
- Hotfix régression Fiche home Magrit sur `beta/v4` (Story 0, déployable indépendamment pour démo).
- **Story technique parallèle — E-NEW-LLM-01 — PRIORITÉ HAUTE (P0) :** migration GPT-4o → `claude-haiku-4-5-20251001` partout où GPT-4o était utilisé pour la « génération rapide ». **Justification escalade en P0 (décision Arnaud, 2026-05-08) :** impact direct sur la qualité des retours de prompts — Haiku 4.5 est sensiblement supérieur sur la production de JSON conforme à un schéma strict (cf. story E1.3 P0 « validation schéma JSON strict »), ce qui réduit le taux de retry et améliore la fiabilité globale du pipeline IA. Bénéfices secondaires : cohérence stack mono-vendor (Anthropic), coût ÷ 2.5, latence -30 %. Taille S, à exécuter **en parallèle de v1.1**, pas après.

**Hors scope explicite v1.1 (reportés) :** Stripe payment terminal (E4.3), back-office validation commandes (E4.4), sync eCommerce Shopify/Woo/Magento (T-03), API publication CMS (E5.1), refonte UX saisie parc machines imprimeur (sprint dédié futur), traitement fichiers AO Excel grands volumes (sprint disruptif futur), recalcul prix Clariprint en temps réel dans l'overlay (pari conditionnel à l'avancement API Clariprint, sinon co-dev avec devs Clariprint).

**Contexte stratégique (mention courte) :** v1.1 est une étape de la roadmap concentrique de Magrit IA, copilote intelligent du print B2B français. La logique d'expansion : producteur (imprimeur) → ses clients (acheteurs B2B) → ses pairs marché (annonceurs type Altavia côté Expert Solutions, industriels producteurs verticaux type Fanatics qui conçoivent / impriment / packagent / vendent leurs produits, industriels hors production type Royal Canin et acteurs du luxe sur leurs packaging). La roadmap évolue selon les projets clients menés en parallèle. Voir document `VISION.md` (à créer à la racine du projet) pour le détail du flywheel marché et des cibles V2/V3.

**Note gouvernance :** Magrit IA est un projet porté par AGE Développement (incubateur), destiné à devenir Magrit SAS au déclenchement Phase 2 capitalistique avec Expert Solutions comme co-fondateur (concédant du moteur Clariprint). AGE Services (BU agence IA d'AGE Dvt., projet frère) intervient comme intégrateur Magrit pour les projets clients qui demanderont du custom au-delà de l'usage standard.

### What Makes This Special

**Différenciateurs v1.1 (par ordre d'impact) :**

1. **Mockup engine paramétrique alimenté par specs Clariprint** — 100 % des produits ont un visuel cohérent dès J1, sans coût marginal par image. Là où la concurrence propose photos studio coûteuses ou pictos génériques peu engageants, Magrit génère à la volée un mockup paramétré (~15 templates SVG/Canvas, artwork procédural par couleur dominante boutique, cache Supabase Storage). Cohérence graphique **par construction**.

2. **Module Commandes-objet sans workflow** — choix architectural assumé : matérialiser l'entité commande dès v1.1 pour permettre lecture et renouvellement par l'acheteur, sans engager le coût d'un workflow complet (validation / paiement / expédition reportés). Approche *ship the smallest thing that validates* — l'objet existe, l'extension future est cadrée par les statuts E4.2 (`draft → validated → in_production → shipped → delivered → invoiced`).

3. **Multi-tenant strict avec RLS testé (déjà livré E9.10)** — différenciateur structurel pour adresser les contrats grands comptes B2B (industriels, agences) où l'isolation tenant est non-négociable.

4. **Definition of Done pilotée par cahiers de tests Notion exécutables Claude in Chrome** — chaque story v1.1 atterrit avec ses cas de test ajoutés à la DB Notion `7e576e69…`, joués automatiquement via Claude in Chrome sur les `data-testid` stables (E7.7 livré). Permet la non-régression sur 4 betas en parallèle sans QA humain par sprint, vélocité préservée.

5. **Connecteur Canva quick-win** — Magrit n'embarque pas de design studio natif (décision produit assumée, CONTEXT §6.3). Le connecteur Canva permet à l'acheteur ou à l'imprimeur d'aller designer son fichier print dans Canva à partir du gabarit Clariprint, et de revenir avec son design dans Magrit. Posture rare sur le marché B2B print : intégrer plutôt que reconstruire.

**Pari conditionnel non-bloquant :** recalcul prix Clariprint en temps réel dans l'overlay ProductCard. Inclus si l'API Clariprint suit, sinon reporté à un sprint co-développé avec les devs Clariprint. Les listes déroulantes Clariprint actuelles suffisent au scope minimal v1.1.

**Core insight :** *Les imprimeurs ne veulent pas devenir des e-commerçants. Ils veulent vendre comme avant — par devis, par configuration, par relation — mais avec une couche digitale qui élimine 80 % du travail manuel.* Magrit substitue progressivement les ERP/MIS legacy de l'imprimerie en attaquant les fonctions où la friction est maximale (saisie parc, traitement AO Excel, relation annonceur-prestataire). Chaque fonction qui simplifie la genèse du business est un levier d'adoption mesurable, pas un nice-to-have.

**Pourquoi un imprimeur choisit v1.1 plutôt que de garder son setup actuel :** parce qu'il peut, dès le déploiement, proposer à ses acheteurs pros une boutique moderne avec leurs commandes, des visuels cohérents, et un overlay de configuration produit aligné aux specs Clariprint — **sans rien coder, sans briefer un studio photo, sans gérer un Shopify**. La promesse est lisible en démo en moins de 3 minutes.

## Project Classification

| Dimension | Valeur |
|---|---|
| **Project Type** | `saas_b2b` (form factor `web_app` — Vite 6 + React 18 + TypeScript + Tailwind v4 + shadcn/ui + Supabase) |
| **Domain** | `general` (web-to-print B2B, hors taxonomie BMAD native) avec adjacence `fintech` côté roadmap (e-invoicing FR obligatoire 2026-2027, paiements Stripe E4.3 reportés) |
| **Complexity** | **Medium** sur le scope v1.1 — tirée par : multi-tenant strict (RLS testé E9.10), observabilité LLM (E7.1 livré, E7.3 reporté), intégration Clariprint externe, mockup engine nouveau, exécution tests Claude in Chrome via plugin MCP. **High** au niveau projet global avec roadmap V2+ (E5.1 API publication, T-03 sync eCommerce, traitement AO Excel grands volumes) |
| **Project Context** | **Brownfield** — code existant sur `beta/v4` (Sprint 2 livré : E9.5, E9.10, E9.11, E9.12, E3.1+E3.2, E7.7, E9.6 + fixes), branche `beta/v5` créée pour cette itération, 4 documents structurants au repo, cahiers de tests fonctionnels actifs depuis E7.7+E7.8 |
| **Iteration Scope** | `e-shop-v1.1` sur `beta/v5` + Story 0 hotfix sur `beta/v4` |
| **Stack LLM** | Anthropic Claude (raisonnement complexe : `claude-sonnet-4-…` ou supérieur ; PIM : `claude-haiku-4-5-20251001`). **Migration GPT-4o → Haiku 4.5 = story P0 parallèle (E-NEW-LLM-01)** pour la génération rapide — impact qualité prompts. |

---

## Success Criteria

### User Success

**Persona primaire — Imprimeur (utilisateur Magrit Pro)**

| Critère | Métrique mesurable | Cible v1.1 |
|---|---|---|
| Vitesse de génération devis complexe | Temps médian entre demande acheteur et devis affiché complet | **< 8 secondes** (p50) sur un devis 3-options |
| Taux de devis livrés sans retry | Devis générés sans intervention manuelle / total devis générés | **> 92 %** (vs ~80 % baseline GPT-4o → bénéfice direct E-NEW-LLM-01) |
| Renouvellement de commande par l'acheteur | Acheteurs ayant renouvelé ≥ 1 commande dans les 30j post-livraison v1.1 | **> 25 %** des acheteurs actifs |
| Adoption visuelle | Boutiques publiées avec ≥ 80 % des produits en mockup paramétrique (vs picto générique) | **100 % des boutiques Pro+** déployées sur v1.1 (par construction du mockup engine) |

**Persona secondaire — Acheteur de l'imprimeur (utilisateur boutique B2B)**

| Critère | Métrique mesurable | Cible v1.1 |
|---|---|---|
| Time-to-first-action sur la boutique | Temps entre arrivée sur `/shop/:slug` et 1ère action métier | **< 15 secondes** (p50) |
| Taux de panier finalisé en devis | Paniers ayant déclenché un devis / paniers créés | **> 60 %** (baseline B3 à mesurer en début de sprint) |
| Découvrabilité produit | Acheteur trouve le produit cherché en ≤ 2 clics depuis la home boutique | Vérifié sur cahier de tests TF P09 |

### Business Success

> _Note Arnaud (2026-05-08) : les jalons théoriques sont validés. **Les dates de démarrage exactes sont fonction du calage de la roadmap v1 production** (cible CONTEXT_Magrit_IA.md : septembre 2026 — V1 ; v1.1 = post-bêta donc en aval). Le plan business sera précisé quand cette ancre v1 prod sera elle-même verrouillée. Aucun jalon ci-dessous ne doit être traité comme date contractuelle tant que la v1 prod n'a pas été calée._

| Critère | Métrique | Cible v1.1 |
|---|---|---|
| **Démo client B4** | Hotfix Fiche déployé sur `beta/v4` + démo jouée sans incident démo-killer | **Avant le 2026-05-23** (J+15 décidé 2026-05-08) — **driver Story 0** |
| Conversion bêta-testeurs | Bêta-testeurs identifiés (Philippe Dupuy / Vincent Gillier) ayant utilisé v1.1 et signé une LOI | **≥ 2 LOI signées** dans les 60j post-livraison v1.1 _(à recaler selon pipe)_ |
| Activation Pro | Imprimeurs ayant créé une boutique premium et invité ≥ 1 acheteur | **≥ 3 imprimeurs** dans les 30j post-livraison _(à recaler selon pipe)_ |
| Trajectoire MRR | Contribution v1.1 à la trajectoire seuil Phase 2 (MRR ≥ 5 000 €/mois) | v1.1 doit débloquer **≥ 1 contrat Pro à 990 €/mois** signé dans les 90j _(à recaler)_ |
| Crédibilité démo Phase 2 BPI (M6 Dihnamic) | v1.1 livrée et démontrable au comité de pilotage Dihnamic | **Avant fin M6** (calage exact selon calendrier reporting BPI à confirmer) |

### Technical Success

| Critère | Métrique | Cible v1.1 |
|---|---|---|
| **Couverture cahiers de tests Notion** | % parcours v1.1 (P09 boutique + P00-P08 régression + P10/P11 streaming) couverts par cas TF avec testid stables | **100 %** au merge final |
| **Tests joués automatiquement par Claude in Chrome** | % cas TF v1.1 exécutables sans intervention humaine | **≥ 80 %** (le reste = cas SQL DB + Manuel humain) |
| **Performance LLM post-migration E-NEW-LLM-01** | Réduction du taux de retries observés en prod sur les sorties LLM (mesurée via `llm_usage_events`) | **-50 %** des retries vs baseline GPT-4o (mesure plus factuelle que le « +10 % JSON valide » initial — décision Arnaud 2026-05-08) |
| **Isolation tenant (régression test)** | Tests RLS E9.10 passent sur `beta/v5` + nouveaux tests Order entity | **6/6 tests E9.10 verts** + nouveaux tests Order **0 fuite cross-tenant** |
| **Mockup engine performance** | Temps de génération + cache hit pour une image produit | **< 300 ms** premier rendu, **< 50 ms** cache hit |
| **Hotfix Fiche B4** | Aucune régression introduite sur les parcours P00-P09 existants après le fix | **0 test TF cassé** |
| **Pas d'outage prod B1** | La branche `main` (B1) reste isolée et inchangée pendant l'itération v1.1 | **0 commit** sur `main` autre que des hotfixes critiques |

### Definition of Done — règle projet pérenne

**Toute story Magrit livrée (v1.1 et au-delà) doit être accompagnée de cas de test ajoutés à la DB Notion 🧪 Cahiers de tests fonctionnels Magrit** (ID `7e576e69-5d50-4cc9-a32e-ad92f4dde01c`), en respectant les règles suivantes :

1. **≥ 1 cas TF** par parcours fonctionnel nouveau ou modifié.
2. **Format identique à l'existant TF-XX** : Titre, Parcours (P00-P11), Persona, Précondition, Étapes numérotées, Résultat attendu, Hints DOM (testid ou structure), URL de départ, Type d'exécution (Manuel humain / IA Chrome / SQL DB), Données de test, Statut.
3. **Hints DOM** centralisés dans `src/lib/testIds.ts` (objet `TEST_IDS as const`). **Ne jamais inventer un testid** sans le déclarer dans ce fichier.
4. **Convention testid** : `data-testid="<scope>-<element>[-<modifier>]"` — scope ∈ {`tenant`, `user`, `shop`, `magrit`, `auth`, `quote`, `usage`, `nav`}. Pas de scope `marguerite` (renommé Magrit, cf. naming).
5. **Stabilité publiée** : un testid ne change plus à la légère. Renommage = dual-tag pendant 1 sprint, mise à jour Notion, suppression sprint suivant.
6. **Production** : les `data-testid` sont conservés en prod (pas de plugin de strip).
7. **À chaque PR mergée**, le statut du cas de test associé dans Notion est mis à jour (`À jouer` → `Jouée OK` ou `Anomalie détectée` avec lien anomalie).
8. **Jouabilité dual** : tout cas TF doit être exécutable indifféremment par un humain ou par Claude in Chrome (via testid stables). C'est un invariant non-négociable du projet.

### Critère de réussite v1.1 — 4 conditions cumulatives

À 90 jours post-livraison v1.1, l'itération est considérée comme un succès **si et seulement si les 4 conditions ci-dessous sont remplies en même temps** :

```
v1.1 réussie  =  (≥ 3 boutiques premium publiées par des imprimeurs Pro)
              ET (≥ 2 LOI signées par des bêta-testeurs)
              ET (100 % des cas TF v1.1 couverts et passants)
              ET (E-NEW-LLM-01 montre -50 % de retries observés en prod)
```

Si une seule des 4 conditions tombe, v1.1 a manqué sa cible globale et **ne déclenche pas la Phase 2 capitalistique** (création Magrit SAS). On itère sur ce qui manque avant d'engager la cap-table.

---

## Product Scope

### MVP — Minimum Viable Product (doit absolument tourner pour démo + 1er bêta-testeur)

> _Si on ne livre QUE ça, on a quand même une démo crédible et un produit utilisable._

- **Story 0 — Hotfix régression Fiche B4** sur `beta/v4` (démo-blocker, deadline 2026-05-23)
- **Boutique B2B premium minimum** (E9.13 : layout 3 colonnes, dark mode, header brandé tenant)
- **Home boutique enrichie** : dernières commandes + paniers en attente
- **Catalogue par gammes** dépliables persistantes
- **Overlay ProductCard** avec options Clariprint en `<select>` (pas de saisie libre)
- **Order entity persistée** + bouton Renouveler
- **Mockup engine paramétrique MVP** : 5 templates (flyer, carte de visite, brochure, étiquette, kakémono) → couvre ~70 % des cas Clariprint print
- **E-NEW-LLM-01 Migration GPT-4o → Haiku 4.5** (P0 parallèle)
- **Couverture cahiers de tests TF + testids** sur tout le périmètre MVP (Definition of Done)

### Growth Features — Post-MVP, dans la même itération si temps

> _Ça transforme une démo crédible en démo qui claque._

- **Mockup engine étendu** : 10 templates supplémentaires (packaging cube/cylindre, PLV mousse, t-shirt, sticker, stylo, mug, bâche, drapeau, dossard, badge) → 100 % couverture Clariprint
- **Multi-sélection + comparateur produits** côte-à-côte
- **Actions groupées** (téléchargement fiches techniques, devis groupé)
- **Quick-win Canva** : envoi gabarit Clariprint → Canva, retour design dans Magrit
- **Recalcul prix Clariprint en temps réel** dans l'overlay (conditionnel à l'avancement API Clariprint)
- **Connecteur Affinity** (conditionnel à l'investigation Claude Cowork)
- **Fichiers produit en attente de production** sur la home boutique (dépend Order entity étendue)

### Vision (Future) — Hors v1.1, à itérer

> _Le rêve : Magrit devient l'OS du print B2B._

- **Workflow B2B complet sur Order entity** : statuts `validated → in_production → shipped → delivered → invoiced` + notifications email + lien public de suivi (E4.2 complet)
- **Stripe payment terminal** (E4.3) + e-invoicing FR (obligatoire 2026-2027)
- **Back-office validation commandes imprimeur** (E4.4)
- **Refonte UX saisie parc machines imprimeur** (sprint dédié, indispensable au scaling Freemium)
- **Module traitement fichiers AO Excel grands volumes** (la fonction disruptive #1 de la vision flywheel d'Arnaud)
- **Plateforme relationnelle annonceur ↔ prestataires** (ouvre les cibles Altavia / Royal Canin / Fanatics / luxe)
- **Sync eCommerce bidirectionnelle** Shopify/Woo/Magento (T-03)
- **API publication CMS** (E5.1) — pour les W2P qui veulent enrichir leurs gammes via Magrit
- **Liens sponsorisés Freemium → imprimeurs Pro** (US-NEW-10, levier growth flywheel)

---

## User Journeys

> _6 journeys narratifs couvrant les personas critiques de v1.1 et la persona tertiaire W2P (horizon mixte v1.1 + Vision). Chaque persona est nommé et contextualisé pour donner aux specs techniques une référence humaine concrète._

### Journey 1 — Imprimeur Pro, parcours nominal (persona primaire, happy path)

**Persona : Bruno Lefèvre, 52 ans, dirigeant d'une imprimerie traditionnelle de 18 salariés à Limoges.** Force de vente de 3 commerciaux, MIS de 2009, ~2,8 M€ de CA. Souscrit à Magrit Pro depuis 6 semaines (990 €/mois). Son parc Clariprint est saisi à ~70 %.

**🎬 Opening Scene — Lundi 9h15.** Bruno reçoit un mail de son client historique Maison Dubois (négoce de vins haut de gamme) : « j'ai besoin de 12 000 contre-étiquettes en deux finitions, vernis sélectif sur le logo, livraison sous 3 semaines. Tu peux me chiffrer aujourd'hui ? J'ai aussi besoin de 500 cartes de visite. » Avant Magrit, ce mail = 45 min de devis manuel + aller-retour Clariprint en bricolage.

**📈 Rising Action.** Bruno tape dans le chat Magrit en mode strict. Magrit pose 3 questions de clarification ciblées (papier, recto-verso, quantité minimum cartonnée). Bruno répond en 30 s. Magrit affiche en 6,2 secondes un devis complet avec descriptifs techniques, prix Clariprint, marge cible imprimeur, délai estimé.

**⭐ Climax.** Bruno clique sur « Mettre cette boutique de Maison Dubois à jour ». La home de la boutique privée Maison Dubois se rafraîchit : les 2 produits y apparaissent dans leur catalogue avec leur mockup paramétrique cohérent (étiquette + carte de visite, même angle, même éclairage, charte couleur Maison Dubois). Bruno envoie le lien à son client en 1 clic. Total : 4 min 15 s vs 45 min avant.

**🌅 Resolution.** Maison Dubois clique sur le lien à 11h, voit ses produits chiffrés et visualisés, valide la commande à 11h27 — la commande est persistée dans Magrit (Order entity v1.1), statut `validated`, Bruno reçoit une notif. La semaine suivante, Maison Dubois revient pour recommander le même lot de cartes : il clique sur « Renouveler » depuis l'historique, 2 clics, c'est fait.

### Journey 2 — Acheteur boutique B2B, parcours nominal (persona secondaire, happy path)

**Persona : Claire Mercier, 34 ans, responsable communication chez un négociant en vins de la région bordelaise.** Commande étiquettes, contre-étiquettes, plaquettes 4 à 6 fois par an. Elle ne connaît rien au print technique. Compte créé par son imprimeur Bruno il y a 2 mois.

**🎬 Opening Scene — Mardi 14h, salon Vinexpo dans 11 jours.** Claire reçoit un message de la direction : « On a besoin de 200 fascicules supplémentaires pour le salon, urgent. » Elle se souvient avoir fait imprimer ce fascicule l'an dernier mais n'a aucune idée des spécifications techniques.

**📈 Rising Action.** Claire arrive sur la boutique privée Maison Dubois (dark mode actif par défaut, header brandé en haut). La home affiche « Tes 3 dernières commandes » : la troisième est exactement le fascicule qu'elle cherche — « Fascicule Vinexpo 2025 — 500 ex, 16 pages, 135 g couché mat ». Elle clique, voit la fiche complète avec mockup paramétrique cohérent.

**⭐ Climax.** Elle clique sur « Renouveler ». L'overlay ProductCard s'ouvre en panneau latéral, pré-rempli avec les options de la commande passée. Elle modifie juste la quantité (500 → 200). Le prix se met à jour. Elle valide.

**🌅 Resolution.** Nouvelle commande créée avec statut `draft`, copie des 16 pages déjà uploadées de l'an dernier. Notification interne envoyée à Bruno. Total : 1 min 47 s. Quand Bruno la rappelle pour confirmer, il sait déjà tout.

### Journey 3 — Imprimeur Pro, edge case démo client (recovery hotfix Fiche)

**Persona : Bruno (même que Journey 1).**

**🎬 Opening Scene — Lundi 19h, veille de démo.** Bruno doit montrer Magrit le lendemain à un prospect (Imprimerie du Roi, Vincent Gillier). Il fait sa répétition. Il ouvre la home Magrit, clique sur une ProductCard de devis récent, clique sur l'onglet « Fiche » pour montrer les infos commerciales. Page blanche. Régression silencieuse depuis Sprint 2. Bruno panique.

**📈 Rising Action.** Il appelle l'équipe Magrit. Le hotfix Story 0 sur `beta/v4` est déjà en cours d'investigation depuis le morning standup. Le fix est livré à 22h ce soir-là (push GitHub Actions).

**⭐ Climax.** Mardi 9h45, démo. Bruno répète son scénario : devis → ProductCard → onglet Fiche → les infos commerciales s'affichent correctement. Vincent Gillier hoche la tête, prend des notes.

**🌅 Resolution.** Vincent Gillier signe une LOI dans les 3 semaines (contribue au critère Business Success « ≥ 2 LOI signées »).

### Journey 4 — Admin tenant, configuration boutique (parcours secondaire)

**Persona : Yasmine Bouchard, 28 ans, assistante de direction chez Bruno.** Gère l'administratif Magrit. Quand un nouveau client signe avec l'imprimerie, elle crée son espace boutique B2B privé.

**🎬 Opening Scene — Vendredi 10h.** Maison Dubois vient de signer comme fournisseur exclusif print pour 3 ans. Bruno demande à Yasmine : « Crée-leur leur boutique privée Magrit. »

**📈 Rising Action.** Yasmine se connecte à `/dashboard/users`, clique « Créer une boutique cliente », saisit nom = `Maison Dubois`, slug = `maison-dubois` (auto-validé contre conflits), upload du logo (drag-and-drop), sélection couleur primaire `#6B0F1A` bordeaux. Elle invite l'email pro de Claire Mercier comme `acheteur` (scope `shop_only`, droits `can_quote=true`, `can_order=true`).

**⭐ Climax.** Boutique créée en 90 secondes. Yasmine partage l'URL à Bruno qui la transmet au client. Le mockup engine est déjà actif : tout produit qu'on ajoute au catalogue Maison Dubois prendra automatiquement la couleur bordeaux dans son artwork procédural.

**🌅 Resolution.** Quand Bruno chiffre des produits depuis l'atelier, il choisit dans un dropdown la boutique cible — `Maison Dubois` apparaît immédiatement.

### Journey 5 — QA Claude in Chrome, exécution cahier de tests (parcours technique)

**Persona : Claude in Chrome — l'agent IA exécutant le cahier de tests Notion sur la boutique Maison Dubois.**

**🎬 Opening Scene — Vendredi 16h, fin de sprint v1.1.** La PR de l'overlay ProductCard a été mergée sur `beta/v5`. Le pipeline CI lance Claude in Chrome qui ouvre la DB Notion 🧪 Cahiers de tests fonctionnels Magrit, filtre `Cible Beta = B5 AND Statut = À jouer AND Type d'exécution contains IA Chrome`.

**📈 Rising Action.** Claude in Chrome trouve TF-47 — « Renouveler une commande passée depuis la home boutique ». Il lit la précondition, récupère les hints DOM (`[data-testid="shop-home-orders-list"]`, `[data-testid="shop-order-row"]`, `[data-testid="shop-order-renew-btn"]`), navigue vers l'URL de départ, authentifie un user de test, clique sur la première commande de la liste, clique « Renouveler ».

**⭐ Climax.** L'overlay ProductCard s'ouvre, Claude in Chrome vérifie que les options Clariprint sont pré-remplies, modifie la quantité, valide. Il vérifie en SQL DB que la commande a bien été créée avec les bons `tenant_id`, `shop_id`, `created_by`. Statut Notion du cas TF-47 → `Jouée OK`.

**🌅 Resolution.** 3 cas TF sur 47 cas v1.1 sortent en `Anomalie détectée` avec un lien vers une issue GitHub auto-créée. L'équipe corrige les 3 anomalies dans la matinée. Le PRD valide son critère technique « 100 % des cas TF v1.1 couverts et passants ».

### Journey 6 — W2P pure player, du devis à l'intégration CMS (persona tertiaire, horizon mixte v1.1 + Vision)

**Persona : Marc Tessier, 41 ans, dirigeant de Print2Web SAS, web-to-printer pure player régional.** 700 k€ CA, 12 salariés dont 4 deviseurs internes, ~800 produits actifs dans son catalogue Shopify. Gère un site e-commerce print depuis 2018. Son moteur de recherche site est faible : signal réel marché — sur **www.exaprint.fr** (concurrent de référence du secteur), taper « brochure 24 pages » ne renvoie aucun produit alors qu'il existe une catégorie qui s'appelle exactement « brochure ». Symptôme de la dette CMS data du marché entier.

**🎬 Opening Scene — Vendredi 9h, 47 devis en backlog.** Équipe deviseurs avec 47 devis hors-grille en attente, dont 12 datent de plus de 5 jours. Trois clients corporate B2B menacent d'aller voir la concurrence. En parallèle, Marc voulait ajouter une nouvelle gamme « livre photo dos carré collé 64 pages » à son catalogue Shopify : 3 jours de saisie à un de ses deviseurs (descriptifs, options, gabarits, prix, photos).

**📈 Rising Action.** Marc voit une démo Magrit chez son confrère Vincent Gillier. Il signe pour Magrit Pro le mois suivant. Première décision : utiliser Magrit pour les 3 clients corporate récurrents en priorité — scope v1.1, immédiat. Il crée 3 boutiques privées Magrit, invite leurs acheteurs en `shop_only`, leur envoie le lien. En 2 semaines, ces 3 clients passent par leur boutique privée plutôt que par mail → l'équipe deviseurs récupère ~12 h/semaine.

**⭐ Climax court terme (v1.1).** La gamme « livre photo dos carré collé 64 pages » : Marc la crée en une fois dans Magrit (une demande chat, chiffrage Clariprint, mockup engine génère le visuel). Elle est immédiatement disponible dans ses 3 boutiques B2B privées sans avoir touché Shopify. Les clients corporate ont accès à la gamme le jour même, vs 3 jours avant. *« Magrit me libère de la prison de mon CMS pour mes clients premium. »*

**⭐⭐ Climax long terme (Vision E5.1, hors v1.1).** Six mois plus tard : Magrit publie via API les produits chiffrés et leurs descriptifs riches vers le catalogue Shopify de Print2Web. Le moteur de recherche Shopify de Marc retourne désormais des résultats sur « brochure 24 pages » (et pas la simple page de catégorie). Marc passe son équipe deviseurs de 4 à 2.

**🌅 Resolution.** Print2Web traite désormais 3× plus de devis avec 2 deviseurs en moins. Le catalogue Shopify s'enrichit automatiquement à chaque nouveau produit Magrit. Marc reste sur Shopify (il aime sa stack e-commerce), mais Magrit est devenu la couche métier qui alimente son CMS au lieu de l'inverse. Modèle commercial : Pro à 990 €/mois → upgrade Business à 2 490 €/mois quand l'API publication est active.

### Journey Requirements Summary

| # | Capacité | Journeys | Horizon |
|---|---|---|---|
| **C1** | Boutique B2B premium par tenant (layout 3 cols, dark mode, theming par boutique cliente) | J2, J4, J6 | v1.1 |
| **C2** | Home boutique enrichie (dernières commandes / paniers en attente) | J1, J2 | v1.1 |
| **C3** | Mockup engine paramétrique alimenté par specs Clariprint + theming boutique | J1, J2, J4, J6 | v1.1 |
| **C4** | Overlay ProductCard avec options Clariprint en `<select>` + recalcul | J1, J2 | v1.1 |
| **C5** | Order entity persistée + bouton Renouveler + statut `draft` | J1, J2, J6 | v1.1 |
| **C6** | Lien atelier → boutique cliente (publication produit chiffré dans catalogue) | J1, J6 | v1.1 |
| **C7** | Hotfix régression Fiche sur `beta/v4` (Story 0) | J3 | Hotfix indépendant |
| **C8** | Cahier de tests TF couvrant 100 % v1.1 + jouable Claude in Chrome | J5 | DoD |
| **C9** | Multi-boutiques par tenant (validation pas de plafond N) | J6 | v1.1 (validation) |
| **C10** | Push instantané gamme/produit vers les N boutiques d'un tenant | J6 | v1.1 |
| **C11** | API de publication CMS (Magrit → Shopify/Woo/Magento) | J6 | **Vision (E5.1)** |
| **C12** | Sync bidirectionnelle stocks/statuts CMS ↔ Magrit | J6 | **Vision (T-03)** |
| **C13** | Moteur de recherche sémantique « brochure 24 pages » → produit + variante | J6 | **Vision (story à créer, signal ExaPrint)** |

**Capacités existantes confirmées (réutilisées par v1.1) :** chat Magrit mode strict (story 2.2), création boutique cliente wizard (E9.4 + E9.6), invitations acheteurs avec scope `shop_only` (E9.3 + E9.5), RLS multi-tenant (E9.10), instrumentation testid (E7.7).

---

## Domain-Specific Requirements

> _Classification step 2 : domain `general` (web-to-print B2B, hors taxonomie BMAD native), complexity `medium`, adjacence `fintech`. Cette section pose les contraintes domain non-triviales qui informeront l'architecture v1.1 et au-delà._

### Compliance & Regulatory

| Item | Statut v1.1 | Implication |
|---|---|---|
| **RGPD** | À renforcer | Données B2B (acheteurs sur boutiques privées), audit trail (table `tenant_member_events` existante à étendre aux Order entity), droit à l'effacement, retention policy à définir |
| **e-invoicing FR** (calendrier resserré confirmé par WebSearch 2026-05-08) | **Anticiper l'architecture, pas implémenter** (décision Arnaud) | Calendrier officiel : phase pilote prod **23 février 2026** (active), obligation B2B **grandes et moyennes entreprises 1er septembre 2026**, extension PME **2027**. Toute e-invoice doit transiter par une **Plateforme Agréée (PA, anciennement PDP)** type Comarch qui dialogue avec le **PPF (Portail Public de Facturation)**. Order entity v1.1 doit être extensible vers facturation conforme PA/PPF sans refactor majeur. Schéma `orders` doit prévoir les hooks d'extension (numéro de facture, statut facturation, identifiants PA/PPF). **Urgence implicite :** un premier client Pro+ en grande/moyenne entreprise activé après septembre 2026 force le module facturation très rapidement |
| **Validation SIREN INSEE** | E6.1 livré (mock) | Mock `mockInseeLookup` dans `sirenValidator.ts` à remplacer par fetch INSEE Sirene V3 quand compte créé. **Hors scope v1.1** (décision Arnaud : flou pour l'instant, **dépendance externe à activer T-2 mois avant 1er POC client payant**) |
| **Convention de licence Clariprint** (Expert Solutions) | Active POC | Redevance 1 € symbolique pendant POC, intéressement progressif sur MRR (0 % ≤ 5k€, 8 % de 5-20k€, 12 % au-delà). PI : moteur = Expert Solutions, couche IA = AGE Dvt. Toute exposition publique du moteur doit respecter les obligations contractuelles (pas de scraping inverse, pas de redistribution non-licenciée). Le « panel Magrit » (prix marché agrégés anonymisés) est la seule sortie publique légitime |
| **Reporting Dihnamic / BPI** | Continu | 4 jalons M3/M6/M9/M12, tout glissement > 4 semaines à notifier. v1.1 doit être démontrable au comité M6 |

### Technical Constraints

| Item | Niveau | Note |
|---|---|---|
| **Sanitization défensive Clariprint — module commun** | **Critique** | Anomalies connues (CONTEXT §3.5) : prix négatifs (-1,2 € observé), valeurs `undefined` dans payloads, produits légalement requis manquants. **Module utilitaire commun** (décision Arnaud) `validateClariprintResponse(payload) → {valid, errors[], sanitized}` à appeler en sortie de chaque appel API, **pas dupliqué endpoint par endpoint**. Toute intégration v1.1 (Order entity, mockup engine, overlay ProductCard) doit l'utiliser |
| **Multi-tenant strict (RLS Supabase)** | **Critique** | Toute nouvelle table v1.1 (`orders`, `order_items`, `mockup_cache`, etc.) doit avoir des policies RLS et des tests vitest similaires à E9.10. **0 fuite cross-tenant tolérée** |
| **Validation schéma JSON strict** (story 1.3 P0) | **Critique** | Sur toutes sorties LLM. D'autant plus important après migration Haiku 4.5 (E-NEW-LLM-01) |
| **Limite 25 paramètres par prompt** (story 2.4 P0) | Critique | Anti-hallucination, à respecter dans tous nouveaux prompts v1.1 (overlay configurateur, mockup artwork) |
| **Token usage tracking** (E7.1 livré) | Étendre | Table `llm_usage_events` doit logger les nouveaux endpoints v1.1 (mockup, ordering). Permet le calcul de la métrique « -50 % retries » |
| **Streaming WebSocket** (E3.1 livré, flag `ENABLE_STREAMING_CHAT=true`) | Préserver | Ne pas dégrader le streaming chat existant en touchant à l'overlay ProductCard |
| **Performance mockup engine** | Cible | < 300 ms premier rendu, < 50 ms cache hit. Implique génération SVG/Canvas server-side (pas de génération client lourde sur mobile) |
| **Audit trail commandes** | À créer | Toute transition de statut Order entity doit être loguée pour démontrer la traçabilité (utile démo + futur back-office) |

### Integration Requirements

| Système | Rôle | Statut v1.1 |
|---|---|---|
| **Clariprint API REST** | Moteur de prix déterministe, **dépendance non substituable** | Production — pari conditionnel sur recalcul live overlay (selon avancement API Clariprint) |
| **Supabase** | DB multi-tenant + Storage (cache mockup, fichiers acheteurs) | Production — extension v1.1 : tables `orders`, `order_items`, bucket `product_mockups/{tenant}/` |
| **Anthropic Claude API** | Sonnet (raisonnement) + Haiku 4.5 (PIM, génération rapide post-migration) | Production |
| **OpenAI GPT-4o** | Génération rapide (legacy) | **À déprécier via E-NEW-LLM-01 P0 parallèle** |
| **Resend** | Envoi emails invitations (E9.5 livré) | Production — domaine `from` à vérifier sur Resend |
| **Canva** | Quick-win v1.1 — gabarits Clariprint → Canva, retour design | **Nouveau v1.1** |
| **Affinity (via Claude Cowork)** | Connecteur design alternative | **Conditionnel** — investigation à mener |
| **Notion API** | DB cahiers de tests + backlog Sprint Board | Production via MCP |
| **Claude in Chrome (MCP plugin)** | Exécution automatisée des cahiers TF | Production — DoD globale |
| **GitHub Actions** | CI/CD (déploiement edge functions, tests) | Production |
| **INSEE Sirene V3** | Validation SIREN production (remplace mock E6.1) | **Hors scope v1.1** — à activer T-2 mois avant 1er POC client payant |

### Risk Mitigations

| Risque | Impact | Mitigation |
|---|---|---|
| **Clariprint renvoie un payload invalide** (-1,2 €, `undefined`, produit manquant) | Devis faux affiché à l'acheteur → perte de confiance immédiate | Module `validateClariprintResponse` systématique avant exposition utilisateur |
| **Hallucinations LLM** dans les descriptifs produits, options Clariprint | Devis incohérent, options inexistantes | Validation JSON schéma strict (1.3) + limite 25 paramètres (2.4) + migration Haiku 4.5 (E-NEW-LLM-01) |
| **Latence LLM > 8 s sur génération devis** | Friction acheteur, abandon panier | Migration Haiku 4.5 (-30 % p50) + cache mockup engine (image déjà calculée si renouvellement) |
| **Fuite cross-tenant via Order entity** | Brèche RGPD, perte de confiance grands comptes | Tests RLS vitest sur `orders`, similaires à E9.10. Convention : aucune query Supabase sans filtre `tenant_id` côté client |
| **Régression silencieuse type "Fiche"** | Démo cassée, perte d'opportunité commerciale | Cahiers de tests TF Notion + Claude in Chrome (DoD pérenne). La régression Fiche aurait dû être attrapée par P05/P08 |
| **Dépendance forte API Clariprint** | Bug Clariprint = bug Magrit | Couche d'abstraction côté Magrit (pattern adapter) + monitoring spécifique des endpoints Clariprint dans `llm_usage_events` |
| **Confidentialité Dihnamic / Expert Solutions** | Rupture de licence, blocage POC | Ne pas exposer publiquement les paramètres internes Clariprint. Le « panel Magrit » est la seule sortie publique légitime |
| **Risque ERP/MIS legacy attachement client** | Cycle de vente long, friction adoption | Stratégie produit déjà alignée : ne pas chercher à remplacer le MIS d'un coup, attaquer par fonctions de friction maximale |

### Story P0 pré-v1.1 — investigation prix mystère

> _Décision Arnaud + John, 2026-05-08 : ajout d'une story d'investigation prioritaire **avant** le démarrage du sprint v1.1 sur `beta/v5`, parce que l'équipe ne sait plus aujourd'hui tracer la source du second prix affiché par Magrit (le premier venant de Clariprint). Sans clarification, l'architecture Order entity est bâtie sur du sable._

**E-NEW-CLARIPRINT-01 — Investigation provenance des prix et infos produits affichés (P0, taille S)**

- **Placement :** **pré-v1.1** (option (a) validée). Exécutée avant tout travail de fond sur `beta/v5`. Peut être conduite en parallèle du hotfix Story 0 sur `beta/v4`.
- **Objectif :** tracer toutes les sources de prix et d'infos produits affichées dans Magrit (front + atelier + boutique). Identifier celles qui ne viennent pas directement de l'API Clariprint.
- **Livrables :**
  1. Diagramme de flux (1 page) : toutes les sources de prix par écran.
  2. Document `PRICE_SOURCES.md` à la racine du projet listant : provenance, conditions d'affichage, comportement en cas d'anomalie Clariprint (-1,2 €, `undefined`, etc.).
  3. Décision tranchée (à valider avec Arnaud) : supprimer / marquer comme estimation LLM / corriger le fallback.
  4. Pour les infos produits en cas de prix Clariprint en échec : déterminer si Clariprint envoie quand même un partial payload ou rien — et tracer le comportement actuel de la couche IA face à ça.
- **Pré-condition obligatoire avant** : E5/Order entity persistée, overlay ProductCard recalcul live, mockup engine (qui pourrait dépendre des infos produit Clariprint).
- **Effort estimé :** 1-2 jours d'investigation + 0,5 jour de fix/cleanup selon les findings.

---

## Innovation & Novel Patterns

> _Step 6 BMAD optionnel exécuté car 4 signaux d'innovation tangibles dans v1.1, validés par WebSearch concurrentiel 2026-05-08. Pas de « innovation theater » forcé — les angles ci-dessous sont étayés par le marché._

### Detected Innovation Areas

| # | Aspect innovant | Pourquoi c'est nouveau | Catégorie |
|---|---|---|---|
| **I1** | **Mockup engine paramétrique alimenté par specs Clariprint** | Combinaison rare : moteur de prix print déterministe externe (Clariprint) + génération visuelle paramétrique cohérente par boutique cliente. Aucun e-shop print du marché ne paramétrise le visuel à partir des specs réelles d'imprimerie en temps réel. WebSearch confirme : l'IA dans le W2P 2026 se concentre sur le **prepress automatique et le routage prod**, pas sur le visuel produit paramétrique B2B. Zone blanche. | Novel combination |
| **I2** | **Cahiers de tests Notion exécutés par Claude in Chrome via MCP** | DoD opérationnelle où chaque story livre un cas TF jouable indifféremment par humain ou par IA, sur testid stables. Très peu d'équipes ont mis ça en production début 2026 (Claude in Chrome / MCP plugin sont récents). Permet la vélocité préservée sur 4 betas en parallèle. | New paradigm (CI/CD × IA) |
| **I3** | **Magrit IA = couche d'assistant business imprimeur sur la phase devis → commande**, pas un MIS, pas un Shopify | Positionnement produit unique sur le segment FR/EU. WebSearch McKinsey 2026 : *« Quote and deal pricing workflows are in a midstage use case phase that is comparatively less advanced, but emerging already »* — Magrit s'inscrit dans une vague qui démarre, pas un marché saturé. Cas d'usage adjacent confirmé : Simply Business (devis assurance B2B dans ChatGPT). Pour le print B2B FR/EU, **personne ne couvre les 4 axes** (IA conversationnelle + moteur déterministe + portail B2B premium + multi-tenant strict). | Novel approach + AI agents |
| **I4** | **Architecture commande extensible vers e-invoicing FR sans refactor** | Order entity v1.1 conçue pour anticiper PA/PPF (e-invoicing FR obligatoire **1er septembre 2026 pour B2B grandes/moyennes entreprises**, **2027 pour PME** — calendrier confirmé par WebSearch 2026-05-08) sans en payer le coût aujourd'hui. Approche défensive rare dans le SaaS B2B FR — la plupart attendent l'échéance puis font un refactor douloureux. | Workflow automation (anticipation réglementaire) |

### Market Context & Competitive Landscape

#### 🎯 Cibles clients (et pas concurrents)

**Web-to-printers / pure players → ce sont nos clients (persona Marc Tessier — Journey 6 — à toutes les échelles).**

- **Groupe Cimpress** (NL/IE, ~2,8 Mds$ CA) possède **ExaPrint** (FR, depuis 2018), **Pixartprinting** (IT), **Vistaprint** (US), **Drukwerkdeal**, **Tradeprint**, **Printi**, **Easyflyer**, etc. → un seul groupe = N marques = cible client unique à très fort potentiel commercial. Un contrat Cimpress débloquerait plusieurs marques d'un coup.
- Ces acteurs sont des **imprimeurs avec leurs propres imprimeries** + un front e-commerce. Ils incarnent **exactement la persona Journey 6** (Marc Tessier W2P) à grande échelle.
- **Ce que Magrit leur apporte :** couche IA pour résoudre la dette CMS data (cf. anecdote ExaPrint « brochure 24 pages → 0 résultat »), enrichissement devis hors-grille, portail B2B premium pour leurs clients corporate récurrents, configurateur Clariprint pour étendre leur catalogue sans repasser par leur CMS.
- **Modèle commercial cible :** tier **Enterprise** (4 900 € + modules) avec engagement 36 mois pour Cimpress / acteurs équivalents. Tier **Pro** (990 €) pour les W2P régionaux type Print2Web / lemagasinduprint.fr.

**Plateformes e-commerce généralistes → complémentaires, pas concurrentes.**

- **Shopify, WooCommerce, Magento, BigCommerce, PrestaShop** ne couvrent pas le print B2B technique (impossibilité de chiffrer dynamiquement avec options Clariprint formats / papiers / finitions / dorure).
- **Magrit ne se positionne PAS** sur le e-commerce généraliste à grande échelle.
- **Magrit se positionne EN COMPLÉMENT :** boutique B2B rapide à déployer pour un client corporate donné de l'imprimeur (Journey 1, 2, 4), shops B2B transactionnels pour les gros comptes, couche IA / configurateur métier print qui alimente les CMS existants via API (Vision E5.1).
- **Posture commerciale assumée :** *« Boostez votre Shopify avec l'IA print »* plutôt que *« remplacez votre Shopify »*. Logique de partenariat technique + revenue-share sur referrals plutôt que de substitution.

#### ⚔️ Concurrents réels (zone blanche identifiée)

L'unicité de Magrit vient de la **combinaison de 4 axes** : IA conversationnelle + moteur Clariprint + portail B2B premium + multi-tenant strict. WebSearch 2026-05-08 confirme qu'**aucun acteur connu ne couvre les 4 simultanément**. Concurrents **partiels** par axe :

| Axe | Concurrents partiels | Type de friction |
|---|---|---|
| **Moteur de devis print** | **MIS legacy imprimerie** (Tharreau, Calenda, Hiflow, OneVision, GMC, MultiPress) | Les imprimeurs ont déjà investi → frein à l'adoption (substitut fonctionnel installé). **Pas un concurrent commercial direct** mais une dette client |
| **IA appliquée au W2P** | Acteurs internes Cimpress (AI/ML pour advertising, design, site experience, customer service, manufacturing operations selon Q3 FY2026) — **mais en interne, pas en SaaS externe** | Risque de pivot futur, pas de menace immédiate |
| **Portail B2B print transactionnel** | Pas d'acteur SaaS identifié sur le marché FR/EU. Solutions custom internes chez les gros W2P | Pas de standard, opportunité ouverte |
| **Multi-tenant SaaS pour imprimeurs** | Pas d'acteur identifié | Opportunité ouverte |

**Repère pricing externe :** **DesignO** est mentionné dans CONTEXT §7 comme comparable de positionnement tarifaire (pas concurrent fonctionnel direct).

#### 💎 Conclusion stratégique

Magrit se positionne dans une **niche complémentaire** plutôt que dans une bataille frontale. Son rôle est d'**équiper les imprimeurs et W2P existants** (de l'imprimeur PME comme Bruno jusqu'à Cimpress) avec une couche IA + configurateur Clariprint, en **se branchant sur leurs CMS e-commerce** plutôt que de les remplacer. Le seul vrai « concurrent » au sens commercial est l'**inertie des MIS legacy déjà payés** par les imprimeurs traditionnels — friction d'adoption à gérer, pas concurrence à battre.

### Validation Approach

| Innovation | Méthode de validation v1.1 | Métrique de succès |
|---|---|---|
| **I1 — Mockup engine** | A/B test démo client : montrer 2 boutiques (avec et sans mockup). Mesurer le ressenti des 2 bêta-testeurs (Philippe Dupuy, Vincent Gillier) sur la perception « pro vs proto ». Indicateur indirect : taux de panier finalisé en devis (cible > 60 %, cf. Success Criteria) | Réaction qualitative bêta-testeurs + métrique conversion panier |
| **I2 — Cahiers de tests Claude in Chrome** | Couverture mesurée : 100 % des cas TF v1.1 documentés, ≥ 80 % jouables par IA. Mesurer le **temps de QA par sprint** : cible div ÷ 3 vs Sprint 2 (humain seul) | Couverture + temps QA |
| **I3 — Positionnement assistant business imprimeur** | Conversion démo → LOI (Success Criteria : ≥ 2 LOI dans les 60j post-livraison). Si 0 LOI signée malgré une démo qui plaît, c'est que le positionnement ne fait pas vendre | Taux LOI/démo + ARPU sur les 90 premiers jours |
| **I4 — Architecture extensible e-invoicing** | Validation par revue d'architecture : un dev externe lit le schéma `orders` et confirme qu'on peut ajouter PA/PPF sans rupture | Revue archi externe |

### Risk Mitigation

| Risque innovation | Probabilité | Fallback |
|---|---|---|
| **I1 — Mockup engine ne convainc pas en démo** (perception « gimmick », pas pro) | Moyenne | Fallback graphique : option d'override par photo studio quand l'imprimeur en a une (déjà prévu dans la roadmap V2) → on bascule plus tôt si nécessaire. Pas de blocage car le mockup reste mieux qu'un picto générique |
| **I2 — Claude in Chrome trop instable** pour exécuter 80 % des tests automatiquement | Moyenne | Fallback : exécution humaine sur les cas qui foirent. La DoD impose la jouabilité humaine de toute façon. Pas de blocage car la convention est dual |
| **I3 — Positionnement « assistant business imprimeur » mal compris** par le marché qui voit Magrit comme « un Shopify pour imprimeurs » | Moyenne | Fallback marketing : repositionner le pitch sur la phase « devis → commande » plus explicitement. Risque principalement éditorial, pas technique |
| **I4 — e-invoicing FR architecture insuffisante** (deadline septembre 2026 plus proche que prévu) | Faible (anticipation conservative) | Fallback : refactor `orders` à T-3 mois avant l'échéance d'un client. Coût acceptable s'il faut le faire |
| **🔍 Watch-item — Cimpress lance une couche SaaS IA externe** (pivot stratégique post-Q3 FY2026 où ils investissent en interne) | Faible aujourd'hui, à monitorer | **Mitigation préventive : transformer Cimpress en client Magrit avant qu'ils ne deviennent concurrent** (logique « buy vs build » à leur vendre). Monitoring continu de [ir.cimpress.com](https://ir.cimpress.com) (annonces investor relations) et des keynotes printing-trade-show |

### Sources WebSearch (2026-05-08)

- [B2B pricing: Navigating the next phase of the AI revolution — McKinsey](https://www.mckinsey.com/capabilities/growth-marketing-and-sales/our-insights/b2b-pricing-navigating-the-next-phase-of-the-ai-revolution)
- [Building a Web-to-Print Portal: A Complete Guide for 2026 — PageDNA](https://www.pagedna.com/blog/web-to-print-portal/)
- [Mandatory B2B E-Invoicing in France [2026 Requirements] — Comarch](https://www.comarch.com/trade-and-services/data-management/e-invoicing/e-invoicing-in-france/)
- [France 2026 E-invoicing & E-reporting updates — Banqup](https://www.banqup.com/resources/blog/france-approves-finance-act-2026-confirms-e-invoicing-and-e-reporting-rules)
- [Cimpress Accelerates Strategy for Elevated Product Growth — Cimpress IR](https://ir.cimpress.com/news-releases/news-release-details/cimpress-accelerates-strategy-elevated-product-growth)
- [Cimpress (CMPR) Q3 2026 Earnings Transcript — The Motley Fool](https://www.fool.com/earnings/call-transcripts/2026/04/30/cimpress-cmpr-q3-2026-earnings-transcript/)

---

## SaaS B2B Specific Requirements

> _Deep dive imposé par le project type `saas_b2b` (CSV BMAD). Couvre 5 sections obligatoires : `tenant_model`, `rbac_matrix`, `subscription_tiers`, `integration_list`, `compliance_reqs`. Sections skipées : `cli_interface`, `mobile_first`._

### Project-Type Overview

Magrit est une **plateforme SaaS B2B multi-tenant à 6 tiers d'abonnement** (Freemium → Enterprise), opérant sur le marché du print B2B français et européen. Persona primaire = imprimeur Pro. Architecture web-app (Vite 6 + React 18 + TypeScript + Tailwind v4 + shadcn/ui + Supabase).

L'enjeu B2B distinctif : **isolation tenant stricte avec RLS testé** (E9.10 livré), **droits granulaires par utilisateur** (E9.3 livré), **API-first sur Clariprint** (moteur de prix externe), **architecture extensible pour e-invoicing FR PA/PPF** (échéance Sep 2026 grandes/moyennes entreprises).

### Tenant Model — Multi-tenant strict

**Architecture existante (Sprint 1-2 livrés) :**

| Table | Rôle | RLS |
|---|---|---|
| `tenants` | Espace SaaS (`slug`, `siren`, `siren_data`, `verified`, `verified_at`) | ✅ |
| `tenant_members` | Liaison user ↔ tenant (`access_scope`, `allowed_shop_ids`, `permissions`) | ✅ |
| `tenant_invitations` | Invitations email + tokens (Resend) | ✅ |
| `tenant_member_events` | Audit trail des actions sur memberships | ✅ |
| `tenant_slug_history` | Archivage rename slug (redirect 90j, E9.4) | ✅ |
| `tenant_gamme_subscriptions` | Souscription gammes (E9.6) | ✅ |
| `llm_usage_events` | Tracking consommation LLM par tenant (E7.1) | ✅ |
| `shops` (tenant-scoped) | Boutiques par tenant | ✅ |

**Routes :** `/t/:slug/dashboard`, `/t/:slug/atelier`, `/shop/:slug` (boutique publique).

**Extension v1.1 (à créer) :**

| Table | Rôle | RLS |
|---|---|---|
| `orders` | Order entity persistée (`tenant_id`, `shop_id`, `created_by`, `status`, `total_ht`, hooks PA/PPF e-invoicing extensibles) | ⚠️ obligatoire + tests vitest |
| `order_items` | Lignes de commande (produit, options Clariprint, quantité, prix unitaire) | ⚠️ obligatoire + tests vitest |
| `order_status_events` | Audit trail des transitions de statut Order (analogue `tenant_member_events`) | ⚠️ obligatoire + tests vitest |

**Storage Supabase (décision Arnaud 2026-05-08) :**
- Bucket `product_mockups/{tenant}/{shop_id}/{product_id}.png` pour le cache mockup engine paramétrique. Servi via CDN, pas de blobs en base. Cache invalidé manuellement quand un imprimeur change le branding boutique ou les specs Clariprint.

**Validation Journey 6 :** un tenant W2P doit pouvoir héberger N boutiques jusqu'à son quota tier (cf. tableau Subscription Tiers ci-dessous). Aucun plafond hardcodé sur la table `shops` au-delà de la limite tier.

### RBAC Matrix — Permission Model

**Rôles existants (E9.3 livré + fix superadmin commit `7881bcb` post-Sprint 2) :**

| Rôle | Scope | Permissions par défaut | Cas d'usage |
|---|---|---|---|
| **Superadmin Magrit** (membre `magrit-root`) | global | bypass tous les guards `canWrite` / `canManage` | Arnaud, équipe Magrit |
| **Admin tenant** | `magrit_full` | `can_manage_users`, `can_manage_shops`, `can_manage_gammes`, `can_quote`, `can_order` | Bruno (Journey 1, 4) |
| **Member tenant** (commercial / deviseur) | `magrit_full` | `can_quote=true`, `can_manage_users=false` | Force de vente Bruno |
| **Acheteur shop_only** | `shop_only` (avec `allowed_shop_ids[]`) | `can_quote=true`, `can_order=true` | Claire Mercier (Journey 2) |
| **Acheteur read-only shop_only** | `shop_only` | `can_quote=false`, `can_order=false` | Acheteur en consultation |

**Extensions v1.1 — permissions Order entity :**

| Permission | Admin tenant | Acheteur shop_only | Contrainte |
|---|---|---|---|
| `can_view_orders` | `true` | `true` (limité à `allowed_shop_ids`) | — |
| `can_create_order` | `true` | `true` | — |
| `can_renew_order` | `true` | `true` | — |
| `can_cancel_order` | `true` (toute commande `draft` du tenant) | `true` | **Acheteur ne peut annuler que ses propres commandes en statut `draft`**. UX souple tant que la commande n'a engagé personne |
| `can_export_orders` | `true` | `false` | Réservé admin (comptabilité, analytics) |

### Subscription Tiers — Mapping features v1.1 (verrouillé)

| Feature v1.1 | Freemium | Découverte (90 €) | Starter (390 €) | **Pro★ (990 €)** | Business (2 490 €) | Enterprise (4 900 €+) |
|---|---|---|---|---|---|---|
| **Quota devis / mois (fair-use)** | **10** | **50** | **250** | **1 500** | **4 000** | **10 000** (négocié au-delà) |
| Chat Magrit — mode ouvert + extrapolation | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Chat Magrit — mode strict + clarifications | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Atelier Magrit (chat devis + historique persistant) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Saisie parc machines imprimeur | ✅ _(collecte data, sponsored listing)_ | ✅ _(panel marché actif)_ | ✅ | ✅ | ✅ | ✅ |
| Overlay ProductCard + recalcul Clariprint _(fonction de base)_ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Mockup engine paramétrique | ✅ _(templates de base)_ | ✅ | ✅ | ✅ | ✅ + override photo studio (V2+) | ✅ + override photo studio (V2+) |
| Connecteur Canva | — | ✅ | ✅ | ✅ | ✅ | ✅ |
| Connecteur Affinity _(conditionnel Claude Cowork)_ | — | ✅ | ✅ | ✅ | ✅ | ✅ |
| Boutique B2B premium (E9.13) | — | — | ✅ | ✅ | ✅ | ✅ |
| **Quota boutiques par tenant** | **0** | **0** | **3** | **10** | **30** | **50** |
| Order entity + Renouveler | — | — | ✅ | ✅ | ✅ | ✅ |
| Multi-sélection + comparateur + actions groupées | — | — | ✅ basique | ✅ complet | ✅ complet | ✅ complet |

**Calibrage des quotas devis (justification) :**

- **Freemium 10/mois** : acté CONTEXT §7, lead-gen.
- **Découverte 50/mois** : ~2-3 devis/jour ouvré (indépendants, freelances print).
- **Starter 250/mois** : ~12-13 devis/jour ouvré (petit imprimeur 2-3 commerciaux).
- **Pro 1 500/mois** : ~75 devis/jour ouvré (imprimeur industriel, W2P moyen comme Marc Tessier).
- **Business 4 000/mois** : ~200 devis/jour ouvré (groupe multi-sites).
- **Enterprise 10 000/mois** : couvre ExaPrint (~5-6 k devis/mois calculés à partir de ~7-8 k commandes mensuelles, ~10 % issues de devis, taux de transformation ~15 %) + headroom. **Au-delà = contrat négocié** (cas Cimpress agrégé multi-marques).

**Calibrage des quotas boutiques (validé Arnaud) :** 0/0/3/10/30/50 selon tier.

**Métrique technique sous-jacente :** tokens LLM IN/OUT trackés via `llm_usage_events` (E7.1 livré). Facturation = compteur devis (user-facing), monitoring coût = tokens (interne).

### Integration List

→ Référence à la section [Domain-Specific Requirements > Integration Requirements](#integration-requirements) ci-dessus pour la liste complète. **Synthèse Step 7 :** 11 systèmes externes au total, dont 4 critiques v1.1 (Clariprint, Supabase, Anthropic Claude, Notion+MCP), 1 quick-win (Canva), 1 conditionnel (Affinity), 1 à déprécier (GPT-4o → Haiku 4.5 via E-NEW-LLM-01 P0), 4 reportés post-v1.1 (INSEE Sirene V3, PA/PPF, Stripe, sync eCommerce).

### Compliance Requirements

→ Référence à la section [Domain-Specific Requirements > Compliance & Regulatory](#compliance--regulatory) ci-dessus. **Points spécifiques B2B v1.1 :** RGPD multi-tenant, e-invoicing FR PA/PPF (Sep 2026 grandes/moyennes entreprises, 2027 PME), validation SIREN INSEE (mock E6.1, prod différée), licence Clariprint (Expert Solutions concédant), reporting Dihnamic/BPI (4 jalons M3/M6/M9/M12).

### Technical Architecture Considerations

**Pattern multi-tenant strict :**
- Toute query Supabase côté front DOIT inclure le filtre `tenant_id` (ou s'appuyer sur RLS automatique). Convention : ne jamais utiliser de `select` sans filtrage, même temporairement.
- Tests vitest RLS systématiques sur toute nouvelle table avec scope tenant.

**Pattern adapter Clariprint :**
- Couche d'abstraction `ClariprintAdapter` côté Magrit isolant les appels API, avec module commun `validateClariprintResponse(payload)` (cf. E-NEW-CLARIPRINT-01 P0 pré-v1.1).
- Sanitization défensive obligatoire avant exposition utilisateur (anomalies CONTEXT §3.5 : prix négatifs -1,2 €, undefined, produits manquants).

**Pattern LLM unifié :**
- SDK Anthropic uniquement après E-NEW-LLM-01 (dépréciation OpenAI).
- Validation JSON schéma strict en sortie (story 1.3 P0).
- Limite 25 paramètres par prompt (story 2.4 P0) — anti-hallucination.
- Tracking obligatoire dans `llm_usage_events` (E7.1) pour tout nouvel endpoint.

**Pattern feature flag par tier :**
- Source de vérité : `src/app/lib/featureFlags.ts` étendu pour les features v1.1 (boutique premium, mockup engine, Canva, Affinity, comparateur).
- Activation conditionnée à `tenant.tier` ET au quota d'usage en cours (compteur devis/boutiques).

**Pattern testid stable :**
- Convention `<scope>-<element>[-<modifier>]` (CONTEXT §4).
- Centralisation `src/app/lib/testIds.ts` (objet `TEST_IDS as const`).
- Conservation en production (overhead négligeable, indispensables E2E IA).

### Implementation Considerations

**Ordre d'exécution proposé pour le sprint v1.1** (à valider en Step 8 Scoping) :

1. **Pré-v1.1 (`beta/v4`) :** Story 0 hotfix Fiche + E-NEW-CLARIPRINT-01 investigation prix mystère.
2. **Foundations (`beta/v5`) :** schémas DB Order entity + RLS + tests vitest. Module commun `validateClariprintResponse`. Module commun `featureFlags` étendu.
3. **Mockup engine MVP :** 5 templates (flyer, carte de visite, brochure, étiquette, kakémono) + bucket Supabase Storage + cache.
4. **Boutique B2B premium (E9.13) :** layout 3 colonnes, dark mode, theming par boutique cliente.
5. **Home boutique enrichie + catalogue gammes persistant.**
6. **Overlay ProductCard + options Clariprint en `<select>`.**
7. **Order entity end-to-end :** création, lecture, renouvellement, annulation, audit trail.
8. **Quick-win Canva** + Affinity conditionnel.
9. **Multi-sélection + comparateur + actions groupées** (Growth).
10. **Mockup engine extension** (10 templates supplémentaires, Growth).

**Parallèle non-bloquant :** **E-NEW-LLM-01 migration GPT-4o → Haiku 4.5** (P0, taille S, en parallèle de tout).

**DoD à chaque étape :**
- Cas TF Notion ajoutés à la DB `7e576e69-…` selon convention.
- testid stables centralisés dans `testIds.ts`.
- Tests vitest RLS pour toute nouvelle table.
- Validation JSON schéma sur sorties LLM.
- PR atomique avec format `feat|fix|chore(v5): description courte` (sans apostrophe, préférence Arnaud).

---

## Project Scoping & Phased Development

> _Mode delivery confirmé : **phased** (3 phases déjà actées dans la section Product Scope ci-dessus). Cette section structure la stratégie de livraison sans inventer de phases nouvelles._

### MVP Strategy & Philosophy

**Approche MVP : « Problem-solving + Experience hybride ».**

| Dimension | Détail |
|---|---|
| **Problem solved** | Gap actuel entre le proto boutique v1 et un portail B2B démontrable à un client / signable par un bêta-testeur. Sans v1.1 MVP, la chaîne « devis → commande » ne peut pas être présentée comme bouclée |
| **Validated learning attendu** | (1) Bêta-testeurs (Philippe Dupuy / Vincent Gillier) signent une LOI après démo. (2) Au moins 1 imprimeur Pro publie une boutique premium dans les 30j. (3) Acheteurs renouvellent leurs commandes (≥ 25 % à 30j) |
| **Pourquoi pas un Revenue MVP pur** | Le vrai revenu (Pro à 990 €) ne se déclenche qu'avec une démo crédible et une boutique premium fonctionnelle. Le MVP doit donc être expérienciel en priorité, le revenu suit |
| **Pourquoi pas un Platform MVP** | L'API CMS publication (E5.1) qui ouvrirait une posture plateforme est explicitement Vision, hors v1.1 |

### Resource Requirements (hypothèses Arnaud 2026-05-09 — à corriger en relecture si besoin)

| Ressource | Allocation v1.1 | Note |
|---|---|---|
| **Arnaud** (PDG + PO + PM + démos client) | ~50-70 % du temps Magrit | Capacité variable selon multi-projets AGE Dvt / AGE Services |
| **Claude code (cette session ou suivantes)** | Dev assistant principal | Sprint full-time selon disponibilité d'Arnaud |
| **Tests automatisés** | Claude in Chrome via MCP | DoD globale, déjà en production (E7.7 + E7.8 livrés) |
| **Side effort partenaire** | Laurent Rebière / Xavier Péchoultres (Expert Solutions) sur API Clariprint si E-NEW-CLARIPRINT-01 nécessite leur input | À confirmer au lancement |
| **Side effort externe (optionnel)** | Dev humain pair-review architecture Order entity | Souhaitable pour la zone à risque tenant/RLS |

**Estimation effort total v1.1 (MVP + Growth) :** ~3-4 semaines de dev intensif (Claude code + Arnaud) si zéro blocker. Hotfix B4 + E-NEW-CLARIPRINT-01 = ~3 jours pré-sprint.

### MVP Feature Set (Phase 1 = MVP v1.1)

**Core User Journeys supportés :** J1 (imprimeur Pro happy path), J2 (acheteur happy path), J4 (admin tenant), J5 (QA Claude in Chrome). J3 (recovery hotfix) est servi par la Story 0 pré-sprint. J6 (W2P) partiellement servi par les capacités v1.1, son climax long terme reste Vision.

**Must-Have Capabilities (MVP v1.1) :**

- Story 0 hotfix régression Fiche sur `beta/v4` (avant 2026-05-23, démo)
- E-NEW-CLARIPRINT-01 investigation prix mystère (pré-v1.1 sur `beta/v5` ou parallèle hotfix)
- Schémas DB Order entity (`orders`, `order_items`, `order_status_events`) + RLS + tests vitest
- Module commun `validateClariprintResponse` (sanitization défensive)
- Boutique B2B premium minimum (E9.13 : layout 3 colonnes, dark mode, theming par boutique cliente)
- Home boutique enrichie (dernières commandes + paniers en attente)
- Catalogue par gammes dépliables et persistantes
- Overlay ProductCard avec options Clariprint en `<select>` (fonction de base, tous tiers)
- Order entity persistée + bouton Renouveler + statut `draft`
- Mockup engine paramétrique MVP (5 templates : flyer, carte de visite, brochure, étiquette, kakémono) + bucket Supabase Storage `product_mockups/`
- E-NEW-LLM-01 P0 parallèle — migration GPT-4o → Haiku 4.5
- Couverture cahiers de tests TF Notion + testid stables (DoD globale)

### Post-MVP Features (Phase 2 — Growth, même itération si temps)

- Mockup engine étendu (10 templates supplémentaires) → couverture 100 % Clariprint
- Multi-sélection + comparateur produits côte-à-côte
- Actions groupées (téléchargement fiches, devis groupé)
- Quick-win Canva (gabarit Clariprint → Canva, retour design)
- Connecteur Affinity (conditionnel investigation Claude Cowork)
- Recalcul prix Clariprint en temps réel dans l'overlay (conditionnel API Clariprint)
- Fichiers produit en attente de production sur la home boutique

### Vision Features (Phase 3 — post-v1.1)

- Workflow B2B complet sur Order entity (statuts `validated → in_production → shipped → delivered → invoiced` + notifications + lien public de suivi, E4.2 complet)
- Stripe payment terminal (E4.3) + e-invoicing FR PA/PPF
- Back-office validation commandes imprimeur (E4.4)
- Refonte UX saisie parc machines imprimeur (sprint dédié, scaling Freemium)
- Module traitement fichiers AO Excel grands volumes (fonction disruptive flywheel)
- Plateforme relationnelle annonceur ↔ prestataires (Altavia, Royal Canin, Fanatics, luxe)
- Sync eCommerce bidirectionnelle Shopify/Woo/Magento (T-03)
- API publication CMS (E5.1) — pour les W2P
- Liens sponsorisés Freemium → imprimeurs Pro (US-NEW-10, levier flywheel)
- Moteur de recherche sémantique enrichi (signal ExaPrint « brochure 24 pages »)

### Risk Mitigation Strategy — synthèse

| Type | Top 3 risques v1.1 | Mitigation |
|---|---|---|
| **Technique** | Clariprint instable (-1,2 €, undefined) | Module commun `validateClariprintResponse` obligatoire (Domain Req) |
| | Hallucinations LLM sur descriptifs / options Clariprint | Schéma JSON strict (1.3 P0) + limite 25 paramètres (2.4 P0) + migration Haiku 4.5 (E-NEW-LLM-01) |
| | Fuite cross-tenant via Order entity | Tests RLS vitest sur `orders` calqués sur E9.10 |
| **Marché** | Bêta-testeurs ne signent pas de LOI | Démo orientée mockup engine + Order entity (effets « wow » immédiats) |
| | Cimpress lance une couche IA SaaS externe | Monitoring [ir.cimpress.com](https://ir.cimpress.com) + accélération acquisition Cimpress comme client |
| | Mauvaise compréhension du positionnement assistant business | Pitch deck révisé sur l'angle « devis → commande » (recommandé en parallèle du PRD) |
| **Ressources** | Indisponibilité Arnaud (50-70 % du temps requis) | Découpage en stories atomiques mergeables indépendamment, pas de big-bang |
| | Blocker API Clariprint dépendant d'Expert Solutions | Pari recalcul live overlay reste **conditionnel** — chemin nominal sans dépendance externe |
| | Charge cognitive Arnaud (multi-projets) | Sprint focus strict sur v1.1 + Story 0, refus explicite de scope creep, BMAD discipline pour limiter les digressions |

### Garde-fou BMAD : pas de descope silencieux

Conformément à la règle BMAD step 8 : **aucune story explicitement validée par Arnaud n'a été sortie du scope sans alerte**. Toutes les stories de la conversation Copilot tour 23 + des décisions explicitement validées (Order entity simplifiée, mockup engine, Canva, hotfix B4, E-NEW-LLM-01, E-NEW-CLARIPRINT-01, fusion Storefront/E-shop, rename Marguerite → Magrit, repositionnement Altavia, scope multi-tenant W2P) sont placées dans une phase explicite ci-dessus.

---

## Functional Requirements

> _Capability contract du produit. 46 FR organisées en 9 domaines. Toute feature non listée ici ne sera pas livrée en v1.1 sauf ajout explicite._

### Domaine 1 — Gestion des tenants, boutiques et membres

- **FR1** Un superadmin Magrit peut créer un tenant via le wizard `/tenants/new` avec validation SIREN (mock E6.1, prod différée).
- **FR2** Un admin tenant peut renommer son tenant (slug) ; le système maintient un redirect 90 jours depuis l'ancien slug.
- **FR3** Un admin tenant peut créer une boutique B2B privée pour un client final, avec slug unique, logo et couleur primaire (theming).
- **FR4** Un admin tenant peut créer plusieurs boutiques jusqu'à la limite de son tier (Starter 3, Pro 10, Business 30, Enterprise 50).
- **FR5** Un admin tenant peut inviter un utilisateur avec un scope (`magrit_full` ou `shop_only` + `allowed_shop_ids[]`) via email Resend.
- **FR6** Un acheteur shop_only ne peut accéder qu'aux boutiques listées dans son `allowed_shop_ids`.
- **FR7** Le système enregistre un événement d'audit pour chaque action sensible sur un membership (création, modification de droits, révocation).

### Domaine 2 — Contrôle d'accès et permissions

- **FR8** Un admin tenant peut configurer des permissions granulaires par membre : `can_manage_users`, `can_manage_shops`, `can_manage_gammes`, `can_quote`, `can_order`, `can_view_orders`, `can_create_order`, `can_renew_order`, `can_cancel_order`, `can_export_orders`.
- **FR9** Un superadmin Magrit bypasse tous les guards `canWrite` / `canManage` quel que soit le tenant.
- **FR10** Le système empêche tout accès cross-tenant via Row-Level Security (RLS) Supabase sur toutes les tables tenant-scoped.

### Domaine 3 — Devis et configuration produit

- **FR11** Un utilisateur peut générer un devis depuis le chat Magrit en mode ouvert (extrapolation avec hypothèses affichées).
- **FR12** Un utilisateur peut générer un devis depuis le chat Magrit en mode strict (questions de clarification ciblées).
- **FR13** Le système calcule le prix d'un devis via le moteur Clariprint avec sanitization défensive des anomalies (-1,2 €, `undefined`, produits manquants).
- **FR14** Le système conserve l'historique persistant des devis générés par chaque utilisateur dans son atelier.
- **FR15** Un utilisateur peut configurer un produit via un overlay ProductCard avec options Clariprint en `<select>` (jamais de saisie libre).
- **FR16** Le système recalcule le prix dynamiquement quand l'utilisateur modifie une option dans l'overlay (pari conditionnel à l'avancement API Clariprint).
- **FR17** Un imprimeur peut publier un devis chiffré dans la boutique B2B d'un de ses clients en un clic depuis l'atelier.

### Domaine 4 — Cycle de vie des commandes (Order entity)

- **FR18** Un utilisateur autorisé peut créer une commande en convertissant un panier (statut initial `draft`).
- **FR19** Un utilisateur autorisé peut visualiser l'historique des commandes des boutiques auxquelles il a accès.
- **FR20** Un acheteur peut renouveler une commande passée en un clic (pré-remplissage des options Clariprint + ajustement de la quantité).
- **FR21** Un acheteur peut annuler ses propres commandes en statut `draft`.
- **FR22** Un admin tenant peut annuler n'importe quelle commande `draft` de son tenant.
- **FR23** Le système enregistre un événement d'audit pour chaque transition de statut Order entity.
- **FR24** Le schéma Order entity est extensible pour accueillir l'intégration future PA/PPF (e-invoicing FR Sep 2026 grandes/moyennes entreprises) sans refactor majeur.

### Domaine 5 — Visuels et workflow design

- **FR25** Le système génère un mockup paramétrique pour chaque produit, alimenté par les specs Clariprint et le theming de la boutique cliente.
- **FR26** Le système met en cache le mockup dans Supabase Storage (`product_mockups/{tenant}/{shop_id}/{product_id}.png`) et le sert via CDN.
- **FR27** Le mockup engine couvre 5 templates en MVP (flyer, carte de visite, brochure, étiquette, kakémono) et 15 templates en Growth (couverture 100 % Clariprint).
- **FR28** Un utilisateur peut envoyer un gabarit Clariprint vers Canva pour design et récupérer le résultat dans Magrit (connecteur Canva, dès Découverte).
- **FR29** Un utilisateur peut envoyer un gabarit vers Affinity (connecteur conditionnel à l'investigation Claude Cowork, dès Découverte si livré).

### Domaine 6 — Expérience boutique storefront B2B

- **FR30** La boutique `/shop/:slug` affiche un layout 3 colonnes (navigation gammes / grille produits / panier sticky), dark mode par défaut, header brandé tenant.
- **FR31** La home boutique affiche les dernières commandes de l'acheteur, ses paniers en attente de validation, et ses fichiers produit ou en attente de production.
- **FR32** Le catalogue boutique présente les produits par gammes dépliables et persistantes (l'ajout d'une gamme n'écrase pas la sélection précédente).
- **FR33** Un utilisateur peut sélectionner plusieurs produits simultanément (multi-sélection avec checkboxes).
- **FR34** Un utilisateur peut comparer plusieurs produits côte-à-côte (comparateur).
- **FR35** Un utilisateur peut effectuer des actions groupées (téléchargement de fiches techniques, création de devis groupé).

### Domaine 7 — Abonnements, quotas et conformité

- **FR36** Le système applique le quota mensuel de devis selon le tier (Freemium 10 / Découverte 50 / Starter 250 / Pro 1 500 / Business 4 000 / Enterprise 10 000) et bloque la génération au-delà.
- **FR37** Le système applique le quota de boutiques par tenant selon le tier (Freemium 0 / Découverte 0 / Starter 3 / Pro 10 / Business 30 / Enterprise 50).
- **FR38** Le système active ou désactive les capacités v1.1 par tier via les feature flags (`src/app/lib/featureFlags.ts`).
- **FR39** Le système garantit la conformité RGPD pour les données B2B (audit trail, droit à l'effacement, politique de rétention).
- **FR40** Le système trace toute consommation LLM dans `llm_usage_events` (E7.1 livré, étendu aux nouveaux endpoints v1.1).

### Domaine 8 — Stack LLM et observabilité

- **FR41** Tous les appels LLM utilisent l'API Anthropic Claude (Sonnet pour raisonnement, Haiku 4.5 pour génération rapide post-migration E-NEW-LLM-01).
- **FR42** Toute sortie LLM est validée contre un schéma JSON strict (story 1.3 P0).
- **FR43** Tout prompt LLM respecte la limite de 25 paramètres anti-hallucination (story 2.4 P0).

### Domaine 9 — Qualité, tests et Definition of Done

- **FR44** Chaque story livrée Magrit (v1.1 et au-delà) ajoute au moins un cas de test fonctionnel à la DB Notion 🧪 Cahiers de tests fonctionnels Magrit, dans le format TF-XX standard.
- **FR45** Tout cas de test fonctionnel est exécutable indifféremment par un humain ou par Claude in Chrome via plugin MCP, sur des `data-testid` stables.
- **FR46** Tout `data-testid` utilisé est centralisé dans `src/app/lib/testIds.ts` (objet `TEST_IDS as const`) et conserve sa stabilité publiée (renommage = dual-tag pendant 1 sprint, suppression sprint suivant).

### Domaine 10 — Concept « Prix marché » (ajout 2026-05-09)

> _Concept structurant ajouté post-S0.2 suite au constat que sans tier de fallback toujours disponible, le bouton « Ajouter au panier » est bloqué quand Clariprint n'a pas calculé → impossibilité de tester le flow commande en démo. Évolutif : aujourd'hui heuristique, demain alimenté par le **panel Magrit** (parcs imprimeurs anonymisés)._

- **FR47** Le système calcule et expose toujours un **prix marché** estimé pour chaque produit, indépendamment de la disponibilité Clariprint. Aujourd'hui : heuristique `estimateMarketPriceHT()` dans `src/app/utils/priceResolver.ts`. Demain (V2+) : **panel Magrit** alimenté par les parcs imprimeurs Pro anonymisés.
- **FR48** Tout affichage de prix marché côté UI (boutique B2B, panier, atelier, fiche produit) est accompagné d'un **badge « ⚠️ Prix marché »** explicite avec sous-texte « prix réel Clariprint à venir ».
- **FR49** Le bouton « Ajouter au panier » d'une boutique B2B reste **toujours actif** (sauf chargement Clariprint en cours), avec le prix marché comme fallback. La commande créée en statut `draft` peut être révisée par l'imprimeur avant validation `validated` (V2+).
- **FR50** Le total panier est calculé via `resolvePrice()` qui applique la hiérarchie canonique : Clariprint validé → cache bibliothèque → prix marché → zéro. Si au moins une ligne du panier est en prix marché, le récap affiche un **badge global** explicitant que le total est indicatif.

### Domaine 11 — Boutique standard e-commerce (ajout 2026-07-06)

> _Extension issue du brainstorming boutique (`_bmad-output/brainstorming/brainstorming-session-2026-07-03-1105.md`, cross-pollination Mixam/Onlineprinters/Exaprint). Objectif : rapprocher la boutique des codes e-commerce standard sans casser l ADN Magrit. **Principe directeur non-négociable : l intelligence est dans la donnée (PIM + bibliothèques + historique commandes), pas dans du paramétrage manuel opérateur.** Couvert par l extension Epic 2 (stories S2.11-S2.31). Décisions d architecture actées en séance : card = produit configurable (filtres légers) · nav identique acheteur/deviseur · home unique loggé/non-loggé · un seul template général · rôles = S-ORDER-ROLES existant._

**Identité et lisibilité produit (S2.11-S2.14)**
- **FR-ECOM-01** Chaque produit expose un repère visuel de famille (couleur + pictogramme) dérivé du PIM, cohérent sur card, fiche, panier et historique. (S2.11)
- **FR-ECOM-02** Le système affiche des badges d état commercial (`Nouveau` / `Meilleure vente` / `Éco` / `Express 24h`) **calculés** depuis les données (récence, volume, délai Clariprint, tag éco), jamais saisis à la main. (S2.12)
- **FR-ECOM-03** La ProductCard expose jusqu à 3 puces d attributs clés normalisés par famille, issues du PIM, comparables entre produits d une même famille. (S2.13)
- **FR-ECOM-04** Le visuel produit utilise un mockup-signature normalisé par famille (extension P18 v2), avec fallback générique par famille tant que le mockup n existe pas. (S2.14)

**Home utile (S2.15-S2.17)**
- **FR-ECOM-05** La home affiche un bloc « Nouveautés » listant les derniers produits intégrés à la boutique, tri dérivé de la date d ajout. (S2.15)
- **FR-ECOM-06** La home affiche les devis en cours (S-QUOTES) et le panier non finalisé avec reprise en un clic. (S2.16, étend FR31)
- **FR-ECOM-07** La home affiche des « best-sellers de votre secteur » inférés de l historique de commandes multi-tenant anonymisé, avec fallback best-sellers globaux boutique. (S2.17)

**Navigation et découverte (S2.18-S2.21)**
- **FR-ECOM-08** La navigation propose un méga-menu 2 niveaux (familles + sous-catégories) auto-illustré par les mockups-signature, dérivé des données. (S2.18)
- **FR-ECOM-09** Les pages catalogue exposent un fil d Ariane et des filtres à facettes **légers** (famille, usage, délai, gamme de prix) générés depuis le PIM, sans variantes techniques fines. (S2.19)
- **FR-ECOM-10** Cliquer une famille ouvre une landing catégorie éditorialisée (intro, sous-catégories en tuiles, best-sellers, grille), jamais une grille brute ni une page vide. (S2.20)
- **FR-ECOM-11** La boutique fournit une recherche produits avec autocomplétion, et un fallback « Demander à Magrit » (chat pré-rempli) quand aucun résultat. (S2.21)

**Différenciateurs IA (S2.22-S2.25)**
- **FR-ECOM-12** Magrit classe automatiquement les produits par usage/intention pour alimenter une navigation transverse qui se maintient seule quand le catalogue grandit. (S2.22)
- **FR-ECOM-13** La home propose un cross-sell contextuel « Magrit vous suggère » déduit des séquences de commande réelles du tenant, avec fallback si pas d historique. (S2.23)
- **FR-ECOM-14** Un product finder guidé (2-3 questions : usage/quantité/délai) retourne 1-3 recommandations produit via IA structurée, avec CTA vers la configuration. (S2.24)
- **FR-ECOM-15** Magrit auto-génère les descriptions catégorie et champs SEO/GEO manquants à partir du PIM (défaut overridable, jamais d écrasement d un contenu saisi). (S2.25)

**Fiche produit et confort B2B (S2.26-S2.29, activation S2.9)**
- **FR-ECOM-16** La fiche produit expose un bloc rassurance B2B (délais chiffrés, BAT/échantillon, garanties, contacts) alimenté par PIM/Clariprint. (S2.26)
- **FR-ECOM-17** La card/fiche affiche les paliers de prix dégressifs (quantité → prix unitaire) via `resolvePrice()`, avec signalement de la source de prix. (S2.27)
- **FR-ECOM-18** Depuis une fiche, l acheteur peut interroger Magrit sur le produit avec contexte pré-chargé (délais, options, prix, PIM). (S2.28)
- **FR-ECOM-19** Un acheteur peut créer des listes d achat nommées ré-commandables en lot (favoris récurrents), persistées par utilisateur/tenant. (S2.29)

**Back-office opérateur (S2.31)**
- **FR-ECOM-20** L écran d admin boutique est consolidé après audit, en privilégiant l affectation de produits PIM→boutique et en excluant tout paramétrage manuel superflu (pas de merchandising manuel, drag & drop, ni templates par secteur). (S2.31)

---

## Non-Functional Requirements

> _NFR sélectives : seules les catégories pertinentes pour Magrit v1.1 sont documentées. Chaque NFR est mesurable et testable (anti-vague PRD)._

### Performance

- **NFR1** Génération d'un devis 3-options en chat Magrit : **temps médian < 8 secondes (p50)**, mesuré du moment où l'utilisateur valide sa demande au moment où le devis complet (descriptif + prix Clariprint + recap options) est affiché.
- **NFR2** Mockup engine paramétrique : **< 300 ms** au premier rendu d'une image produit, **< 50 ms** sur cache hit (Supabase Storage CDN).
- **NFR3** Time-to-first-action sur la boutique B2B : **< 15 secondes (p50)** entre l'arrivée d'un acheteur sur `/shop/:slug` et sa première action métier (clic ProductCard, ajout panier, renouvellement commande).
- **NFR4** Latence LLM post-migration E-NEW-LLM-01 : **-30 % en p50** vs baseline GPT-4o sur les prompts de génération rapide (PIM, descriptif produit, mockup artwork).
- **NFR5** Taux de retries LLM observés en prod (mesuré via `llm_usage_events`) : **réduction de 50 %** vs baseline GPT-4o après migration Haiku 4.5.

### Security

- **NFR6** Isolation tenant stricte via Row-Level Security (RLS) Supabase sur **100 %** des tables tenant-scoped (existantes : `tenants`, `tenant_members`, `tenant_invitations`, `tenant_member_events`, `tenant_slug_history`, `tenant_gamme_subscriptions`, `llm_usage_events`, `shops` ; nouvelles v1.1 : `orders`, `order_items`, `order_status_events`). **0 fuite cross-tenant tolérée** (validée par tests vitest dédiés).
- **NFR7** Authentification par Supabase Auth (email/password, magic link, OAuth si activé). Tokens JWT avec expiration courte (≤ 1 h) et refresh token rotation.
- **NFR8** Tous les secrets (`MAGRIT3` Anthropic, `RESEND_API_KEY`, `CLARIPRINT_HOST/LOGIN/PASSWORD`, `SUPABASE_*`) stockés exclusivement dans Supabase Edge Function secrets (pas en clair côté repo, pas dans `.env` commités).
- **NFR9** Audit trail complet : `tenant_member_events` (existant) + nouveau `order_status_events`. Chaque action sensible loguée avec `actor_id`, `tenant_id`, `target_id`, `action`, `metadata`, `timestamp`.
- **NFR10** Conformité RGPD : audit trail des accès aux données personnelles, droit à l'effacement (suppression complète d'un user et de ses données associées sur demande), politique de rétention documentée et appliquée.
- **NFR11** Sanitization défensive systématique des sorties Clariprint via le module commun `validateClariprintResponse` avant exposition utilisateur (pas de prix négatif, pas de `undefined`, pas de produit légalement requis manquant).
- **NFR12** Convention licence Clariprint respectée : aucune exposition publique des paramètres internes Clariprint (parc machines bruts, prix marché individuels). Seul le « panel Magrit » (prix marché agrégés anonymisés) est public.

### Scalability

- **NFR13** Application des quotas devis mensuels par tier (Freemium 10 / Découverte 50 / Starter 250 / Pro 1 500 / Business 4 000 / Enterprise 10 000) avec blocage automatique au-delà et notification utilisateur.
- **NFR14** Application des quotas boutiques par tenant (Freemium 0 / Découverte 0 / Starter 3 / Pro 10 / Business 30 / Enterprise 50) avec blocage de création au-delà.
- **NFR15** Mockup engine : génération SVG/Canvas server-side (edge function ou backend Python), cache Supabase Storage CDN, **scalabilité linéaire** par tenant (pas de bottleneck partagé).
- **NFR16** Architecture e-invoicing FR PA/PPF extensible sans refactor majeur (hooks `invoice_number`, `invoice_status`, `pa_id`, `ppf_message_id` prévus dans le schéma `orders` même si non peuplés en v1.1).
- **NFR17** Anticipation Phase 2 capitalistique : architecture multi-tenant doit supporter ≥ 100 tenants actifs sans dégradation > 10 % de performance (cible Year 1 post-V1).

### Accessibility

- **NFR18** Conformité **WCAG 2.1 AA** comme objectif raisonnable (pas obligation légale stricte sur SaaS B2B FR, mais bonnes pratiques RGAA/WCAG AA respectées). Vérifications minimales : contrastes suffisants, navigation clavier complète sur les parcours P00-P11, alt-text sur les images mockup.
- **NFR19** Dark mode actif par défaut sur les boutiques B2B (décision design B2). Mode clair conservé sur l'admin Magrit pour confort longue durée d'usage.
- **NFR20** Internationalisation : tous les libellés produits / UI sont stockés en français (langue de travail) avec architecture i18n permettant l'ajout de langues sans refactor (futur internationalisation Cimpress et autres clients EU/US).

### Integration & Reliability

- **NFR21** Sanitization Clariprint via module commun unique (cf. NFR11 + E-NEW-CLARIPRINT-01). Tout endpoint consommant Clariprint l'utilise.
- **NFR22** Adapter Clariprint isolant les appels API derrière une interface `ClariprintAdapter` côté Magrit (pattern adapter), permettant le mocking en tests et l'évolution de l'API Clariprint sans casser Magrit.
- **NFR23** Tracking obligatoire dans `llm_usage_events` (E7.1 livré, étendu aux nouveaux endpoints v1.1) pour tout appel LLM. Permet le calcul des métriques NFR4-5 et la facturation interne.
- **NFR24** Edge functions Supabase déployées via `supabase functions deploy <name> --project-ref ightkxebexuzfjdbpsdg` (PAT temporaire à régénérer à chaque session). CI/CD via GitHub Actions.
- **NFR25** Pas de modification de la branche `main` (Beta 1, prod) pendant le sprint v1.1 sauf hotfixes critiques explicitement validés par Arnaud. La prod B1 reste isolée.

### Reliability

- **NFR26** Disponibilité cible : Magrit n'a pas de SLA contractuel sur Pro (best effort). Sur Enterprise (4 900 €+), SLA 99,5 % sur les heures ouvrées FR (à formaliser au contrat).
- **NFR27** Recovery : aucune perte de données de devis sauvegardés ou de commandes persistées en cas de redémarrage / panne edge function (Supabase Postgres = source de vérité, pas d'état en mémoire).
- **NFR28** Aucun timeout silencieux : tout échec d'appel Clariprint, Anthropic, ou Resend doit déclencher un message d'erreur explicite à l'utilisateur (pas de page blanche, pas de spinner infini). Logs côté `llm_usage_events` ou table dédiée pour diagnostic.

---

## Document Status & Next Steps

### Statut PRD

| Item | Valeur |
|---|---|
| Skill BMAD | `bmad-create-prd` (12 steps) |
| Steps complétés | 12/12 ✅ |
| Date complétion | 2026-05-09 |
| Mode delivery | Phased (MVP / Growth / Vision) |
| Auteur | Arnaud Mazon (PDG AGE Dvt., porteur projet) |
| Facilitateur PM | John (BMAD agent, Claude Opus 4.7 1M context) |
| Couverture FR | 46 capacités sur 9 domaines |
| Couverture NFR | 28 critères mesurables sur 6 dimensions |
| Personas | 6 journeys couvrant imprimeur / acheteur / admin tenant / QA IA / W2P |

### Décisions structurantes prises pendant l'élaboration du PRD

| Décision | Date | Source |
|---|---|---|
| Hotfix régression Fiche en Story 0 sur `beta/v4`, indépendant v1.1 | 2026-05-08 | Conversation Copilot tour 27 + démo client J+15 |
| Order entity v1.1 = persistée + lecture + renouvellement (sans workflow / paiement / logistique) | 2026-05-08 | Réponse Arnaud question PM #1 |
| Stratégie images = mockup engine paramétrique (pas IA générative seule) | 2026-05-08 | Reco PM validée Arnaud |
| Cahiers de tests Notion + Claude in Chrome = DoD pérenne projet | 2026-05-08 | Règle projet validée Arnaud |
| Migration GPT-4o → Claude Haiku 4.5 = story P0 parallèle (E-NEW-LLM-01) | 2026-05-08 | Décision Arnaud sur impact qualité prompts |
| Investigation prix mystère (E-NEW-CLARIPRINT-01) en pré-v1.1 sur `beta/v5` | 2026-05-08 | Décision Arnaud option (a) |
| Rename Marguerite → Magrit partout | 2026-05-08 | Décision Arnaud (anti-confusion + i18n) |
| Fusion conceptuelle Storefront + E-shop en entité boutique unique | 2026-05-08 | Décision Arnaud |
| Altavia retiré du frame investisseur, repositionné en client potentiel via Expert Solutions | 2026-05-08 | Correction mémoire projet |
| Cimpress / ExaPrint / Pixartprinting = cibles **clients**, pas concurrents | 2026-05-08 | Correction Arnaud + WebSearch validation |
| Quotas devis (10/50/250/1500/4000/10000) + boutiques (0/0/3/10/30/50) par tier | 2026-05-09 | Calibrage Arnaud sur repère ExaPrint ~5-6k devis/mois |

### Validation options BMAD

**Option 1 — Check Implementation Readiness** (`bmad-check-implementation-readiness`)
- Validation que le PRD contient toutes les infos pour démarrer le dev
- Vérification couverture epic, alignement UX, qualité epic & stories
- Identification des gaps avant architecture / design

**Option 2 — Skip validation et démarrer les workflows aval**
- Architecture (`bmad-create-architecture` avec agent Architect)
- Création epics & stories (`bmad-create-epics-and-stories`)
- UX design (`bmad-create-ux-design` avec agent UX Designer)

### Prochaines actions concrètes recommandées

1. **Avant 2026-05-23 (démo client)** :
   - Story 0 : Hotfix régression Fiche sur `beta/v4`
   - E-NEW-CLARIPRINT-01 : Investigation prix mystère (livrables : `PRICE_SOURCES.md`, diagramme de flux, décisions tranchées)

2. **Sprint v1.1 (`beta/v5`)** :
   - Architecture technique Order entity + RLS + tests vitest
   - Mockup engine MVP (5 templates)
   - E-NEW-LLM-01 migration LLM en parallèle
   - Suivi par les workflows BMAD : `bmad-create-architecture` puis `bmad-create-epics-and-stories`

3. **Pendant tout le sprint** :
   - DoD : ajout systématique des cas TF Notion sur les nouveaux parcours
   - Confirmation avant push (préférence Arnaud)
   - Commits atomiques `feat|fix|chore(v5): ...`

### Documents associés

- 📄 [CONTEXT_Magrit_IA.md](../../../../../Downloads/CONTEXT_Magrit_IA.md) — onboarding maître projet (à lire en premier par tout nouvel agent)
- 📄 [SPRINT_HANDOFF.md](../../SPRINT_HANDOFF.md) — état du dev, à mettre à jour à fin de chaque sprint
- 📄 [ARCHITECTURE.md](../../ARCHITECTURE.md) — architecture technique existante
- 🌐 [Backlog Sprint Board Notion](https://www.notion.so/4d2e2ea106914ce5a69728fdb67dfddd)
- 🌐 [🧪 Cahiers de tests fonctionnels Magrit](https://www.notion.so/7e576e695d504cc9a32ead92f4dde01c)
- 🌐 [Vision_Produit_Backlog_Magrit_15avril2026.docx](https://drive.google.com/file/d/1UjEd6IrBsxxV1AVKOelAdly6HDFH0tti/view)
- 📦 Repo : [github.com/amazon-svg/Magritoff](https://github.com/amazon-svg/Magritoff)

---

> **Le PRD est la fondation de tous les travaux aval (architecture, UX, dev). Toute design / archi / dev doit pouvoir tracer son origine vers une exigence ou la vision documentées ici. Mettre à jour le PRD au fur et à mesure que la planification évolue.**

🎉 **PRD Magrit / e-shop v1.1 — terminé.**
