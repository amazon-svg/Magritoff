---
id: AF26.3
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [AF26.2]
---
# AF26.3 — Déclarer les sorties multi-surfaces du module Quotes

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

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
