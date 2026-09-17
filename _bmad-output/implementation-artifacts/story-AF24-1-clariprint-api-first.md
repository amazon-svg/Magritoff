---
id: AF24.1
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [AF23.2b]
---
# AF24.1 — Sortir les devis Clariprint du navigateur

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Résultat livré

- nouveau module `clariprint` avec contrat, client API, service et port de
  fournisseur ;
- route `POST /api/v1/clariprint/quote` consommée par le configurateur et les
  écrans boutique ;
- appel direct à `QuoteRequest` réalisé uniquement dans l’adaptateur serveur ;
- identifiants Clariprint exclusivement lus dans l’environnement Edge ;
- normalisation de la quantité et de la livraison par défaut conservée ;
- filtrage serveur des prix absents, non numériques ou négatifs ;
- repli fonctionnel historique sur le prix marché conservé dans l’UX ;
- adaptateur navigateur déplacé de `src/server` vers `src/adapters/http` et
  débarrassé de toute URL Supabase ou fournisseur.

## Accès storefront

La route reste publique afin de préserver le calcul de prix dans les boutiques
`self_signup` consultables sans compte. Cette décision conserve le comportement
existant. Une protection de quota/rate-limit devra être ajoutée au niveau du
gateway public avant une ouverture à fort trafic.

## Compatibilité transitoire

L’ancien endpoint `make-server-e3db71a4/clariprint-quote` reste présent mais
n’est plus appelé par `src/app`. Sa suppression sera incluse dans le nettoyage
des Edge Functions legacy après validation de la recette distante.
