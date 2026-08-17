# Contrôle d’accès des boutiques

> Source de vérité fonctionnelle depuis UM8.1 (2026-08-17).

## Deux populations strictement séparées

| Population | Identité | Périmètre | Création |
|---|---|---|---|
| Utilisateur Magrit | `auth.users` + `tenant_members` | Dashboard, production, validation, administration | Invitation depuis « Utilisateurs et rôles » |
| Client boutique | `shop_customer_accounts` + credentials privés storefront | Une seule boutique | Éditeur de la boutique, puis lien d’activation |

Un email identique dans deux boutiques correspond à deux comptes clients
distincts. Un utilisateur Magrit n’est jamais automatiquement un client
boutique.

## Accès délégué depuis Magrit

L’action **Se connecter à la boutique** :

1. crée si nécessaire un compte boutique miroir `delegated_only` avec l’email
   et le nom de l’utilisateur Magrit ;
2. ouvre une session storefront déléguée, limitée à cette boutique ;
3. conserve l’identité du compte boutique et l’acteur Magrit séparément dans
   les commandes et l’audit ;
4. permet de quitter la délégation sans fermer la session Magrit.

Le mot de passe aléatoire envisagé initialement n’est pas conservé : aucune
credential partageable n’est créée pour une délégation.

## Modes de boutique

| Mode | Catalogue anonyme | Création libre de compte | Compte autorisé |
|---|---|---|---|
| `invite_only` (défaut) | Non, écran privé sans branding | Non | Session storefront activée ou délégation Magrit |
| `self_signup` (transitoire) | Oui | Ancien parcours gelé | Session storefront ou compatibilité legacy pendant UM8 |

Le modèle cible est `invite_only`. Le mode `self_signup` reste lisible pendant
la migration mais ne doit plus être choisi pour une nouvelle boutique avant sa
refonte fonctionnelle sur les identités storefront.

## Invariants

1. Une boutique privée ne révèle ni nom, ni logo, ni catalogue, ni prix avant
   autorisation.
2. La page privée ne propose jamais de création libre de compte.
3. Une session storefront ne vaut que pour son `shop_id`.
4. Un compte boutique n’accorde aucun accès au dashboard Magrit.
5. Une session Magrit ne devient une identité boutique que par une délégation
   explicite et auditée.
6. Toute commande storefront référence `shop_customer_account_id`. En mode
   délégué, `acted_by_magrit_user_id` conserve également l’opérateur.
7. Les secrets, credentials et tokens storefront restent dans le schéma
   `private` ou dans des cookies HttpOnly ; React ne manipule aucun token.
8. Les médias stockés en base utilisent une référence portable
   `/storage/v1/object/...`, jamais l’origine Docker ou distante complète.

## Transition `shop_only`

`tenant_members.access_scope='shop_only'` est un modèle historique :

- UM7 crée un `shop_customer_account` par `(boutique, email)` et rattache les
  commandes historiques ;
- le rapport est visible dans « Utilisateurs et rôles » pour les gestionnaires ;
- UM8.1 interdit toute nouvelle invitation ou attribution `shop_only` ;
- les lignes existantes restent temporairement lisibles ;
- elles peuvent uniquement être converties vers `magrit_full` ;
- leur suppression définitive attend la validation du rapport sur la base
  distante.

## Administration

- **Utilisateur Magrit** : `/t/<slug>/dashboard/users`.
- **Compte client boutique** : éditeur de la boutique, section « Comptes clients
  de cette boutique ».
- **Activation client** : lien à usage unique ; si l’email n’est pas configuré,
  l’interface affiche toujours le lien manuel à transmettre.
- **Délégation** : bouton « Se connecter à la boutique » dans l’éditeur.

## Validation manuelle minimale

1. Ouvrir une boutique `invite_only` déconnecté : aucune identité de marque et
   aucun catalogue.
2. Vérifier qu’aucun bouton de création de compte n’est proposé.
3. Créer un compte client depuis l’éditeur et transmettre son lien d’activation.
4. Activer le compte puis se connecter : accès à cette boutique uniquement.
5. Avec le même email, créer un compte dans une seconde boutique : deux comptes
   et deux sessions indépendantes.
6. Depuis Magrit, utiliser « Se connecter à la boutique » : bandeau délégué,
   commande attribuée au compte boutique et acteur Magrit présent dans l’audit.
7. Depuis « Utilisateurs », vérifier que l’invitation ne propose plus le type
   d’accès Boutique(s).

## Frontière API-first

Le navigateur passe par `/api/v1`. Les lectures privées, créations de comptes,
activations, délégations et commandes ne sont pas des appels PostgREST directs.
Les contrôles d’autorisation sont répétés côté serveur et les réponses d’erreur
respectent Problem Details.
