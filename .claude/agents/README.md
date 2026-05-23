# Sous-agents Claude Code — Magrit

> Note pour Damien & Sébastien — installée le 2026-05-24 par Arnaud.

## Ce qu'on a fait

Ajout de **trois sous-agents Claude Code persistants** versionnés dans ce repo, sous `.claude/agents/`. Ils sont automatiquement chargés par toute session Claude Code ouverte dans le repo Magrit, sans rien à installer côté de votre poste.

Source : adapté en FR depuis le dépôt communautaire `luongnv89/claude-howto` (33 k stars, MIT), modules `04-subagents/`, avec spécificités Magrit (RLS Supabase, isolation multi-tenant, cahiers de tests Notion).

## Ce qu'est un sous-agent (rappel)

Un sous-agent Claude Code = un **expert spécialisé** auquel Claude délègue automatiquement (ou que vous invoquez manuellement) pour une tâche cadrée. Différences clés vs un prompt manuel :

- **Format de sortie imposé** → les retours sont structurés et comparables d'une exécution à l'autre.
- **Périmètre verrouillé** → l'agent ne fait que ce pour quoi il a été conçu, pas de dérive.
- **Permissions restreintes** → certains agents (ex : `secure-reviewer`) sont en lecture seule par conception, donc inoffensifs.
- **Versionné dans le repo** → toute l'équipe utilise la même définition, comparable à un linter partagé.

## Les trois agents installés

### `code-reviewer` — Revue de code globale
**Quand** : après toute écriture ou modification de code significative, avant push, en pré-revue de PR.
**Périmètre** : sécurité, performance, qualité du code, couverture de tests, architecture.
**Sortie** : sections « À corriger impérativement » / « À corriger avant merge » / « À considérer », avec sévérité + fichier:ligne + correction suggérée.
**Permissions** : Read, Grep, Glob, Bash.

**Invocation manuelle** :
```
> passe le code-reviewer sur les derniers changements
```

### `secure-reviewer` — Audit sécurité
**Quand** : avant tout merge touchant à l'authentification, l'autorisation (RLS), le paiement, l'accès aux données acheteurs, la gestion de secrets/config.
**Périmètre** : exposition de secrets (motifs `sbp_`, `eyJhbGci`, `SERVICE_ROLE`…), RLS Supabase manquantes, isolation cross-tenant, injection SQL/XSS, OWASP top 10.
**Spécifique Magrit** : l'agent connaît la distinction `anon` (publique) vs `service_role` (critique) et hiérarchise les alertes en conséquence.
**Sortie** : vulnérabilités classées par sévérité (Critique → Faible) avec catégorie OWASP + remédiation.
**Permissions** : **Read et Grep uniquement** — l'agent ne peut rien modifier ni exécuter par conception.

**Invocation manuelle** :
```
> lance le secure-reviewer sur les changements RLS de cette branche
```

### `test-engineer` — Écriture et exécution de tests
**Quand** : après implémentation d'une fonctionnalité, modification de logique métier critique, ou correction de bug (ajout d'un test de non-régression).
**Périmètre** : tests unitaires, intégration (base de données réelle, **pas de mock DB**), end-to-end Playwright, cas limites, scénarios d'erreur.
**Spécifique Magrit (DoD)** : impose `data-testid` stables et explicites (`product-card-title`, pas `card-1`), exige des tests d'isolation multi-tenant à chaque feature qui touche aux données, propose les entrées correspondantes pour la base de tests Notion.
**Sortie** : fichier de tests créé/modifié + nombre de cas + couverture estimée + chemins critiques protégés + cas Notion à ajouter.
**Permissions** : Read, Write, Bash, Grep.

**Invocation manuelle** :
```
> test-engineer : ajoute les tests d'isolation tenant pour cette feature
```

## Comment Claude les déclenche

Deux modes coexistent :

1. **Auto-invocation** — la description du frontmatter contient le mot-clé `PROACTIVELY`. Claude décide seul d'invoquer l'agent quand il détecte une situation correspondante (après écriture de code, avant merge sensible…). Pas d'action de votre part.
2. **Invocation manuelle** — vous demandez explicitement (« passe le secure-reviewer », « lance le test-engineer »). Toujours possible, même si l'auto-invocation ne s'est pas déclenchée.

Pour lister les agents disponibles dans une session, taper `/agents`.

## Ce que ça doit changer dans votre quotidien

- **Vous n'écrivez plus la grille de revue à la main** dans vos prompts — l'agent l'a déjà.
- **Les revues sont comparables** d'un commit à l'autre (sévérité harmonisée, format constant). Utile pour suivre la dette technique dans le temps.
- **Le `secure-reviewer` peut tourner sans risque** sur n'importe quelle branche : il ne peut rien casser (lecture seule). Pas de raison de s'en priver avant un merge.
- **Pour les tests Magrit**, le `test-engineer` connaît déjà la DoD (testid stables, multi-tenant, base réelle). Pas besoin de re-rappeler les conventions à chaque session.

## Modifier ou proposer un nouvel agent

- Modification d'un agent existant → édit direct du fichier `.md`, commit, PR. Discussion sur Notion ou en weekly.
- Nouvel agent spécifique Magrit (ex : `magrit-rls-reviewer` qui connaît les conventions RLS du repo) → créer un fichier supplémentaire dans `.claude/agents/` avec frontmatter (`name`, `description`, `tools`, `model`). Pas de limite au nombre d'agents.
- Convention adoptée : `description` en EN avec le mot-clé `PROACTIVELY` pour conserver l'auto-invocation Claude, **corps complet en FR** avec adaptations contexte AGE/Magrit.

## Lecture utile

- Source originale : https://github.com/luongnv89/claude-howto (modules `04-subagents/`)
- Documentation Anthropic sur les sous-agents : https://docs.claude.com/claude-code (chercher « subagents »)
- Commande `/agents` dans une session Claude Code pour lister et inspecter les agents chargés.
