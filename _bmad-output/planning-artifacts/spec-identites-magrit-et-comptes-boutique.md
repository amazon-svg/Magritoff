---
id: SPEC-IDENTITY-STORE-01
title: Séparation des utilisateurs Magrit et des comptes boutique
date: 2026-08-12
updated: 2026-08-16
status: in_progress
target_epic: EPIC-UM-STORE-IDENTITY
decision_owner: produit
implementation: um1_api_delivered
---

# Spécification — Identités Magrit et comptes boutique séparés

## 1. Statut de cette spécification

Cette spécification formalise la cible produit. UM0 et UM1.1 à UM1.4 ont été
livrés le 16 août 2026 : ADR, module, contrats, table, service métier, accès
workspace par capability, routes de gestion `GET/POST` et première section de
gestion des comptes dans l’éditeur de boutique. Ces routes et cette interface ne
créent aucune session storefront. L’authentification boutique, les invitations,
le compte miroir et la délégation ne sont pas encore livrés. Chaque vague
suivante doit être découpée en stories BMAD exécutables avant son implémentation.

## 2. Décisions produit figées

1. Les utilisateurs Magrit et les utilisateurs boutique forment deux
   populations strictement séparées.
2. Il n’existe aucun profil mixte.
3. Un compte client boutique est identifié par le couple
   `(boutique, email normalisé)`.
4. La même adresse email utilisée dans deux boutiques correspond à deux comptes
   différents et indépendants.
5. Les mots de passe, invitations, paniers, commandes, préférences et sessions
   ne sont jamais partagés entre deux boutiques.
6. Un utilisateur Magrit peut ouvrir une boutique avec « Se connecter comme »,
   sans fusionner son identité avec celle du compte boutique.
7. Depuis une boutique, l’action « Créer un utilisateur pour moi » crée un
   compte boutique propre à cette boutique avec le nom et l’email de
   l’utilisateur Magrit.
8. L’interface Magrit expose une action principale unique « Se connecter à la
   boutique ». Elle garantit d’abord l’existence du compte miroir, puis démarre
   immédiatement la délégation. Les deux opérations restent distinctes côté
   domaine et audit.

## 3. Terminologie

### Utilisateur Magrit

Identité interne autorisée à utiliser les surfaces `workspace` et/ou
`backoffice`. Ses rôles possibles comprennent notamment Owner, Admin,
Validateur et Producteur.

### Compte boutique

Identité client limitée à une seule boutique. Elle utilise les surfaces
`storefront` et `customer-portal`. Elle n’est pas membre de l’équipe Magrit du
tenant et ne reçoit aucun rôle interne.

### Délégation

Session temporaire et auditée pendant laquelle un utilisateur Magrit utilise
une boutique sous l’identité fonctionnelle d’un compte boutique. L’acteur réel
et le compte joué restent distincts dans tous les journaux.

## 4. Invariants du domaine

```text
Compte boutique = boutique_id + email_normalisé
```

- contrainte d’unicité obligatoire sur `(shop_id, normalized_email)` ;
- une session boutique contient exactement un `shop_id` et un
  `shop_customer_account_id` ;
- une session boutique ne permet jamais de changer de boutique ;
- aucune recherche globale par email ne doit révéler les autres boutiques dans
  lesquelles cette adresse possède un compte ;
- le nom est une donnée de profil, pas une clé d’identité ;
- toute commande boutique référence le compte boutique, jamais directement un
  membre Magrit ;
- en délégation, toute écriture auditée conserve également l’utilisateur Magrit
  ayant réellement déclenché l’action.

## 5. Modèle de données cible indicatif

### `shop_customer_accounts`

- `id uuid primary key`
- `shop_id uuid not null`
- `email text not null`
- `normalized_email text not null`
- `full_name text not null`
- `auth_subject_id uuid unique`
- `status` : `delegated_only | invited | active | suspended`
- `created_by_magrit_user_id uuid null`
- `created_at`, `activated_at`, `suspended_at`
- `unique (shop_id, normalized_email)`

### `shop_customer_delegations`

- `id uuid primary key`
- `shop_id uuid not null`
- `shop_customer_account_id uuid not null`
- `actor_magrit_user_id uuid not null`
- `issued_at`, `expires_at`, `revoked_at`
- `reason` et métadonnées d’audit

### Références métier à migrer

- commandes, devis boutique, paniers persistants, adresses et préférences vers
  `shop_customer_account_id` ;
- ajout de `acted_by_magrit_user_id` ou d’un événement d’audit équivalent pour
  les actions effectuées par délégation.

Le modèle ne contient pas de relation multi-boutiques pour les comptes clients.

## 6. Authentification storefront

Supabase Auth impose une identité email globalement unique alors que ce modèle
autorise la même adresse dans plusieurs boutiques et pour un utilisateur Magrit.
Le storefront ne doit donc pas appeler Supabase Auth directement.

Le BFF reçoit le contexte de boutique, l’email et le secret, résout le compte par
`(shop_id, normalized_email)`, puis utilise un identifiant Auth technique unique
et non exposé. L’email métier reste stocké sur le compte boutique.

Conséquences :

- connexion et récupération de mot de passe toujours initiées depuis une
  boutique précise ;
- messages neutres ne révélant pas l’existence du compte ;
- envoi des emails d’activation et de récupération par le port email Magrit ;
- aucun identifiant Auth technique renvoyé au navigateur ;
- session storefront distincte de la session Magrit et limitée à une boutique.

## 7. Parcours unifié « Se connecter à la boutique »

Cette action est le parcours nominal depuis la gestion d’une boutique Magrit.
Elle combine « Créer un utilisateur pour moi » lorsque nécessaire et « Se
connecter comme » sans obliger l’utilisateur à comprendre ces deux étapes.

1. L’utilisateur Magrit choisit « Se connecter à la boutique ».
2. Le serveur vérifie le tenant, la boutique, la capability de délégation et
   l’état de la boutique.
3. Il normalise l’email Magrit et recherche le compte miroir par
   `(shop_id, normalized_email)`.
4. Si le compte n’existe pas, il le crée en état `delegated_only` avec le nom et
   l’email métier de l’utilisateur Magrit.
5. Il crée ensuite une délégation courte pour ce compte.
6. La boutique s’ouvre, de préférence dans un nouvel onglet, avec le bandeau de
   délégation permanent.

L’orchestration est idempotente sur la création du compte. Si le compte est créé
mais que l’émission de la délégation échoue, une nouvelle tentative réutilise ce
compte et ne produit aucun doublon. Aucune session storefront partielle ne doit
être retournée au navigateur.

L’interface peut conserver une action avancée « Se connecter comme » pour jouer
un autre compte client existant. « Créer un utilisateur pour moi » n’a pas à
rester une action primaire visible si le parcours unifié est disponible.

### 7.1 Primitive « Créer un utilisateur pour moi »

Préconditions : utilisateur Magrit authentifié, boutique appartenant à son
tenant et capability dédiée à la délégation.

1. L’utilisateur ouvre la gestion d’une boutique.
2. Il choisit « Créer un utilisateur pour moi ».
3. Le serveur normalise l’email Magrit et recherche le couple boutique/email.
4. Si le compte existe, aucun doublon n’est créé et l’interface propose
   « Se connecter comme ».
5. Sinon, un compte boutique `delegated_only` est créé avec le même nom et le
   même email métier.
6. Un mot de passe aléatoire cryptographiquement robuste est généré côté
   serveur pour l’identité Auth technique. Il n’est ni affiché, ni journalisé,
   ni transmis au navigateur.
7. Le compte devient immédiatement utilisable par délégation.
8. Une activation autonome ultérieure passe par une invitation ou une
   récupération de mot de passe propre à cette boutique.

La création est idempotente sur `(shop_id, normalized_email)`.

## 8. Primitive « Se connecter comme »

1. Depuis le backoffice d’une boutique, un utilisateur Magrit sélectionne un
   compte client existant ou son compte miroir.
2. Le serveur vérifie le tenant, la boutique, la capability et l’état du compte.
3. Il crée une délégation courte, signée, révocable et à usage limité.
4. La boutique s’ouvre de préférence dans un nouvel onglet.
5. Un bandeau permanent affiche le compte joué, l’acteur réel et l’action
   « Quitter ce mode ».
6. Quitter ou expirer la délégation restitue la session Magrit sans demander une
   nouvelle authentification.

La délégation ne doit jamais reposer sur la communication ou la réutilisation du
mot de passe du compte boutique.

## 9. Sécurité et audit obligatoires

- capability dédiée, par exemple `can_impersonate_shop_customer` ;
- délégation limitée à une boutique du tenant de l’acteur ;
- durée courte, révocation explicite et protection contre la réutilisation ;
- jeton en cookie `HttpOnly`, `Secure`, `SameSite` approprié, jamais dans le
  stockage local ;
- journalisation du début, de la fin et des opérations sensibles ;
- conservation systématique de `actor_magrit_user_id` et
  `shop_customer_account_id` ;
- interdiction de modifier les moyens d’authentification du client pendant une
  délégation ;
- protection CSRF et rotation après élévation de contexte ;
- aucune clé `service_role` ou information Auth technique dans le navigateur.

## 10. Conséquences sur le modèle actuel

- `tenant_members` devient réservé aux utilisateurs Magrit ;
- `shop_only` n’est plus un type d’appartenance tenant cible ;
- `allowed_shop_ids` n’est plus utilisé pour représenter les clients boutique ;
- le rôle Acheteur disparaît du catalogue de rôles Magrit ;
- les invitations Magrit et les invitations boutique deviennent deux parcours
  et deux contrats distincts ;
- les anciens membres `shop_only` doivent être migrés vers un compte par
  boutique autorisée ; un membre lié à trois boutiques produit donc trois
  comptes boutique indépendants.

La migration doit préserver les commandes historiques et produire un rapport
des collisions `(boutique, email)` avant d’activer les contraintes d’unicité.

## 11. Contrats API cibles indicatifs

- `GET /api/v1/tenants/{tenantId}/shops/{shopId}/customers`
- `POST /api/v1/tenants/{tenantId}/shops/{shopId}/customers`
- `POST /api/v1/tenants/{tenantId}/shops/{shopId}/customers/self-mirror`
- `POST /api/v1/tenants/{tenantId}/shops/{shopId}/customers/self-delegation`
- `POST /api/v1/tenants/{tenantId}/shops/{shopId}/customers/{customerId}/delegate`
- `DELETE /api/v1/storefront/delegation/current`
- `POST /api/v1/storefront/{shopSlug}/session`
- `POST /api/v1/storefront/{shopSlug}/password-recovery`
- endpoints d’invitation boutique séparés des invitations tenant Magrit.

Les chemins sont indicatifs ; les contrats définitifs doivent être validés dans
les stories d’implémentation.

## 12. Découpage BMAD futur

- **UM0 — ADR et contrats** : formaliser les deux populations et leurs sessions.
- **UM1 — Comptes boutique** : table, unicité boutique/email, repository et API.
- **UM2 — Auth storefront BFF** : connexion, déconnexion, activation et reset.
- **UM3 — Invitations boutique** : parcours et emails séparés de Magrit.
- **UM4 — Compte miroir** : primitive « Créer un utilisateur pour moi »
  idempotente.
- **UM5 — Délégation** : action unifiée « Se connecter à la boutique »,
  primitive « Se connecter comme », bandeau, sortie et audit.
- **UM6 — Références métier** : commandes, devis, paniers et préférences.
- **UM7 — Migration** : conversion des membres `shop_only` existants.
- **UM8 — Nettoyage** : retrait de `shop_only`, `allowed_shop_ids` client et du
  rôle Acheteur dans Magrit.

UM0 et UM1 peuvent avancer parallèlement aux travaux fournisseurs AF24. La
migration générale des surfaces et la suppression de Supabase Auth du navigateur
doivent attendre la stabilisation du contrat UM2.

## 13. Critères d’acceptation de l’epic

1. Une même adresse peut posséder deux comptes totalement indépendants dans deux
   boutiques.
2. Changer le mot de passe dans une boutique n’affecte aucune autre boutique.
3. Une session boutique ne peut lire aucune donnée d’une autre boutique.
4. Un utilisateur Magrit n’est jamais considéré comme client sans création
   explicite d’un compte miroir dans la boutique concernée.
5. « Créer un utilisateur pour moi » ne crée jamais de doublon dans une même
   boutique.
6. « Se connecter comme » ne connaît ni ne révèle le mot de passe du client.
7. Chaque action déléguée identifie le client joué et l’acteur Magrit réel.
8. Les comptes clients n’apparaissent pas dans la gestion de l’équipe Magrit et
   réciproquement.
9. Les anciens comptes `shop_only` sont migrés sans perte de commandes.
10. « Se connecter à la boutique » crée le compte miroir uniquement s’il manque
    puis ouvre la délégation en une seule action utilisateur.
11. Réessayer après un échec de délégation ne crée aucun compte miroir
    supplémentaire.

## 14. Arbitrages restant à faire avant développement

- actions autorisées pendant une délégation : navigation seule, panier, devis,
  commande réelle ou commande marquée comme test ;
- durée exacte d’une délégation et éventuelle ré-authentification Magrit ;
- activation autonome automatique ou uniquement sur invitation explicite ;
- comportement lors de la suppression, désactivation ou duplication d’une
  boutique ;
- politique de conservation des audits et données client.
