---
id: AF30.14
epic: EPIC-8-API-FIRST
priority: P2
status: done
branch: feat/storefront-identity-um2
depends_on: [AF30.13]
---
# AF30.14 — Isoler la persistance des devis imprimés

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Intention

`QuoteModal` et `CartButton` composent directement le client Quotes pour
enregistrer les devis imprimés. Les vues doivent conserver le rendu et la
fenêtre navigateur, mais déléguer la persistance workspace.

## Critères d'acceptation

- composition Quotes portée par un hook partagé ;
- persistance individuelle et groupée inchangée ;
- logique d'impression conservée dans les vues ;
- composants sans client Quotes ;
- garde-fou d'architecture, tests, typecheck modulaire et build verts.

## Résultat livré

- `useQuotePersistence` compose la façade Quotes et expose une commande de
  persistance workspace ;
- `QuoteModal` et `CartButton` ne connaissent plus le client Quotes ;
- le rendu HTML, le choix du gabarit et l'ouverture des fenêtres d'impression
  restent inchangés ;
- le garde-fou API-first couvre les deux vues.

## Validation

- 169 fichiers de tests passés ;
- 1 230 tests passés, 0 ignoré, 0 échec ;
- typecheck modulaire et build de production passés.
