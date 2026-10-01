
  # MAGRIT_OFF

  This is a code bundle for MAGRIT_OFF. The original project is available at https://www.figma.com/design/RN6CAYFDlZgWXnGQ6xg0bY/MAGRIT_OFF.

  ## Développement local

  Prérequis : Node 22, pnpm et Docker.

  ```bash
  pnpm install --frozen-lockfile
  pnpm dev:local
  ```

  Cette commande démarre PostgreSQL 17, SeaweedFS (API S3), Mailpit, applique
  les migrations et le seed, puis lance l'API Node sur `127.0.0.1:8787` et
  Vite sur `127.0.0.1:5176`.

  Commandes utiles :

  ```bash
  pnpm infra:dev:status
  pnpm infra:dev:logs
  pnpm infra:dev:down
  pnpm typecheck
  curl http://127.0.0.1:8787/api/v1/health
  ```

  `pnpm infra:dev:reset` détruit explicitement les volumes locaux après
  confirmation. Après un changement important de branche, relancez
  `pnpm install --frozen-lockfile`, puis `pnpm dev:local` : les migrations
  PostgreSQL manquantes sont appliquées automatiquement.

  ## Générer des données volumiques pour les tests UX

  Après avoir démarré l'infrastructure locale et appliqué les migrations, générez les
  fixtures avec :

  ```bash
  pnpm db:seed:ux
  ```

  Sans argument, la commande crée trois tenants (`pressetout`,
  `atelier-lumiere`, `imprimerie-du-parc`), deux boutiques par tenant, puis
  **100 clients** et **200 commandes par tenant**. Elle crée aussi le compte
  local `demo@magrit.local` (mot de passe `magrit-demo`), administrateur des
  trois espaces, ainsi que trois utilisateurs par tenant :

  - `commandes.<tenant>@magrit.local` avec l'option Commandes ;
  - `boutiques.<tenant>@magrit.local` avec l'option Boutiques ;
  - `equipe.<tenant>@magrit.local` sans option fonctionnelle.

  Tous les comptes de démonstration utilisent le mot de passe `magrit-demo`.

  Pour choisir un seul tenant et les volumes, ou changer les volumes du jeu
  multi-tenant :

  ```bash
  pnpm db:seed:ux <tenant-slug> <nombre-clients> <nombre-commandes>
  pnpm db:seed:ux --all <nombre-clients-par-tenant> <nombre-commandes-par-tenant>

  # Exemple
  pnpm db:seed:ux pressetout 250 500
  ```

  Le générateur est autonome : il crée au besoin les comptes Auth, les tenants,
  leurs membres, leurs options et leurs boutiques. Il est réservé à la base
  locale et peut être relancé : ses
  identifiants déterministes évitent de dupliquer les mêmes fixtures. Les
  données produites couvrent plusieurs types de clients, statuts, boutiques et
  dates pour tester les recherches, filtres, paginations et listes denses.

  ## Documentation

   ### Documentation OpenAPI locale

   La documentation graphique du contrat est servie directement par Vite en
   développement. Lancez l'application avec :

   ```bash
   pnpm openapi:docs
   ```

   Puis ouvrez [http://localhost:5176/docs/openapi](http://localhost:5176/docs/openapi).
   La page lit directement `openapi/magrit-core.v1.yaml` ; elle reste donc
   synchronisée avec le contrat source. Le rendu Redoc charge sa bibliothèque
   depuis le CDN Redocly.

  - [Contexte projet](docs/project-context.md)
  - [Contrôle d’accès des boutiques](docs/SHOP_ACCESS_CONTROL.md)
  - [Règles d’architecture](docs/REGLES_ARCHITECTURE.md)
  - [Plan de migration hors Supabase](docs/MIGRATION_HORS_SUPABASE.md)
  - [Workflow des migrations Supabase](docs/SUPABASE_MIGRATIONS_WORKFLOW.md)
  - [Guides bêta](docs/beta-guides/README.md)
