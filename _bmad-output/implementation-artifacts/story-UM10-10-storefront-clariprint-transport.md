---
id: UM10.10
epic: EPIC-UM-STORE-IDENTITY
status: done
branch: feat/storefront-identity-um2
depends_on: [UM10.7, UM10.9]
---
# UM10.10 — Isoler le transport Clariprint du storefront

## Problème

La route de devis Clariprint est publique et ne dépend pas d’une identité
Magrit. Pourtant, le catalogue, la fiche produit et le configurateur boutique
utilisaient encore la passerelle construite sur le transport workspace. Un
bearer Magrit pouvait donc être joint inutilement aux calculs de prix.

## Résultat

- le composition root navigateur construit deux passerelles Clariprint ;
- l’atelier utilise la passerelle workspace authentifiée ;
- le storefront utilise une passerelle construite sur le transport anonyme ;
- catalogue, fiche produit, overlay et page gamme propagent explicitement cette
  passerelle jusqu’au moteur partagé.

## Validation

- garde-fou API-first sur les deux compositions ;
- garde-fou storefront sur tous les consommateurs Clariprint ;
- tests du configurateur, typecheck, suite Vitest et build de production.
