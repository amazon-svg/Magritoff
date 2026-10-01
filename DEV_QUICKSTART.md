# DEV Quickstart — Magrit

## Démarrage complet

Prérequis : Node 22, pnpm et Docker.

```bash
pnpm install --frozen-lockfile
pnpm dev:local
```

`dev:local` démarre et initialise :

- PostgreSQL 17 sur `127.0.0.1:55432` ;
- SeaweedFS compatible S3 sur `127.0.0.1:58333` ;
- Mailpit sur `127.0.0.1:58025` (SMTP `51025`) ;
- l'API Node sur `127.0.0.1:8787` ;
- Vite sur `127.0.0.1:5176`.

La commande applique les migrations PostgreSQL, le seed de développement et
la configuration des neuf buckets S3. `Ctrl-C` arrête l'API et Vite ; les
conteneurs et leurs volumes restent disponibles pour le prochain démarrage.

## Vérifications et maintenance

```bash
curl http://127.0.0.1:8787/api/v1/health
curl http://127.0.0.1:8787/api/v1/readiness
pnpm infra:dev:status
pnpm infra:dev:logs
pnpm infra:dev:down
```

Pour réinitialiser volontairement les données locales :

```bash
pnpm infra:dev:reset
```

Cette commande demande confirmation et détruit uniquement les volumes Compose
du projet. Au démarrage suivant, les migrations et le seed sont rejoués.

## Processus séparés

Pour travailler sur une seule couche :

```bash
pnpm infra:dev:up
pnpm api:dev
pnpm dev
```

Les workers portables se lancent séparément :

```bash
pnpm worker:outbox
pnpm worker:notifications
pnpm worker:order-exports
pnpm worker:order-file-purge
```

Les variantes `:once` traitent réellement les éléments en attente. Ne pas les
utiliser comme simple smoke test sur un environnement contenant des données
utiles.

## Tests principaux

```bash
pnpm typecheck
pnpm test:architecture
pnpm test:contract
pnpm build
```

L'ancienne stack locale Supabase et la fonction Edge `magrit-api` ne sont plus
nécessaires au développement courant. Les migrations et adaptateurs Supabase
encore présents dans le dépôt servent uniquement à la reprise des données tant
que la migration des environnements existants n'est pas achevée.
