---
id: AF8
epic: EPIC-8-API-FIRST
priority: P0
status: done
branch: refactor/api-first-foundation
depends_on: [AF7.2]
---

# AF8 — Création des invitations via l’API Magrit

## Contexte

Le formulaire d’administration appelait directement l’Edge Function
`invite-member`. Le navigateur connaissait ainsi le fournisseur, son nom de
fonction et un payload historique contenant notamment `invited_by`. Une erreur
de gateway remontait en outre sous la forme générique « Edge Function returned
a non-2xx status code ».

## Résultat livré

- contrat fournisseur-agnostique `CreateInvitationCommand` et résultat typé ;
- client navigateur `InvitationsApiClient` ;
- service applicatif et port `InvitationsRepository` ;
- commande authentifiée `POST /api/v1/invitations` ;
- identité de l’invitant dérivée du JWT par la route, jamais du body client ;
- erreurs métier traduites en Problem Details (`401`, `403`, `409`, `422`,
  `502`) puis en messages français actionnables ;
- adaptateur Supabase isolé côté serveur ;
- suppression du formulaire historique mort et de l’appel direct
  `invite-member` dans le dashboard ;
- baseline de `DashboardUsers.tsx` abaissée de 10 à 9 références Supabase.

## Décision transitoire

L’adaptateur serveur délègue encore à `invite-member` pour préserver, pendant
la migration, sa transaction création + envoi et ses contrôles existants. Ce
détail n’est plus exposé au navigateur. Une story ultérieure internalisera
l’écriture dans le repository et supprimera cette Edge Function.

Les lectures des rôles et boutiques dans la modale, ainsi que le renvoi et la
révocation d’une invitation, restent brownfield et constituent la tranche
verticale suivante.

## Validation

- tests du client API et de la route (authentification, identité serveur,
  doublon) ;
- garde-fou d’architecture : aucune invocation Edge dans la modale et aucune
  réintroduction de `invite-member` dans le dashboard ;
- smoke local non authentifié : route chargée et Problem Details `401` attendu ;
- typecheck modulaire, suite complète et build de production.
