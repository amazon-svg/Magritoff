
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
  - [Guides bêta](docs/beta-guides/README.md)
