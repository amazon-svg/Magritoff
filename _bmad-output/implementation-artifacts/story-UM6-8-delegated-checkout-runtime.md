---
id: UM6.8
epic: EPIC-UM-STORE-IDENTITY
status: done
branch: feat/storefront-identity-um2
depends_on: [UM6.7]
---
# UM6.8 — Stabiliser le checkout en mode délégué

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

| TF | Cas de test | Statut | Priorité | Parcours | Cible | Stories liées |
|---|---|---|---|---|---|---|
| [TF-153](https://app.notion.com/3c6d0131973c81f8a01dc2e0fc0574b1) | P12 — Délégation « Se connecter à la boutique » : compte miroir, bandeau permanent, commande tracée, sortie sans perdre la session Magrit | À jouer | P0 — Critique | P12 — Comptes clients boutique | B5 | UM4-1, UM5-1..3, UM6-8, invariants 5-6 |

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Problème observé

Depuis le checkout, le bouton « Passer commande » du drawer renaviguait vers
la route déjà active et ne déclenchait aucune action. Le drawer masquait en
outre le bouton « Commander » porté par le récapitulatif.

Le scénario SQL de cycle de vie storefront dépendait également d'un compte
`active` préexistant et pouvait donc échouer sur une base locale valide ne
contenant que des comptes `delegated_only`.

## Résultat

- le drawer se ferme à l'entrée du checkout et après confirmation ;
- son CTA soumet réellement si le checkout est déjà actif ;
- la création déléguée conserve séparément le compte boutique et l'acteur
  Magrit dans l'audit ;
- le scénario de session crée ses propres fixtures dans une transaction
  rollbackée ;
- `pnpm test:storefront:sql` valide le cycle réel sur Supabase local : session,
  délégation, création, portail, brouillon, annulation et audit.

## Validation

- typecheck ;
- tests d'architecture ;
- tests applicatifs ;
- build production ;
- sept scénarios SQL transactionnels sur Supabase local.
