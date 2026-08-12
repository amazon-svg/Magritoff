# Déploiement de la façade API v1

La SPA appelle uniquement des chemins même origine `/api/v1`. Le runtime de référence est la fonction Supabase Edge `magrit-api`, mais son URL fournisseur ne doit jamais être connue des composants React.

## Ordre obligatoire

1. Déployer le backend :

   ```sh
   supabase functions deploy magrit-api --project-ref ightkxebexuzfjdbpsdg
   ```

2. Vérifier `GET /functions/v1/magrit-api/api/v1/health`, puis `GET .../session` avec un JWT utilisateur de recette.
3. Configurer sur l hébergeur le reverse proxy suivant, sans cache :

   ```text
   /api/v1/* -> https://ightkxebexuzfjdbpsdg.supabase.co/functions/v1/magrit-api/api/v1/*
   ```

4. Vérifier depuis le domaine public que le navigateur ne voit que `/api/v1/*`.
5. Déployer ensuite le front.

Le proxy Vite équivalent est versionné dans `vite.config.ts` pour le développement local. La fonction construit un client Supabase avec la clé anonyme et le bearer utilisateur ; elle ne doit jamais utiliser la service role pour le bootstrap, afin de conserver les politiques RLS.

Le proxy doit transmettre les corps `multipart/form-data` sans les convertir ni
forcer manuellement leur en-tête `Content-Type`. L’endpoint des visuels de
boutique accepte des fichiers jusqu’à 5 Mo ; cette limite doit également être
autorisée par le proxy et le runtime Edge.

Les URL Storage sont construites côté serveur. Lorsque le runtime Supabase voit
l’origine Docker interne `http://kong:8000`, `magrit-api` la remplace par
l’origine reçue du proxy. `MAGRIT_PUBLIC_SUPABASE_URL` permet de forcer cette
origine dans un environnement où les en-têtes forwardés ne sont pas fiables.

## Rollback

Le backend peut être déployé avant le front et rester inutilisé. En cas de problème après livraison du front, revenir à l artefact front précédent suffit ; ne pas supprimer immédiatement la fonction, afin de conserver les request IDs nécessaires au diagnostic.

Le déploiement, la configuration de l hébergeur et le smoke authentifié sont des actions externes : ils nécessitent une confirmation explicite et ne sont pas effectués par le commit AF2.
