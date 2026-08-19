---
id: AF30.4
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: feat/storefront-identity-um2
depends_on: [AF30.3, UM8.3]
---
# AF30.4 — Isoler l'acceptation des invitations Magrit

## Intention

Le composant `AcceptInvitation` orchestre encore l'acceptation, le rechargement
de session, la recherche d'une boutique et la redirection. Cette dernière étape
réintroduit une ambiguïté entre utilisateur Magrit et compte boutique.

## Règles fonctionnelles

- une invitation `tenant_invitations` crée exclusivement un accès Magrit ;
- son acceptation redirige vers `/t/:tenantSlug`, jamais directement vers une
  boutique ;
- l'entrée dans une boutique depuis Magrit passe exclusivement par le parcours
  de délégation « Se connecter à la boutique » ;
- une erreur de correspondance d'email conserve le token afin de permettre un
  changement de compte ;
- la vue ne connaît aucun client API et ne décide pas de la destination.

## Critères d'acceptation

- orchestration extraite dans un hook dédié ;
- résolution de destination testée sans React ni réseau ;
- `AcceptInvitation` devient une vue pilotée par l'état du hook ;
- le client Shops n'est plus chargé par ce parcours ;
- tests, typecheck modulaire et build verts.

## Résultat livré

- `useMagritInvitationAcceptance` orchestre stockage du token, acceptation,
  rechargement de session, erreurs et redirection différée ;
- `AcceptInvitation` ne connaît plus Session ni Shops et reste une vue ;
- l'ancien helper d'acceptation a été retiré de `TenantContext` ;
- la destination Magrit est une fonction pure testée et ne construit aucune
  route boutique ;
- la règle est reportée dans la spécification d'identité et le guide d'accès.

## Validation

- 161 fichiers de tests passés ;
- 1 211 tests passés, 0 ignoré, 0 échec ;
- typecheck modulaire et build de production passés.
