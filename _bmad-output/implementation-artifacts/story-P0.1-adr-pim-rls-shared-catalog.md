---
story_id: P0.1
epic: Sprint 4 — PIM-Boutique-Commandes (Phase 0 Préalables)
title: ADR-PIM-RLS-1 — Documentation RLS product_definitions shared catalog
status: draft
target_branch: beta/v5
agent: Dev (Claude Code)
size: XS (<0.5j)
adr_ref: architecture.md §4.9
mémoire_bmad: project_pim_rls_shared_catalog.md
---

# Story P0.1 — ADR PIM RLS shared catalog

## Story (As / I want / So that)

**As an** architecte projet Magrit
**I want** documenter formellement la décision de garder la RLS `product_definitions` en lecture publique
**So that** toute story sprint future (PIM, boutique, fiches produits) ne propose pas de scope tenant-spécifique sans rouvrir une ADR explicite, évitant ainsi des refacto inutiles ou des régressions de sécurité par interprétation libre.

## Contexte

L'audit PIM du 2026-05-17 (préalable au sprint Sprint 4) a soulevé une **anomalie apparente** : la RLS de `public.product_definitions` est en lecture publique → tout acheteur voit toutes les fiches PIM. Arnaud a tranché que c'est **intentionnel** (catalogue vitrine partagé, fiches SEO/marketing mutualisées), pas un bug.

Sans documentation formelle, un dev/Architect futur pourrait re-proposer de scoper la RLS par `tenant_gamme_subscriptions` (intention apparemment "propre" mais qui casserait le shared catalog volontaire).

## Acceptance Criteria

**AC1** — Section `### 4.9 PIM product_definitions — Shared Catalog (RLS publique intentionnelle)` ajoutée à `_bmad-output/planning-artifacts/architecture.md` entre §4.8 Feature Flags et Step 5.

**AC2** — La section couvre : (a) décision, (b) pourquoi (3+ raisons), (c) conséquence NFR6, (d) pattern à respecter (do / don't), (e) référence mémoire BMAD.

**AC3** — Mémoire BMAD `project_pim_rls_shared_catalog.md` créée dans `~/.claude/projects/-Users-arnaudmazon-Documents-Claude-BMAD-Magrit/memory/` avec frontmatter `type: project` + lien dans `MEMORY.md`.

**AC4** — Aucun changement de code applicatif (la RLS reste telle quelle en prod).

## Décisions

| Décision | Choix | Argument |
|---|---|---|
| Numéro ADR | §4.9 (Step 4 Core Architectural Decisions) | Cohérence avec les ADR existantes 4.1-4.8 |
| Pattern do/don't | Inclus | Évite régression future via interprétation libre |
| Cas d'override tenant-privé V2+ | Table séparée `tenant_pim_overrides` | Préserve la RLS pub partagée |

## Fichiers touchés

- `_bmad-output/planning-artifacts/architecture.md` : +60 lignes (§4.9)
- `~/.claude/projects/.../memory/project_pim_rls_shared_catalog.md` : créé (P0.1 préparé en amont)
- `~/.claude/projects/.../memory/MEMORY.md` : +1 ligne (pointeur)

## Tests / Vérifications

- Lecture humaine de §4.9 par Arnaud avant commit.
- Pas de test code (story doc-only).

## TF Notion à créer en fin de story

Aucun (story purement documentaire — pas de comportement testable côté UI/DB).

## Notes

ADR rédigée en amont du sprint et déjà présente dans `architecture.md`. Ce story doc formalise la traçabilité BMAD (chaque livrable = un story doc).
