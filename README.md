
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
  Vite sur `localhost:5176`.

  Commandes utiles :

  ```bash
  pnpm infra:dev:status
  pnpm infra:dev:logs
  pnpm infra:dev:down
  pnpm db:seed:ux       # fixtures UX : clients, devis et commandes
  pnpm typecheck
  curl http://127.0.0.1:8787/api/v1/health
  ```

  `pnpm infra:dev:reset` détruit explicitement les volumes locaux après
  confirmation. Après un changement important de branche, relancez
  `pnpm install --frozen-lockfile`, puis `pnpm dev:local` : les migrations
  PostgreSQL manquantes sont appliquées automatiquement.

  `pnpm db:seed:ux` crée par défaut trois espaces de démonstration contenant
  chacun 100 clients, 150 devis, 200 commandes boutique et les commandes
  atelier associées aux devis convertis. La commande est idempotente.
  Les espaces UX disposent aussi d'un gabarit PDF de démonstration : le PDF
  manquant d'un devis envoyé, accepté, refusé ou converti est généré au premier
  clic sur « Voir le PDF » ou « Télécharger », puis conservé.
  Pour un seul espace et des volumes précis :

  ```bash
  pnpm db:seed:ux atelier-test 250 400 300
  ```

  ## Documentation

  - [Gestion de projet, backlog et décisions](project/README.md)
  - [Gouvernance produit](docs/GOUVERNANCE_PRODUIT_BACKLOG_SPECIFICATIONS.md)

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
