---
id: AF27.1
epic: EPIC-8-API-FIRST
priority: P1
status: done
branch: refactor/api-first-foundation
depends_on: [AF26.15]
---
# AF27.1 — Exécuter les chemins host du portail

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Résultat livré

- racine `/shop/:slug/*` dérivée de la contribution storefront de Shops ;
- chemin checkout dérivé de la contribution storefront de Orders ;
- chemins commandes, devis et profil dérivés des contributions customer portal ;
- `shopUrl` et `parsePortalPath` utilisent les mêmes chemins déclaratifs ;
- tests de résolution runtime et garde-fou contre le retour des littéraux.

## Écart fonctionnel conservé

`quotes.storefront.create` déclare encore le chemin `quote`, mais `PublicShop`
ne possède aucune vue de création de devis correspondant à cette route. AF27.3
classe désormais explicitement cette contribution comme `planned` : elle reste
un contrat cible, mais ne peut plus être consommée par le runtime.
