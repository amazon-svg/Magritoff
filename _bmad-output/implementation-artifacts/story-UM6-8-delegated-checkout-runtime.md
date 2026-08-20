---
id: UM6.8
epic: EPIC-UM-STORE-IDENTITY
status: done
branch: feat/storefront-identity-um2
depends_on: [UM6.7]
---
# UM6.8 — Stabiliser le checkout en mode délégué

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
