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
```

Le mode `--plan` valide la configuration et affiche les contrôles prévus sans
les exécuter.

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

Le runner initial collecte et normalise les preuves déterministes. Les profils
d'agents sont prêts pour une analyse LLM, mais aucun verdict sémantique ne doit
être prétendu tant qu'un adaptateur de modèle n'a pas effectivement exécuté le
profil sur le périmètre. Cette absence apparaît explicitement dans les
limitations du rapport.
