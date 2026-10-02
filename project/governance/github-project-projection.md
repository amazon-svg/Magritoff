# Projection du backlog vers GitHub Project

## Principe

Les fichiers de project/backlog/ restent la source canonique. GitHub Project est une vue dérivée, destinée à faciliter les vues tableau, roadmap, filtres et regroupements.

La synchronisation fonctionne uniquement de project/backlog/**/*.md vers GitHub Project.

Une modification effectuée directement dans GitHub Project peut être écrasée lors de la projection suivante. La synchronisation inverse est volontairement exclue de cette première version.

## Représentation

Chaque epic, fonctionnalité et story devient un draft item GitHub Project. Aucune issue GitHub n'est créée.

L'identifiant du frontmatter est enregistré dans le champ Backlog ID et sert de clé d'idempotence.

| Champ GitHub Project | Type | Source |
|---|---|---|
| Backlog ID | texte | id |
| Type | sélection | Epic, Feature ou Story |
| Spec Status | sélection | specStatus |
| Delivery Status | sélection | deliveryStatus |
| Epic | texte | epic |
| Feature | texte | feature |
| Source Path | texte | chemin du fichier Markdown |

Le titre et le corps du draft item sont également régénérés. Le corps rappelle que Git reste canonique et fournit un lien vers le fichier source.

## Sécurité

- le mode par défaut est un dry-run ;
- toute écriture exige --apply ;
- aucun élément distant n'est supprimé ou archivé automatiquement ;
- les éléments GitHub Project sans Backlog ID sont ignorés ;
- les doublons de Backlog ID interrompent la synchronisation ;
- une issue ou pull request existante n'est jamais réécrite comme un draft item ;
- le script n'effectue aucune modification dans les fichiers Markdown.

## Prévisualisation locale

    pnpm github-project:plan
    pnpm test:project-sync

Cette commande lit le backlog et affiche les éléments qui seraient projetés, sans accès à GitHub.

## Configuration initiale

Déterminer le propriétaire et le numéro du GitHub Project, puis créer les champs :

    pnpm github-project:sync -- \
      --owner amazon-svg \
      --project <NUMERO> \
      --repository amazon-svg/Magritoff \
      --bootstrap-fields \
      --apply

Le CLI GitHub doit être authentifié avec un jeton possédant le scope project. Un accès en lecture seule peut utiliser read:project.

## Projection courante

Dry-run comparé au projet distant :

    pnpm github-project:sync -- \
      --owner amazon-svg \
      --project <NUMERO> \
      --repository amazon-svg/Magritoff

Application :

    pnpm github-project:sync -- \
      --owner amazon-svg \
      --project <NUMERO> \
      --repository amazon-svg/Magritoff \
      --apply

Variables d'environnement :

- GH_PROJECT_OWNER ;
- GH_PROJECT_NUMBER ;
- GITHUB_REPOSITORY ;
- GH_PROJECT_SOURCE_REF, avec main par défaut.

## GitHub Actions

Le workflow .github/workflows/github-project-sync.yml :

- vérifie le plan local sur les pull requests ;
- projette automatiquement après fusion sur main, si la configuration est présente ;
- permet une exécution manuelle ;
- utilise le secret PROJECTS_TOKEN.

Variables du dépôt à configurer :

- GH_PROJECT_OWNER ;
- GH_PROJECT_NUMBER.

Secret à configurer :

- PROJECTS_TOKEN, avec accès en écriture au GitHub Project.

## Bidirectionnel

Une synchronisation GitHub Project vers Markdown n'est pas prévue dans cette version. Elle nécessiterait une règle d'autorité champ par champ, une gestion des éditions concurrentes, une identité d'auteur et une proposition de modification Git sous forme de pull request.

Le webhook projects_v2_item pourra servir de déclencheur ultérieur, mais Git restera la source canonique.
