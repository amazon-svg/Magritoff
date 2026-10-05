# Tableau de bord du projet

Le tableau de bord est une vue dérivée du contenu canonique de `project/`.
Il ne stocke aucun statut et ne doit jamais être modifié manuellement.

## Génération locale

```bash
pnpm project:dashboard
```

Ouvrir ensuite `project/dashboard/index.html` dans un navigateur. Le fichier est
autonome : aucune API, aucun serveur et aucun jeton GitHub ne sont nécessaires.

## Données affichées

- synthèse et métriques du backlog ;
- Kanban des stories par `deliveryStatus` ;
- filtres par epic, fonctionnalité et `specStatus` ;
- hiérarchie epic → fonctionnalité → story ;
- décisions enregistrées et questions ouvertes.

Les liens ouvrent les fichiers canoniques sur la branche `main` du dépôt.

## Automatisation

Le workflow `.github/workflows/project-dashboard.yml` régénère et teste le
fichier à chaque pull request ou push qui modifie ses sources. Le HTML est joint
à l'exécution GitHub Actions sous forme d'artefact téléchargeable. La PR échoue
si le fichier versionné ne correspond plus aux sources : il suffit alors de
relancer `pnpm project:dashboard` et de committer le résultat.

La publication GitHub Pages est optionnelle et n'utilise aucun jeton personnel.
Pour l'activer :

1. choisir **GitHub Actions** comme source dans `Settings → Pages` ;
2. créer la variable de dépôt `ENABLE_PROJECT_DASHBOARD_PAGES=true` ;
3. fusionner ou pousser une modification concernée sur `main`.

GitHub fournit alors au workflow un jeton temporaire limité à Pages.
