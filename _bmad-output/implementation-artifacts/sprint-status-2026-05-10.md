---
sprint: Sprint 3 — e-shop v1.1 (BMAD)
status_date: 2026-05-10
agent: Dev (BMAD)
prd_ref: _bmad-output/planning-artifacts/prd.md
architecture_ref: _bmad-output/planning-artifacts/architecture.md
epics_ref: _bmad-output/planning-artifacts/epics.md
target_branches: [beta/v4, beta/v5]
demo_target_date: 2026-05-23
---

# Sprint Status — 2026-05-10

## Vue d'ensemble

| Indicateur | Valeur |
|---|---|
| **Sprint** | Sprint 3 — itération **e-shop v1.1** |
| **Période** | 2026-05-08 → en cours (démo cible 2026-05-23) |
| **Stories planifiées (PRD/Epics)** | 32 stories sprint-ready (7 epics) + 2 pré-sprint |
| **Stories livrées à date** | 8 (Pré-sprint Epic 0 + Epic 1 partiel + extension Prix marché) |
| **Stories partielles** | 1 (S1.3 → 2/4 endpoints LLM refactorés) |
| **Stories en attente** | 24 (Epic 2-7 à venir + S1.3 reste) |
| **Tests TF Notion** | 9 cas créés (à jouer avant démo) |
| **Edge functions prod** | 4 redéployées (make-server-e3db71a4, pim-generate, pim-ingest, claude-proxy non-touché) |
| **Migrations DB prod** | 1 appliquée (`20260509_01_e1_orders_v1_1.sql` — Order entity tenant_*) |

## Stories livrées (chronologique)

### Pré-sprint (Epic 0 — Démo Readiness)

| Story | Document | Branche | Commit | Statut |
|---|---|---|---|---|
| S0.1 Hotfix Fiche regression | [story-S0.1](story-S0.1-hotfix-fiche-b4.md) | `beta/v4` | `f925eba` | ✅ livrée |
| S0.2 Audit prix + sanitization Clariprint | [story-S0.2](story-S0.2-audit-prix-clariprint.md) | `beta/v5` | `c929371` | ✅ livrée + edge fn déployée |

### Epic 1 — Stack Foundations

| Story | Document | Branche | Commit | Statut |
|---|---|---|---|---|
| S1.1 Wrapper AnthropicClient | [story-S1.1](story-S1.1-anthropic-client-wrapper.md) | `beta/v5` | `6f1aa84` | ✅ livrée |
| S1.2 ClariprintAdapter pattern | [story-S1.2](story-S1.2-clariprint-adapter.md) | `beta/v5` | `632db88` | ✅ livrée |
| S1.4 Order entity (tenant_orders) | [story-S1.4](story-S1.4-order-entity-tenant.md) | `beta/v5` | `1a29481` + `4b2091c` + `9d70e58` | ✅ livrée + migration appliquée prod |
| S1.3 Migration LLM (partiel 2/4) | [story-S1.3](story-S1.3-llm-migration-partial.md) | `beta/v5` | `555574a` + `df47dc3` | 🟡 partielle (claude-proxy reste) |

### Extension Epic 0 — Prix marché (concept structurant ajouté en cours)

| Story | Document | Branches | Commits | Statut |
|---|---|---|---|---|
| Prix marché + débridage panier | [story-prix-marche](story-prix-marche-debridage-panier.md) | `beta/v5` + `beta/v4` | `ebaf76f` + `b10a209` | ✅ livrée sur les 2 branches |

## Tests fonctionnels Notion (DoD)

🔗 https://www.notion.so/7e576e695d504cc9a32ead92f4dde01c

**9 cas créés ce sprint (statut À jouer) :**

| TF (Notion ID) | Story | Cible | Priorité | Type |
|---|---|---|---|---|
| Onglet Fiche affiche infos commerciales | S0.1 | B4 | P0 | Manuel + IA Chrome |
| Onglet Fiche avec gamme PIM enrichie | S0.1 | B4 | P1 | Manuel + IA Chrome |
| Onglet Fiche fallback sans gamme | S0.1 | B4 | P0 | Manuel + IA Chrome |
| Console warning PIMContext | S0.1 | B4 | P2 | Manuel |
| Endpoint clariprint-quote bloque -1.2€ | S0.2 | B5 | P0 | SQL DB + API |
| PricingPanel badge Prix marché | S0.2 | B5 | P1 | Manuel + IA Chrome |
| validateClariprintResponse 4 anomalies | S0.2 | B5 | P0 | API directe |
| Bouton panier actif sans Clariprint | Prix marché | B5 | P0 | Manuel + IA Chrome |
| PortalCart total non-zéro + badge | Prix marché | B5 | P0 | Manuel + IA Chrome |

## Reste à faire pour démo 2026-05-23

### Bloquants démo (priorité P0)

- [ ] **Validation manuelle Arnaud** sur les 9 cas TF Notion (ports 5176 + 5177)
- [ ] **Répétition démo Bruno (Journey 3)** — vérifier le scénario complet avant le 23
- [ ] Configurer un compte acheteur shop_only pour la démo (cf. cas TF Prix marché)

### Non-bloquants (post-démo, sprint suivant)

- [ ] **S1.3 finalisation** — refactor `claude-proxy` + `make-server-e3db71a4/claude-proxy*` (reportés, complexité demo fallback + streaming)
- [ ] **R1 (Implementation Readiness)** — instrument `first_action_after_landing` (NFR1+NFR3)
- [ ] **R2** — wireframes lo-fi composants Epic 2
- [ ] **Epic 4 — Mockup Engine** (S4.1a → S4.1b → S4.1c → S4.2 → S4.3) priorité haute par R3

## Dette technique observée (à intégrer backlog)

| Item | Origine | Sévérité |
|---|---|---|
| Migration historique Supabase désynchronisée — `db push` automatique fail | Constaté lors S1.4 (collision legacy `public.orders`) | Moyenne — workaround SQL Editor manuel |
| `ProductCard.tsx` dans atelier Magrit duplique encore `estimatePrice()` localement | Pas DRY-é vers `priceResolver.ts` (story Prix marché) | Faible — fonctionnel mais à migrer en sprint cleanup |
| Diagnostics IDE TypeScript (config TS de B4) | Préexistante | Faible — non bloquant, à refaire au cleanup TS |

## Risques identifiés à surveiller

| Risque | Probabilité | Impact | Mitigation en place |
|---|---|---|---|
| Validation TF cas P05/P08 sur Fiche échoue (régression non corrigée) | Faible | **Critique** (démo bloquée) | Fix vérifié sur S0.1 mais à valider en démo répétition |
| Cimpress lance couche IA externe pendant le sprint | Très faible | Moyen | Watch-item monitoring IR.cimpress.com (Innovation §) |
| API Clariprint instable en démo | Moyenne | Moyen | Prix marché fallback toujours actif (acheteur peut commander quand même) |
| Indisponibilité Arnaud (50-70 % capacity hypothèse) | À surveiller | Variable | Découpage en stories atomiques mergeables indépendamment |

## Métriques sprint à date

- **Code committed** : 11 commits sur les 2 branches (`f925eba` à `ebaf76f` sur v5, `f925eba` à `b10a209` sur v4)
- **Lignes ajoutées** : ~3 200 (code + tests + docs)
- **Files modifiés / créés** : ~25
- **Edge functions redéployées** : 4
- **Migrations SQL appliquées** : 1
- **Documents BMAD livrés** : 4 planning + 8 story + 1 sprint-status + 1 retrospective + project-context = **15 artefacts**

## Prochaine revue

À effectuer après validation Arnaud sur les 9 cas TF + répétition démo. Décision GO/NO-GO démo client 2026-05-23.
