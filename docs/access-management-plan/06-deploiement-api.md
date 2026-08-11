# Déploiement de la façade Access Management

## Contrat visible par le navigateur

Le navigateur appelle uniquement des URLs relatives sous `/api/v1` :

```text
/api/v1/tenants/{tenantId}/access/...
```

Il ne construit ni URL Supabase, ni chemin `/functions/v1`, ni nom d'Edge Function.

## Développement local

`vite.config.ts` route `/api/v1/*` vers l'hébergeur actuel de l'API. Cette configuration appartient à la composition d'infrastructure et n'est pas incluse dans le bundle navigateur.

## Environnement déployé

Le reverse proxy de la plateforme d'hébergement doit appliquer la réécriture suivante en conservant la méthode, le bearer token et `X-Request-Id` :

```text
/api/v1/*
  -> /functions/v1/access-management/api/v1/*
```

La destination Supabase reste une configuration du proxy. Elle ne constitue pas le contrat public et ne doit pas être injectée dans `VITE_API_BASE_URL`.

## Ordre de déploiement

1. déployer l'Edge Function `access-management` ;
2. tester directement la fonction depuis l'infrastructure ;
3. configurer et tester la réécriture `/api/v1` ;
4. déployer le frontend ;
5. exécuter les scénarios membre, non-membre, feature absente et capability absente ;
6. rendre le contrôle d'intégration bloquant avant promotion.

## Limite actuelle

Le dépôt ne contient pas la configuration du reverse proxy de production, car l'hébergeur du frontend n'est pas déclaré. Le proxy Vite couvre uniquement le développement local. La réécriture de production doit être ajoutée dans le dépôt de déploiement ou la configuration de l'hébergeur retenu.

