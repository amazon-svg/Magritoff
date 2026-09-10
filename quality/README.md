# Architecture de contrôle qualité Magrit

Ce dossier contient la configuration indépendante du fournisseur pour auditer
Magrit. Les contrôles sont des auditeurs en lecture seule : ils collectent des
preuves, rendent un verdict et produisent un rapport, mais ne corrigent pas le
code, ne fusionnent pas de branche et ne déploient rien.

## Modes d'exécution

- `diff` : changements entre une référence de base et le commit courant ;
- `module` : totalité d'un module `src/modules/<id>` ;
- `full` : totalité des fichiers suivis du dépôt, découpée par module dans le
  contexte du run.

Le mode `full` sert à créer puis réévaluer une baseline globale. Le mode `diff`
sert au retour rapide sur une branche ou une pull request. Aucun de ces modes
n'est bloquant par défaut.

## Auditeurs

| Identifiant | Responsabilité |
|---|---|
| `architecture` | Règles R1-R8, frontières, modularité et API-first |
| `api` | Contrats, comportements HTTP, sécurité et isolation tenant |
| `functional` | Traçabilité des critères d'acceptation vers le code et les tests |
| `ux` | Parcours réels, responsive, accessibilité et qualité d'interaction |
| `test-quality` | Exhaustivité et capacité des tests à détecter des régressions |

Les profils détaillés vivent dans `quality/agents/`. Ils constituent les
instructions communes aux futurs adaptateurs Codex, Claude et LLM locaux.

## Verdicts

- `PASS` : toutes les preuves obligatoires disponibles sont positives ;
- `WARN` : un contrôle optionnel a échoué ou une réserve non critique existe ;
- `FAIL` : au moins une preuve obligatoire est négative ;
- `INCONCLUSIVE` : une preuve obligatoire n'a pas pu être produite ;
- `ERROR` : le runner lui-même n'a pas pu terminer correctement.

`FAIL` décrit la qualité auditée. Il ne provoque pas un échec du processus en
politique `advisory`. `ERROR` décrit un problème d'infrastructure et produit un
code de sortie non nul.

## Commandes

```bash
pnpm quality:audit --mode diff
pnpm quality:audit --mode module --module commercial-quotes
pnpm quality:audit --mode full
pnpm quality:audit --mode full --agent api
pnpm quality:audit --mode full --plan
pnpm quality:audit --mode diff --semantic
```

Le mode `--plan` valide la configuration et affiche les contrôles prévus sans
les exécuter.

### Analyse sémantique optionnelle

`--semantic` exécute réellement les profils d'auditeurs sur les fichiers du
périmètre. Le fournisseur est configuré uniquement par variables
d'environnement :

```bash
export QUALITY_LLM_BASE_URL=http://localhost:11434/v1
export QUALITY_LLM_MODEL=modele-local
export QUALITY_LLM_API=chat-completions
pnpm quality:audit --mode module --module commercial-quotes --semantic
```

Variables disponibles :

- `QUALITY_LLM_BASE_URL` : racine API, sans endpoint final ;
- `QUALITY_LLM_MODEL` : identifiant exact du modèle ;
- `QUALITY_LLM_API_KEY` : clé facultative pour un endpoint local ;
- `QUALITY_LLM_API` : `responses` par défaut ou `chat-completions` ;
- `QUALITY_LLM_BATCH_CHARS` : taille maximale approximative d'un lot ;
- `QUALITY_LLM_MAX_BATCHES` : garde-fou de coût pour un audit intégral.

Dans GitHub, l'analyse s'active uniquement en cochant `run_semantic` lors d'un
déclenchement manuel. Le dépôt doit définir les secrets `QUALITY_LLM_BASE_URL`
et `QUALITY_LLM_API_KEY`, ainsi que les variables `QUALITY_LLM_MODEL` et
`QUALITY_LLM_API`. La clé peut rester vide pour un fournisseur compatible sans
authentification. Une instance locale telle qu'Ollama exige un runner
auto-hébergé ayant accès à cette instance : un runner GitHub hébergé ne peut pas
joindre le `localhost` de votre poste.

Les requêtes OpenAI utilisent `store: false` et une sortie structurée par le
schéma `quality/schemas/agent-assessment.schema.json`. Un endpoint compatible
Chat Completions, notamment local, reçoit le même schéma dans
`response_format`. Une réponse invalide ou un lot non analysé rend le verdict
`INCONCLUSIVE`.

## Rapports

Chaque run écrit dans `quality-reports/<run-id>/` :

```text
context.json
manifest.json
summary.md
agents/<agent>.json
agents/<agent>.md
evidence/<agent>/<check>.log
```

`quality-reports/` est ignoré par Git. Sur GitHub, le dossier complet est
publié comme artefact temporaire. Les fichiers Markdown et JSON pourront être
recopiés ensuite sur une branche orpheline `audit-reports` pour l'historique
durable ; les traces et captures volumineuses restent des artefacts.

Le rapport enregistre le SHA, la branche, le mode, les commandes, leurs codes
de sortie, les limitations et les chemins des preuves. Le schéma canonique est
`quality/schemas/agent-report.schema.json`.

## Politique non bloquante

La politique `advisory` est définie dans `quality/policy.yaml` :

- un test négatif donne un rapport `FAIL` mais le runner sort avec le code 0 ;
- un prérequis absent donne `INCONCLUSIVE` ;
- une configuration illisible ou un rapport impossible à écrire donne
  `ERROR` et un code de sortie non nul ;
- le workflow GitHub n'est pas destiné à devenir un status check requis.

## Limite du premier socle

Sans option `--semantic`, le runner collecte et normalise uniquement les
preuves déterministes. Aucun verdict sémantique n'est alors prétendu et cette
absence apparaît explicitement dans les limitations du rapport.
