
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

  ## Documentation

  - [Contexte projet](docs/project-context.md)
  - [Contrôle d’accès des boutiques](docs/SHOP_ACCESS_CONTROL.md)
  - [Règles d’architecture](docs/REGLES_ARCHITECTURE.md)
  - [Workflow des migrations Supabase](docs/SUPABASE_MIGRATIONS_WORKFLOW.md)
  - [Guides bêta](docs/beta-guides/README.md)
