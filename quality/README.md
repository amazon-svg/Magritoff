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

Tant qu'aucun fichier `*.spec.yaml` autre que le modèle n'est importé dans
`quality/specs`, la conformité fonctionnelle reste explicitement
`INCONCLUSIVE`, même si le schéma et les tests techniques passent.

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

Les parcours navigateur sont séparés en deux niveaux :

- `pnpm test:e2e:quality` exécute les scénarios reproductibles sans compte de
  recette historique ;
- `pnpm test:e2e:staging` exécute la suite complète contre une recette préparée.

La suite complète exige les variables Supabase et les comptes
`E2E_QA_EMAIL`, `E2E_QA_PASSWORD` et `E2E_ADMIN_PASSWORD`. Leur absence est une
preuve manquante (`INCONCLUSIVE`), pas un succès ni un défaut du produit.

Le mode `--plan` valide la configuration et affiche les contrôles prévus sans
les exécuter.

### Analyse sémantique optionnelle

`--semantic` exécute réellement les profils d'auditeurs sur les fichiers du
périmètre. Copier d'abord le modèle local, qui est ignoré par Git :

```bash
cp .env.quality.example .env.quality.local
# renseigner ensuite le fournisseur, le modèle et la clé dans ce fichier
pnpm quality:audit --mode module --module commercial-quotes --semantic
```

Le runner charge automatiquement `.env.quality.local`. Une variable déjà
définie dans le shell ou dans la CI reste prioritaire. Pour employer un autre
fichier, définir `QUALITY_ENV_FILE` avec son chemin avant de lancer la commande.

Variables disponibles :

- `QUALITY_LLM_BASE_URL` : racine API, sans endpoint final ;
- `QUALITY_LLM_MODEL` : identifiant exact du modèle ;
- `QUALITY_LLM_API_KEY` : clé facultative pour un endpoint local ;
- `QUALITY_LLM_API` : `responses` par défaut ou `chat-completions` ;
- `QUALITY_LLM_BATCH_CHARS` : taille maximale approximative d'un lot ;
- `QUALITY_LLM_MAX_BATCHES` : garde-fou de coût pour un audit intégral.
- `QUALITY_LLM_TIMEOUT_MS` : délai maximal d'une requête au fournisseur.

Dans GitHub, l'analyse s'active uniquement en cochant `run_semantic` lors d'un
déclenchement manuel. Le dépôt doit définir les secrets `QUALITY_LLM_BASE_URL`
et `QUALITY_LLM_API_KEY`, ainsi que les variables `QUALITY_LLM_MODEL` et
`QUALITY_LLM_API`. La clé peut rester vide pour un fournisseur compatible sans
authentification. Une instance locale telle qu'Ollama exige un runner
auto-hébergé ayant accès à cette instance : un runner GitHub hébergé ne peut pas
joindre le `localhost` de votre poste.

Les contrôles navigateur se déclenchent manuellement avec `run_e2e`. La suite
complète exige en plus `run_staging_e2e` et les secrets GitHub préfixés par
`QUALITY_SUPABASE_` et `QUALITY_E2E_` déclarés dans le workflow.

### Contrat OpenAPI

Le contrat `openapi/magrit-core.v1.yaml` est la source de vérité. Toute
génération de types passe d'abord par `pnpm openapi:validate`, qui vérifie :

- le parsing YAML et la version OpenAPI 3.1.0 ;
- la présence des chemins, des `operationId`, des `summary` et des réponses ;
- l'unicité des `operationId` ;
- la longueur des `summary`.

Règle rédactionnelle : `summary` est un intitulé court, professionnel et
orienté action, par exemple « Liste les clients », « Crée un client » ou
« Récupère un client ». Il ne contient ni justification métier, ni liste de
cas, ni détail technique. Ces éléments appartiennent à `description`, qui
porte le comportement complet de l'opération et ses exceptions.

Le vocabulaire doit rester homogène avec l'action exposée : `Liste`, `Crée`,
`Récupère`, `Modifie`, `Supprime`, `Ajoute`, `Remplace`, `Envoie`, etc. Le
`summary` est dérivé de l'intention de l'`operationId`, pas d'un paragraphe de
cadrage copié dans la documentation.

Les summaries de plus de 120 caractères font échouer la validation. Pour une
lecture temporaire sans ce garde-fou, `OPENAPI_STRICT_SUMMARIES=0` désactive
la règle, mais cette exception ne doit pas être utilisée dans l'audit qualité.

`pnpm gen:api:check` exécute automatiquement cette validation avant de vérifier
la dérive entre le contrat et `src/platform/api/generated/magrit-core.v1.ts`.

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
evidence/semantic/<agent>-requests.jsonl
evidence/checks/<check>-artifacts/
```

`quality-reports/` est ignoré par Git. Sur GitHub, le dossier complet est
publié comme artefact conservé 90 jours et `summary.md` est recopié dans la
synthèse du run GitHub. Les fichiers Markdown et JSON pourront être
recopiés ensuite sur une branche orpheline `audit-reports` pour l'historique
durable ; les traces et captures volumineuses restent des artefacts.

Les fichiers `.env.quality`, `.env.quality.local` et les configurations locales
Hoppscotch ne doivent jamais être ajoutés à Git. `pnpm quality:secrets` vérifie
ce garde-fou à partir de la liste des fichiers réellement suivis.

Le rapport enregistre le SHA, la branche, le mode, les commandes, leurs codes
de sortie, les limitations et les chemins des preuves. Le schéma canonique est
`quality/schemas/agent-report.schema.json`.

Lors d'une analyse LLM, la console affiche chaque lot, sa durée, son verdict et
sa consommation lorsque le fournisseur la communique. Le journal JSONL associé
conserve ces métadonnées, l'identifiant de réponse et les erreurs, sans clé API.
La réponse brute structurée de chaque lot reste disponible dans le même dossier.

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
