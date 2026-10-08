# Déploiement sur Clever Cloud depuis Git

Utiliser une application **Node.js**, reliée au dépôt et à la branche souhaitée.
Après fusion de la PR, déployer `main` et vérifier le SHA affiché dans les logs.
Le serveur sert l'interface Vite compilée et `/api/v1/*` sur une seule origine.
`pnpm start` lance Node sans Vite, tsx ou Docker. Il écoute sur `0.0.0.0:8080`
par défaut ; `PORT` fourni par l'hébergeur est prioritaire.

## Configuration de l'application

Importer les valeurs de [clevercloud/environment.example](../clevercloud/environment.example)
dans les variables de l'application. Ce fichier est un modèle, pas une configuration
automatiquement lue par Clever Cloud.

| Variable | Valeur |
| --- | --- |
| `CC_NODE_BUILD_TOOL` | `pnpm` |
| `CC_NODE_DEV_DEPENDENCIES` | `install` |
| `CC_POST_BUILD_HOOK` | `pnpm build` |
| `CC_RUN_COMMAND` | `pnpm start` |
| `CC_HEALTH_CHECK_PATH` | `/api/v1/readiness` |
| `NODE_ENV` | `production` |

Les dépendances de développement sont nécessaires **pendant le build**. Le
hook compile `dist/` (interface) et `dist-server/` (API et workers), avant la
création du cache. Le runtime utilise les dépendances de production. Les versions
Node et pnpm sont définies par `engines` et `packageManager` dans `package.json`.
Retirer une ancienne surcharge `MAGRIT_API_HOST=127.0.0.1` ou un ancien
`CC_RUN_COMMAND`. Refaire un build sans cache après la première configuration.

Ces réglages suivent la [documentation Node.js de Clever Cloud](https://www.clever.cloud/developers/doc/deploy/applications/nodejs/)
et les [hooks de déploiement](https://www.clever.cloud/developers/doc/develop/common-configuration/build-hooks/).

## Base, authentification et services

Le démarrage exige `DATABASE_URL`, `APP_BASE_URL` et `MAGRIT_AUTH_SECRET`.
Ne pas placer leurs valeurs privées dans Git.

| Variable | Configuration |
| --- | --- |
| `DATABASE_URL` | URL PostgreSQL du service lié, avec les droits applicatifs requis |
| `APP_BASE_URL` | URL HTTPS publique exacte, par exemple `https://magrit.example.com` |
| `MAGRIT_AUTH_SECRET` | Secret stable et aléatoire, au moins 32 caractères |
| `MAGRIT_DATABASE_MIGRATION_URL` | URL avec droits de migration si distincte du compte applicatif |
| `MAGRIT_TRUSTED_PROXIES` | Adresses/CIDR des proxies Clever Cloud, séparés par des virgules ; recopier la liste `CC_REVERSE_PROXY_IPS` fournie par la plateforme |
| `S3_ENDPOINT` | Endpoint HTTPS de Cellar ; ajouter `https://` à `CELLAR_ADDON_HOST` si nécessaire |
| `S3_PUBLIC_BASE_URL` | Endpoint S3 accessible aux navigateurs pour les URL signées |
| `S3_ACCESS_KEY_ID` | Valeur privée de `CELLAR_ADDON_KEY_ID` |
| `S3_SECRET_ACCESS_KEY` | Valeur privée de `CELLAR_ADDON_KEY_SECRET` |
| `S3_REGION` | Région attendue par le stockage S3 |
| `S3_FORCE_PATH_STYLE` | `true` pour l'accès par chemin aux buckets |
| `MAIL_HOST`, `MAIL_PORT`, `MAIL_SECURE` | Serveur SMTP réel (`MAIL_SECURE=true` pour TLS implicite) |
| `MAIL_USER`, `MAIL_PASSWORD` | Identifiants SMTP si requis |

Les noms des variables des add-ons ne sont pas automatiquement traduits en
variables Magrit : renseigner explicitement les valeurs correspondantes. Cellar
ne remplace pas PostgreSQL. Créer les buckets nécessaires et autoriser les
origines web pour les transferts directs du navigateur ; voir aussi
[la configuration des services](MIGRATION_HORS_SUPABASE.md).
SMTP est nécessaire pour la vérification des comptes et les invitations.

### Prérequis des rôles PostgreSQL

Les migrations créent cinq rôles SQL : `magrit_migrator`, `magrit_api`,
`magrit_worker`, `magrit_readonly` et `magrit_auth`. Le compte de migration
doit pouvoir les créer et gérer leurs permissions. Les comptes runtime
doivent aussi pouvoir utiliser les rôles nécessaires : les transactions de
l'API et des workers exécutent explicitement `SET LOCAL ROLE`.

Sur un add-on PostgreSQL Clever Cloud, l'administration des utilisateurs est
[restreinte par le fournisseur](https://www.clever.cloud/developers/deploy/addon/postgresql/postgresql/).
Le compte propriétaire fourni peut donc échouer avec `permission denied to
create role`. Avant le déploiement, demander au support comment provisionner
ces rôles, leurs droits et les appartenances nécessaires sur l'offre utilisée.
Leur création préalable seule ne garantit pas que toutes les migrations
pourront gérer leurs permissions. Si le fournisseur ne permet pas cette
configuration, utiliser une instance PostgreSQL dont on maîtrise les rôles.
Changer `DATABASE_URL` ou relancer le hook ne donne pas le droit `CREATEROLE`.
Ne pas contourner l'erreur en supprimant les rôles ou les politiques RLS.

Appliquer les migrations sur la base cible avec `pnpm db:migrate` avant le
premier démarrage, après validation de ces droits. Aucun seed de démonstration
n'est lancé en production.
Pour les déploiements suivants, exécuter les migrations dans une étape de
déploiement unique avant de lancer les instances ; éviter un hook concurrent
sur chaque instance. Le contrôle `/api/v1/readiness` vérifie la connexion
PostgreSQL, mais ne vérifie ni le schéma, ni SMTP, ni S3.

## Workers

Le build compile aussi les traitements asynchrones. Les exécuter dans des
workers avec les mêmes variables de services, selon les fonctionnalités utilisées :

```sh
pnpm start:worker:order-exports
pnpm start:worker:notifications
pnpm start:worker:outbox
pnpm start:worker:order-file-purge
```

Le serveur web seul n'exécute pas ces files de tâches. Les workers doivent
être supervisés par Clever Cloud dans les services appropriés.

## Vérification

Après le build, le log doit afficher `api.started` avec `http://0.0.0.0:8080`.
Vérifier `/`, un accès direct à `/tenants`, `/api/v1/health`,
`/api/v1/readiness` et `/api/v1/auth/get-session`. Sans session, ce dernier
retourne normalement `200` avec `null`. Tester ensuite la connexion, l'envoi
d'un courriel et un transfert S3 sur l'URL HTTPS réelle.

Une variable indispensable absente ou un build d'interface manquant fait
échouer le démarrage avec un message explicite. Une base indisponible rend
le contrôle readiness `503` et empêche de valider le déploiement.
