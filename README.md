
  # MAGRIT_OFF

  This is a code bundle for MAGRIT_OFF. The original project is available at https://www.figma.com/design/RN6CAYFDlZgWXnGQ6xg0bY/MAGRIT_OFF.

  ## Running the code

  Run `pnpm install` to install the dependencies.

  Run `pnpm run dev` to start the development server.

  ## Après un gros checkout ou changement de branche

  Un checkout important peut laisser un environnement local incohérent : les
  dépendances peuvent venir de l'ancienne branche et la base Supabase locale
  conserve son propre historique de migrations. Procédez dans cet ordre.

  1. Vérifiez d'abord que vos modifications locales sont sauvegardées :

     ```bash
     git status --short
     ```

  2. Arrêtez les processus de l'ancienne branche :

     ```bash
     pnpm dev:b5:stop || true
     pnpm db:local:stop
     ```

  3. Réinstallez les dépendances correspondant au nouveau `pnpm-lock.yaml` :

     ```bash
     pnpm install --frozen-lockfile
     ```

  4. Redémarrez Supabase et tentez d'appliquer les migrations manquantes sans
     supprimer les données :

     ```bash
     pnpm db:local:start
     pnpm db:local:push
     pnpm supabase:use:local
     ```

  5. Si `db:local:push` signale `Remote migration versions not found in local
     migrations directory`, la base appartient à l'historique d'une autre
     branche. La solution fiable est alors de la recréer :

     ```bash
     pnpm db:local:reset
     pnpm supabase:use:local
     ```

     **Attention :** `db:local:reset` supprime toutes les données de la base
     Supabase locale de ce projet, puis rejoue les migrations et le seed. Il ne
     touche pas au projet Supabase distant. N'utilisez pas `migration repair`
     pour masquer une divergence de branche sans avoir identifié précisément
     les migrations concernées.

  6. Relancez enfin le front :

     ```bash
     pnpm dev
     ```

     Utilisez exactement cette commande, sans ajouter `start`. Avec
     `pnpm dev start`, Vite interprète `start` comme le dossier racine à servir :
     le port 5176 reste ouvert, mais toutes les pages répondent `404` et le
     navigateur affiche un écran blanc.

  Si Vite sert encore d'anciens modules après ces étapes, forcez une seule fois
  la reconstruction de son cache :

  ```bash
  pnpm exec vite --port 5176 --strictPort --force
  ```

  Contrôles rapides en cas d'échec persistant :

  ```bash
  pnpm supabase:env:status  # vérifie la cible de .env.local
  pnpm db:local:status      # vérifie les services Docker/Supabase
  pnpm typecheck            # détecte une API ou un module désynchronisé
  ```

  Un HTTP 500 contenant `Could not find the table ... in the schema cache`
  indique généralement que les migrations de la branche courante ne sont pas
  appliquées. Reprenez alors les étapes 4 et 5.

  Un HTTP 503 `BOOT_ERROR` accompagné de `Module not found` dans les logs de
  l'Edge Runtime indique que le checkout a remplacé des fichiers montés dans
  les conteneurs. Un simple redémarrage du conteneur ne suffit pas toujours :
  exécutez `pnpm db:local:stop`, puis `pnpm db:local:start` pour recréer les
  montages, sans réinitialiser les données.

  ## Choisir l'environnement Supabase

  - `pnpm dev:local` démarre Supabase local, sélectionne ses clés puis lance Vite.
  - `pnpm dev:official` sélectionne le projet Supabase officiel puis lance Vite.
  - `pnpm supabase:env:status` affiche l'environnement actuellement sélectionné.

  Pour changer d'environnement sans lancer Vite, utilisez
  `pnpm supabase:use:local` ou `pnpm supabase:use:official`. Le switch ne modifie
  que les trois variables Supabase de `.env.local` et conserve les autres
  secrets locaux. Si Vite tourne déjà, redémarrez-le après le changement.

  ## Générer des données volumiques pour les tests UX

  Après avoir démarré Supabase local et appliqué les migrations, générez les
  fixtures avec :

  ```bash
  pnpm db:seed:ux
  ```

  Sans argument, la commande crée **100 clients** et **200 commandes** dans le
  tenant `pressetout`. Pour choisir le tenant et les volumes :

  ```bash
  pnpm db:seed:ux <tenant-slug> <nombre-clients> <nombre-commandes>

  # Exemple
  pnpm db:seed:ux pressetout 250 500
  ```

  Le tenant ciblé doit déjà posséder au moins un administrateur et une
  boutique. Le générateur est réservé à la base locale et peut être relancé :
  ses identifiants déterministes évitent de dupliquer les mêmes fixtures. Les
  données produites couvrent plusieurs types de clients, statuts, boutiques et
  dates pour tester les recherches, filtres, paginations et listes denses.

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
