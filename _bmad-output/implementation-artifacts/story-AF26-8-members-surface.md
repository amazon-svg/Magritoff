---
id: AF26.8
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [AF26.7]
---
# AF26.8 — Déclarer la sortie workspace de Members

## Résultat livré

- manifeste du module Members, adossé au service API existant ;
- feature et capability d'administration des membres Magrit du tenant ;
- route lazy et navigation « Utilisateurs » fournies par le registre ;
- conservation du `data-testid` de navigation pour la recette existante ;
- suppression de la déclaration correspondante dans `routes.tsx`.

L'écran orchestre encore les modules Invitations et Roles et conserve
temporairement le modèle brownfield `shop_only`. Cette tranche ne transforme
pas ces membres en comptes boutique : la séparation stricte des identités et
le mécanisme « se connecter comme » restent régis par la spécification dédiée
`spec-identites-magrit-et-comptes-boutique.md`.
