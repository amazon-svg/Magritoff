---
id: AF26.3
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [AF26.2]
---
# AF26.3 — Déclarer les sorties multi-surfaces du module Quotes

## Résultat livré

- storefront : cible déclarative de création d’un devis depuis la boutique ;
- portail client : consultation des devis du compte ;
- workspace : bibliothèque, file d’attente et éditeur en routes lazy ;
- backoffice : contribution pour la validation des devis en attente ;
- navigation « Devis » et « Devis en attente » alimentée par le registre ;
- retrait des trois déclarations correspondantes de `routes.tsx`.

Les gabarits de devis restent volontairement dans le module QuoteTemplates et
ne sont pas absorbés par Quotes. Ils seront déclarés dans un lot distinct.

## Rectification AF27.3

L'audit du runtime boutique a confirmé qu'aucun écran ne crée actuellement un
devis client : le bouton historique `productCardQuoteBtn` ajoute au panier et
le devis Clariprint ne fait que calculer un prix. La route storefront `quote`
est donc `planned`, pas active. La contribution backoffice est également
planifiée tant que son composition root n'existe pas.
