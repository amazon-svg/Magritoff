---
id: AF31.6
epic: EPIC-8-API-FIRST
priority: P2
status: done
branch: feat/storefront-identity-um2
depends_on: [AF31.5]
---

# AF31.6 — Isoler la création d'invitation Magrit

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

La modale d'invitation chargeait les rôles, renouvelait la session, reconstruisait
un client authentifié et envoyait la commande. Cette orchestration sensible ne
devait pas rester dans le composant de formulaire.

## Résultat

- `useMagritInvitationManagement` charge les options de rôles ;
- les réponses tardives sont ignorées après fermeture ou changement d'espace ;
- la session est renouvelée immédiatement avant la création ;
- une erreur dédiée distingue l'expiration de session des problèmes API ;
- la modale conserve validation, sélection, feedback email et lien manuel ;
- aucun composant dashboard ne dépend désormais directement des clients de modules.

## Validation

- test de l'erreur de session et garde-fous API-first ;
- 177 fichiers et 1 257 tests passés ;
- typecheck modulaire et build de production passés.
