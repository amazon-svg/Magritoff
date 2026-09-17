---
id: UM10.33
epic: EPIC-UM-STORE-IDENTITY
status: done
branch: feat/storefront-identity-um2
depends_on: [UM10.32]
---
# UM10.33 — Isoler le reçu de commande storefront

<!-- notion-functional:begin — section générée depuis Notion, ne pas modifier à la main (docs/spec/STORY_DOCUMENT_STANDARD.md) -->
## Périmètre fonctionnel — story Notion

> Aucune story du Sprint Board Notion n'est rattachée à ce story document : c'est une story née dans le dépôt (refonte technique, lot d'architecture ou correctif). Son périmètre est celui décrit ci-dessous. Si elle relève d'une story Notion, renseigner ce rattachement et régénérer cette section.

### Cas de test fonctionnels rattachés (Notion)

_Aucun cas de test rattaché dans la base Notion « 🧪 Cahiers de tests fonctionnels Magrit »._

---

_Fin du périmètre fonctionnel. La suite du document porte sur l'implémentation._
<!-- notion-functional:end -->

## Résultat

- `useStorefrontOrderReceipt` porte la lecture du détail de commande ;
- toute requête est annulée au changement de reçu ou au démontage ;
- les états vide, chargement et erreur sont centralisés ;
- `PortalThankYou` ne connaît plus le client Orders et conserve uniquement le
  focus accessible, les calculs d'affichage et le rendu du reçu.

## Validation

- garde-fou d'architecture sur la façade Orders anonyme ;
- tests ciblés du portail et du format de confirmation ;
- suite Vitest complète, typecheck et build de production.
