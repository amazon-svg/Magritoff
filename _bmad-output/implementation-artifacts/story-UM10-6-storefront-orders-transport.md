---
id: UM10.6
epic: EPIC-UM-STORE-IDENTITY
status: done
branch: feat/storefront-identity-um2
depends_on: [UM6.2, UM10.5]
---
# UM10.6 — Isoler le transport Orders du storefront

## Problème

Les composants de commandes boutique utilisaient la même instance
`OrdersApiClient` que le workspace. Une session boutique restait correctement
contrôlée côté serveur, mais le navigateur pouvait joindre aussi le bearer de
l’utilisateur Magrit lorsqu’il était connecté dans le même navigateur. Cette
ambiguïté de transport contredisait la séparation stricte des identités.

## Résultat

- le composition root expose un client Orders storefront construit avec le
  transport anonyme ;
- liste, création, renouvellement, édition, confirmation et annulation utilisent
  uniquement ce client et le cookie boutique HttpOnly ;
- l’historique reçoit explicitement le client de sa surface appelante ;
- le tableau de bord conserve le client Orders authentifié Magrit.

Le client « anonyme » signifie ici « sans en-tête Authorization Magrit ». Les
cookies same-origin restent transmis normalement et le BFF demeure responsable
de la résolution de la session storefront.

## Validation

- garde-fou d’architecture couvrant tous les composants storefront Orders ;
- tests d’architecture API-first ;
- typecheck modulaire, suite Vitest et build de production.
