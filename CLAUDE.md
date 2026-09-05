# Magrit — Onboarding Claude Code

> Ce fichier est **chargé automatiquement par Claude Code** au démarrage de chaque session dans ce repo.
> Il garantit l onboarding minimal même quand un agent BMAD n est pas explicitement invoqué.

## Lecture obligatoire avant toute action

1. **[docs/REGLES_ARCHITECTURE.md](docs/REGLES_ARCHITECTURE.md)** — règles R1-R8 de la session RP#070826 (Annexe A), **opposables à tout développement** : API-first, modularité, MCP différé, noyau minimal, souplesse encadrée sur l existant, workflow Git, design charte v2, rapport de fin de tâche.
   → **[docs/CONVENTION_GIT.md](docs/CONVENTION_GIT.md)** complète R6 : rôle des branches, cadence de remontée vers `main`, tags de version, séquence de synchronisation avec Expert Solutions.
2. **[docs/project-context.md](docs/project-context.md)** — persistent facts BMAD (vision, stack, multi-tenancy, conventions, identifiants techniques).
3. **[SPRINT_HANDOFF.md](SPRINT_HANDOFF.md)** — état dev courant (sprint en cours, stories livrées, edge functions déployées, bugs connus).

## Workflow BMAD strict

Ce projet suit la méthode BMAD v6.6.0 (installée dans [_bmad/](_bmad/)). Pour toute tâche dépassant un fix simple, invoquer le bon agent via skill Claude Code :

| Phase | Agent | Skill Claude Code | Persistent facts auto-chargés |
|---|---|---|---|
| Plan (PRD) | John 📋 PM | `bmad-agent-pm` | + `_bmad-output/planning-artifacts/prd.md` |
| Solutioning (Architecture) | Winston 🏗️ Architect | `bmad-agent-architect` | + `_bmad-output/planning-artifacts/architecture.md` + `ARCHITECTURE.md` |
| Implementation (code, tests) | Amelia 💻 Dev | `bmad-agent-dev` | + `architecture.md` + `epics.md` |
| Analysis (briefs) | Mary 📊 Analyst | `bmad-agent-analyst` | (de base) |
| Documentation | Paige 📚 Tech Writer | `bmad-agent-tech-writer` | (de base) |
| UX | Sally 🎨 UX Designer | `bmad-agent-ux-designer` | (de base) |

Tous les agents reçoivent automatiquement `docs/project-context.md` + `SPRINT_HANDOFF.md` via les fichiers [_bmad/custom/bmad-agent-*.toml](_bmad/custom/).

**Règle Dev** : produire un story document `_bmad-output/implementation-artifacts/story-{X}.md` à chaque story livrée.

## ⚠️ Copie de travail de référence — à vérifier en début de session

Le repo `amazon-svg/Magritoff` est cloné **deux fois** en local. Les deux clones portent les mêmes noms de branches et le même `package.json` : rien dans le repo ne permet de les distinguer. **Se tromper de dossier = travailler sur du code périmé sans le voir.**

| Clone | Chemin | Rôle |
|---|---|---|
| **Référence** ✅ | `/Users/arnaudmazon/Documents/AGE/Projet formateur /Claude code/Magritoff-v4/` | **Copie de travail active.** C est ici que se fait le développement. `pnpm dev` → **http://localhost:5176** |
| Secondaire ⚠️ | `/Users/arnaudmazon/Library/Mobile Documents/com~apple~CloudDocs/AGE/Claude/BMAD/Magrit/` (iCloud) | Clone utilisé pour la doc et la branche `migration_owk`. **Son `beta/v5` se désynchronise vite** — `git fetch` obligatoire avant toute comparaison de branches |

**Réflexe obligatoire avant tout diagnostic de branche** : `git fetch origin --prune` **puis** comparer. Un `git log` sur un ref local non fetché a déjà produit un faux diagnostic (session 2026-08-09, cf. `SPRINT_HANDOFF.md` section 26).

## Conventions critiques (rappel rapide)

- **Branches** : voir [docs/CONVENTION_GIT.md](docs/CONVENTION_GIT.md) — **source de vérité unique**. `main` = référence partagée avec Expert Solutions ; `beta/v5` = ligne d'intégration interne (temporaire) ; `feat/<périmètre>` = branches fonctionnelles ; versions en **tags**, jamais en branches.
  - ⚠️ Ne **jamais** désigner ici « la » branche de travail : elle change, ce fichier resterait périmé (remarque Xavier Péchoultres, 2026-08-10). Vérifier la branche courante avec `git branch --show-current`.
  - Le port de `pnpm dev` (**5176**) ne dit rien de la branche ni du clone.
- **Langue de travail** : français (commits, code, livrables).
- **Format commits** : `feat|fix|chore|test|docs(v5): description courte` — **PAS d apostrophes** (HEREDOC).
- **Confirmation systématique avant push**.
- **Pas d invention de `data-testid`** — déclarer dans [src/app/lib/testIds.ts](src/app/lib/testIds.ts).
- **Persona IA** = `Magrit` (pas `Marguerite` — décision 2026-05-08).
- **Toute interaction Clariprint** passe par `ClariprintAdapter` ([src/server/clariprint/](src/server/clariprint/)) + `validateClariprintResponse()`.
- **Hiérarchie de prix** : `clariprint > library_cached > prix_marche > zero` via `resolvePrice()` ([src/app/utils/priceResolver.ts](src/app/utils/priceResolver.ts)).

## Sprint 5 — Gestion commerciale (Epic E10, API-first)

Chantier actif depuis le 2026-09-01 (WM Xavier Péchoultres). Détail complet des règles dans `.claude/rules/api.md`, `db.md`, `frontend.md` (chargés automatiquement selon les fichiers touchés) et `docs/api/CONVENTIONS.md`. Rappel condensé :

- **API-first strict** : `openapi/magrit-core.v1.yaml` fait foi, écrit avant tout endpoint. Seul l'agent `architecte` le modifie. Préfixe `/api/v1`, tenant résolu du jeton, réponses `{data, meta}`, erreurs RFC 7807, pagination par curseur, `Idempotency-Key` sur POST, `ETag`/`If-Match` sur PATCH.
- **Interdit absolu** : aucun composant React n'interroge Supabase en direct, aucun contrôle métier (seuil, quota, total, numérotation) posé uniquement côté navigateur.
- **Données** : montants `numeric(12,2)`, taux `numeric(6,4)`, jamais de flottant sur un prix. Tables d'audit append-only. RLS testée, pas seulement déclarée.
- **Modularité** : un module = `api/` + `application/` (pattern déjà en place dans le dépôt — ne pas réintroduire une convention de dossiers différente).
- **Prix** : tout calcul passe par l'interface `PricingEngine` (E10.21) une fois livrée ; `E10.8` reste gelée (spécification seule, pas de code).
- Agents dédiés : `architecte` (opus, seul habilité à toucher `openapi/`), `dev-story` (sonnet, implémente une story), `qa-review` (opus, revue adversariale distincte de l'auteur), `scribe` (haiku, met à jour Notion — n'écrit jamais de code).
- Une story = une branche `feat/gescom-<id-story>-<slug>` depuis `main`, une PR vers `main`, jamais de merge sans `qa-review` distinct.

## Identifiants techniques essentiels

- **Projet Supabase** : `ightkxebexuzfjdbpsdg` (B4 + B5 partagés, RLS isole).
- **PAT Supabase** : à régénérer à chaque session — demander à Arnaud avant déploiement edge function.
- **Modèle LLM raisonnement** : `claude-sonnet-4-5-20250929`.
- **Modèle LLM génération rapide** : `claude-haiku-4-5-20251001`.

## Documents canoniques

| Document | Rôle |
|---|---|
| [docs/project-context.md](docs/project-context.md) | Persistent facts BMAD (synthèse opérationnelle) |
| [SPRINT_HANDOFF.md](SPRINT_HANDOFF.md) | État dev courant (à jour à chaque sprint) |
| [_bmad-output/planning-artifacts/](_bmad-output/planning-artifacts/) | PRD, Architecture, Epics, Implementation Readiness |
| [_bmad-output/implementation-artifacts/](_bmad-output/implementation-artifacts/) | Sprint status + story documents + retrospective |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Référence technique pré-v1.1 (1206 lignes) |
| [docs/PRICE_SOURCES.md](docs/PRICE_SOURCES.md) | Audit S0.2 sources de prix |

## Pour ouvrir une session

Premier message à Claude Code (ou agent BMAD) :

```
Je reprends Magrit v1.1. Aujourd hui je veux travailler sur : [story / fonctionnalité].
```

Le contexte (`project-context.md` + `SPRINT_HANDOFF.md`) est déjà chargé via ce CLAUDE.md (Claude Code) ou via `persistent_facts` (agent BMAD).

## Reproduire l install BMAD (onboarding équipe / nouvelle machine)

L install BMAD est **project-local** par convention (cohérent avec AGE-Services et la pratique BMAD v6). Toute la config est versionnée avec le repo : [_bmad/](_bmad/), [_bmad/custom/](_bmad/custom/), [.claude/skills/](.claude/skills/).

**Pour reproduire l install à zéro** (machine vierge, ou après `rm -rf _bmad .claude/skills`) :

```bash
cd /chemin/vers/Magrit
npx -y bmad-method install \
  --directory $(pwd) \
  --tools claude-code \
  --action update \
  --set core.user_name=Arnaud \
  --set core.communication_language=Français \
  --set core.document_output_language=Français \
  -y
```

L installer recrée :
- `_bmad/` (modules core + bmm v6.6.0, scripts, configs base)
- `.claude/skills/` (42 skills BMAD : agents PM/Architect/Dev/Analyst/Tech Writer/UX + workflows create-prd, dev-story, code-review, etc.)
- `_bmad/_config/manifest.yaml` avec `ides: [claude-code]`

**Ce qu il NE faut PAS recréer** (déjà versionné dans le repo, conservé par `--action update`) :
- [_bmad/custom/bmad-agent-*.toml](_bmad/custom/) — les `persistent_facts` par agent (config équipe)
- [_bmad-output/](_bmad-output/) — tous les artefacts (PRD, architecture, epics, story documents, sprint status, retrospective)

**Anti-pattern à éviter** : `npx bmad-method install` sans `--directory` lancé depuis ton home — cela crée un install global dans `~/_bmad/` qui ne sert à rien (Claude Code ne le voit pas pour ce repo) et duplique BMAD pour rien. C est l erreur historique commise le 2026-05-08, nettoyée le 2026-05-10.

**Mise à jour BMAD vers une nouvelle version** (ex: v6.7.0 quand elle sortira) :
```bash
cd /chemin/vers/Magrit
npx -y bmad-method install --directory $(pwd) --action update -y
```
L update préserve `_bmad/custom/` et `_bmad-output/`. Vérifier le `manifest.yaml` après pour confirmer la version.
