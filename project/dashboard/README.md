# Tableau de bord du projet

Le tableau de bord est une vue dérivée du contenu canonique de `project/`.
Il ne stocke aucun statut et ne doit jamais être modifié manuellement.

## Génération locale

```bash
pnpm project:refresh
```

Ouvrir ensuite `project/dashboard/index.html` dans un navigateur. Le fichier est
autonome : aucune API, aucun serveur et aucun jeton GitHub ne sont nécessaires.

Depuis GitHub, utiliser le lien suivant pour obtenir directement le rendu HTML :

[Ouvrir le tableau de bord](https://html-preview.github.io/?url=https://github.com/amazon-svg/Magritoff/blob/main/project/dashboard/index.html)

Ce lien utilise le proxy CORS tiers `html-preview.github.io`. Le dashboard ne
contient que les informations versionnées dans le dépôt et ne stocke aucune
donnée saisie, aucun cookie et aucun jeton. Ne pas employer ce mécanisme pour
prévisualiser une page contenant des données sensibles.

## Données affichées

- synthèse et métriques du backlog ;
- Kanban des stories par `deliveryStatus` ;
- filtres par epic, fonctionnalité et `specStatus` ;
- hiérarchie epic → fonctionnalité → story ;
- décisions enregistrées et questions ouvertes.
- comptes rendus et reports à analyser, avec responsable et points ouverts.

Les liens ouvrent les fichiers canoniques sur la branche `main` du dépôt.

## Automatisation

Le workflow `.github/workflows/project-dashboard.yml` synchronise le registre
des réunions, régénère et teste le fichier à chaque pull request ou push qui modifie ses sources. Le HTML est joint
à l'exécution GitHub Actions sous forme d'artefact téléchargeable. La PR échoue
si le fichier versionné ne correspond plus aux sources : il suffit alors de
relancer `pnpm project:refresh` et de committer le résultat.

Les demandes de fusion doivent aussi contenir le dernier `main`. Après un
`rebase`, les hooks installés par `pnpm hooks:install` régénèrent le dashboard ;
le hook avant push bloque ensuite l'envoi si ce résultat n'est pas commité. Un
conflit dans `index.html` se traite donc en régénérant le fichier depuis les
sources réconciliées, jamais en fusionnant manuellement son contenu.

La publication GitHub Pages reste optionnelle si une URL hébergée directement
par le dépôt est préférée. Elle n'utilise aucun jeton personnel.
Pour l'activer :

1. choisir **GitHub Actions** comme source dans `Settings → Pages` ;
2. créer la variable de dépôt `ENABLE_PROJECT_DASHBOARD_PAGES=true` ;
3. fusionner ou pousser une modification concernée sur `main`.

GitHub fournit alors au workflow un jeton temporaire limité à Pages.
