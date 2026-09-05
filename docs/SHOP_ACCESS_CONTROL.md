# Contrôle d’accès des boutiques

> Source de vérité fonctionnelle depuis UM8.1 (2026-08-17). Complétée par
> E10.5 (2026-09-01) : le type `shop_customer` et son lien optionnel avec un
> interlocuteur de gestion (`customer_contacts`, E10.4).

## Trois types de compte, jamais superposables

Le modèle de droits Magrit distingue **trois types de compte**, jamais deux à
la fois pour la même identité `auth.users` (garanti en base par des triggers
d’exclusivité symétriques, pas seulement déclaré applicativement) :

| Type | Table porteuse | Périmètre | Création |
|---|---|---|---|
| `magrit_full` | `tenant_members.access_scope` | Dashboard, production, validation, administration | Invitation depuis « Utilisateurs et rôles » |
| `shop_only` (legacy, gelé UM8) | `tenant_members.access_scope` | Ancien accès boutique porté par un membre interne — plus jamais créé, en transition vers `shop_customer` | Aucune (UM8.1 interdit toute nouvelle attribution) |
| `shop_customer` | `shop_customer_accounts` + credentials privés storefront | Une seule boutique | Éditeur de la boutique, auto-inscription `self_signup`, **ou ouverture explicite depuis un interlocuteur (E10.5)** |

`magrit_full`/`shop_only` sont l’axe **UM1** (deux profils de membres
*internes* du tenant, `tenant_members`). `shop_customer` est un axe
**différent** : un compte de *client final* d’une boutique, qui n’est jamais
un membre du tenant. Les deux axes ne se confondent pas et ne se convertissent
jamais l’un en l’autre par une route applicative — voir « Exclusivité en
base » ci-dessous.

## Deux populations strictement séparées

| Population | Identité | Périmètre | Création |
|---|---|---|---|
| Utilisateur Magrit (`magrit_full`/`shop_only`) | `auth.users` + `tenant_members` | Dashboard, production, validation, administration | Invitation depuis « Utilisateurs et rôles » |
| Client boutique (`shop_customer`) | `shop_customer_accounts` + credentials privés storefront | Une seule boutique | Éditeur de la boutique, puis lien d’activation |

Un email identique dans deux boutiques correspond à deux comptes clients
distincts. Un utilisateur Magrit n’est jamais automatiquement un client
boutique.

## E10.5 — lien optionnel avec un interlocuteur de gestion

`shop_customer_accounts.customer_contact_id` (nullable) relie, quand il est
renseigné, un compte client boutique à l’interlocuteur (`customer_contacts`,
E10.4) qui en a demandé l’ouverture depuis la fiche client. Deux origines
distinctes pour un compte `shop_customer`, jamais confondues :

- **sans lien de gestion** : auto-inscription `self_signup`, migration
  legacy `shop_only` (UM7), délégation « Se connecter à la boutique » (UM2) —
  `customer_contact_id` reste `null` ;
- **avec lien de gestion** : ouverture explicite depuis la fiche d’un
  interlocuteur, action **distincte** de sa création (CA2 : un interlocuteur
  E10.4 ne porte, par défaut, aucun compte).

Contraintes posées EN BASE (migration `20260901000400`), pas seulement
vérifiées côté service :

1. Un interlocuteur n’a qu’un seul compte `shop_customer` par boutique
   (index unique partiel `(shop_id, customer_contact_id)`) — il peut en avoir
   un par boutique si le tenant en possède plusieurs.
2. L’interlocuteur et la boutique liée appartiennent obligatoirement au même
   tenant (trigger `enforce_shop_customer_contact_tenant_match`).
3. Révoquer l’accès délie l’interlocuteur du compte (`customer_contact_id`
   repasse à `null`) et suspend ce dernier — l’historique de commandes du
   compte n’est jamais supprimé.

### Exclusivité en base (`tenant_members` ⟺ `shop_customer_accounts`)

Aucune route ne convertit un compte d’un type vers l’autre, dans un sens ou
l’autre. La garantie n’est pas qu’applicative : deux triggers symétriques
refusent l’écriture qui ferait qu’un même `auth.users.id` apparaisse à la
fois comme `tenant_members.user_id` ET comme
`shop_customer_accounts.auth_subject_id` renseigné. Un compte `shop_customer`
qui atteindrait malgré tout `/api/v1/` reçoit `403 auth.scope_forbidden`
(`current_user_is_shop_customer()`, même primitive que celle utilisée par la
RLS) — la vraie barrière reste la RLS, ce code n’est qu’un diagnostic plus
précis que le refus générique « aucun espace accessible ».

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
| `self_signup` | Oui | Oui, au checkout | Session storefront directe ou délégation Magrit |

En `self_signup`, l’inscription crée atomiquement un compte, un credential et
une session propres à la boutique. Elle ne crée ni `auth.users`, ni
`tenant_members`, ni rôle Acheteur. Le mode `invite_only` reste le défaut et le
seul adapté aux catalogues privés.

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
9. Une auto-inscription est refusée hors d’une boutique active `self_signup` et
   ne révèle pas si l’email existe déjà.
10. La récupération de mot de passe part toujours du slug de la boutique,
    répond de façon identique pour tout email et révoque les anciennes sessions.
11. La recherche IA du storefront s’autorise avec le cookie de cette boutique,
    jamais avec un JWT Magrit. Une suggestion client reste éphémère ; seule une
    action de back-office peut publier durablement un produit au catalogue.
12. L’acceptation d’une invitation d’équipe Magrit aboutit dans l’espace
    `/t/:tenantSlug`, jamais directement dans une boutique. L’unique pont vers
    le storefront reste la délégation explicite « Se connecter à la boutique ».

## Transition `shop_only`

`tenant_members.access_scope='shop_only'` est un modèle historique :

- UM7 crée un `shop_customer_account` par `(boutique, email)` et rattache les
  commandes historiques ;
- le rapport est visible dans « Utilisateurs et rôles » pour les gestionnaires ;
- UM8.1 interdit toute nouvelle invitation ou attribution `shop_only` ;
- UM8.3 classe le rôle Acheteur historique en `storefront_legacy`, le masque
  des catalogues Magrit et bloque toute nouvelle assignation ou propagation ;
- les lignes existantes restent temporairement lisibles ;
- leur connexion historique affiche une demande d’activation et n’ouvre plus
  automatiquement `/shop/:slug` ;
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
- **Mot de passe oublié** : action sur le formulaire storefront ; lien valable
  une heure, à usage unique et limité à ce compte dans cette boutique.

## Validation manuelle minimale

1. Ouvrir une boutique `invite_only` déconnecté : aucune identité de marque et
   aucun catalogue.
2. Vérifier qu’aucun bouton de création de compte n’est proposé.
3. Créer un compte client depuis l’éditeur et transmettre son lien d’activation.
4. Activer le compte : une session boutique s’ouvre et donne immédiatement
   accès à cette boutique uniquement, sans seconde saisie du mot de passe.
5. Avec le même email, créer un compte dans une seconde boutique : deux comptes
   et deux sessions indépendantes.
6. Depuis Magrit, utiliser « Se connecter à la boutique » : bandeau délégué,
   commande attribuée au compte boutique et acteur Magrit présent dans l’audit.
7. Depuis « Utilisateurs », vérifier que l’invitation ne propose plus le type
   d’accès Boutique(s).
8. Sur une boutique `self_signup`, choisir « Créer un compte » au checkout : la
   session s’ouvre et la commande reste limitée à ce nouveau compte.

## Frontière API-first

Le navigateur passe par `/api/v1`. Les lectures privées, créations de comptes,
activations, délégations et commandes ne sont pas des appels PostgREST directs.
Les contrôles d’autorisation sont répétés côté serveur et les réponses d’erreur
respectent Problem Details.
