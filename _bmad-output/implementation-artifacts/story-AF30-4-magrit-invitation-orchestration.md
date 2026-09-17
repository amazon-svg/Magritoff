---
id: AF30.4
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: feat/storefront-identity-um2
depends_on: [AF30.3, UM8.3]
---
# AF30.4 — Isoler l'acceptation des invitations Magrit

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

| TF | Cas de test | Statut | Priorité | Parcours | Cible | Stories liées |
|---|---|---|---|---|---|---|
| [TF-148](https://app.notion.com/3c6d0131973c81dc96ddc6468c9664b4) | UM — Règles serveur de l invitation Magrit (scope, profil, options admin, déjà membre, doublon) | OK | P0 — Critique | P02 — Gestion utilisateurs | B5 | UM1, migrations 20260824000100 / 000700 (api_create_tenant_invitation), AF30-4, AF31-6 |

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

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
