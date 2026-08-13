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

- storefront : création d’un devis depuis la boutique ;
- portail client : consultation des devis du compte ;
- workspace : bibliothèque, file d’attente et éditeur en routes lazy ;
- backoffice : contribution pour la validation des devis en attente ;
- navigation « Devis » et « Devis en attente » alimentée par le registre ;
- retrait des trois déclarations correspondantes de `routes.tsx`.

Les gabarits de devis restent volontairement dans le module QuoteTemplates et
ne sont pas absorbés par Quotes. Ils seront déclarés dans un lot distinct.
