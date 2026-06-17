# Magrit — Onboarding Claude Code

> Ce fichier est **chargé automatiquement par Claude Code** au démarrage de chaque session dans ce repo.
> Il garantit l onboarding minimal même quand un agent BMAD n est pas explicitement invoqué.

## Lecture obligatoire avant toute action

1. **[docs/project-context.md](docs/project-context.md)** — persistent facts BMAD (vision, stack, multi-tenancy, conventions, identifiants techniques).
2. **[SPRINT_HANDOFF.md](SPRINT_HANDOFF.md)** — état dev courant (sprint en cours, stories livrées, edge functions déployées, bugs connus).

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

## Conventions critiques (rappel rapide)

- **Branche active session** : `beta/v5` (B5, port 5177).
- **Langue de travail** : français (commits, code, livrables).
- **Format commits** : `feat|fix|chore|test|docs(v5): description courte` — **PAS d apostrophes** (HEREDOC).
- **Confirmation systématique avant push**.
- **Pas d invention de `data-testid`** — déclarer dans [src/app/lib/testIds.ts](src/app/lib/testIds.ts).
- **Persona IA** = `Magrit` (pas `Marguerite` — décision 2026-05-08).
- **Toute interaction Clariprint** passe par `ClariprintAdapter` ([src/server/clariprint/](src/server/clariprint/)) + `validateClariprintResponse()`.
- **Hiérarchie de prix** : `clariprint > library_cached > prix_marche > zero` via `resolvePrice()` ([src/app/utils/priceResolver.ts](src/app/utils/priceResolver.ts)).

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
