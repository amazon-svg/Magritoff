---
id: AF31.5
epic: EPIC-8-API-FIRST
priority: P2
status: done
branch: feat/storefront-identity-um2
depends_on: [AF31.4]
---

# AF31.5 — Isoler la gestion des utilisateurs Magrit

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

| TF | Cas de test | Statut | Priorité | Parcours | Cible | Stories liées |
|---|---|---|---|---|---|---|
| [TF-159](https://app.notion.com/3c6d0131973c8168b135d5ef1e8ad647) | UM — Page Utilisateurs : deux sections (Équipe Magrit / Utilisateurs des boutiques) et deux parcours d invitation distincts | À jouer | P1 — Importante | P02 — Gestion utilisateurs | B5 | UM3 (1ee36bf), MUX1, AF31-5, AF32-1 |

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Intention

La page Utilisateurs chargeait et transformait directement membres et invitations,
puis appelait les mutations de deux modules depuis ses gestionnaires UX. Ce lot
ne change ni la distinction Magrit/boutique, ni la modale de création d'invitation.

## Résultat

- `useMagritUsersManagement` charge membres et invitations en parallèle ;
- une panne d'une source ne masque pas les données disponibles de l'autre ;
- les réponses tardives sont ignorées après changement d'espace ;
- changement de rôle, retrait, renvoi et révocation sont orchestrés hors vue ;
- confirmations, alertes et lien manuel restent sous le contrôle de l'écran ;
- la modale de création et son renouvellement de session restent hors de ce lot.

## Validation

- tests unitaires des adaptateurs membre et invitation ;
- garde-fous API-first et séparation des identités ;
- 176 fichiers et 1 256 tests passés ;
- typecheck modulaire et build de production passés.
