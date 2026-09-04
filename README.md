
  # MAGRIT_OFF

  This is a code bundle for MAGRIT_OFF. The original project is available at https://www.figma.com/design/RN6CAYFDlZgWXnGQ6xg0bY/MAGRIT_OFF.

  ## Running the code

  Run `pnpm install` to install the dependencies.

  Run `pnpm run dev` to start the development server.

  ## Choisir l'environnement Supabase

  - `pnpm dev:local` démarre Supabase local, sélectionne ses clés puis lance Vite.
  - `pnpm dev:official` sélectionne le projet Supabase officiel puis lance Vite.
  - `pnpm supabase:env:status` affiche l'environnement actuellement sélectionné.

  Pour changer d'environnement sans lancer Vite, utilisez
  `pnpm supabase:use:local` ou `pnpm supabase:use:official`. Le switch ne modifie
  que les trois variables Supabase de `.env.local` et conserve les autres
  secrets locaux. Si Vite tourne déjà, redémarrez-le après le changement.

  ## Changer de branche avec Supabase local

  Supabase local monte plusieurs fichiers du dépôt dans son conteneur Edge
  Runtime. Un `git switch` peut remplacer ces fichiers tout en laissant le
  conteneur attaché à leur ancienne version. L'API `magrit-api` échoue alors au
  démarrage avec un `503 BOOT_ERROR`, et l'application affiche « Espaces
  temporairement indisponibles ».

  Installez une fois le hook Git fourni par le dépôt :

  ```bash
  pnpm hooks:install
  ```

  L'installation copie le hook dans `.git/hooks`, qui n'est pas remplacé lors
  d'un changement de branche. Relancez cette commande après une modification
  du hook versionné afin de mettre à jour sa copie locale.

  Lors d'un `git switch` ou d'un `git checkout` vers une autre branche, le hook
  redémarre automatiquement Supabase si l'environnement local est sélectionné
  et déjà actif. Il ne fait rien lorsque Supabase est arrêté, lorsque
  l'environnement officiel est sélectionné ou lors du checkout d'un simple
  fichier.

  Le hook signale également les actions manuelles éventuellement nécessaires :

  - `pnpm install` si `pnpm-lock.yaml` a changé ;
  - `pnpm db:local:push` si les migrations Supabase ont changé.

  Ces deux commandes ne sont volontairement pas exécutées automatiquement :
  elles peuvent être longues ou modifier la base locale. Évitez
  `pnpm db:local:reset` sauf si une reconstruction complète est nécessaire :
  cette commande efface les données de la base locale.

  Pour vérifier que l'API locale a correctement redémarré :

  ```bash
  curl http://127.0.0.1:54321/functions/v1/magrit-api/api/v1/health
  ```

  La réponse doit contenir `"status":"ok"`. Si le changement de branche a été
  effectué avant l'installation du hook et que l'erreur est déjà présente,
  exécutez simplement `pnpm db:local:stop`, puis `pnpm db:local:start`.
  Rechargez ensuite la page ou utilisez le bouton « Réessayer ».

  ## Documentation

  - [Contexte projet](docs/project-context.md)
  - [Contrôle d’accès des boutiques](docs/SHOP_ACCESS_CONTROL.md)
  - [Règles d’architecture](docs/REGLES_ARCHITECTURE.md)
  - [Workflow des migrations Supabase](docs/SUPABASE_MIGRATIONS_WORKFLOW.md)
  - [Guides bêta](docs/beta-guides/README.md)
