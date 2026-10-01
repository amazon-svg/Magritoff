# Déploiement de la façade API v1

La SPA appelle uniquement des chemins même origine `/api/v1`. Le runtime de
référence est le serveur Node `src/server/node/main.ts`, construit et déployé
avec le reste de l'application sans dépendance à une fonction Edge.

## Ordre obligatoire

1. Appliquer les migrations PostgreSQL avec `pnpm db:migrate`.
2. Déployer l'image contenant l'API Node et le worker.
3. Vérifier `GET /api/v1/health`, puis `GET /api/v1/session` avec une session utilisateur de recette.
4. Configurer sur l'hébergeur le reverse proxy suivant, sans cache :

   ```text
   /api/v1/* -> http://api-magrit:8787/api/v1/*
   ```

5. Vérifier depuis le domaine public que le navigateur ne voit que `/api/v1/*`.
6. Déployer ensuite le front.

Le proxy Vite équivalent est versionné dans `vite.config.ts` et vise
`http://127.0.0.1:8787` par défaut. L'API résout la session locale ou le jeton
OIDC et applique `authentication: 'required'` dans son routeur ; les seules
routes anonymes sont explicitement marquées `public`.

Le proxy doit transmettre les corps `multipart/form-data` sans les convertir ni
forcer manuellement leur en-tête `Content-Type`. L’endpoint des visuels de
boutique accepte des fichiers jusqu’à 5 Mo ; cette limite doit également être
autorisée par le reverse proxy et le serveur Node. Les URL d'objets sont
construites côté serveur à partir de `S3_PUBLIC_BASE_URL` ou sous forme d'URL
signée S3.

## Rollback

Conserver l'image API précédente et rendre les migrations additives. En cas de
problème après livraison, rétablir ensemble les versions précédentes de l'API
et du front ; ne jamais restaurer une base en production sans procédure de
reprise validée.
