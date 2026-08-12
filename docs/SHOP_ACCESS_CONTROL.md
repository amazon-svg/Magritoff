# Contrôle d’accès des boutiques

> Source de vérité fonctionnelle depuis AF7.1 (`97829bc`, 2026-08-11).

## Matrice de comportement

| Mode boutique | Visiteur anonyme | Compte sans invitation | Membre autorisé |
|---|---|---|---|
| `invite_only` | Écran privé générique, connexion uniquement | 403 générique | Catalogue et fonctions autorisées par ses permissions |
| `self_signup` | Catalogue public, connexion ou création de compte au checkout | Catalogue accessible ; rattachement à la première commande | Catalogue et commande selon ses permissions |

Une boutique existante est `invite_only` par défaut. Le mode `self_signup` doit
être activé volontairement par l’administrateur de la boutique.

## Invariants

1. Une boutique `invite_only` ne propose jamais « Créer un compte ».
2. Se connecter avec un compte Magrit quelconque ne constitue pas une
   invitation.
3. Pour `invite_only`, seule la membership du tenant propriétaire est prise en
   compte :
   - `magrit_full` autorise la boutique du tenant ;
   - `shop_only` exige que l’identifiant de la boutique figure dans
     `allowed_shop_ids` ;
   - une membership d’un autre tenant ne donne aucun accès.
4. Avant autorisation, `PublicShop` ne charge via l’API qu’un triplet technique
   minimal (`id`, `tenantId`, `accessMode`). Il ne demande ni marque, ni
   description, ni produits, ni prix, ni PIM, ni gammes.
5. Un compte authentifié sur `self_signup` est rattaché atomiquement lors de sa
   première commande. Le rattachement est `shop_only`, limité à la boutique et
   ne confère jamais `magrit_full`.
6. La fonction SQL interne `api_create_tenant_order_core` n’est exécutable que
   par son propriétaire. Seul le wrapper `api_create_tenant_order` est accordé
   au rôle `authenticated`.

## Parcours UX attendus

### Boutique sur invitation

- anonyme : « Boutique privée » → « Se connecter » ;
- la modale contient connexion et mot de passe oublié, sans inscription ;
- authentifié non membre : 403 sans branding ni catalogue ;
- membre invité : accès normal, puis commande si `permissions.can_order=true`.

### Boutique en inscription libre

- catalogue visible sans compte ;
- identification requise avant commande ;
- création de compte disponible ;
- la première commande déclenche le rattachement si nécessaire.

## Implémentation

- décision pure : `src/app/components/shop/ShopAccessGuard.helpers.ts` ;
- orchestration et chargement différé : `src/app/components/shop/PublicShop.tsx` ;
- écran privé/403 : `src/app/components/shop/ShopForbidden403.tsx` ;
- wrapper SQL :
  `supabase/migrations/20260811000800_create_order_self_signup.sql` ;
- tests : `tests/components/shop/ShopAccessGuard.helpers.test.ts` ;
- story BMAD :
  `_bmad-output/implementation-artifacts/story-AF7-1-acces-boutique-et-self-signup.md`.

## Validation manuelle minimale

1. Ouvrir une boutique `invite_only` déconnecté : aucun nom ni produit, aucun
   lien de création de compte.
2. Se connecter avec un compte non invité : 403.
3. Inviter ce compte avec le bon `allowed_shop_ids` : catalogue accessible.
4. Ouvrir une boutique `self_signup` déconnecté : catalogue visible.
5. Créer un compte et commander : commande créée et membership `shop_only`
   ajoutée une seule fois.

## Frontière API-first

AF13.2 garantit l’absence de chargement du contenu privé dans le parcours de
l’application et revérifie cette autorisation côté serveur avant de construire
le catalogue. Un appel forgé à `/api/v1/public/shops/:slug/catalog` retourne
`401` sans session ou `403` sans membership pour une boutique `invite_only`.
Les policies RLS historiques publiques restent une dette des anciens accès
PostgREST, mais `PublicShop` ne les consomme plus directement.

## Administration des membres et rôles

Depuis AF12.1, la consultation du catalogue de rôles, la matrice des membres et
les assignations/révocations passent par `/api/v1`. L’interface ne transmet
jamais l’identité de l’administrateur : le serveur la dérive du JWT utilisateur
et les policies RLS contrôlent `can_manage_roles`. Le périmètre `magrit_full` ou
`shop_only` et les boutiques autorisées continuent de passer par l’API Membres.

Depuis AF12.2, la définition du catalogue (création, édition, archivage et
ordre) passe également par l’API. La permutation d’ordre est atomique en base,
et l’archivage des rôles canoniques est refusé côté serveur. Une revue
fonctionnelle complète du module invitations/membres/rôles reste planifiée
après cette migration technique.
