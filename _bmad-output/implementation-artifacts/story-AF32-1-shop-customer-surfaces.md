---
id: AF32.1
epic: EPIC-8-API-FIRST
priority: P2
status: done
branch: feat/storefront-identity-um2
depends_on: [AF31.6]
---

# AF32.1 — Attribuer les surfaces au module comptes boutique

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

Le module `shop-customers` déclarait quatre sorties dans son manifeste mais ne
contribuait à aucune surface. Les chemins d'activation et de récupération de mot
de passe restaient donc codés directement par le host storefront.

## Résultat

- activation et réinitialisation sont des routes storefront actives du module ;
- le host résout leurs chemins depuis le registre de contributions ;
- portail et workspace sont explicitement reconnus comme montages intégrés ;
- la future administration des comptes boutique est déclarée au backoffice avec
  `availability: planned` et n'est pas exposée dans le runtime actuel ;
- les contributions restent indépendantes de React et du fournisseur.

## Validation

- tests du registre, des chemins runtime et des frontières architecturales ;
- 177 fichiers et 1 257 tests passés ;
- typecheck modulaire et build de production passés.
